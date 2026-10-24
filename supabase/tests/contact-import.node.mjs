import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../migrations/', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('importação Excel: duplicados e autorização no banco', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  async function as(role, user, run) {
    await q("select set_config('request.jwt.claim.sub',$1,false)", [user ? id(user) : '']);
    await db.exec(`set role ${role}`);
    try {
      return await run();
    } finally {
      await db.exec('reset role');
      await q("select set_config('request.jwt.claim.sub','',false)");
    }
  }
  const user = (n, run) => as('authenticated', n, run);
  const denied = (promise) => assert.rejects(promise, (error) => error.code === '42501');
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir(root)).filter((name) => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, root), 'utf8'));
  for (let n = 1; n <= 7; n++) {
    await q('insert into auth.users(id) values($1)', [id(n)]);
    await q(
      'insert into public.crm_profiles(id,display_name,password_change_required) values($1,$2,$3)',
      [id(n), `Pessoa fictícia ${n}`, n === 6],
    );
  }
  for (const n of [100, 200]) {
    await q(
      "insert into public.crm_companies(id,name,segment,enabled) values($1,'Empresa fictícia','Teste',true)",
      [id(n)],
    );
    await q(
      "insert into public.crm_company_billing(company_id,monthly_amount_cents,due_date) values($1,999999,((now() at time zone 'America/Sao_Paulo')::date)+7)",
      [id(n)],
    );
  }
  for (const [n, company, role] of [
    [1, 100, 'manager'],
    [2, 100, 'seller'],
    [3, 100, 'reception'],
    [4, 200, 'manager'],
    [5, 100, 'seller'],
    [6, 100, 'manager'],
  ]) {
    await q('insert into public.crm_memberships(id,company_id,user_id,role) values($1,$2,$3,$4)', [
      id(n + 10),
      id(company),
      id(n),
      role,
    ]);
  }
  for (const kind of ['terms', 'privacy']) {
    await q(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values($1,'local-fixture','Fixture local; não publicar','')",
      [kind],
    );
    // A migração de homologação já configura a versão exigida. A fixture local
    // ativa uma versão própria sem alterar documentos imutáveis de homologação.
    await q(
      "insert into public.crm_legal_requirements(kind,version) values($1,'local-fixture') on conflict (kind) do update set version=excluded.version",
      [kind],
    );
    for (const n of [1, 2, 3, 4, 5, 7])
      await user(n, () =>
        q("insert into public.crm_legal_acceptances(kind,version) values($1,'local-fixture')", [
          kind,
        ]),
      );
  }
  await q('insert into crm_private.platform_admins(user_id) values($1)', [id(7)]);

  const items = [
    { name: 'Primeiro nome', phone: '14996732848' },
    { name: 'Duplicado no Excel', phone: '14996732848' },
  ];
  const run = (company, owner, rows = items) =>
    q('select public.crm_import_contacts($1,$2,$3::jsonb) as count', [
      id(company),
      id(owner),
      JSON.stringify(rows),
    ]);
  await t.test(
    'importa uma vez, preserva dados e permite o mesmo telefone em outra empresa',
    async () => {
      assert.equal((await user(1, () => run(100, 11))).rows[0].count, 1);
      assert.equal((await user(1, () => run(100, 11))).rows[0].count, 0);
      assert.equal(
        (
          await q(
            "select name from public.crm_contacts where phone='14996732848' and company_id=$1",
            [id(100)],
          )
        ).rows[0].name,
        'Primeiro nome',
      );
      assert.equal((await user(4, () => run(200, 14))).rows[0].count, 1);
    },
  );
  await t.test('vendedor não duplica contato oculto nem recebe seus dados', async () => {
    assert.equal((await user(2, () => run(100, 12))).rows[0].count, 0);
    assert.equal(
      (await user(2, () => q("select id from public.crm_contacts where phone='14996732848'"))).rows
        .length,
      0,
    );
  });
  await t.test(
    'recepção, outra empresa, outro responsável e primeiro acesso incompleto são recusados',
    async () => {
      const fresh = [{ name: 'Fictício', phone: '11988887777' }];
      await as('anon', null, () => denied(run(100, 11, fresh)));
      await user(3, () => denied(run(100, 13, fresh)));
      await user(2, () => denied(run(200, 14, fresh)));
      await user(2, () => denied(run(100, 11, fresh)));
      await user(6, () => denied(run(100, 16, fresh)));
    },
  );
  await t.test('banco rejeita lote inválido inteiro e ignora máscaras já cadastradas', async () => {
    await assert.rejects(
      user(1, () =>
        run(100, 11, [
          { name: 'Fictício', phone: '11977776666' },
          { name: 'Erro', phone: '977776666' },
        ]),
      ),
      (e) => e.code === '22023',
    );
    assert.equal(
      (await q("select count(*)::int as n from public.crm_contacts where phone='11977776666'"))
        .rows[0].n,
      0,
    );
    await q(
      "insert into public.crm_contacts(company_id,owner_membership_id,name,phone) values($1,$2,'Anterior','+55 (11) 98888-7777')",
      [id(100), id(11)],
    );
    assert.equal(
      (await user(1, () => run(100, 11, [{ name: 'Não substituir', phone: '11988887777' }])))
        .rows[0].count,
      0,
    );
  });
});
