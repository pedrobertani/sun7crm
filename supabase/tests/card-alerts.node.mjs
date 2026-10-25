import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';
test('alertas por card: prazos fixos de 24h, 3/7 dias e histórico do gestor', async (t) => {
  const { q, user, card } = await fixture(t);
  const seeds = [
    [5001, 100, 1001, 3001, 3101, '25 hours', false, false],
    [5002, 100, 1001, 3001, 3101, '73 hours', false, false],
    [5003, 100, 1001, 3001, 3101, '169 hours', false, false],
    [5004, 100, 1002, 3001, 3101, '169 hours', false, false],
    [5005, 200, 2001, 4001, 4101, '500 hours', false, false],
    [5006, 100, 1001, 3001, 3101, '500 hours', true, false],
    [5007, 100, 1001, 3001, 3101, '500 hours', false, true],
  ];
  for (const [n, company, contact, board, stage, age, closed, future] of seeds)
    await q(
      "insert into public.crm_opportunities(id,company_id,contact_id,board_id,stage_id,title,created_at,is_closed,follow_up_at) values($1,$2,$3,$4,$5,'Card fixture',statement_timestamp()-$6::interval,$7,case when $8 then statement_timestamp()+interval '2 days' else null end)",
      [id(n), id(company), id(contact), id(board), id(stage), age, closed, future],
    );
  const sync = (actor) => user(actor, () => q('select public.crm_refresh_notifications()'));
  const visible = (actor) =>
    user(
      actor,
      async () =>
        (
          await q(
            "select * from public.crm_notifications where kind in ('card_first_response','card_idle','card_escalation') order by kind,entity_id",
          )
        ).rows,
    );
  await t.test(
    'cada responsável recebe apenas seus cards; gestor recebe escalonamento da própria empresa',
    async () => {
      await sync(2);
      const own = await visible(2);
      assert.equal(own.filter((x) => x.kind === 'card_first_response').length, 1);
      assert.equal(own.filter((x) => x.kind === 'card_idle').length, 2);
      assert.ok(own.every((x) => x.contact_id === id(1001)));
      await sync(1);
      const manager = await visible(1);
      assert.equal(manager.length, 2);
      assert.ok(manager.every((x) => x.kind === 'card_escalation'));
      await sync(5);
      assert.equal((await visible(5)).length, 1);
      await sync(4);
      assert.ok((await visible(4)).every((x) => x.company_id === id(200)));
      await sync(3);
      assert.equal((await visible(3)).length, 0);
    },
  );
  await t.test(
    'fechado e retorno futuro ficam fora dos avisos; atualizar não duplica nem apaga leitura',
    async () => {
      let notices = await visible(2);
      assert.ok(notices.every((x) => ![id(5006), id(5007)].includes(x.entity_id)));
      const n = notices.find((x) => x.entity_id === id(5002));
      await user(2, () => q('select public.crm_mark_notifications_read($1)', [[n.id]]));
      await sync(2);
      notices = await visible(2);
      assert.equal(notices.length, 3);
      assert.ok(notices.find((x) => x.id === n.id).read_at);
    },
  );
  await t.test(
    'nota geral não movimenta todos os cards da pessoa; nota vinculada resolve só o card indicado',
    async () => {
      await user(2, () =>
        q(
          "insert into public.crm_contact_history(company_id,contact_id,kind,title,body) values($1,$2,'note','Ignorado','Nota geral')",
          [id(100), id(1001)],
        ),
      );
      await sync(2);
      assert.equal((await visible(2)).length, 3);
      await user(2, () =>
        q(
          "insert into public.crm_contact_history(company_id,contact_id,opportunity_id,kind,title,body) values($1,$2,$3,'note','Ignorado','Retorno registrado neste card')",
          [id(100), id(1001), id(5002)],
        ),
      );
      assert.equal((await visible(2)).filter((x) => x.entity_id === id(5002)).length, 0);
      assert.equal((await visible(2)).filter((x) => x.entity_id === id(5003)).length, 1);
      await sync(2);
      assert.equal((await visible(2)).length, 2);
      await assert.rejects(
        user(2, () =>
          q(
            "insert into public.crm_contact_history(company_id,contact_id,opportunity_id,kind,title,body) values($1,$2,$3,'note','Inválido','Outro card')",
            [id(100), id(1001), id(5004)],
          ),
        ),
        (e) => e.code === '22023',
      );
    },
  );
  await t.test(
    'WhatsApp vinculado registra acionamento sem afirmar mensagem enviada e resolve o alerta',
    async () => {
      await user(2, () =>
        q(
          "insert into public.crm_contact_history(company_id,contact_id,opportunity_id,kind,title,body) values($1,$2,$3,'whatsapp_opened','Mensagem enviada','Forjado')",
          [id(100), id(1001), id(5001)],
        ),
      );
      const event = (
        await user(2, () =>
          q(
            "select * from public.crm_contact_history where opportunity_id=$1 and kind='whatsapp_opened'",
            [id(5001)],
          ),
        )
      ).rows[0];
      assert.equal(event.title, 'WhatsApp acionado');
      assert.match(event.body, /não são confirmados/);
      assert.equal((await visible(2)).filter((x) => x.entity_id === id(5001)).length, 0);
    },
  );
  await t.test(
    'prazos são fixos e o gestor não pode alterá-los nem desativá-los por API',
    async () => {
      for (const actor of [1, 2]) {
        await assert.rejects(
          user(actor, () =>
            q('select public.crm_configure_card_alerts($1,$2,$3,$4,$5,$6,$7,$8)', [
              id(100),
              id(3001),
              null,
              12,
              2,
              5,
              false,
              1,
            ]),
          ),
          (e) => e.code === '42883',
        );
      }
      for (const table of ['crm_boards', 'crm_stages']) {
        await assert.rejects(
          user(1, () =>
            q(`update public.${table} set alerts_enabled=false where company_id=$1`, [id(100)]),
          ),
          (e) => e.code === '42703',
        );
      }
      const thresholds = (
        await user(1, () =>
          q(
            'select distinct alerts_enabled,first_response_hours,idle_days_threshold,escalation_days_threshold from public.crm_card_activity',
          ),
        )
      ).rows;
      assert.deepEqual(thresholds, [
        {
          alerts_enabled: true,
          first_response_hours: 24,
          idle_days_threshold: 3,
          escalation_days_threshold: 7,
        },
      ]);
      await sync(1);
      assert.equal((await visible(1)).length, 2);
    },
  );
  await t.test(
    'gestor consulta o histórico dos consultores da empresa com autoria e horário',
    async () => {
      await user(5, () =>
        q(
          "insert into public.crm_contact_history(company_id,contact_id,kind,title,body) values($1,$2,'note','Nota','Atendimento da segunda carteira')",
          [id(100), id(1002)],
        ),
      );
      const notes = (
        await user(1, () => q("select * from public.crm_contact_history where kind='note'"))
      ).rows;
      assert.deepEqual([...new Set(notes.map((n) => n.actor_user_id))].sort(), [id(2), id(5)]);
      assert.ok(notes.every((n) => n.company_id === id(100) && n.occurred_at));
      assert.equal(notes.find((n) => n.contact_id === id(1002)).actor_name, 'Fixture 5');
      assert.equal(
        (
          await user(2, () =>
            q('select * from public.crm_contact_history where contact_id=$1', [id(1002)]),
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await user(4, () =>
            q('select * from public.crm_contact_history where company_id=$1', [id(100)]),
          )
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    'reatribuir a pessoa retira imediatamente os avisos do responsável anterior',
    async () => {
      await user(1, () =>
        q(
          'select public.crm_save_contact($1,$2,$3,(select row_version from public.crm_contacts where id=$2))',
          [id(100), id(1001), { owner_membership_id: id(15) }],
        ),
      );
      assert.equal((await visible(2)).length, 0);
      await sync(5);
      assert.ok((await visible(5)).some((x) => x.entity_id === id(5003)));
      assert.equal(
        (await user(5, () => q('select * from public.crm_card_idle_report'))).rows.length,
        0,
      );
    },
  );
});

test('limites fixos entram em vigor após 24h, 72h e 168h em funis e etapas distintos', async (t) => {
  const { q, user } = await fixture(t);
  const board = (
    await user(1, () => q("select public.crm_create_board($1,'Retornos') as result", [id(100)]))
  ).rows[0].result;
  const stage = (await q('select id from public.crm_stages where board_id=$1', [board.id])).rows[0]
    .id;
  const ages = [
    '23 hours 59 minutes',
    '24 hours',
    '71 hours 59 minutes',
    '72 hours',
    '167 hours 59 minutes',
    '168 hours',
  ];
  for (let i = 0; i < ages.length; i++) {
    await q(
      "insert into public.crm_opportunities(id,company_id,contact_id,board_id,stage_id,title,created_at) values($1,$2,$3,$4,$5,'Limite fixo',statement_timestamp()-$6::interval)",
      [
        id(6001 + i),
        id(100),
        id(1001),
        i < 3 ? id(3001) : board.id,
        i < 3 ? id(3101 + (i % 2)) : stage,
        ages[i],
      ],
    );
  }
  const visible = async (actor) =>
    (
      await user(actor, () =>
        q(
          "select entity_id,kind from public.crm_notifications where kind like 'card_%' order by entity_id",
        ),
      )
    ).rows;
  await user(2, () => q('select public.crm_refresh_notifications()'));
  assert.deepEqual(await visible(2), [
    { entity_id: id(6002), kind: 'card_first_response' },
    { entity_id: id(6003), kind: 'card_first_response' },
    { entity_id: id(6004), kind: 'card_idle' },
    { entity_id: id(6005), kind: 'card_idle' },
    { entity_id: id(6006), kind: 'card_idle' },
  ]);
  await user(1, () => q('select public.crm_refresh_notifications()'));
  assert.deepEqual(await visible(1), [{ entity_id: id(6006), kind: 'card_escalation' }]);
});
