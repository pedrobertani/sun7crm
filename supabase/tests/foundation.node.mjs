import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// Runner node:test separado dos testes Vitest do frontend.
// PostgreSQL real em memória. Auth é um stub local: não testa JWT, GoTrue ou PostgREST.
// Nenhuma conexão de rede e nenhuma chave Supabase são utilizadas por estes testes.
const migration = await readFile(
  new URL('../migrations/20261023190000_crm_foundation.sql', import.meta.url),
  'utf8',
);
const bootstrap = await readFile(
  new URL('../bootstrap/01_platform_admin.sql', import.meta.url),
  'utf8',
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('fundação SUN7CRM: migração, vínculos e políticas reais de PostgreSQL', async (t) => {
  const db = new PGlite();
  const query = (sql, params = []) => db.query(sql, params);
  const count = async (table) =>
    Number((await query(`select count(*) as n from public.${table}`)).rows[0].n);
  const denied = (sql, params = [], code = '42501') =>
    assert.rejects(query(sql, params), (error) => error.code === code);
  const asUser = async (userId, fn, role = 'authenticated') => {
    await db.exec('reset role');
    await query("select set_config('request.jwt.claim.sub', $1, false)", [userId || '']);
    await db.exec(`set role ${role}`);
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub', '', false)");
    }
  };
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(migration);

  await t.test('migração cria tabelas vazias e habilita RLS em todas elas', async () => {
    const rows = (
      await query(
        "select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relname like 'crm_%'",
      )
    ).rows;
    assert.equal(rows.length, 13);
    assert.ok(rows.every((row) => row.relrowsecurity));
    for (const { relname } of rows) assert.equal(await count(relname), 0);
    const exposed = await query(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname like 'crm_%' and prosecdef",
    );
    assert.equal(exposed.rows.length, 0);
  });

  for (let n = 1; n <= 9; n++) {
    await query('insert into auth.users(id) values ($1)', [id(n)]);
    await query('insert into public.crm_profiles(id, display_name) values ($1, $2)', [
      id(n),
      `Pessoa fictícia ${n}`,
    ]);
  }
  await query('insert into crm_private.platform_admins(user_id) values ($1)', [id(1)]);
  for (const n of [100, 200]) {
    await query(
      "insert into public.crm_companies(id, name, segment, enabled) values ($1, $2, 'Teste', true)",
      [id(n), `Empresa fictícia ${n}`],
    );
    await query(
      'insert into public.crm_company_billing(company_id, monthly_amount_cents, due_date) values ($1, 19900, current_date)',
      [id(n)],
    );
  }
  for (const [n, company, user, role, active] of [
    [102, 100, 2, 'manager', true],
    [103, 100, 3, 'seller', true],
    [104, 100, 4, 'seller', true],
    [105, 100, 5, 'reception', true],
    [108, 100, 8, 'seller', false],
    [109, 100, 9, 'seller', true],
    [206, 200, 6, 'manager', true],
  ]) {
    await query(
      'insert into public.crm_memberships(id, company_id, user_id, role, active) values ($1,$2,$3,$4,$5)',
      [id(n), id(company), id(user), role, active],
    );
  }
  for (const kind of ['terms', 'privacy']) {
    await query(
      "insert into public.crm_legal_documents(kind, version, body, content_sha256) values ($1, 'fixture-v1', $2, '')",
      [kind, `Documento ${kind} somente para teste local.`],
    );
    await query(
      "insert into public.crm_legal_requirements(kind, version) values ($1, 'fixture-v1')",
      [kind],
    );
    for (let n = 1; n <= 8; n++)
      await query(
        "insert into public.crm_legal_acceptances(user_id, kind, version) values ($1,$2,'fixture-v1')",
        [id(n), kind],
      );
  }
  for (const [n, company, owner] of [
    [110, 100, 103],
    [111, 100, 104],
    [210, 200, 206],
  ]) {
    await query(
      'insert into public.crm_contacts(id,company_id,owner_membership_id,name) values ($1,$2,$3,$4)',
      [id(n), id(company), id(owner), `Contato fictício ${n}`],
    );
  }
  for (const [n, company] of [
    [130, 100],
    [140, 100],
    [230, 200],
  ]) {
    await query(
      "insert into public.crm_boards(id,company_id,kind,name) values ($1,$2,'leads','Quadro fictício')",
      [id(n), id(company)],
    );
    await query(
      "insert into public.crm_stages(id,company_id,board_id,name,position) values ($1,$2,$3,'Etapa fictícia',0)",
      [id(n + 2), id(company), id(n)],
    );
  }
  await query(
    "insert into public.crm_stages(id,company_id,board_id,name,position) values ($1,$2,$3,'Segunda etapa',1)",
    [id(133), id(100), id(130)],
  );
  for (const [n, company, contact, board] of [
    [120, 100, 110, 130],
    [121, 100, 111, 130],
    [220, 200, 210, 230],
  ]) {
    await query(
      'insert into public.crm_opportunities(id,company_id,contact_id,board_id,stage_id) values ($1,$2,$3,$4,$5)',
      [id(n), id(company), id(contact), id(board), id(board + 2)],
    );
  }
  for (const [n, company, owner, contact] of [
    [150, 100, 103, 110],
    [151, 100, 104, 111],
    [152, 100, 105, null],
    [250, 200, 206, 210],
  ]) {
    await query(
      "insert into public.crm_tasks(id,company_id,owner_membership_id,contact_id,title,due_date) values ($1,$2,$3,$4,'Tarefa fictícia',current_date)",
      [id(n), id(company), id(owner), contact ? id(contact) : null],
    );
  }

  await t.test('anônimo não lê CRM nem chama a verificação administrativa', () =>
    asUser(
      null,
      async () => {
        await denied('select * from public.crm_contacts');
        await denied('select public.crm_is_platform_admin()');
      },
      'anon',
    ),
  );
  await t.test('autenticado sem vínculo não lê empresas ou contatos', () =>
    asUser(id(7), async () => {
      assert.equal(await count('crm_companies'), 0);
      assert.equal(await count('crm_contacts'), 0);
      assert.equal(await count('crm_profiles'), 1);
    }),
  );
  await t.test('gestor A lê apenas a empresa A e os seus contatos', () =>
    asUser(id(2), async () => {
      assert.equal(await count('crm_companies'), 1);
      assert.equal(await count('crm_contacts'), 2);
      assert.equal(await count('crm_opportunities'), 2);
      assert.equal(await count('crm_company_billing'), 0);
    }),
  );
  await t.test('vendedor lê e altera somente contatos próprios', () =>
    asUser(id(3), async () => {
      assert.equal(await count('crm_contacts'), 1);
      assert.equal(await count('crm_opportunities'), 1);
      const changed = await query(
        'update public.crm_contacts set name = $1 where id = $2 returning id',
        ['Contato atualizado', id(110)],
      );
      assert.equal(changed.rows.length, 1);
      const other = await query(
        "update public.crm_contacts set name = 'Indevido' where id = $1 returning id",
        [id(111)],
      );
      assert.equal(other.rows.length, 0);
      await denied('update public.crm_contacts set owner_membership_id = $1 where id = $2', [
        id(104),
        id(110),
      ]);
    }),
  );
  await t.test('recepção consulta contatos e movimenta somente tarefas próprias', () =>
    asUser(id(5), async () => {
      assert.equal(await count('crm_contacts'), 2);
      const changed = await query(
        "update public.crm_contacts set name = 'Indevido' where id = $1 returning id",
        [id(110)],
      );
      assert.equal(changed.rows.length, 0);
      await denied(
        "insert into public.crm_contacts(company_id,owner_membership_id,name) values ($1,$2,'Indevido')",
        [id(100), id(105)],
      );
      assert.equal(await count('crm_tasks'), 1);
      assert.equal(
        (
          await query("update public.crm_tasks set status='in_progress' where id=$1 returning id", [
            id(152),
          ])
        ).rows.length,
        1,
      );
    }),
  );
  await t.test('usuário não promove perfil nem cria integrantes', () =>
    asUser(id(3), async () => {
      await denied("update public.crm_memberships set role = 'manager' where id=$1", [id(103)]);
      await denied(
        "insert into public.crm_memberships(company_id,user_id,role) values ($1,$2,'manager')",
        [id(200), id(3)],
      );
      await denied('insert into crm_private.platform_admins(user_id) values ($1)', [id(3)]);
      assert.equal(
        (await query('select public.crm_is_platform_admin() as allowed')).rows[0].allowed,
        false,
      );
    }),
  );
  await t.test('Caio lê cobrança e gestão, sem acesso implícito aos contatos das empresas', () =>
    asUser(id(1), async () => {
      assert.equal(
        (await query('select public.crm_is_platform_admin() as allowed')).rows[0].allowed,
        true,
      );
      assert.equal(await count('crm_companies'), 2);
      assert.equal(await count('crm_company_billing'), 2);
      assert.equal(await count('crm_contacts'), 0);
      assert.equal(await count('crm_tasks'), 0);
      assert.equal(await count('crm_opportunities'), 0);
    }),
  );
  await t.test('gestor não altera segmento, habilitação ou cobrança pela Data API', () =>
    asUser(id(2), async () => {
      await denied("update public.crm_companies set template='generic' where id=$1", [id(100)]);
      await denied('update public.crm_companies set enabled=false where id=$1', [id(100)]);
      await denied(
        'update public.crm_company_billing set monthly_amount_cents=1 where company_id=$1',
        [id(100)],
      );
      assert.equal(
        (
          await query(
            "update public.crm_companies set display_name='Nome da empresa' where id=$1 returning id",
            [id(100)],
          )
        ).rows.length,
        1,
      );
    }),
  );
  await t.test('CRUD autenticado não insere contato em outra empresa', () =>
    asUser(id(2), async () => {
      await denied(
        "insert into public.crm_contacts(company_id,owner_membership_id,name) values ($1,$2,'Indevido')",
        [id(200), id(206)],
      );
      await denied(
        "insert into public.crm_contacts(company_id,owner_membership_id,name) values ($1,$2,'Indevido')",
        [id(100), id(206)],
      );
    }),
  );
  await t.test(
    'chaves estrangeiras impedem vínculos entre empresas até com papel privilegiado',
    async () => {
      await denied(
        "insert into public.crm_contacts(company_id,owner_membership_id,name) values ($1,$2,'Indevido')",
        [id(100), id(206)],
        '23503',
      );
      await denied(
        'insert into public.crm_opportunities(company_id,contact_id,board_id,stage_id) values ($1,$2,$3,$4)',
        [id(100), id(210), id(130), id(132)],
        '23503',
      );
    },
  );
  await t.test('etapa pertence ao mesmo quadro e empresa da oportunidade', () =>
    asUser(id(3), async () => {
      await denied(
        'update public.crm_opportunities set stage_id=$1 where id=$2',
        [id(142), id(120)],
        '23503',
      );
      await denied(
        'update public.crm_opportunities set stage_id=$1 where id=$2',
        [id(232), id(120)],
        '23503',
      );
      assert.equal(
        (
          await query('update public.crm_opportunities set stage_id=$1 where id=$2 returning id', [
            id(133),
            id(120),
          ])
        ).rows.length,
        1,
      );
    }),
  );
  await t.test('identidade, empresa e autoria não são reescritas', async () => {
    await asUser(id(2), async () => {
      await denied('update public.crm_contacts set company_id=$1 where id=$2', [id(200), id(110)]);
      await denied("update public.crm_contacts set created_at='2000-01-01' where id=$1", [id(110)]);
    });
    await denied(
      'update public.crm_contacts set company_id=$1 where id=$2',
      [id(200), id(110)],
      '23514',
    );
  });
  await t.test('conclusão e reabertura de tarefa usam timestamp do servidor', () =>
    asUser(id(3), async () => {
      assert.equal(await count('crm_tasks'), 1);
      const done = (
        await query(
          "update public.crm_tasks set status='done' where id=$1 returning completed_at",
          [id(150)],
        )
      ).rows[0];
      assert.ok(done.completed_at);
      const reopened = (
        await query(
          "update public.crm_tasks set status='in_progress' where id=$1 returning completed_at",
          [id(150)],
        )
      ).rows[0];
      assert.equal(reopened.completed_at, null);
      await denied("update public.crm_tasks set completed_at='2000-01-01' where id=$1", [id(150)]);
    }),
  );
  await t.test('tarefa não pode ser atribuída a integrante ou contato de outra empresa', () =>
    asUser(id(2), async () => {
      await denied('update public.crm_tasks set owner_membership_id=$1 where id=$2', [
        id(206),
        id(150),
      ]);
      await denied('update public.crm_tasks set contact_id=$1 where id=$2', [id(210), id(150)]);
    }),
  );
  await t.test('desativar vínculo corta acesso mesmo com identidade autenticada', async () => {
    await query('update public.crm_memberships set active=false where id=$1', [id(103)]);
    await asUser(id(3), async () => assert.equal(await count('crm_contacts'), 0));
    await query('update public.crm_memberships set active=true where id=$1', [id(103)]);
  });
  await t.test(
    'desabilitar empresa corta acesso da equipe e preserva visão administrativa',
    async () => {
      await query('update public.crm_companies set enabled=false where id=$1', [id(100)]);
      await asUser(id(2), async () => assert.equal(await count('crm_contacts'), 0));
      await asUser(id(1), async () => assert.equal(await count('crm_companies'), 2));
      await query('update public.crm_companies set enabled=true where id=$1', [id(100)]);
    },
  );
  await t.test(
    'aceite da conta real exige os dois documentos e não admite timestamp ou usuário forjado',
    () =>
      asUser(id(9), async () => {
        assert.equal(await count('crm_contacts'), 0);
        assert.equal(await count('crm_legal_documents'), 2);
        await query(
          "insert into public.crm_legal_acceptances(kind,version) values ('terms','fixture-v1')",
        );
        assert.equal(await count('crm_boards'), 0);
        await denied(
          "insert into public.crm_legal_acceptances(user_id,kind,version) values ($1,'privacy','fixture-v1')",
          [id(2)],
        );
        await denied(
          "insert into public.crm_legal_acceptances(kind,version,accepted_at) values ('privacy','fixture-v1','2000-01-01')",
        );
        await query(
          "insert into public.crm_legal_acceptances(kind,version) values ('privacy','fixture-v1')",
        );
        assert.equal(await count('crm_boards'), 2);
        await denied("update public.crm_legal_acceptances set version='forged'");
      }),
  );
  await t.test('versão exigida nova retira acesso até confirmação individual', async () => {
    await query(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values ('terms','fixture-v2','Segunda versão de teste','')",
    );
    await query("update public.crm_legal_requirements set version='fixture-v2' where kind='terms'");
    await asUser(id(2), async () => {
      assert.equal(await count('crm_contacts'), 0);
      await denied(
        "insert into public.crm_legal_acceptances(kind,version) values ('terms','fixture-v1')",
      );
      await query(
        "insert into public.crm_legal_acceptances(kind,version) values ('terms','fixture-v2')",
      );
      assert.equal(await count('crm_contacts'), 2);
    });
  });
  await t.test('documentos têm hash calculado e conteúdo publicado imutável', async () => {
    const document = (
      await query(
        "select body,content_sha256 from public.crm_legal_documents where kind='terms' and version='fixture-v1'",
      )
    ).rows[0];
    assert.equal(document.content_sha256, createHash('sha256').update(document.body).digest('hex'));
    await denied(
      "update public.crm_legal_documents set body='Alterado' where kind='terms' and version='fixture-v1'",
      [],
      '23514',
    );
    await denied("delete from public.crm_legal_documents where kind='privacy'", [], '23514');
  });
  await t.test('configuração legal incompleta mantém acesso fechado', async () => {
    await query("delete from public.crm_legal_requirements where kind='privacy'");
    await asUser(id(2), async () => assert.equal(await count('crm_contacts'), 0));
    await query(
      "insert into public.crm_legal_requirements(kind,version) values ('privacy','fixture-v1')",
    );
  });
  await t.test('auditoria é gerada por gatilho e não é gravável pelo navegador', () =>
    asUser(id(2), async () => {
      const entries = (await query('select * from public.crm_audit_events')).rows;
      assert.ok(entries.length > 0);
      assert.ok(entries.every((entry) => entry.company_id === id(100)));
      await denied(
        "insert into public.crm_audit_events(record_id,entity,action) values ($1,'forged','INSERT')",
        [id(110)],
      );
      await denied("update public.crm_audit_events set entity='forged'");
      await denied('delete from public.crm_audit_events');
    }),
  );
  await t.test('reaplicar migração falha sem apagar a estrutura ou os dados', async () => {
    await assert.rejects(db.exec(migration), (error) => error.code === '42P06');
    await db.exec('rollback');
    assert.equal(await count('crm_companies'), 2);
    assert.equal(await count('crm_contacts'), 3);
  });
  await t.test('bootstrap exige usuário existente e só promove pelo SQL confiável', async () => {
    await assert.rejects(db.exec(bootstrap), (error) => error.code === 'P0001');
    await db.exec('rollback');
    const withUser = (user) =>
      bootstrap.replace(
        "target_user uuid := '00000000-0000-0000-0000-000000000000'",
        `target_user uuid := '${user}'`,
      );
    await assert.rejects(db.exec(withUser(id(999))), (error) => error.code === 'P0001');
    await db.exec('rollback');
    await db.exec(withUser(id(1)));
    assert.equal(
      Number((await query('select count(*) as n from crm_private.platform_admins')).rows[0].n),
      1,
    );
  });
});
