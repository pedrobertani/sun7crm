import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './helpers/db.mjs';

test('cobranças: histórico, autorização, confirmação e recibos do provedor', async (t) => {
  const { q, as, user, id } = await fixture(t);
  const result = async (promise) => (await promise).rows[0].result;
  const bill = async () =>
    (
      await q(
        'select due_date::text,cycle_kind from public.crm_company_billing where company_id=$1',
        [id(100)],
      )
    ).rows[0];
  const date = (await q("select (now() at time zone 'America/Sao_Paulo')::date::text d")).rows[0].d;
  const history = (actor = 1, company = 100, status = 'all', offset = 0) =>
    result(
      user(actor, () =>
        q("select public.crm_billing_history($1,$2,null,null,'',$3) result", [
          company ? id(company) : null,
          status,
          offset,
        ]),
      ),
    );
  const create = async (operation, actor = 7, company = 100, due = null) =>
    result(
      user(actor, () =>
        q('select public.crm_admin_create_subscription_charge($1,$2,$3,$4) result', [
          id(company),
          id(operation),
          due || currentDue,
          'Cobrança de teste',
        ]),
      ),
    );
  const manage = (charge, action = 'confirm', note = 'Conferido', method = 'pix', actor = 7) =>
    result(
      user(actor, () =>
        q('select public.crm_admin_manage_subscription_charge($1,$2,$3,$4) result', [
          charge,
          action,
          note,
          method,
        ]),
      ),
    );
  const service = (name, args) =>
    result(
      as('service_role', null, () =>
        q(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) result`, args),
      ),
    );
  const received = (
    reference,
    payment,
    amount = 18990,
    status = 'approved',
    subscription = false,
    cycle = null,
  ) =>
    service('crm_edge_apply_provider_payment', [
      reference,
      subscription,
      String(payment),
      amount,
      status,
      'pix',
      status === 'approved' ? new Date().toISOString() : null,
      cycle,
    ]);
  const denied = (promise) => assert.rejects(promise, (e) => e.code === '42501');
  let currentDue = (await bill()).due_date;
  await t.test(
    'criar não renova; repetição é idempotente e duplicação do ciclo é bloqueada',
    async () => {
      const before = await bill(),
        first = await create(7001),
        repeated = await create(7001);
      assert.equal(first.id, repeated.id);
      assert.equal(first.amount_cents, 18990);
      assert.deepEqual(await bill(), before);
      await assert.rejects(create(7002), (e) => e.code === '23505');
      await assert.rejects(create(7001, 7, 200), (e) => e.code === '23505');
      assert.equal((await history()).records.length, 1);
    },
  );
  await t.test(
    'só gestor próprio/ADM leem; colaboradores, outras empresas e escrita direta são bloqueados',
    async () => {
      for (const n of [2, 3, 4, 6, 8]) await denied(history(n));
      await denied(history(1, null));
      await denied(create(7010, 1));
      await denied(manage(id(7001), 'confirm', '', 'pix', 1));
      await denied(as('anon', null, () => q('select public.crm_billing_history()')));
      assert.equal(
        (await user(2, () => q('select * from public.crm_subscription_charges'))).rows.length,
        0,
      );
      assert.equal(
        (await user(4, () => q('select * from public.crm_subscription_charges'))).rows.length,
        0,
      );
      await denied(
        user(1, () =>
          q("update public.crm_subscription_charges set status='paid' where id=$1", [id(7001)]),
        ),
      );
      await denied(
        user(1, () =>
          q(
            "select public.crm_edge_apply_provider_payment($1,false,'999',18990,'approved','pix',now(),null)",
            [id(7001)],
          ),
        ),
      );
    },
  );
  await t.test(
    'recebimento manual renova uma única vez e preserva o meio de pagamento',
    async () => {
      const first = await manage(id(7001)),
        due = (await bill()).due_date;
      const repeat = await manage(id(7001));
      assert.equal(first.id, repeat.id);
      assert.equal((await bill()).due_date, due);
      const rows = (await history()).records;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].display_status, 'paid');
      assert.equal(rows[0].payment_method, 'pix');
      assert.equal(rows[0].event_id, first.id);
      await assert.rejects(manage(id(7001), 'cancel'), (e) => e.code === '40001');
      currentDue = due;
    },
  );
  await t.test(
    'cancelamento exige motivo e não remove acesso; cobrança desatualizada não renova',
    async () => {
      await create(7003);
      const before = await bill();
      await assert.rejects(manage(id(7003), 'cancel', ''), (e) => e.code === '22023');
      await manage(id(7003), 'cancel', 'Cancelada em teste');
      await manage(id(7003), 'cancel', 'Repetição');
      assert.deepEqual(await bill(), before);
      await create(7004);
      await q('update public.crm_company_billing set due_date=due_date+1 where company_id=$1', [
        id(100),
      ]);
      await assert.rejects(manage(id(7004)), (e) => e.code === '40001');
      assert.equal((await history()).records.find((r) => r.id === id(7004)).status, 'pending');
      await manage(id(7004), 'cancel', 'Plano alterado');
      currentDue = (await bill()).due_date;
    },
  );
  await t.test(
    'vencimento é calculado no servidor e filtros/paginação não vazam dados',
    async () => {
      await q('update public.crm_company_billing set due_date=$1::date-1 where company_id=$2', [
        date,
        id(100),
      ]);
      currentDue = (await bill()).due_date;
      await create(7005);
      const data = await history(7, null, 'overdue');
      assert.equal(data.total, 1);
      assert.equal(data.totals.overdue_cents, 18990);
      assert.equal(data.records[0].display_status, 'overdue');
      assert.equal((await history(7, null, 'paid')).totals.pending_count, 1);
      assert.equal((await history(7, null, 'all', 20)).records.length, 0);
      const range = await result(
        user(7, () => q("select public.crm_billing_history(null,'all',$1,$1,'',0) result", [date])),
      );
      assert.equal(range.total, 0);
      await manage(id(7005), 'cancel', 'Fim do teste');
    },
  );
  let online;
  await t.test(
    'checkout autentica o gestor; preço vem do servidor e criação é reivindicada uma vez',
    async () => {
      for (const actor of [2, 3, 4, 6, 8])
        await denied(service('crm_edge_billing_context', [id(actor), id(100)]));
      await denied(service('crm_edge_begin_checkout', [id(7), id(100), id(7100), 'one_time']));
      online = await service('crm_edge_begin_checkout', [id(1), id(100), id(7100), 'one_time']);
      assert.equal(online.checkout.amount_cents, 18990);
      assert.equal(online.email, 'fixture@example.invalid');
      assert.equal(
        (await service('crm_edge_begin_checkout', [id(1), id(100), id(7101), 'one_time'])).checkout
          .id,
        online.checkout.id,
      );
      assert.equal(
        await service('crm_edge_claim_checkout', [id(1), id(100), online.checkout.id, 'one_time']),
        true,
      );
      assert.equal(
        await service('crm_edge_claim_checkout', [id(1), id(100), online.checkout.id, 'one_time']),
        false,
      );
    },
  );
  await t.test(
    'pagamento pendente não libera; aprovação renova uma vez; confirmação antiga não desfaz aprovação',
    async () => {
      const before = await bill();
      await received(online.checkout.id, 8100, 18990, 'pending');
      assert.deepEqual(await bill(), before);
      await received(online.checkout.id, 8100);
      const after = await bill();
      assert.notEqual(after.due_date, before.due_date);
      await received(online.checkout.id, 8100);
      await received(online.checkout.id, 8100, 18990, 'pending');
      assert.deepEqual(await bill(), after);
      const rows = (await history()).records.filter((r) => r.provider_payment_id === '8100');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'paid');
      await received(online.checkout.id, 8101);
      assert.deepEqual(await bill(), after);
      assert.equal((await history()).totals.review_count, 1);
    },
  );
  await t.test(
    'valor divergente e plano alterado ficam para conferência e preservam o acesso',
    async () => {
      const prepared = await service('crm_edge_begin_checkout', [
        id(1),
        id(100),
        id(7102),
        'one_time',
      ]);
      const before = await bill();
      await received(prepared.checkout.id, 8102, 100);
      assert.deepEqual(await bill(), before);
      const charge = (await history()).records.find((r) => r.provider_payment_id === '8102');
      assert.equal(charge.received_amount_cents, 100);
      assert.equal(charge.needs_review, true);
      assert.equal(charge.event_id, null);
      const next = await service('crm_edge_begin_checkout', [id(1), id(100), id(7103), 'one_time']);
      await q('update public.crm_company_billing set due_date=due_date+1 where company_id=$1', [
        id(100),
      ]);
      const changed = await bill();
      await received(next.checkout.id, 8103);
      assert.deepEqual(await bill(), changed);
      assert.equal(
        (await history()).records.find((r) => r.provider_payment_id === '8103').needs_review,
        true,
      );
    },
  );
  await t.test(
    'assinatura autorizada não concede acesso; recibo por ciclo deduplica renovação',
    async () => {
      const prepared = await service('crm_edge_begin_checkout', [
        id(1),
        id(100),
        id(7200),
        'subscription',
      ]);
      const agreement = prepared.checkout.id,
        before = await bill();
      await service('crm_edge_update_agreement', [agreement, 'agreement-test', 'authorized']);
      assert.deepEqual(await bill(), before);
      await received(agreement, 8200, 18990, 'approved', true, date);
      const after = await bill();
      await received(agreement, 8200, 18990, 'approved', true, date);
      assert.deepEqual(await bill(), after);
      await received(agreement, 8201, 18990, 'approved', true, date);
      assert.deepEqual(await bill(), after);
      assert.equal(
        (await history()).records.find((r) => r.provider_payment_id === '8201').needs_review,
        true,
      );
      await service('crm_edge_update_agreement', [agreement, 'agreement-test', 'cancelled']);
      assert.deepEqual(await bill(), after);
    },
  );
  await t.test(
    'estorno preserva trilha e exige conferência; recibo repetido não reativa o pagamento',
    async () => {
      await received(online.checkout.id, 8100, 18990, 'refunded');
      const refunded = (await history()).records.find((r) => r.provider_payment_id === '8100');
      assert.equal(refunded.status, 'refunded');
      assert.equal(refunded.needs_review, true);
      assert.ok(refunded.event_id);
      await received(online.checkout.id, 8100);
      assert.equal(
        (await history()).records.find((r) => r.provider_payment_id === '8100').status,
        'refunded',
      );
    },
  );
  await t.test(
    'conferência exige ADM e motivo; repetição do estorno não reabre análise concluída',
    async () => {
      await denied(manage(online.checkout.id, 'review', 'Analisado', 'unknown', 1));
      await assert.rejects(manage(online.checkout.id, 'review', ''), (e) => e.code === '22023');
      await manage(online.checkout.id, 'review', 'Conferência concluída em teste');
      await received(online.checkout.id, 8100, 18990, 'refunded');
      const reviewed = (await history()).records.find((r) => r.provider_payment_id === '8100');
      assert.equal(reviewed.needs_review, false);
      assert.ok(reviewed.reviewed_at);
      assert.equal(reviewed.review_note, 'Conferência concluída em teste');
    },
  );
  await t.test(
    'pagamento de teste fica identificado e não renova acesso nem soma receita real',
    async () => {
      const before = await bill(),
        totals = (await history()).totals;
      const prepared = await service('crm_edge_begin_checkout', [
        id(1),
        id(100),
        id(7300),
        'one_time',
        'test',
      ]);
      assert.equal(prepared.checkout.environment, 'test');
      await service('crm_edge_apply_provider_payment', [
        prepared.checkout.id,
        false,
        '8300',
        18990,
        'approved',
        'pix',
        new Date().toISOString(),
        null,
        'test',
      ]);
      assert.deepEqual(await bill(), before);
      assert.equal((await history()).totals.paid_cents, totals.paid_cents);
      const charge = (await history()).records.find((r) => r.provider_payment_id === '8300');
      assert.equal(charge.environment, 'test');
      assert.equal(charge.event_id, null);
      assert.equal(charge.status, 'paid');
      const ignored = await service('crm_edge_apply_provider_payment', [
        prepared.checkout.id,
        false,
        '8300',
        18990,
        'approved',
        'pix',
        new Date().toISOString(),
        null,
        'production',
      ]);
      assert.equal(ignored.ignored, true);
    },
  );
  await t.test(
    'gestor mantém histórico durante bloqueio, sem expor financeiro aos funcionários',
    async () => {
      await q('update public.crm_company_billing set due_date=$1::date-20 where company_id=$2', [
        date,
        id(100),
      ]);
      assert.ok((await history()).total > 0);
      await denied(history(2));
      assert.equal(
        (await user(2, () => q('select * from public.crm_subscription_agreements'))).rows.length,
        0,
      );
    },
  );
});
