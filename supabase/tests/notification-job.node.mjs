import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

test('job de notificações sem sessão: persistência, deduplicação e permissões', async (t) => {
  const { q, user, as } = await fixture(t);
  const run = async () =>
    (await q('select crm_private.run_notification_job() as changed')).rows[0].changed;
  const all = async () => (await q('select * from public.crm_notifications order by id')).rows;
  const cards = async (actor) =>
    (
      await user(actor, () =>
        q("select * from public.crm_notifications where kind like 'card_%' order by entity_id"),
      )
    ).rows;

  for (const [n, company, contact, board, stage, age, closed, future] of [
    [5001, 100, 1001, 3001, 3101, '169 hours', false, false],
    [5002, 100, 1001, 3001, 3101, '73 hours', false, false],
    [5003, 100, 1002, 3001, 3101, '169 hours', false, false],
    [5004, 200, 2001, 4001, 4101, '169 hours', false, false],
    [5005, 100, 1001, 3001, 3101, '169 hours', true, false],
    [5006, 100, 1001, 3001, 3101, '169 hours', false, true],
  ]) {
    await q(
      "insert into public.crm_opportunities(id,company_id,contact_id,board_id,stage_id,title,created_at,is_closed,follow_up_at) values($1,$2,$3,$4,$5,'Fixture do cron',statement_timestamp()-$6::interval,$7,case when $8 then statement_timestamp()+interval '2 days' when $9 then statement_timestamp()-interval '25 hours' else null end)",
      [id(n), id(company), id(contact), id(board), id(stage), age, closed, future, n === 5001],
    );
  }

  await t.test(
    'gera avisos com auth.uid() nulo para destinatários elegíveis de cada empresa',
    async () => {
      assert.equal((await q('select auth.uid() as actor')).rows[0].actor, null);
      assert.ok((await run()) > 0);
      assert.deepEqual(
        (await cards(2)).map((n) => [n.entity_id, n.kind]),
        [
          [id(5001), 'card_first_response'],
          [id(5002), 'card_idle'],
        ],
      );
      assert.deepEqual(
        (await cards(1)).map((n) => n.entity_id),
        [id(5003)],
      );
      assert.deepEqual(
        (await cards(4)).map((n) => n.entity_id),
        [id(5004)],
      );
      assert.deepEqual(
        (await cards(5)).map((n) => n.entity_id),
        [id(5003)],
      );
      assert.equal((await cards(3)).length, 0);
      assert.ok((await all()).every((n) => ![id(6), id(8)].includes(n.recipient_user_id)));
    },
  );

  await t.test(
    'execuções repetidas preservam IDs, data, leitura e não regravam avisos estáveis',
    async () => {
      const notice = (await cards(2)).find((n) => n.entity_id === id(5002));
      await user(2, () => q('select public.crm_mark_notifications_read($1)', [[notice.id]]));
      const before = await all();
      for (let n = 0; n < 3; n++) assert.equal(await run(), 0);
      assert.deepEqual(await all(), before);
      assert.ok((await cards(2)).find((n) => n.id === notice.id).read_at);
    },
  );

  await t.test('uma nova faixa de atraso gera um novo evento e resolve o anterior', async () => {
    const first = (await cards(2)).find((n) => n.entity_id === id(5001));
    await q(
      "update public.crm_opportunities set follow_up_at=statement_timestamp()-interval '73 hours' where id=$1",
      [id(5001)],
    );
    assert.ok((await run()) > 0);
    const current = (await cards(2)).find((n) => n.entity_id === id(5001));
    assert.equal(current.kind, 'card_idle');
    assert.notEqual(current.id, first.id);
    assert.equal(current.read_at, null);
    assert.equal((await all()).find((n) => n.id === first.id).active, false);
    assert.equal(await run(), 0);
  });

  await t.test(
    'acompanhamento vinculado ao card resolve o aviso sem afetar outros cards',
    async () => {
      await user(2, () =>
        q(
          "insert into public.crm_contact_history(company_id,contact_id,opportunity_id,kind,title,body) values($1,$2,$3,'note','Fixture','Atendimento registrado')",
          [id(100), id(1001), id(5002)],
        ),
      );
      await run();
      assert.deepEqual(
        (await cards(2)).map((n) => n.entity_id),
        [id(5001)],
      );
    },
  );

  await t.test(
    'os clientes não podem executar o job, consultar candidatos globais ou fabricar destinatários',
    async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        for (const signature of [
          'crm_private.run_notification_job()',
          'crm_private.notification_candidates(uuid)',
          'crm_private.reconcile_notifications(uuid)',
        ]) {
          assert.equal(
            (
              await q('select has_function_privilege($1,$2,$3) as allowed', [
                role,
                signature,
                'EXECUTE',
              ])
            ).rows[0].allowed,
            false,
          );
        }
        await assert.rejects(
          as(role, role === 'authenticated' ? 2 : null, () =>
            q('select crm_private.run_notification_job()'),
          ),
          (e) => e.code === '42501',
        );
      }
      const foreign = (await all()).find((n) => n.recipient_user_id === id(4));
      const result = await user(2, () =>
        q('select public.crm_mark_notifications_read($1) as changed', [[foreign.id]]),
      );
      assert.equal(result.rows[0].changed, 0);
      assert.equal((await all()).find((n) => n.id === foreign.id).read_at, null);
    },
  );

  await t.test('revogar vínculo ou habilitação resolve os avisos daquele acesso', async () => {
    await q('update public.crm_memberships set active=false where id=$1', [id(15)]);
    await q('update public.crm_companies set enabled=false where id=$1', [id(200)]);
    await run();
    assert.ok(
      (await all())
        .filter((n) => n.recipient_user_id === id(5) || n.company_id === id(200))
        .every((n) => !n.active),
    );
  });

  await t.test('bloqueio do plano preserva somente os avisos financeiros do gestor', async () => {
    await q(
      "update public.crm_company_billing set due_date=(statement_timestamp() at time zone 'America/Sao_Paulo')::date-8,cycle_kind='monthly' where company_id=$1",
      [id(100)],
    );
    await run();
    const active = (await all()).filter((n) => n.active);
    assert.equal(active.length, 1);
    assert.equal(active[0].kind, 'subscription_due');
    assert.equal(active[0].recipient_user_id, id(1));
    assert.equal((await user(2, () => q('select * from public.crm_notifications'))).rows.length, 0);
  });
});
