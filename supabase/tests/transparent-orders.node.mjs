import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './helpers/db.mjs';
test('Orders: isolamento, idempotência e pagamentos de teste no banco', async (t) => {
  const { q, as, user, id } = await fixture(t);
  const service = async (name, args) =>
    (
      await as('service_role', null, () =>
        q(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`, args),
      )
    ).rows[0].result;
  const prepare = (actor, company, request, method = 'pix', env = 'test') =>
    service('crm_edge_prepare_order', [id(actor), id(company), id(request), method, env]);
  const bill = async () =>
    (
      await q('select due_date::text from public.crm_company_billing where company_id=$1', [
        id(100),
      ])
    ).rows[0];
  const record = (attempt, n, status, env = 'test', amount = 18990, method = 'pix') =>
    service('crm_edge_record_order', [
      id(attempt),
      'ORD' + String(n).padStart(26, '0'),
      status,
      'PAY' + String(n).padStart(26, '0'),
      amount,
      method,
      status === 'approved' ? '2026-10-27T12:00:00Z' : null,
      env,
    ]);
  const denied = (p) => assert.rejects(p, (e) => e.code === '42501');
  await t.test('funcionários, recepção, outra empresa e ADM não iniciam pagamentos', async () => {
    for (const actor of [2, 3, 4, 6, 7, 8]) await denied(prepare(actor, 100, 9000 + actor));
    await denied(
      user(1, () =>
        q("select public.crm_edge_prepare_order($1,$2,$3,'pix','test')", [
          id(1),
          id(100),
          id(9001),
        ]),
      ),
    );
    await denied(user(1, () => q('select * from crm_private.payment_attempts')));
  });
  await t.test(
    'uma tentativa ativa por cobrança; repetição recupera a mesma referência',
    async () => {
      const first = await prepare(1, 100, 9100),
        repeat = await prepare(1, 100, 9100),
        other = await prepare(1, 100, 9101);
      assert.equal(first.created, true);
      assert.equal(repeat.created, false);
      assert.equal(other.created, false);
      assert.equal(other.attempt.id, first.attempt.id);
      assert.equal(first.amount_cents, 18990);
      await assert.rejects(prepare(1, 100, 9100, 'credit_card'), (e) => e.code === '23505');
      await denied(service('crm_edge_order_context', [id(4), id(100), id(9100), 'test']));
      assert.equal(
        await service('crm_edge_order_context', [id(4), id(200), id(9100), 'test']),
        null,
      );
    },
  );
  await t.test(
    'pendente preserva acesso; aprovação de teste registra uma vez sem receita real',
    async () => {
      const before = await bill();
      await record(9100, 1, 'pending');
      assert.deepEqual(await bill(), before);
      await record(9100, 1, 'approved');
      await record(9100, 1, 'approved');
      await record(9100, 1, 'pending');
      assert.deepEqual(await bill(), before);
      const rows = (
        await q('select * from public.crm_subscription_charges where provider_payment_id=$1', [
          'PAY' + '1'.padStart(26, '0'),
        ])
      ).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'paid');
      assert.equal(rows[0].event_id, null);
      const history = (
        await user(1, () =>
          q("select public.crm_billing_history($1,'all',null,null,'',0) result", [id(100)]),
        )
      ).rows[0].result;
      assert.equal(history.totals.paid_cents, 0);
      assert.equal(
        (await service('crm_edge_order_context', [id(1), id(100), id(9100), 'test'])).attempt
          .status,
        'approved',
      );
    },
  );
  await t.test('outro ambiente e outra order não podem alterar a tentativa', async () => {
    assert.equal((await record(9100, 1, 'approved', 'production')).ignored, true);
    await assert.rejects(record(9100, 2, 'approved'), (e) => e.code === '23505');
    await assert.rejects(
      record(9100, 1, 'approved', 'test', 18990, 'credit_card'),
      (e) => e.code === '22023',
    );
  });
  await t.test(
    'rejeição definitiva permite nova tentativa; estorno preserva a trilha',
    async () => {
      await prepare(1, 100, 9102);
      await service('crm_edge_reject_order_input', [id(1), id(100), id(9102), 'test']);
      const next = await prepare(1, 100, 9103);
      assert.equal(next.created, true);
      await record(9103, 3, 'rejected');
      assert.equal((await prepare(1, 100, 9104)).created, true);
      await record(9100, 1, 'refunded');
      await record(9100, 1, 'approved');
      const row = (
        await q('select status from crm_private.payment_attempts where id=$1', [id(9100)])
      ).rows[0];
      assert.equal(row.status, 'refunded');
    },
  );
});
