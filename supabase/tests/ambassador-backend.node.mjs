import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';
const denied = (p) => assert.rejects(p, (e) => e.code === '42501');
test('campanhas: pontos inteiros, quitação única e estornos auditáveis', async (t) => {
  const { q, user, as, card } = await fixture(t);
  let op = 9000;
  const date = (await q("select (now() at time zone 'America/Sao_Paulo')::date::text as d")).rows[0]
    .d;
  const ambassador = (
    await user(1, () =>
      q(
        "insert into public.crm_ambassadors(company_id,contact_id,category,commission_enabled) values($1,$2,'Consultora',true) returning *",
        [id(100), id(1001)],
      ),
    )
  ).rows[0];
  const other = (
    await user(1, () =>
      q('insert into public.crm_ambassadors(company_id,contact_id) values($1,$2) returning *', [
        id(100),
        id(1002),
      ]),
    )
  ).rows[0];
  async function campaign(mode = 'per_point', rate = 10000) {
    return (
      await user(1, () =>
        q(
          "insert into public.crm_ambassador_campaigns(company_id,name,starts_on,ends_on,payment_mode,rate_cents,rate_bps) values($1,'Campanha fixture',$2::date-20,$2::date+20,$3,$4,$5) returning *",
          [id(100), date, mode, mode === 'per_point' ? rate : 0, mode === 'percentage' ? rate : 0],
        ),
      )
    ).rows[0];
  }
  async function referral(
    c,
    amount,
    { paid = true, attended = true, person = ambassador.id } = {},
  ) {
    const opportunity = await card();
    const request = id(++op);
    const args = [
      id(100),
      null,
      c.id,
      person,
      opportunity.id,
      { value_cents: amount, sold_on: date, paid, attended },
      request,
      null,
    ];
    const result = (
      await user(1, () =>
        q('select public.crm_save_referral($1,$2,$3,$4,$5,$6,$7,$8) as result', args),
      )
    ).rows[0].result;
    return { result, args };
  }
  const totals = (c, a = ambassador.id) =>
    user(1, async () => {
      const row = (
        await q(
          'select * from public.crm_ambassador_campaign_totals where campaign_id=$1 and ambassador_id=$2',
          [c.id, a],
        )
      ).rows[0];
      if (row)
        for (const key of ['amount_cents', 'balance_cents']) {
          row[key] = Number(row[key]);
          assert.ok(Number.isSafeInteger(row[key]));
        }
      return row;
    });
  const pay = (c, amount, request = id(++op), actor = 1) =>
    user(actor, () =>
      q('select public.crm_record_campaign_payment($1,$2,$3,$4,$5) as result', [
        id(100),
        c.id,
        ambassador.id,
        amount,
        request,
      ]),
    );
  const close = (c, pending = false, request = id(++op)) =>
    user(1, () =>
      q('select public.crm_close_campaign($1,$2,$3,$4,$5) as result', [
        id(100),
        c.id,
        c.row_version,
        request,
        pending,
      ]),
    );
  const c = await campaign();
  let first, second;
  await t.test(
    'vínculo não promove perfil; código é individual e acesso comercial é exclusivo do gestor',
    async () => {
      assert.equal(other.commission_enabled, false);
      assert.match(ambassador.referral_code, /^[A-Z0-9]{12}$/);
      assert.equal(
        (await q('select role from public.crm_memberships where id=$1', [id(12)])).rows[0].role,
        'seller',
      );
      for (const actor of [2, 3, 4, 7]) {
        assert.equal(
          (await user(actor, () => q('select * from public.crm_ambassadors'))).rows.length,
          0,
        );
        await denied(pay(c, 10000, id(++op), actor));
      }
      await denied(
        as('anon', null, () =>
          q('select public.crm_close_campaign($1,$2,1,$3)', [id(100), c.id, id(++op)]),
        ),
      );
      await assert.rejects(
        user(1, () =>
          q('insert into public.crm_ambassadors(company_id,contact_id) values($1,$2)', [
            id(100),
            id(1001),
          ]),
        ),
        (e) => e.code === '23505',
      );
      await denied(
        user(2, () =>
          q('insert into public.crm_ambassadors(company_id,contact_id) values($1,$2)', [
            id(100),
            id(1001),
          ]),
        ),
      );
    },
  );
  await t.test('soma R$600+R$900=1 ponto; falta de pagamento/presença não pontua', async () => {
    first = await referral(c, 60000);
    second = await referral(c, 90000);
    await referral(c, 500000, { paid: false });
    await referral(c, 500000, { attended: false });
    await referral(c, 500000, { person: other.id });
    const result = await totals(c);
    assert.equal(result.eligible_cents, 150000);
    assert.equal(result.points, 1);
    assert.equal(result.amount_cents, 10000);
    assert.equal(result.remaining_points, 1);
    const noCommission = await totals(c, other.id);
    assert.equal(noCommission.points, 5);
    assert.equal(noCommission.amount_cents, 0);
    const repeated = (
      await user(1, () =>
        q('select public.crm_save_referral($1,$2,$3,$4,$5,$6,$7,$8) as result', first.args),
      )
    ).rows[0].result;
    assert.equal(repeated.id, first.result.id);
    const duplicate = [...first.args];
    duplicate[6] = id(++op);
    await assert.rejects(
      user(1, () => q('select public.crm_save_referral($1,$2,$3,$4,$5,$6,$7,$8)', duplicate)),
      (e) => e.code === '23505',
    );
  });
  await t.test(
    'fechamento exige conferência de pendências e congela elegibilidade/configuração',
    async () => {
      await assert.rejects(pay(c, 10000), (e) => e.code === '23514');
      await assert.rejects(close(c), (e) => e.code === '23514');
      const request = id(++op);
      const closed = (await close(c, true, request)).rows[0].result;
      assert.equal(closed.status, 'closed');
      assert.equal((await close(c, true, request)).rows[0].result.id, c.id);
      await user(1, () =>
        q('update public.crm_ambassadors set commission_enabled=false where id=$1', [
          ambassador.id,
        ]),
      );
      await user(1, () =>
        q('update public.crm_ambassadors set commission_enabled=true where id=$1', [other.id]),
      );
      assert.equal((await totals(c)).amount_cents, 10000);
      assert.equal((await totals(c, other.id)).amount_cents, 0);
      await assert.rejects(
        user(1, () =>
          q('update public.crm_ambassador_campaigns set rate_cents=99999 where id=$1', [c.id]),
        ),
        (e) => e.code === '23514',
      );
      await assert.rejects(referral(c, 100000), (e) => e.code === '23514');
    },
  );
  await t.test(
    'quitação conserva pontos/valor do cálculo e não duplica em duas solicitações',
    async () => {
      await assert.rejects(pay(c, 20000), (e) => e.code === '40001');
      const request = id(++op);
      const payment = (await pay(c, 10000, request)).rows[0].result;
      assert.equal(payment.points, 1);
      assert.equal(payment.eligible_cents, 150000);
      assert.equal((await pay(c, 10000, request)).rows[0].result.id, payment.id);
      await assert.rejects(pay(c, 10000), (e) => e.code === '23505');
      const result = await totals(c);
      assert.equal(result.balance_cents, 0);
      assert.equal(result.remaining_points, 0);
      assert.equal(result.settled, true);
      await denied(user(1, () => q('delete from public.crm_campaign_payments')));
      await denied(user(1, () => q('update public.crm_campaign_payments set amount_cents=0')));
      await denied(user(1, () => q('update public.crm_ambassador_referrals set paid=true')));
    },
  );
  await t.test(
    'estorno após quitação mantém pagamento e apresenta ajuste negativo, sem outra campanha',
    async () => {
      const request = id(++op);
      const args = [
        id(100),
        second.result.id,
        second.result.row_version,
        60000,
        false,
        'Devolução parcial declarada',
        request,
      ];
      const adjusted = (
        await user(1, () =>
          q('select public.crm_adjust_referral($1,$2,$3,$4,$5,$6,$7) as result', args),
        )
      ).rows[0].result;
      assert.equal(
        (
          await user(1, () =>
            q('select public.crm_adjust_referral($1,$2,$3,$4,$5,$6,$7) as result', args),
          )
        ).rows[0].result.id,
        adjusted.id,
      );
      const result = await totals(c);
      assert.equal(result.eligible_cents, 90000);
      assert.equal(result.points, 0);
      assert.equal(result.paid_cents, 10000);
      assert.equal(result.balance_cents, -10000);
      assert.equal(result.remaining_points, 0);
      const separate = await campaign();
      assert.equal((await totals(separate)).balance_cents, 0);
      await assert.rejects(
        user(1, () =>
          q('select public.crm_adjust_referral($1,$2,$3,$4,$5,$6,$7)', [
            id(100),
            second.result.id,
            adjusted.row_version,
            90001,
            false,
            'Inválido',
            id(++op),
          ]),
        ),
        (e) => e.code === '22023',
      );
      await denied(
        user(2, () =>
          q('select public.crm_adjust_referral($1,$2,$3,$4,$5,$6,$7)', [
            id(100),
            second.result.id,
            adjusted.row_version,
            0,
            false,
            'Invasão',
            id(++op),
          ]),
        ),
      );
    },
  );
  await t.test(
    'percentuais usam pontos-base e arredondam centavos; estornos nunca somem do histórico',
    async () => {
      await user(1, () =>
        q('update public.crm_ambassadors set commission_enabled=true where id=$1', [ambassador.id]),
      );
      const percent = await campaign('percentage', 750);
      await referral(percent, 150050);
      assert.equal((await totals(percent)).amount_cents, 11254);
      await close(percent);
      const result = (await pay(percent, 11254)).rows[0].result;
      assert.equal(result.points, 1);
      assert.equal(result.amount_cents, 11254);
      assert.ok(
        (
          await user(1, () =>
            q("select * from public.crm_referral_revisions where kind='adjusted'"),
          )
        ).rows.length > 0,
      );
      assert.equal(
        (await user(2, () => q('select * from public.crm_campaign_payments'))).rows.length,
        0,
      );
      assert.equal(
        (await user(4, () => q('select * from public.crm_ambassador_campaign_totals'))).rows.length,
        0,
      );
    },
  );
});
