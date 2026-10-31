import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

const denied = async (promise) => {
  await assert.rejects(promise, (e) =>
    e.code === '42501' || /CRM_FORBIDDEN|permission denied/.test(e.message));
};

test('cards têm dono independente do contato e somente dono/gestor enxergam', async (t) => {
  const { q, user, card } = await fixture(t);
  const company = id(100);
  const newCard = await card(2);
  assert.equal(newCard.owner_membership_id, id(12));

  await t.test('funcionário com alcance empresa não vê card de outro colega', async () => {
    const grant = (actor, keys, scope) => user(1, () =>
      q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [company,id(actor),keys,scope]));
    await grant(13, ['contacts.view','boards.view','cards.view'], 'company');
    const rows = (await user(3, () => q('select id from public.crm_opportunities'))).rows;
    assert.ok(!rows.some((r) => r.id === newCard.id));
    assert.equal((await user(1, () => q('select id from public.crm_opportunities where id=$1', [newCard.id]))).rows.length,1);
  });

  await t.test('criar pode designar responsável diferente, sem transferir o contato', async () => {
    const another = await card(2, {owner_membership_id:id(15),title:'Card designado ao colega'});
    assert.equal(another.owner_membership_id,id(15));
    assert.equal((await q('select owner_membership_id from public.crm_contacts where id=$1',[id(1001)])).rows[0].owner_membership_id,id(12));
    const own = await user(2, () => q('select id from public.crm_opportunities where id=$1',[another.id]));
    assert.equal(own.rows.length,0);
    const assigned = await user(5, () => q('select id from public.crm_opportunities where id=$1',[another.id]));
    assert.equal(assigned.rows.length,1);
    const contact = await user(5, () => q('select id from public.crm_contacts where id=$1',[id(1001)]));
    assert.equal(contact.rows.length,1, 'responsável pelo card precisa conseguir identificar o contato vinculado');
    const otherContacts = await user(5, () => q('select id from public.crm_contacts where id=$1',[id(2001)]));
    assert.equal(otherContacts.rows.length,0,'não pode ler contato de outra empresa');
  });

  await t.test('CRUD de card não delega acesso a administração de funcionários', async () => {
    const people = (await user(2, () =>
      q("select public.crm_assignable_members($1,'cards','create') as members",[company]))).rows[0].members;
    assert.ok(people.some((x) => x.id === id(15)),'criação deve listar o colega elegível');
    assert.ok(people.every((x) => Object.keys(x).sort().join(',') === 'active,display_name,id'));
    await denied(user(2, () => q('select public.crm_team_members($1)',[company])));
    const ownContacts = (await user(2, () =>
      q("select public.crm_assignable_members($1,'contacts','create') as members",[company]))).rows[0].members;
    assert.deepEqual(ownContacts.map(x=>x.id),[id(12)],'contato respeita alcance próprio');
  });

  await t.test('somente editar permite redistribuir card já atribuído, sem poder criar novo', async () => {
    // Funcionário 5 recebe editar, mas não criar; atribuição continua sendo uma edição.
    await user(1, () =>
      q('select public.crm_set_employee_permissions($1,$2,$3,$4,0)', [
        company,id(15),['contacts.view','boards.view','cards.view','cards.edit'],'own',
      ]));
    await denied(card(5));
    const created = await card(2, {owner_membership_id:id(15)});
    const moved = await card(5,{owner_membership_id:id(12),title:'Encaminhado'},created.id,created.row_version);
    assert.equal(moved.owner_membership_id,id(12));
    assert.equal((await user(5,()=>q('select id from public.crm_opportunities where id=$1',[created.id]))).rows.length,0);
    assert.equal((await user(2,()=>q('select id from public.crm_opportunities where id=$1',[created.id]))).rows.length,1);
    await denied(card(5, {title:'Alteração indevida'},created.id,moved.row_version));
    assert.equal((await q('select title from public.crm_opportunities where id=$1',[created.id])).rows[0].title,'Encaminhado');
    await assert.rejects(card(2,{owner_membership_id:id(14)},created.id,moved.row_version),
      (e) => e.code === '22023' || /CRM_INVALID_OWNER/.test(e.message));
  });

  await t.test('nem os dados auxiliares de outro card ficam legíveis', async () => {
    const created = await card(2);
    assert.equal((await user(5,()=>q('select id from public.crm_opportunities where id=$1',[created.id]))).rows.length,0);
    const labelRows = (await user(5,()=>q('select label_id from public.crm_card_labels where opportunity_id=$1',[created.id]))).rows;
    assert.equal(labelRows.length,0);
  });
});
