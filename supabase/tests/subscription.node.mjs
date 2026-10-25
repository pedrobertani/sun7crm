import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const root = new URL('../migrations/', import.meta.url);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

test('plano: carência, gratuidade, quitação e isolamento no servidor', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const q = (sql, args = []) => db.query(sql, args);
  async function as(role, n, run) {
    await q("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
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
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;$$;
    grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
  for (const file of (await readdir(root)).filter((name) => name.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, root), 'utf8'));
  for (let n = 1; n <= 6; n++) {
    await q('insert into auth.users(id) values($1)', [id(n)]);
    await q(
      'insert into public.crm_profiles(id,display_name,password_change_required) values($1,$2,$3)',
      [id(n), `Fixture ${n}`, n === 5],
    );
  }
  for (const kind of ['terms', 'privacy']) {
    await q(
      "insert into public.crm_legal_documents(kind,version,body,content_sha256) values($1,'billing-fixture','Fixture local de teste','')",
      [kind],
    );
    await q("update public.crm_legal_requirements set version='billing-fixture' where kind=$1", [
      kind,
    ]);
    for (const n of [1, 2, 3, 4])
      await user(n, () =>
        q("insert into public.crm_legal_acceptances(kind,version) values($1,'billing-fixture')", [
          kind,
        ]),
      );
  }
  await q('insert into crm_private.platform_admins(user_id) values($1)', [id(1)]);
  const date = (await q("select (now() at time zone 'America/Sao_Paulo')::date::text as d")).rows[0]
    .d;
  const shift = (date, days) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const monthly = (date) => {
    const d = new Date(date + 'T12:00:00Z'),
      day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(
      Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()),
    );
    return d.toISOString().slice(0, 10);
  };
  for (const company of [100, 200]) {
    await q(
      "insert into public.crm_companies(id,name,segment,enabled) values($1,'Fixture','Teste',true)",
      [id(company)],
    );
    await q(
      'insert into public.crm_company_billing(company_id,monthly_amount_cents,due_date) values($1,18990,$2)',
      [id(company), shift(date, 10)],
    );
  }
  for (const [n, company, role] of [
    [2, 100, 'manager'],
    [3, 100, 'seller'],
    [4, 200, 'manager'],
    [5, 100, 'manager'],
    [6, 100, 'manager'],
  ])
    await q('insert into public.crm_memberships(id,user_id,company_id,role) values($1,$2,$3,$4)', [
      id(n + 10),
      id(n),
      id(company),
      role,
    ]);
  await q(
    "insert into public.crm_contacts(company_id,owner_membership_id,name) values($1,$2,'Fixture cliente')",
    [id(100), id(13)],
  );
  let op = 500;
  const summary = () =>
    user(
      2,
      async () =>
        (await q('select public.crm_subscription_summary($1) as result', [id(100)])).rows[0].result,
    );
  const setBill = (due, kind = 'monthly') =>
    q('update public.crm_company_billing set due_date=$1,cycle_kind=$2 where company_id=$3', [
      due,
      kind,
      id(100),
    ]);
  const payment = (operation, expected, amount = 18990, actor = 1) =>
    user(actor, () =>
      q('select public.crm_admin_record_subscription_payment($1,$2,$3,$4,$5) as result', [
        id(100),
        id(operation),
        expected,
        amount,
        'Conferido em teste',
      ]),
    );
  const grant = (operation, expected, days, actor = 1) =>
    user(actor, () =>
      q('select public.crm_admin_grant_subscription_days($1,$2,$3,$4,$5) as result', [
        id(100),
        id(operation),
        expected,
        days,
        'Cortesia de teste',
      ]),
    );
  await t.test('dias 1 e 7 liberam, dia 8 bloqueia; vencimento em São Paulo', async () => {
    for (const [offset, state, allowed] of [
      [0, 'active', true],
      [-1, 'grace', true],
      [-7, 'grace', true],
      [-8, 'blocked', false],
    ]) {
      await setBill(shift(date, offset));
      const value = await summary();
      assert.equal(value.status, state);
      assert.equal(value.access_allowed, allowed);
      const contacts = await user(3, () => q('select * from public.crm_contacts'));
      assert.equal(contacts.rows.length, allowed ? 1 : 0);
    }
    await denied(
      user(3, () =>
        q(
          "insert into public.crm_contacts(company_id,owner_membership_id,name) values($1,$2,'Bloqueado')",
          [id(100), id(13)],
        ),
      ),
    );
    assert.equal(
      (await user(3, () => q('select public.crm_company_access_status($1) as result', [id(100)])))
        .rows[0].result.status,
      'blocked',
    );
    assert.equal((await user(2, () => q('select * from public.crm_companies'))).rows.length, 1);
    assert.equal((await user(3, () => q('select * from public.crm_memberships'))).rows.length, 1);
    assert.equal(
      (await user(2, () => q('select * from public.crm_contact_history'))).rows.length,
      0,
    );
    assert.equal(
      (await user(2, () => q('select * from public.crm_contact_activity_report'))).rows.length,
      0,
    );
    await denied(
      as('service_role', null, () =>
        q('select public.crm_edge_prepare_user($1,$2,$3,$4,$5)', [
          id(2),
          id(498),
          id(100),
          'seller',
          'a'.repeat(64),
        ]),
      ),
    );
    await denied(
      as('service_role', null, () =>
        q('select public.crm_edge_begin_password_reset($1,$2,$3,$4)', [
          id(2),
          id(499),
          id(100),
          id(3),
        ]),
      ),
    );
  });
  await t.test(
    'só ADM concede dias; só ADM/gestor próprio consultam dados financeiros',
    async () => {
      await denied(user(3, () => q('select public.crm_subscription_summary($1)', [id(100)])));
      await denied(user(4, () => q('select public.crm_subscription_summary($1)', [id(100)])));
      await denied(user(5, () => q('select public.crm_subscription_summary($1)', [id(100)])));
      await denied(user(6, () => q('select public.crm_subscription_summary($1)', [id(100)])));
      await denied(
        as('anon', null, () => q('select public.crm_subscription_summary($1)', [id(100)])),
      );
      await denied(payment(++op, shift(date, -8), 18990, 2));
      await denied(grant(++op, shift(date, -8), 7, 2));
      await assert.rejects(grant(++op, shift(date, -8), 14), (error) => error.code === '22023');
    },
  );
  await t.test(
    'pagamento desconta só a carência usada, inclusive após longo bloqueio',
    async () => {
      for (const [offset, used] of [
        [-3, 3],
        [-7, 7],
        [-40, 7],
        [10, 0],
      ]) {
        const due = shift(date, offset);
        await setBill(due);
        const event = (await payment(++op, due)).rows[0].result;
        assert.equal(event.grace_days, used);
        assert.equal(event.next_due_date, shift(monthly(offset > 0 ? due : date), -used));
        assert.equal((await summary()).status, 'active');
      }
      await assert.rejects(
        payment(++op, (await summary()).due_date, 1),
        (error) => error.code === '22023',
      );
    },
  );
  await t.test(
    'quitacao idempotente e janela desatualizada não geram duas renovações',
    async () => {
      const due = shift(date, -7);
      await setBill(due);
      const operation = ++op;
      const first = (await payment(operation, due)).rows[0].result;
      assert.equal((await payment(operation, due)).rows[0].result.id, first.id);
      await assert.rejects(payment(++op, due), (error) => error.code === '40001');
      await assert.rejects(payment(operation, due, 1), (error) => error.code === '23505');
      assert.equal((await summary()).due_date, first.next_due_date);
    },
  );
  await t.test(
    'cortesias 7/15/30 preservam o período disponível e não viram carência descontável',
    async () => {
      for (const days of [7, 15, 30]) {
        await setBill(shift(date, -8));
        const operation = ++op;
        const event = (await grant(operation, shift(date, -8), days)).rows[0].result;
        assert.equal(event.next_due_date, shift(date, days));
        assert.equal((await summary()).status, 'complimentary');
        assert.equal((await grant(operation, shift(date, -8), days)).rows[0].result.id, event.id);
        await setBill(date, 'complimentary');
        assert.equal((await summary()).status, 'blocked');
        const paid = (await payment(++op, date)).rows[0].result;
        assert.equal(paid.grace_days, 0);
        assert.equal(paid.next_due_date, monthly(date));
      }
      await setBill(shift(date, 20));
      assert.equal(
        (await grant(++op, shift(date, 20), 7)).rows[0].result.next_due_date,
        shift(date, 27),
      );
    },
  );
  await t.test(
    'histórico é imutável, sem escrita direta e sem vazamento para vendedores/outras empresas',
    async () => {
      assert.ok(
        (await user(2, () => q('select * from public.crm_subscription_events'))).rows.length > 0,
      );
      assert.equal(
        (await user(3, () => q('select * from public.crm_subscription_events'))).rows.length,
        0,
      );
      assert.equal(
        (await user(4, () => q('select * from public.crm_subscription_events'))).rows.length,
        0,
      );
      for (const actor of [1, 2]) {
        await denied(
          user(actor, () => q('update public.crm_subscription_events set amount_cents=0')),
        );
        await denied(user(actor, () => q('delete from public.crm_subscription_events')));
        await denied(
          user(actor, () =>
            q(
              'update public.crm_company_billing set due_date=current_date+100 where company_id=$1',
              [id(100)],
            ),
          ),
        );
      }
    },
  );
  await t.test(
    'gestor recebe aviso diário de carência e pode ler o aviso mesmo bloqueado',
    async () => {
      await setBill(shift(date, -3));
      await user(2, () => q('select public.crm_refresh_notifications()'));
      let notices = (
        await user(2, () =>
          q("select * from public.crm_notifications where kind='subscription_due'"),
        )
      ).rows;
      assert.equal(notices.length, 1);
      assert.match(notices[0].body, /Dia 3 de 7/);
      await user(2, () => q('select public.crm_mark_notifications_read($1)', [[notices[0].id]]));
      await user(2, () => q('select public.crm_refresh_notifications()'));
      assert.ok(
        (
          await user(2, () =>
            q("select * from public.crm_notifications where kind='subscription_due'"),
          )
        ).rows[0].read_at,
      );
      await setBill(shift(date, -8));
      await user(2, () => q('select public.crm_refresh_notifications()'));
      notices = (
        await user(2, () =>
          q("select * from public.crm_notifications where kind='subscription_due'"),
        )
      ).rows;
      assert.equal(notices.length, 1);
      assert.match(notices[0].title, /suspenso/);
      await user(3, () => q('select public.crm_refresh_notifications()'));
      assert.equal(
        (await user(3, () => q('select * from public.crm_notifications'))).rows.length,
        0,
      );
      await payment(++op, shift(date, -8));
      assert.equal(
        (
          await user(2, () =>
            q("select * from public.crm_notifications where kind='subscription_due'"),
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test('cadastro novo usa R$189,90 e aguarda pagamento ou cortesia', async () => {
    const created = (
      await as('service_role', null, () =>
        q('select public.crm_edge_create_company($1,$2,$3,$4) as result', [
          id(1),
          id(++op),
          'a'.repeat(64),
          {
            name: 'Nova fixture',
            segment: 'Teste',
            template: 'generic',
            theme: 'blue',
            monthly_amount_cents: 12345,
            due_date: '2099-01-01',
          },
        ]),
      )
    ).rows[0].result;
    const bill = (
      await q('select * from public.crm_company_billing where company_id=$1', [created])
    ).rows[0];
    assert.equal(bill.monthly_amount_cents, 18990);
    assert.equal(bill.cycle_kind, 'awaiting_payment');
    assert.equal(
      (await q('select crm_private.subscription_allows_access($1) as result', [created])).rows[0]
        .result,
      false,
    );
  });
});
