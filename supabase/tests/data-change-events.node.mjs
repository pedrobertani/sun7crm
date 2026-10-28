import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

test('eventos privados: isolamento, agrupamento e transações', async (t) => {
  const { q, db, user, as } = await fixture(t, { realtime: true });
  const messages = async () =>
    (await q('select topic,payload,event,private from realtime.messages order by topic')).rows;
  await t.test(
    'bloqueia outra empresa, outro usuário, administrador falso e acesso incompleto',
    async () => {
      for (const [actor, topic, allowed] of [
        [1, `crm:company:${id(100)}`, true],
        [2, `crm:company:${id(100)}`, true],
        [2, `crm:company:${id(200)}`, false],
        [2, `crm:user:${id(1)}`, false],
        [2, `crm:user:${id(2)}`, true],
        [2, 'crm:admin', false],
        [6, `crm:company:${id(100)}`, false],
        [2, 'crm:company:invalid', false],
      ])
        assert.equal(
          (
            await user(actor, () =>
              q('select crm_private.can_receive_data_change($1) as allowed', [topic]),
            )
          ).rows[0].allowed,
          allowed,
        );
      await q(
        "insert into realtime.messages(topic,event,private,payload) values($1,'changed',true,'{}')",
        [`crm:company:${id(200)}`],
      );
      await q("select set_config('request.realtime.topic',$1,false)", [`crm:company:${id(100)}`]);
      assert.ok(
        (await user(2, () => q('select topic from realtime.messages'))).rows.every(
          (r) => r.topic === `crm:company:${id(100)}`,
        ),
      );
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(
          (
            await q(
              "select has_function_privilege($1,'crm_private.emit_data_change(text,text)','execute') as allowed",
              [role],
            )
          ).rows[0].allowed,
          false,
        );
      }
      await assert.rejects(
        as('authenticated', 2, () =>
          q("insert into realtime.messages(topic,payload) values('crm:admin','{}')"),
        ),
        (e) => e.code === '42501',
      );
    },
  );
  await t.test(
    'agrupa uma importação por empresa e recurso e publica somente metadados',
    async () => {
      await q('delete from realtime.messages');
      await db.exec('begin');
      for (let n = 6001; n < 6011; n++)
        await q(
          'insert into public.crm_contacts(id,company_id,owner_membership_id,name,phone) values($1,$2,$3,$4,$5)',
          [id(n), id(100), id(12), `Privado fixture ${n}`, `1190000${n}`],
        );
      assert.equal((await messages()).length, 0);
      await db.exec('commit');
      const events = (await messages()).filter(
        (r) => r.topic === `crm:company:${id(100)}` && r.payload.resource === 'contacts',
      );
      assert.equal(events.length, 1);
      assert.deepEqual(Object.keys(events[0].payload).sort(), ['resource', 'revision']);
      assert.equal(events[0].private, true);
      assert.ok(!JSON.stringify(await messages()).includes('Privado fixture'));
      const notices = (
        await q(
          "select count(*)::int as total from public.crm_notifications where recipient_user_id=$1 and kind='new_contact' and active and entity_id=any($2::uuid[])",
          [id(1), Array.from({ length: 10 }, (_, n) => id(6001 + n))],
        )
      ).rows[0].total;
      assert.equal(notices, 10);
      assert.ok(
        (await messages()).some(
          (r) => r.topic === `crm:user:${id(1)}` && r.payload.resource === 'notifications',
        ),
      );
    },
  );
  await t.test('rollback não publica avisos e exclusão também invalida a lista', async () => {
    await q('delete from realtime.messages');
    await db.exec('begin');
    await q("update public.crm_contacts set name='Descartar' where id=$1", [id(6001)]);
    await db.exec('rollback');
    assert.equal((await messages()).length, 0);
    await q('delete from public.crm_contact_history where contact_id=$1', [id(6001)]);
    await q('delete from public.crm_contacts where id=$1', [id(6001)]);
    assert.equal(
      (await messages()).filter(
        (r) => r.topic === `crm:company:${id(100)}` && r.payload.resource === 'contacts',
      ).length,
      1,
    );
  });
  await t.test('revogar vínculo impede novas inscrições na empresa', async () => {
    await q('update public.crm_memberships set active=false where company_id=$1 and user_id=$2', [
      id(100),
      id(2),
    ]);
    assert.equal(
      (
        await user(2, () =>
          q('select crm_private.can_receive_data_change($1) as allowed', [
            `crm:company:${id(100)}`,
          ]),
        )
      ).rows[0].allowed,
      false,
    );
    assert.ok(
      (await messages()).some(
        (r) => r.topic === `crm:user:${id(2)}` && r.payload.resource === 'access',
      ),
    );
  });
  await t.test(
    'um prazo do cron também avisa a tela do plano e a verificação de acesso',
    async () => {
      await q('delete from realtime.messages');
      await q(
        "insert into public.crm_notifications(company_id,recipient_user_id,kind,entity_id,event_key,title,body,priority) values($1,$2,'subscription_due',$1,'fixture-timer','Prazo de teste','Reavaliar acesso',3)",
        [id(100), id(1)],
      );
      const events = await messages();
      assert.ok(
        events.some(
          (r) => r.topic === `crm:company:${id(100)}` && r.payload.resource === 'billing',
        ),
      );
      assert.ok(
        events.some((r) => r.topic === `crm:user:${id(1)}` && r.payload.resource === 'access'),
      );
    },
  );
});
