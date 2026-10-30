import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../migrations/', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('notificações por perfil, vencimento e erros técnicos: isolamento no banco', async (t) => {
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
  const sync = () => q('select public.crm_refresh_notifications()');
  const visible = async () =>
    (
      await q(
        'select id,company_id,kind,title,body,read_at from public.crm_notifications order by kind,id',
      )
    ).rows;
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
    await q('insert into public.crm_memberships(id,company_id,user_id,role,active) values($1,$2,$3,$4,$5)', [
      id(n + 10),
      id(company),
      id(n),
      role,
      n !== 6,
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
  for (const [n, owner, company, offset] of [
    [300, 12, 100, -1],
    [301, 13, 100, 2],
    [302, 15, 100, 2],
    [303, 14, 200, -2],
  ]) {
    await q(
      "insert into public.crm_tasks(id,company_id,owner_membership_id,title,due_date) values($1,$2,$3,'Tarefa fictícia',((now() at time zone 'America/Sao_Paulo')::date)+$4::integer)",
      [id(n), id(company), id(owner), offset],
    );
  }
  for (const [n, owner] of [
    [400, 12],
    [401, 13],
  ])
    await q(
      "insert into public.crm_contacts(id,company_id,owner_membership_id,name) values($1,$2,$3,'Contato fictício')",
      [id(n), id(100), id(owner)],
    );

  await t.test(
    'sessão anônima e primeiro acesso incompleto não geram nem leem avisos',
    async () => {
      await as('anon', null, () => denied(sync()));
      await user(6, async () => {
        await denied(sync());
        assert.equal((await visible()).length, 0);
      });
    },
  );
  await t.test(
    'gestor recebe vencimento e pendências da equipe sem dados de outra empresa',
    async () => {
      await user(1, async () => {
        await sync();
        const rows = await visible();
        assert.equal(rows.filter((r) => r.kind === 'subscription_due').length, 1);
        assert.equal(rows.filter((r) => r.kind === 'task_due').length, 1);
        assert.equal(rows.filter((r) => r.kind === 'new_contact').length, 2);
        assert.ok(rows.every((r) => r.company_id === id(100)));
        assert.ok(rows.every((r) => !r.body.includes('999999')));
      });
    },
  );
  await t.test(
    'vendedor e recepção recebem apenas seus contatos e tarefas, sem cobrança',
    async () => {
      for (const n of [2, 3])
        await user(n, async () => {
          await sync();
          const rows = await visible();
          assert.equal(rows.length, 2);
          assert.equal(
            rows.some((r) => r.kind === 'subscription_due'),
            false,
          );
          assert.equal(rows.filter((r) => r.kind === 'contact_assigned').length, 1);
          assert.equal(
            rows.filter((r) => r.kind === (n === 2 ? 'task_due' : 'task_assigned')).length,
            1,
          );
        });
    },
  );
  await t.test('não duplica avisos nem apaga a leitura ao atualizar o sino', async () => {
    await user(1, async () => {
      const before = await visible(),
        notification = before.find((r) => r.kind === 'subscription_due');
      assert.equal(
        (await q('select public.crm_mark_notifications_read($1) as n', [[notification.id]])).rows[0]
          .n,
        1,
      );
      await sync();
      const after = await visible();
      assert.equal(after.length, before.length);
      assert.ok(after.find((r) => r.id === notification.id).read_at);
    });
  });
  await t.test('não permite forjar mensagens ou marcar o aviso de outra pessoa', async () => {
    const target = (
      await q(
        "select id from public.crm_notifications where recipient_user_id=$1 and kind='subscription_due'",
        [id(1)],
      )
    ).rows[0].id;
    await user(2, async () => {
      assert.equal(
        (await q('select public.crm_mark_notifications_read($1) as n', [[target]])).rows[0].n,
        0,
      );
      await denied(q("update public.crm_notifications set title='Forjado'"));
      await denied(q('update public.crm_notifications set recipient_user_id=$1', [id(2)]));
      await denied(
        q(
          "insert into public.crm_notifications(company_id,recipient_user_id,kind,entity_id,event_key,title,body) values($1,$2,'subscription_due',$1,'fake','Forjado','Forjado')",
          [id(100), id(2)],
        ),
      );
    });
  });
  await t.test('avisa no dia e após vencer; renovação elimina o alerta anterior', async () => {
    for (const [offset, title] of [
      [0, 'vence hoje'],
      [-1, 'pendente'],
    ]) {
      await q(
        "update public.crm_company_billing set due_date=((now() at time zone 'America/Sao_Paulo')::date)+$1::integer where company_id=$2",
        [offset, id(100)],
      );
      await user(1, async () => {
        await sync();
        const notices = (await visible()).filter((r) => r.kind === 'subscription_due');
        assert.equal(notices.length, 1);
        assert.ok(notices[0].title.includes(title));
      });
    }
    await q(
      "update public.crm_company_billing set due_date=((now() at time zone 'America/Sao_Paulo')::date)+30 where company_id=$1",
      [id(100)],
    );
    await user(1, async () => {
      await sync();
      assert.equal(
        (await visible()).some((r) => r.kind === 'subscription_due'),
        false,
      );
    });
  });
  await t.test('conclusão de tarefa resolve os avisos correspondentes', async () => {
    await q("update public.crm_tasks set status='done' where id=$1", [id(300)]);
    await user(2, async () => {
      await sync();
      assert.equal(
        (await visible()).some((r) => r.kind === 'task_due'),
        false,
      );
    });
  });
  await t.test(
    'rebaixamento de perfil e reatribuição retiram avisos antigos imediatamente',
    async () => {
      await q(
        "update public.crm_company_billing set due_date=(now() at time zone 'America/Sao_Paulo')::date where company_id=$1",
        [id(100)],
      );
      await user(1, () => sync());
      await q("update public.crm_memberships set role='seller' where id=$1", [id(11)]);
      await user(1, async () =>
        assert.ok(
          (await visible()).every((row) => !['subscription_due', 'new_contact'].includes(row.kind)),
        ),
      );
      await q("update public.crm_memberships set role='manager' where id=$1", [id(11)]);
      await q('update public.crm_contacts set owner_membership_id=$1 where id=$2', [
        id(15),
        id(400),
      ]);
      await user(2, async () =>
        assert.equal(
          (await visible()).some((row) => row.kind === 'contact_assigned'),
          false,
        ),
      );
    },
  );
  await t.test('revogação do vínculo ou habilitação corta acesso imediatamente', async () => {
    await q('update public.crm_memberships set active=false where id=$1', [id(13)]);
    await user(3, async () => assert.equal((await visible()).length, 0));
    await q('update public.crm_companies set enabled=false where id=$1', [id(100)]);
    await user(1, async () => assert.equal((await visible()).length, 0));
    await q('update public.crm_companies set enabled=true where id=$1', [id(100)]);
  });
  await t.test(
    'administrador edita e habilita sem recriar quadros nem alterar o plano silenciosamente',
    async () => {
      const values = {
        name: 'Empresa editada',
        segment: 'Teste',
        template: 'generic',
        theme: 'blue',
        monthly_amount_cents: 20000,
        due_date: '2026-12-31',
        enabled: true,
      };
      const update = (actor, request, company = 200, hash = 'a'.repeat(64)) =>
        q('select public.crm_edge_update_company($1,$2,$3,$4,$5)', [
          id(actor),
          id(request),
          id(company),
          hash,
          values,
        ]);
      await user(7, () => denied(update(7, 950)));
      await as('service_role', null, () => denied(update(1, 951)));
      await q("insert into public.crm_companies(id,name,segment) values($1,'Sem gestor','Teste')", [
        id(250),
      ]);
      await q(
        "insert into public.crm_company_billing(company_id,monthly_amount_cents,due_date) values($1,0,'2026-12-31')",
        [id(250)],
      );
      await as('service_role', null, () =>
        assert.rejects(update(7, 952, 250), (error) => error.code === '23514'),
      );
      await q(
        "insert into public.crm_boards(id,company_id,kind,name,position) values($1,$2,'leads','Quadro personalizado',0)",
        [id(800), id(200)],
      );
      await as('service_role', null, () =>
        assert.rejects(update(7, 949), (error) => error.code === '40001'),
      );
      const currentBill = (
        await q(
          'select monthly_amount_cents,due_date::text as due_date from public.crm_company_billing where company_id=$1',
          [id(200)],
        )
      ).rows[0];
      values.monthly_amount_cents = currentBill.monthly_amount_cents;
      values.due_date = currentBill.due_date;
      await as('service_role', null, () => update(7, 953));
      const row = (
        await q('select name,template,enabled from public.crm_companies where id=$1', [id(200)])
      ).rows[0];
      assert.equal(row.name, 'Empresa editada');
      assert.equal(row.template, 'generic');
      assert.equal(row.enabled, true);
      assert.equal(
        (
          await q(
            'select due_date::text as d from public.crm_company_billing where company_id=$1',
            [id(200)],
          )
        ).rows[0].d,
        values.due_date,
      );
      assert.equal(
        (await q('select name from public.crm_boards where id=$1', [id(800)])).rows[0].name,
        'Quadro personalizado',
      );
      const audit = (
        await q('select count(*)::integer as n from public.crm_audit_events where company_id=$1', [
          id(200),
        ])
      ).rows[0].n;
      await as('service_role', null, () => update(7, 953));
      assert.equal(
        (
          await q(
            'select count(*)::integer as n from public.crm_audit_events where company_id=$1',
            [id(200)],
          )
        ).rows[0].n,
        audit,
      );
      await as('service_role', null, () =>
        assert.rejects(update(7, 953, 200, 'b'.repeat(64)), (error) => error.code === '23505'),
      );
    },
  );
  await t.test('tabela de erros só aceita escrita pelo servidor e mantém correlação', async () => {
    const event = {
      function_name: 'crm-create-company',
      request_id: id(900),
      operation_id: id(901),
      actor_user_id: id(1),
      execution_id: null,
      http_status: 503,
      error_code: 'DATABASE_UNAVAILABLE',
      safe_message: 'Não foi possível concluir a solicitação.',
      exception_type: 'HttpError',
      trace: 'handler.ts:10:2',
    };
    for (const role of ['anon', 'authenticated'])
      await as(role, role === 'authenticated' ? 1 : null, async () => {
        await denied(q('select public.crm_log_function_error($1)', [event]));
        await denied(q('select * from crm_private.function_errors'));
      });
    await as('service_role', null, async () => {
      await q('select public.crm_log_function_error($1)', [event]);
      await q('select public.crm_log_function_error($1)', [event]);
      await denied(q('select * from crm_private.function_errors'));
    });
    const rows = (
      await q('select request_id,operation_id,error_code,trace from crm_private.function_errors')
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].request_id, id(900));
    assert.equal(rows[0].operation_id, id(901));
    assert.equal(rows[0].trace, 'handler.ts:10:2');
  });
});
