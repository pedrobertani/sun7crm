import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';
const denied = (p) => assert.rejects(p, (e) => e.code === '42501');
test('base operacional: funis, cards, catálogo e etiquetas', async (t) => {
  const { q, user, as, card } = await fixture(t);
  const configure = (stages, version = 1, name = 'Funil inicial') =>
    user(1, () =>
      q('select public.crm_configure_board($1,$2,$3,$4,$5) as result', [
        id(100),
        id(3001),
        name,
        stages,
        version,
      ]),
    );
  const stages = [
    { id: id(3101), name: 'Primeira' },
    { id: id(3102), name: 'Segunda' },
    { id: id(3103), name: 'Terceira' },
  ];
  await t.test(
    'gestor cria funil customizado; outros perfis/empresas não administram',
    async () => {
      const result = (
        await user(1, () => q("select public.crm_create_board($1,'Retornos') as result", [id(100)]))
      ).rows[0].result;
      assert.equal(result.kind, 'custom');
      assert.equal(result.stages.length, 1);
      for (const actor of [2, 3, 4, 6, 7, 8])
        await denied(
          user(actor, () => q("select public.crm_create_board($1,'Proibido')", [id(100)])),
        );
      await denied(
        as('anon', null, () => q("select public.crm_create_board($1,'Proibido')", [id(100)])),
      );
      await assert.rejects(
        user(1, () => q("select public.crm_create_board($1,'retornos')", [id(100)])),
        (e) => e.code === '23505',
      );
    },
  );
  await t.test('etapas preservam IDs, limitam 10 e rejeitam nomes/versões inválidas', async () => {
    await assert.rejects(configure([]), (e) => e.code === '22023');
    await assert.rejects(
      configure(Array.from({ length: 11 }, (_, i) => ({ id: id(7000 + i), name: `Etapa ${i}` }))),
      (e) => e.code === '22023',
    );
    await assert.rejects(
      configure([
        { id: id(3101), name: 'Teste' },
        { id: id(3102), name: 'teste' },
      ]),
      (e) => e.code === '22023',
    );
    await assert.rejects(
      configure([{ id: id(4101), name: 'Outra empresa' }]),
      (e) => e.code === '42501',
    );
    const result = (await configure([stages[2], stages[0], stages[1]])).rows[0].result;
    assert.equal(result.stages[0].id, id(3103));
    assert.equal(result.row_version, 2);
    await assert.rejects(configure(stages, 1), (e) => e.code === '40001');
    await configure(stages, 2);
  });
  await t.test(
    'catálogo/etiquetas/estratégias só são editados pelo gestor e pertencem à empresa',
    async () => {
      for (const actor of [2, 3, 4, 7])
        await denied(
          user(actor, () =>
            q(
              "insert into public.crm_labels(company_id,name,color) values($1,'Invasão','#112233')",
              [id(100)],
            ),
          ),
        );
      await assert.rejects(
        user(1, () =>
          q("insert into public.crm_labels(company_id,name,color) values($1,'Cor ruim','red')", [
            id(100),
          ]),
        ),
        (e) => e.code === '23514',
      );
      assert.equal((await user(2, () => q('select * from public.crm_labels'))).rows.length, 3);
      assert.equal((await user(4, () => q('select * from public.crm_labels'))).rows.length, 3);
      await denied(user(1, () => q('delete from public.crm_labels')));
    },
  );
  let first, other, labels, item, strategy;
  await t.test('mesma pessoa pode ter vários cards e vínculos são salvos juntos', async () => {
    labels = (await user(1, () => q('select id from public.crm_labels order by id'))).rows.map(
      (x) => x.id,
    );
    item = (
      await user(1, () =>
        q(
          "insert into public.crm_catalog_items(company_id,kind,name,value_cents) values($1,'service','Serviço fixture',12000) returning id",
          [id(100)],
        ),
      )
    ).rows[0].id;
    strategy = (
      await user(1, () =>
        q(
          "insert into public.crm_strategies(company_id,name,month,owner_membership_id) values($1,'Estratégia fixture','2026-10-01',$2) returning id",
          [id(100), id(11)],
        ),
      )
    ).rows[0].id;
    first = await card(2, {
      label_ids: labels,
      catalog_ids: [item],
      strategy_id: strategy,
      stage_id: id(3102),
    });
    other = await card();
    assert.notEqual(first.id, other.id);
    assert.equal((await user(2, () => q('select * from public.crm_opportunities'))).rows.length, 2);
    assert.equal((await user(5, () => q('select * from public.crm_card_catalog'))).rows.length, 0);
    await denied(card(5, {}, first.id, first.row_version));
    await denied(card(3));
    await denied(
      user(2, () => q('update public.crm_opportunities set value_cents=0 where id=$1', [first.id])),
    );
  });
  await t.test(
    'máximo de três etiquetas e referência de outra empresa desfazem a gravação',
    async () => {
      const fourth = (
        await user(1, () =>
          q(
            "insert into public.crm_labels(company_id,name,color) values($1,'Quarta','#112233') returning id",
            [id(100)],
          ),
        )
      ).rows[0].id;
      await assert.rejects(
        card(2, { label_ids: [...labels, fourth], value_cents: 999 }, first.id, first.row_version),
        (e) => e.code === '23514',
      );
      const saved = (
        await user(2, () =>
          q('select value_cents,row_version from public.crm_opportunities where id=$1', [first.id]),
        )
      ).rows[0];
      assert.equal(saved.value_cents, 0);
      assert.equal(saved.row_version, first.row_version);
      const foreign = (await user(4, () => q('select id from public.crm_labels limit 1'))).rows[0]
        .id;
      await assert.rejects(
        card(2, { label_ids: [foreign] }, first.id, first.row_version),
        (e) => e.code === '22023',
      );
      await assert.rejects(
        q(
          'insert into public.crm_card_labels(company_id,opportunity_id,label_id) values($1,$2,$3)',
          [id(100), first.id, fourth],
        ),
        (e) => e.code === '23514',
      );
    },
  );
  await t.test('desativar produto preserva vínculo antigo e impede novas seleções', async () => {
    await user(1, () => q('update public.crm_catalog_items set active=false where id=$1', [item]));
    first = await card(2, { catalog_ids: [item], title: 'Mantido' }, first.id, first.row_version);
    assert.deepEqual(first.catalog_ids, [item]);
    await assert.rejects(card(2, { catalog_ids: [item] }), (e) => e.code === '22023');
    await assert.rejects(card(2, { title: 'Conflito' }, first.id, 1), (e) => e.code === '40001');
  });
  await t.test('excluir etapa transfere para anterior; a primeira usa a próxima', async () => {
    const result = (await configure([stages[0], stages[2]], 3)).rows[0].result;
    assert.equal(
      (await q('select stage_id from public.crm_opportunities where id=$1', [first.id])).rows[0]
        .stage_id,
      id(3101),
    );
    const event = (
      await user(2, () =>
        q(
          "select body from public.crm_contact_history where opportunity_id=$1 and kind='card_moved' order by occurred_at desc limit 1",
          [first.id],
        ),
      )
    ).rows[0];
    assert.match(event.body, /Segunda.*Primeira/);
    await configure([stages[2]], result.row_version);
    assert.equal(
      (await q('select stage_id from public.crm_opportunities where id=$1', [first.id])).rows[0]
        .stage_id,
      id(3103),
    );
    await assert.rejects(configure([], 5), (e) => e.code === '22023');
  });
  await t.test('troca de responsável retira acesso ao card e aos interesses', async () => {
    await user(1, () =>
      q(
        'select public.crm_save_contact($1,$2,$3,(select row_version from public.crm_contacts where id=$2))',
        [id(100), id(1001), { owner_membership_id: id(15) }],
      ),
    );
    assert.equal((await user(2, () => q('select * from public.crm_opportunities'))).rows.length, 0);
    assert.equal((await user(2, () => q('select * from public.crm_card_labels'))).rows.length, 0);
    await denied(card(2, {}, first.id, first.row_version));
    assert.equal((await user(5, () => q('select * from public.crm_opportunities'))).rows.length, 2);
  });
});
