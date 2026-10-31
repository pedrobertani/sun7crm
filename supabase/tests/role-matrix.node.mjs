import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

// Auditoria negativa da matriz de papéis contra todas as migrations do SUN7CRM.
// PGlite + Auth simulado: não realiza chamadas ao Supabase remoto.
const blocked = (promise) =>
  assert.rejects(promise, (error) =>
    ['42501', '22023'].includes(error.code) || /CRM_FORBIDDEN|permission denied/i.test(error.message),
  );

test('matriz de papéis: leitura de contatos por empresa, carteira e primeiro acesso', async (t) => {
  const { q, user, as } = await fixture(t);
  const visible = async (actor) =>
    (await user(actor, () => q('select id from public.crm_contacts order by id'))).rows.map((x) => x.id);

  const cases = [
    { actor: 1, name: 'gestor empresa A', expected: [1001, 1002] },
    { actor: 2, name: 'consultor A', expected: [1001] },
    { actor: 5, name: 'consultor B', expected: [1002] },
    { actor: 3, name: 'recepção empresa A', expected: [1001, 1002] },
    { actor: 4, name: 'gestor empresa B', expected: [2001] },
    { actor: 6, name: 'gestor inativo', expected: [] },
    { actor: 8, name: 'primeiro acesso pendente', expected: [] },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const rows = await visible(entry.actor);
      assert.deepEqual(rows, entry.expected.map(id), entry.name);
    });
  }
  await t.test('requisições anônimas não enxergam dados comerciais', async () => {
    await assert.rejects(
      as('anon', null, () => q('select id from public.crm_contacts')),
      (e) => e.code === '42501',
    );
  });
});

test('matriz de papéis: operações privilegiadas e adulteração do proprietário são recusadas', async (t) => {
  const { q, user, card } = await fixture(t);
  const company = id(100);
  const saveContact = (actor, values, contactId = null, version = null, targetCompany = company) =>
    user(actor, () =>
      q('select public.crm_save_contact($1,$2,$3,$4) as result', [
        targetCompany, contactId, values, version,
      ]),
    );

  await t.test('gestor pode atualizar cliente da própria empresa; outro gestor não', async () => {
    const current = (await q('select row_version from public.crm_contacts where id=$1', [id(1001)])).rows[0];
    const updated = (await saveContact(1, { notes: 'Revisão de acesso' }, id(1001), current.row_version)).rows[0].result;
    assert.equal(updated.notes, 'Revisão de acesso');
    await blocked(saveContact(4, { notes: 'Tentativa externa' }, id(1001), updated.row_version));
    await blocked(saveContact(1, { notes: 'Outra empresa' }, id(2001), 1, id(200)));
    assert.equal((await q('select notes from public.crm_contacts where id=$1', [id(1001)])).rows[0].notes, 'Revisão de acesso');
  });

  await t.test('consultor não muda dono nem edita carteira do colega', async () => {
    const version = (await q('select row_version from public.crm_contacts where id=$1', [id(1001)])).rows[0].row_version;
    await blocked(saveContact(2, { owner_membership_id: id(15) }, id(1001), version));
    await blocked(saveContact(5, { notes: 'Tentativa na carteira alheia' }, id(1001), version));
    await blocked(saveContact(2, { notes: 'Outro cliente' }, id(1002), 1));
    const after = (await q('select owner_membership_id,notes from public.crm_contacts where id=$1', [id(1001)])).rows[0];
    assert.equal(after.owner_membership_id, id(12));
    assert.equal(after.notes, 'Revisão de acesso');
  });

  await t.test('recepção não herda criação/edição de contatos ou cards', async () => {
    await blocked(saveContact(3, { name: 'Cadastro administrativo indevido' }));
    await blocked(saveContact(3, { notes: 'Alteração' }, id(1001), 2));
    await blocked(card(3));
  });

  await t.test('consultor não altera card alheio nem força vínculo de outra empresa', async () => {
    const created = await card(2);
    await blocked(card(5, { title: 'Card de outro consultor' }, created.id, created.row_version));
    await blocked(card(2, { contact_id: id(1002) }, created.id, created.row_version));
    await blocked(card(4, { contact_id: id(1001) }, null, null, 100));
    const saved = (await q('select title,contact_id from public.crm_opportunities where id=$1', [created.id])).rows[0];
    assert.equal(saved.contact_id, id(1001));
    assert.equal(saved.title, 'Oportunidade fixture');
  });

  await t.test('consultor e recepção não criam funil nem gerenciam equipe', async () => {
    for (const actor of [2, 3, 5, 4]) {
      await blocked(user(actor, () =>
        q("select public.crm_create_board($1,'Funil indevido')", [company])));
    }
    for (const actor of [2, 3, 5, 4]) {
      await blocked(user(actor, () =>
        q('select public.crm_team_members($1)', [company])));
    }
  });
});
