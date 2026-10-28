import assert from 'node:assert/strict';
import test from 'node:test';
import {fixture,id} from './helpers/db.mjs';

test('conclusão comercial: confirmação, isolamento, estorno e histórico',async t=>{
  const {q,user,as,card}=await fixture(t);
  const company=id(100),boardId=id(3001),stageId=id(3103),start=id(3101);
  const opportunity=await card(2,{value_cents:10000});
  const configure=async(excludeFinal=false)=>{
    const board=(await user(1,()=>q('select name,row_version from public.crm_boards where id=$1',[boardId]))).rows[0];
    const stages=(await user(1,()=>q('select id,name from public.crm_stages where board_id=$1 order by position',[boardId]))).rows;
    const desired=excludeFinal?stages.filter(s=>s.id!==stageId):stages.map(s=>s.id===stageId?{...s,name:'Fechado'}:s);
    return user(1,()=>q('select public.crm_configure_board($1,$2,$3,$4,$5)',[
      company,boardId,board.name,JSON.stringify(desired),board.row_version,
    ]));
  };
  const confirmed=()=>user(2,()=>q('select public.crm_confirm_card_sale($1,$2,$3,$4,$5) as result',[
    company,opportunity.id,stageId,opportunity.row_version,250000,
  ]));
  await t.test('etapa normal não vira venda por simples arraste nem confirmação inválida',async()=>{
    await user(2,()=>q('select public.crm_save_card($1,$2,$3,$4)',[
      company,opportunity.id,JSON.stringify({stage_id:id(3102)}),opportunity.row_version,
    ]));
    let moved=(await user(1,()=>q('select stage_id,row_version from public.crm_opportunities where id=$1',[opportunity.id]))).rows[0];
    assert.equal(moved.stage_id,id(3102));
    assert.equal((await user(1,()=>q('select count(*)::int as n from public.crm_confirmed_sales'))).rows[0].n,0);
    await assert.rejects(user(2,()=>q('select public.crm_confirm_card_sale($1,$2,$3,$4,$5)',[
      company,opportunity.id,id(3102),moved.row_version,250000,
    ])),/CRM_NOT_A_SALE_STAGE/);
  });
  await t.test('confirmação explícita registra venda para vendedor original e preserva RLS',async()=>{
    await configure();
    const current=(await user(1,()=>q('select row_version from public.crm_opportunities where id=$1',[opportunity.id]))).rows[0];
    const saved=(await user(2,()=>q('select public.crm_confirm_card_sale($1,$2,$3,$4,$5) as result',[
      company,opportunity.id,stageId,current.row_version,250000,
    ]))).rows[0].result;
    assert.equal(saved.stage_id,stageId);
    assert.equal(saved.value_cents,250000);
    const mine=(await user(2,()=>q('select opportunity_id,membership_id,value_cents,confirmed_by,reversed_at from public.crm_confirmed_sales'))).rows;
    assert.equal(mine.length,1);
    assert.equal(mine[0].membership_id,id(12));
    assert.equal(mine[0].confirmed_by,id(2));
    assert.equal(mine[0].value_cents,250000);
    assert.equal(mine[0].reversed_at,null);
    assert.equal((await user(5,()=>q('select count(*)::int as n from public.crm_confirmed_sales'))).rows[0].n,0);
    assert.equal((await user(4,()=>q('select count(*)::int as n from public.crm_confirmed_sales'))).rows[0].n,0);
    await assert.rejects(as('anon',null,()=>q('select * from public.crm_confirmed_sales')),/permission denied/);
    await assert.rejects(user(2,()=>q('select public.crm_confirm_card_sale($1,$2,$3,$4,$5)',[
      company,opportunity.id,stageId,saved.row_version,250000,
    ])),/CRM_SALE_ALREADY_CONFIRMED/);
  });
  await t.test('impede exclusão de etapa com venda confirmada e mantém cartão intacto',async()=>{
    await assert.rejects(configure(true),/CRM_CANNOT_REMOVE_STAGE_WITH_CONFIRMED_SALES/);
    const still=(await user(1,()=>q('select stage_id from public.crm_opportunities where id=$1',[opportunity.id]))).rows[0];
    assert.equal(still.stage_id,stageId);
  });
  await t.test('reabrir card desfaz contagem e preserva registro para auditoria',async()=>{
    const before=(await user(1,()=>q('select row_version from public.crm_opportunities where id=$1',[opportunity.id]))).rows[0];
    await user(2,()=>q('select public.crm_save_card($1,$2,$3,$4)',[
      company,opportunity.id,JSON.stringify({stage_id:start}),before.row_version,
    ]));
    const record=(await user(1,()=>q('select reversed_at,membership_id from public.crm_confirmed_sales where opportunity_id=$1',[opportunity.id]))).rows[0];
    assert.ok(record.reversed_at);
    assert.equal(record.membership_id,id(12));
    assert.equal((await user(1,()=>q('select count(*)::int as n from public.crm_confirmed_sales where reversed_at is null'))).rows[0].n,0);
  });
});
