import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const foundation = await readFile(
  new URL('../migrations/20261023190000_crm_foundation.sql', import.meta.url),
  'utf8',
);
const commands = await readFile(
  new URL('../migrations/20261023203000_crm_edge_commands.sql', import.meta.url),
  'utf8',
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hash = 'a'.repeat(64);

test('Edge commands: permissões e transações em PostgreSQL, com Auth simulado', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const query = (sql, params = []) => db.query(sql, params);
  async function asRole(role, fn) {
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  }
  const service = (sql, params = []) => asRole('service_role', () => query(sql, params));
  const denied = (promise, code = '42501') =>
    assert.rejects(promise, (error) => error.code === code);
  const prepare = (actor, op, company, role, fingerprint = hash) =>
    service('select public.crm_edge_prepare_user($1,$2,$3,$4,$5) as result', [
      id(actor),
      id(op),
      id(company),
      role,
      fingerprint,
    ]);
  const finish = (actor, op, user, name = 'Pessoa fictícia') =>
    service('select public.crm_edge_finish_user($1,$2,$3,$4) as result', [
      id(actor),
      id(op),
      id(user),
      name,
    ]);
  const reset = (actor, op, company, target) =>
    service('select public.crm_edge_begin_password_reset($1,$2,$3,$4)', [
      id(actor),
      id(op),
      id(company),
      id(target),
    ]);
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
  await db.exec(foundation);
  await db.exec(commands);
  for (let n = 1; n <= 9; n++) {
    await query('insert into auth.users(id) values ($1)', [id(n)]);
    await query('insert into public.crm_profiles(id,display_name) values ($1,$2)', [
      id(n),
      `Pessoa fictícia ${n}`,
    ]);
  }
  await query('insert into crm_private.platform_admins(user_id) values ($1)', [id(1)]);
  for (const n of [100, 200]) {
    await query(
      "insert into public.crm_companies(id,name,segment,enabled) values ($1,'Empresa fictícia','Teste',true)",
      [id(n)],
    );
  }
  for (const [user, company, role] of [
    [2, 100, 'manager'],
    [3, 100, 'seller'],
    [4, 100, 'reception'],
    [5, 200, 'manager'],
    [6, 100, 'manager'],
    [7, 100, 'manager'],
    [8, 100, 'seller'],
    [8, 200, 'seller'],
  ]) {
    await query('insert into public.crm_memberships(company_id,user_id,role) values ($1,$2,$3)', [
      id(company),
      id(user),
      role,
    ]);
  }
  for (const kind of ['terms', 'privacy']) {
    await query(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values ($1,'fixture-v1','Somente teste local','')",
      [kind],
    );
    await query(
      "insert into public.crm_legal_requirements(kind,version) values ($1,'fixture-v1')",
      [kind],
    );
    for (const n of [1, 2, 3, 4, 5, 6, 8])
      await query(
        "insert into public.crm_legal_acceptances(user_id,kind,version) values ($1,$2,'fixture-v1')",
        [id(n), kind],
      );
  }

  await t.test('RPCs do backend não podem ser invocadas por anon nem authenticated', async () => {
    const signatures = [
      [
        'crm_edge_create_company(uuid,uuid,text,jsonb)',
        'crm_edge_create_company($1,$2,$3,$4)',
        [id(1), id(500), hash, {}],
      ],
      [
        'crm_edge_prepare_user(uuid,uuid,uuid,text,text)',
        'crm_edge_prepare_user($1,$2,$3,$4,$5)',
        [id(1), id(500), id(100), 'manager', hash],
      ],
      [
        'crm_edge_finish_user(uuid,uuid,uuid,text)',
        'crm_edge_finish_user($1,$2,$3,$4)',
        [id(1), id(500), id(9), 'Teste'],
      ],
      ['crm_edge_cancel_user(uuid,uuid)', 'crm_edge_cancel_user($1,$2)', [id(1), id(500)]],
      [
        'crm_edge_begin_password_reset(uuid,uuid,uuid,uuid)',
        'crm_edge_begin_password_reset($1,$2,$3,$4)',
        [id(1), id(500), id(100), id(2)],
      ],
      [
        'crm_edge_end_password_reset(uuid,uuid,boolean)',
        'crm_edge_end_password_reset($1,$2,$3)',
        [id(1), id(500), true],
      ],
    ];
    for (const [signature, call, args] of signatures) {
      for (const role of ['anon', 'authenticated']) {
        await denied(asRole(role, () => query(`select public.${call}`, args)));
        assert.equal(
          (
            await query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [
              role,
              `public.${signature}`,
            ])
          ).rows[0].allowed,
          false,
        );
      }
      assert.equal(
        (
          await query("select has_function_privilege('service_role',$1,'EXECUTE') as allowed", [
            `public.${signature}`,
          ])
        ).rows[0].allowed,
        true,
      );
    }
  });
  await t.test(
    'tabelas de controle têm RLS e não ficam legíveis ao cliente ou serviço',
    async () => {
      for (const name of ['company_provisioning', 'user_provisioning', 'password_reset_requests']) {
        assert.equal(
          (
            await query('select relrowsecurity from pg_class where oid=$1::regclass', [
              `crm_private.${name}`,
            ])
          ).rows[0].relrowsecurity,
          true,
        );
        for (const role of ['anon', 'authenticated', 'service_role'])
          await denied(asRole(role, () => query(`select * from crm_private.${name}`)));
      }
    },
  );
  let newCompany;
  const values = {
    name: 'Nova empresa fictícia',
    segment: 'Teste',
    template: 'generic',
    theme: 'blue',
    monthly_amount_cents: 12345,
    due_date: '2026-12-01',
  };
  const createCompany = (actor, op, payload = values, fingerprint = hash) =>
    service('select public.crm_edge_create_company($1,$2,$3,$4) as result', [
      id(actor),
      id(op),
      fingerprint,
      payload,
    ]);
  await t.test('somente Caio cria empresa, cobrança e os dois quadros atomicamente', async () => {
    await denied(createCompany(2, 500));
    newCompany = (await createCompany(1, 500)).rows[0].result;
    const row = (await query('select * from public.crm_companies where id=$1', [newCompany]))
      .rows[0];
    assert.equal(row.enabled, false);
    assert.equal(row.template, 'generic');
    assert.equal(
      (
        await query(
          'select monthly_amount_cents from public.crm_company_billing where company_id=$1',
          [newCompany],
        )
      ).rows[0].monthly_amount_cents,
      12345,
    );
    assert.equal(
      (
        await query('select count(*)::int as n from public.crm_boards where company_id=$1', [
          newCompany,
        ])
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await query('select count(*)::int as n from public.crm_stages where company_id=$1', [
          newCompany,
        ])
      ).rows[0].n,
      10,
    );
    const audits = (
      await query('select actor_user_id from public.crm_audit_events where company_id=$1', [
        newCompany,
      ])
    ).rows;
    assert.ok(audits.length > 0 && audits.every((item) => item.actor_user_id === id(1)));
  });
  await t.test(
    'repetição da empresa não duplica registros; payload divergente é recusado',
    async () => {
      assert.equal((await createCompany(1, 500)).rows[0].result, newCompany);
      await denied(createCompany(1, 500, values, 'b'.repeat(64)), '23505');
      const before = (await query('select count(*)::int as n from public.crm_companies')).rows[0].n;
      await denied(createCompany(1, 501, { ...values, monthly_amount_cents: -1 }), '23514');
      assert.equal(
        (await query('select count(*)::int as n from public.crm_companies')).rows[0].n,
        before,
      );
    },
  );
  await t.test('criação de usuário respeita a hierarquia e a empresa', async () => {
    await prepare(1, 510, 100, 'manager');
    await prepare(2, 511, 100, 'seller');
    await prepare(2, 512, 100, 'reception');
    for (const [actor, company, role] of [
      [1, 100, 'seller'],
      [2, 100, 'manager'],
      [2, 200, 'seller'],
      [3, 100, 'seller'],
      [4, 100, 'seller'],
      [7, 100, 'seller'],
      [2, 100, 'platform_admin'],
    ]) {
      await denied(prepare(actor, 590 + actor, company, role));
    }
  });
  await t.test(
    'confirmação exige conta criada para a mesma operação e grava perfil/vínculo juntos',
    async () => {
      await query('insert into auth.users(id,raw_app_meta_data) values ($1,$2)', [
        id(11),
        { crm_provisioning_id: id(511) },
      ]);
      await denied(finish(2, 512, 11));
      const result = (await finish(2, 511, 11)).rows[0].result;
      assert.equal(result.state, 'complete');
      assert.equal(result.user_id, id(11));
      const member = (
        await query('select role,company_id from public.crm_memberships where id=$1', [
          result.membership_id,
        ])
      ).rows[0];
      assert.equal(member.role, 'seller');
      assert.equal(member.company_id, id(100));
      assert.equal((await prepare(2, 511, 100, 'seller')).rows[0].result.state, 'complete');
      assert.equal((await finish(2, 511, 11)).rows[0].result.membership_id, result.membership_id);
      const audits = (
        await query(
          "select actor_user_id from public.crm_audit_events where record_id=$1 and entity='crm_memberships'",
          [result.membership_id],
        )
      ).rows;
      assert.deepEqual(
        audits.map((row) => row.actor_user_id),
        [id(2)],
      );
    },
  );
  await t.test(
    'operação pendente, ator diferente e mudança de escopo não podem ser reutilizados',
    async () => {
      await denied(prepare(2, 512, 100, 'reception'), '23505');
      await denied(prepare(6, 511, 100, 'seller'), '23505');
      await denied(prepare(2, 511, 100, 'reception'), '23505');
      await denied(service('select public.crm_edge_cancel_user($1,$2)', [id(6), id(512)]));
    },
  );
  await t.test(
    'cancelamento impede confirmação tardia e não desfaz operação já concluída',
    async () => {
      await service('select public.crm_edge_cancel_user($1,$2)', [id(2), id(512)]);
      await query('insert into auth.users(id,raw_app_meta_data) values ($1,$2)', [
        id(12),
        { crm_provisioning_id: id(512) },
      ]);
      await denied(finish(2, 512, 12), '23505');
      const completed = (
        await service('select public.crm_edge_cancel_user($1,$2) as result', [id(2), id(511)])
      ).rows[0].result;
      assert.equal(completed.state, 'complete');
    },
  );
  await t.test('permissão é verificada novamente ao concluir o cadastro', async () => {
    await prepare(2, 520, 100, 'seller');
    await query('insert into auth.users(id,raw_app_meta_data) values ($1,$2)', [
      id(13),
      { crm_provisioning_id: id(520) },
    ]);
    await query('update public.crm_memberships set active=false where user_id=$1', [id(2)]);
    await denied(finish(2, 520, 13));
    assert.equal(
      (await service('select public.crm_edge_cancel_user($1,$2) as result', [id(2), id(520)]))
        .rows[0].result.state,
      'cancelled',
    );
    await query('update public.crm_memberships set active=true where user_id=$1', [id(2)]);
  });
  await t.test(
    'sem documentos vigentes ou aceite, comandos administrativos são bloqueados',
    async () => {
      await query("delete from public.crm_legal_requirements where kind='privacy'");
      await denied(createCompany(1, 530));
      await denied(prepare(2, 531, 100, 'seller'));
      await denied(reset(2, 532, 100, 3));
      await query(
        "insert into public.crm_legal_requirements(kind,version) values ('privacy','fixture-v1')",
      );
    },
  );
  await t.test('reset permite Caio → gestor e gestor → equipe da própria empresa', async () => {
    await reset(1, 540, 100, 2);
    await reset(2, 541, 100, 3);
    await reset(2, 542, 100, 4);
    for (const [actor, company, target] of [
      [2, 100, 1],
      [2, 100, 2],
      [2, 100, 6],
      [2, 200, 5],
      [2, 200, 3],
      [1, 100, 3],
      [3, 100, 4],
      [4, 100, 3],
      [7, 100, 3],
    ]) {
      await denied(reset(actor, 570 + actor + target, company, target));
    }
  });
  await t.test(
    'reset global é recusado para conta com vínculos em mais de uma empresa',
    async () => {
      await denied(reset(2, 550, 100, 8));
    },
  );
  await t.test(
    'resultado do reset gera auditoria sem senha e não pode trocar de ator',
    async () => {
      await denied(
        service('select public.crm_edge_end_password_reset($1,$2,$3)', [id(6), id(541), true]),
      );
      await service('select public.crm_edge_end_password_reset($1,$2,$3)', [id(2), id(541), true]);
      const row = (
        await query('select * from crm_private.password_reset_requests where request_id=$1', [
          id(541),
        ])
      ).rows[0];
      assert.equal(row.outcome, 'succeeded');
      assert.ok(row.finished_at);
      assert.ok(!Object.keys(row).some((key) => ['password', 'token', 'secret'].includes(key)));
      const audits = (
        await query(
          "select entity,actor_user_id from public.crm_audit_events where record_id=$1 and entity like 'crm_password_reset_%'",
          [id(3)],
        )
      ).rows;
      assert.ok(
        audits.some(
          (row) => row.entity === 'crm_password_reset_succeeded' && row.actor_user_id === id(2),
        ),
      );
    },
  );
  await t.test(
    'mesmo identificador não redefine senha novamente e existe limite por alvo',
    async () => {
      await denied(reset(2, 541, 100, 3), '23505');
      for (let n = 0; n < 4; n++) await reset(2, 600 + n, 100, 3);
      await denied(reset(2, 610, 100, 3), 'P0003');
    },
  );
  await t.test(
    'empresa desabilitada bloqueia gestor mas permite provisão de gestor por Caio',
    async () => {
      await query('update public.crm_companies set enabled=false where id=$1', [id(100)]);
      await denied(prepare(2, 620, 100, 'seller'));
      await denied(reset(2, 621, 100, 4));
      await prepare(1, 622, 100, 'manager');
    },
  );
});
