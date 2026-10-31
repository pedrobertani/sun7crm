import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { fixture, id } from './helpers/db.mjs';

test('segurança: entradas são dados e não alteram o escopo ou os comandos SQL', async (t) => {
  const { q, user, as, card } = await fixture(t);
  const payloads = [
    "Robert'); DROP TABLE public.crm_contacts;--",
    "' OR 1=1 --",
    "x'); SELECT pg_sleep(30); --",
    '<img src=x onerror=alert(1)>',
  ];
  await t.test('nomes, observações, títulos e catálogo preservam o texto literal', async () => {
    for (const value of payloads) {
      const contact = (
        await user(2, () =>
          q('select public.crm_save_contact($1,null,$2,null) as result', [
            id(100),
            { name: value, notes: value },
          ]),
        )
      ).rows[0].result;
      assert.equal(contact.name, value);
      assert.equal(contact.notes, value);
      const saved = await card(2, { contact_id: contact.id, title: value, source: value });
      assert.equal(saved.title, value);
      const found = await user(2, () =>
        q('select id from public.crm_contacts where name=$1', [value]),
      );
      assert.deepEqual(
        found.rows.map((row) => row.id),
        [contact.id],
      );
      const catalog = (
        await user(1, () =>
          q(
            "insert into public.crm_catalog_items(company_id,kind,name) values($1,'service',$2) returning name",
            [id(100), value],
          ),
        )
      ).rows[0];
      assert.equal(catalog.name, value);
    }
    assert.equal(
      (await user(4, () => q('select count(*)::int as n from public.crm_contacts'))).rows[0].n,
      1,
    );
    assert.equal(
      (await user(5, () => q('select count(*)::int as n from public.crm_contacts'))).rows[0].n,
      1,
    );
  });
  await t.test('JSON extra não injeta empresa, papel ou autoria em RPCs', async () => {
    for (const values of [
      { name: 'Teste', company_id: id(200) },
      { name: 'Teste', created_by: id(4) },
      { name: 'Teste', role: 'manager' },
      { name: 'Teste', "name='x';drop table crm_contacts;--": 'x' },
    ])
      await assert.rejects(
        user(2, () => q('select public.crm_save_contact($1,null,$2,null)', [id(100), values])),
        (error) => error.code === '22023',
      );
    await assert.rejects(card(2, { company_id: id(200) }), (error) => error.code === '22023');
  });
  await t.test('identificadores e relações maliciosas falham sem mudar dados', async () => {
    const before = (await q('select count(*)::int as n from public.crm_opportunities')).rows[0].n;
    await assert.rejects(card(2, { stage_id: "' OR 1=1 --" }), (error) => error.code === '22P02');
    await assert.rejects(card(2, { contact_id: id(2001) }), (error) => error.code === '42501');
    assert.equal(
      (await q('select count(*)::int as n from public.crm_opportunities')).rows[0].n,
      before,
    );
  });
  await t.test('tabelas CRM têm RLS e funções privilegiadas fixam search_path', async () => {
    assert.deepEqual(
      (
        await q(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname like 'crm_%' and not c.relrowsecurity`)
      ).rows,
      [],
    );
    assert.deepEqual(
      (
        await q(`select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','crm_private') and p.prosecdef
      and not coalesce(p.proconfig @> array['search_path=""'], false)`)
      ).rows,
      [],
    );
    await assert.rejects(
      as('anon', null, () => q('select * from public.crm_contacts')),
      (error) => error.code === '42501',
    );
  });
});


test('hook de senha permanece desativado e fora das migrations automáticas', async () => {
  const config = await readFile(new URL('../config.toml', import.meta.url), 'utf8');
  const section = config.match(/^\\[auth\\.hook\\.password_verification_attempt\\]\\s*\\n([^\\[]*)/m);
  assert.ok(section, 'A configuração precisa declarar o hook como inativo');
  assert.match(section[1], /^enabled\\s*=\\s*false\\s*$/m);
  assert.match(section[1], /^uri\\s*=\\s*"pg-functions:\\/\\/postgres\\/public\\/crm_password_verification_hook"\\s*$/m);
  const hook = await readFile(
    new URL('../security/password-verification-hook.sql', import.meta.url),
    'utf8',
  );
  assert.match(hook, /PREPARADO, NÃO ATIVADO/);
  assert.match(hook, /security invoker/);
  assert.match(hook, /grant execute on function public\\.crm_password_verification_hook\\(jsonb\\) to supabase_auth_admin/i);
  assert.match(hook, /revoke all on function public\\.crm_password_verification_hook\\(jsonb\\) from public, anon, authenticated, service_role/i);
  const dir = new URL('../migrations/', import.meta.url);
  const files = await readdir(dir);
  assert.ok(files.length > 0);
  for (const path of files.filter((name) => name.endsWith('.sql'))) {
    const migration = await readFile(new URL(path, dir), 'utf8');
    assert.doesNotMatch(
      migration,
      /create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?crm_password_verification_hook\\s*\\(/i,
      'A ativação do hook não pode acontecer por migrations automáticas: ' + path,
    );
    assert.doesNotMatch(
      migration,
      /create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?crm_private\\.login_attempts/i,
      'Tabela do hook também deve permanecer fora de migrations: ' + path,
    );
  }
});

test('hook de cinco falhas: preparado localmente, não ativado no projeto Free', async (t) => {
  const { db, q, as } = await fixture(t);
  await db.exec('create role supabase_auth_admin');
  await db.exec(
    await readFile(new URL('../security/password-verification-hook.sql', import.meta.url), 'utf8'),
  );
  const attempt = async (userId, valid) =>
    (
      await as('supabase_auth_admin', null, () =>
        q('select public.crm_password_verification_hook($1) as result', [
          { user_id: id(userId), valid },
        ]),
      )
    ).rows[0].result;
  const state = async (userId) =>
    (await q('select * from crm_private.login_attempts where user_id=$1', [id(userId)])).rows[0];

  await t.test('a quinta falha bloqueia por 15 minutos, sem encerrar sessões', async () => {
    for (let n = 1; n <= 5; n++) {
      assert.deepEqual(await attempt(1, false), { decision: 'continue' });
      assert.equal((await state(1)).failures, n);
      assert.equal(!!(await state(1)).locked_until, n === 5);
    }
    const locked = await state(1);
    assert.deepEqual(await attempt(1, true), {
      decision: 'reject',
      should_logout_user: false,
      message: 'Não foi possível entrar. Aguarde alguns minutos e tente novamente.',
    });
    assert.deepEqual(await attempt(1, false), { decision: 'continue' });
    assert.deepEqual((await state(1)).locked_until, locked.locked_until);
    assert.equal((await state(1)).failures, 5);
    assert.deepEqual(await attempt(2, true), { decision: 'continue' });
    assert.equal(await state(2), undefined);
    const seconds = (
      await q(
        'select extract(epoch from (locked_until-clock_timestamp())) as n from crm_private.login_attempts where user_id=$1',
        [id(1)],
      )
    ).rows[0].n;
    assert.ok(Number(seconds) > 890 && Number(seconds) <= 900);
  });
  await t.test('o prazo não se prolonga e permite novo login após expirar', async () => {
    await q(
      "update crm_private.login_attempts set locked_until=clock_timestamp()-interval '1 second' where user_id=$1",
      [id(1)],
    );
    assert.deepEqual(await attempt(1, true), { decision: 'continue' });
    assert.equal(await state(1), undefined);
  });
  await t.test(
    'sucesso antes do limite zera a contagem; janela expirada reinicia em um',
    async () => {
      for (let n = 0; n < 4; n++) await attempt(1, false);
      await attempt(1, true);
      assert.equal(await state(1), undefined);
      await attempt(1, false);
      assert.equal((await state(1)).failures, 1);
      await q(
        "update crm_private.login_attempts set failures=4,window_started_at=clock_timestamp()-interval '16 minutes' where user_id=$1",
        [id(1)],
      );
      await attempt(1, false);
      assert.equal((await state(1)).failures, 1);
      assert.equal((await state(1)).locked_until, null);
    },
  );
  await t.test('senhas erradas após expirar o bloqueio iniciam nova janela', async () => {
    await q(
      "update crm_private.login_attempts set failures=5,locked_until=clock_timestamp()-interval '1 second' where user_id=$1",
      [id(1)],
    );
    await attempt(1, false);
    assert.equal((await state(1)).failures, 1);
    assert.equal((await state(1)).locked_until, null);
  });
  await t.test('API pública e usuários autenticados não leem nem alteram contadores', async () => {
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await assert.rejects(
        as(role, 1, () => q('select * from crm_private.login_attempts')),
        (error) => error.code === '42501',
      );
      await assert.rejects(
        as(role, 1, () =>
          q('select public.crm_password_verification_hook($1)', [{ user_id: id(1), valid: true }]),
        ),
        (error) => error.code === '42501',
      );
    }
    for (const value of [{ user_id: id(1), valid: 'true' }, { valid: false }, null])
      await assert.rejects(
        as('supabase_auth_admin', null, () =>
          q('select public.crm_password_verification_hook($1)', [value]),
        ),
        (error) => error.code === '22023',
      );
  });
});
