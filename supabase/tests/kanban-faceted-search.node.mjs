import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture,id } from './helpers/db.mjs';

test('Kanban: RLS, busca por contato, facetas e paginação no SQL',async t=>{
 const {q,user,card}=await fixture(t);
 const company=id(100),board=id(3001);
 const vip=id(5501),service=id(5502);
 const first=await card(2,{title:'Procedimento Ana'});
 const second=await card(5,{contact_id:id(1002),stage_id:id(3102),title:'Consulta especial'});
 await q("update public.crm_contacts set name='Ana Souza',temperature='hot' where id=$1",[id(1001)]);
 await q("update public.crm_contacts set name='Beatriz Lima',temperature='cold' where id=$1",[id(1002)]);
 await q("insert into public.crm_labels(id,company_id,name,color) values($1,$2,'VIP','#C8A24B')",[vip,company]);
 await q("insert into public.crm_catalog_items(id,company_id,kind,name) values($1,$2,'service','Limpeza')",[service,company]);
 await q("insert into public.crm_card_labels(company_id,opportunity_id,label_id) values($1,$2,$3)",[company,first.id,vip]);
 await q("insert into public.crm_card_catalog(company_id,opportunity_id,catalog_id) values($1,$2,$3)",[company,first.id,service]);
 const lookup=(actor,{stage=null,contact=null,page=0,size=10,search='',labels=[],catalog=[],owner=null,temp=null,closed=null}={})=>
  user(actor,()=>q('select public.crm_search_kanban_cards($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::uuid[],$11::uuid[],$12,$13,$14) as result',[
   company,board,stage,contact,page,size,search,null,null,labels,catalog,owner,temp,closed,
  ]));
 const all=(await lookup(1)).rows[0].result;
 assert.equal(all.total,2);
 assert.equal(all.rows.length,2);
 assert.equal((await lookup(1,{search:'Ana Souza'})).rows[0].result.total,1);
 assert.equal((await lookup(1,{search:'Beatriz'})).rows[0].result.rows[0].id,second.id);
 assert.equal((await lookup(1,{stage:id(3102)})).rows[0].result.rows[0].id,second.id);
 assert.equal((await lookup(1,{labels:[vip],catalog:[service]})).rows[0].result.rows[0].id,first.id);
 assert.equal((await lookup(1,{labels:[vip],catalog:[id(5999)]})).rows[0].result.total,0);
 assert.equal((await lookup(1,{owner:id(15),temp:'cold'})).rows[0].result.total,1);
 assert.equal((await lookup(1,{owner:id(12),temp:'cold'})).rows[0].result.total,0);
 assert.equal((await lookup(1,{contact:id(1002)})).rows[0].result.total,1);
 assert.equal((await lookup(2)).rows[0].result.total,1);
 assert.equal((await lookup(5)).rows[0].result.total,1);
 await assert.rejects(lookup(4),e=>e.code==='42501');
 await assert.rejects(lookup(1,{size:1000}),e=>e.code==='22023');
 await assert.rejects(lookup(1,{temp:'INVALID'}),e=>e.code==='22023');
 const page2=(await lookup(1,{page:1,size:10})).rows[0].result;
 assert.equal(page2.total,2);
 assert.deepEqual(page2.rows,[]);
});