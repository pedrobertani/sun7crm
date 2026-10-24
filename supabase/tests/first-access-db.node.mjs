import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrationRoot = new URL('../migrations/', import.meta.url);
const initial = [
  '20261023190000_crm_foundation.sql',
  '20261023203000_crm_edge_commands.sql',
  '20261023221000_crm_first_access.sql',
  '20261023223000_crm_first_access_status_invoker.sql',
];
const fixes = (await readdir(migrationRoot)).filter((name) =>
  name.endsWith('_crm_legal_acceptance_status_policy.sql'),
);
assert.equal(fixes.length, 1, 'A correção versionada deve ser única.');
const fix = await readFile(new URL(fixes[0], migrationRoot), 'utf8');
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('primeiro acesso e aceite individual: políticas reais após as migrações', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const query = (sql, args = []) => db.query(sql, args);
  async function asRole(role, user, fn) {
    await query("select set_config('request.jwt.claim.sub', $1, false)", [user || '']);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub', '', false)");
    }
  }
  const asUser = (user, fn) => asRole('authenticated', id(user), fn);
  const denied = (operation) => assert.rejects(operation, (error) => error.code === '42501');
  const accept = (kind, version = 'fixture-v1') =>
    query('insert into public.crm_legal_acceptances(kind,version) values ($1,$2)', [kind, version]);
  const visibleCompanies = async () =>
    (await query('select count(*)::int as n from public.crm_companies')).rows[0].n;
  const beginPassword = async (user) =>
    (
      await asRole('service_role', null, () =>
        query('select public.crm_first_access_begin($1) as nonce', [id(user)]),
      )
    ).rows[0].nonce;
  const completePassword = (user, nonce) =>
    asRole('service_role', null, () =>
      query('select public.crm_first_access_complete($1,$2)', [id(user), nonce]),
    );

  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  for (const name of initial) await db.exec(await readFile(new URL(name, migrationRoot), 'utf8'));
  for (const user of [1, 2]) {
    await query('insert into auth.users(id) values ($1)', [id(user)]);
    await query('insert into public.crm_profiles(id,display_name) values ($1,$2)', [
      id(user),
      `Pessoa fictícia ${user}`,
    ]);
  }
  await query(
    "insert into public.crm_companies(id,name,segment,enabled) values ($1,'Empresa fictícia','Teste',true)",
    [id(100)],
  );
  for (const user of [1, 2])
    await query(
      "insert into public.crm_memberships(company_id,user_id,role) values ($1,$2,'manager')",
      [id(100), id(user)],
    );
  for (const kind of ['terms', 'privacy']) {
    await query(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values ($1,'fixture-v1','Fixture local; não publicar','')",
      [kind],
    );
    await query(
      "insert into public.crm_legal_requirements(kind,version) values ($1,'fixture-v1')",
      [kind],
    );
  }
  await completePassword(1, await beginPassword(1));

  await t.test('reproduz a falha original de EXECUTE mesmo após a troca de senha', async () => {
    await assert.rejects(
      asUser(1, () => accept('terms')),
      (error) =>
        error.code === '42501' &&
        error.message.includes('permission denied for function has_completed_first_access'),
    );
  });
  await db.exec(fix);

  await t.test(
    'reutiliza a consulta autorizada do próprio estado e mantém a função privada fechada',
    async () => {
      assert.equal(
        (
          await query(
            "select has_function_privilege('authenticated','crm_private.has_completed_first_access()','EXECUTE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      assert.equal(
        (
          await query(
            "select has_function_privilege('anon','crm_private.has_completed_first_access()','EXECUTE') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
      await asUser(1, async () => {
        await denied(query('select crm_private.has_completed_first_access()'));
        assert.equal(
          (await query('select public.crm_first_access_status() as state')).rows[0].state
            .password_change_required,
          false,
        );
        await denied(query('select public.crm_first_access_complete($1,$2)', [id(1), id(900)]));
        await denied(
          query('update public.crm_profiles set password_change_required=false where id=$1', [
            id(1),
          ]),
        );
      });
      await asUser(2, async () => {
        await denied(query('select crm_private.has_completed_first_access()'));
        assert.equal(
          (await query('select public.crm_first_access_status() as state')).rows[0].state
            .password_change_required,
          true,
        );
      });
    },
  );
  await t.test(
    'registra os dois aceites individualmente com identidade e horário do servidor',
    () =>
      asUser(1, async () => {
        await accept('terms');
        assert.equal(await visibleCompanies(), 0);
        await accept('privacy');
        assert.equal(await visibleCompanies(), 1);
        const rows = (await query('select user_id,accepted_at from public.crm_legal_acceptances'))
          .rows;
        assert.equal(rows.length, 2);
        assert.ok(rows.every((row) => row.user_id === id(1) && row.accepted_at));
        await denied(
          query(
            "insert into public.crm_legal_acceptances(user_id,kind,version) values ($1,'terms','fixture-v1')",
            [id(2)],
          ),
        );
      }),
  );
  await t.test('senha temporária impede aceite mesmo com documentos vigentes', () =>
    asUser(2, async () => {
      assert.equal(await visibleCompanies(), 0);
      await denied(accept('terms'));
      assert.equal(
        (await query('select count(*)::int as n from public.crm_legal_acceptances')).rows[0].n,
        0,
      );
    }),
  );
  await t.test('aceite de uma pessoa não libera outra após a troca de senha', async () => {
    await completePassword(2, await beginPassword(2));
    await asUser(2, async () => {
      assert.equal(await visibleCompanies(), 0);
      assert.equal(
        (await query('select count(*)::int as n from public.crm_legal_acceptances')).rows[0].n,
        0,
      );
      await accept('terms');
      await accept('privacy');
      assert.equal(await visibleCompanies(), 1);
    });
  });
  await t.test(
    'versão nova exige nova confirmação e rejeita confirmação de versão antiga',
    async () => {
      await query(
        "insert into public.crm_legal_documents(kind,version,body,content_sha256) values ('terms','fixture-v2','Outra fixture local','')",
      );
      await query(
        "update public.crm_legal_requirements set version='fixture-v2' where kind='terms'",
      );
      await asUser(1, async () => {
        assert.equal(await visibleCompanies(), 0);
        await denied(accept('terms'));
        await accept('terms', 'fixture-v2');
        assert.equal(await visibleCompanies(), 1);
      });
    },
  );
  await t.test('ausência de documento exigido mantém a operação bloqueada', async () => {
    await query("delete from public.crm_legal_requirements where kind='privacy'");
    await asUser(1, async () => assert.equal(await visibleCompanies(), 0));
    await query(
      "insert into public.crm_legal_requirements(kind,version) values ('privacy','fixture-v1')",
    );
  });
  await t.test(
    'reset troca o nonce e impede conclusão antiga, cortando acesso imediatamente',
    async () => {
      await query('update public.crm_profiles set password_change_required=true where id=$1', [
        id(1),
      ]);
      const oldNonce = await beginPassword(1);
      await query(
        'update public.crm_profiles set password_change_nonce=gen_random_uuid() where id=$1',
        [id(1)],
      );
      await denied(completePassword(1, oldNonce));
      await asUser(1, async () => assert.equal(await visibleCompanies(), 0));
      await completePassword(1, await beginPassword(1));
      await asUser(1, async () => assert.equal(await visibleCompanies(), 1));
    },
  );
});
