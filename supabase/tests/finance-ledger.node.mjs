import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

test('financeiro: confirmação, parcelas, entradas, saídas, segurança e reversões', async (t) => {
  const { q, user, as, card } = await fixture(t);
  const company = id(100), other = id(200), stageId = id(3103);
  const cardRow = await card(2, {value_cents:100000});
  const board = (await user(1,()=>q('select row_version,name from public.crm_boards where id=$1',[id(3001)]))).rows[0];
  const stages = (await user(1,()=>q('select id,name from public.crm_stages where board_id=$1 order by position',[id(3001)]))).rows;
  await user(1,()=>q('select public.crm_configure_board($1,$2,$3,$4,$5)',[
    company,id(3001),board.name,JSON.stringify(stages.map(x=>x.id===stageId?{...x,name:'Fechado'}:x)),board.row_version,
  ]));

  await t.test('venda só entra como a receber, nunca como entrada de caixa', async () => {
    await user(2,()=>q('select public.crm_confirm_card_sale($1,$2,$3,$4,$5)',[
      company,cardRow.id,stageId,cardRow.row_version,100000,
    ]));
    const sale = (await user(1,()=>q('select * from public.crm_finance_sales where opportunity_id=$1',[cardRow.id]))).rows[0];
    assert.equal(Number(sale.total_cents),100000);
    assert.equal(sale.membership_id,id(12));
    const ins = (await user(1,()=>q('select * from public.crm_finance_installments where opportunity_id=$1',[cardRow.id]))).rows;
    assert.equal(ins.length,1);
    assert.equal(Number(ins[0].amount_cents),100000);
    assert.equal((await user(1,()=>q('select count(*)::int n from public.crm_finance_movements'))).rows[0].n,0);
    assert.equal((await user(2,()=>q('select count(*)::int n from public.crm_finance_sales'))).rows[0].n,0);
    assert.equal((await user(7,()=>q('select count(*)::int n from public.crm_finance_sales'))).rows[0].n,0);
    assert.equal((await user(4,()=>q('select count(*)::int n from public.crm_finance_sales'))).rows[0].n,0);
    await assert.rejects(as('anon',null,()=>q('select * from public.crm_finance_movements')),/permission denied/);
    await assert.rejects(user(2,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',[
      company,ins[0].id,id(9001),20000,'pix','2026-11-04','Teste',
    ])),/CRM_FORBIDDEN/);
  });

  const schedule = [
    {entry:true,amount_cents:20000,due_on:'2026-11-04',method:'pix'},
    {amount_cents:20000,due_on:'2026-12-04',method:'bank_transfer'},
    {amount_cents:20000,due_on:'2027-01-04',method:'bank_transfer'},
    {amount_cents:20000,due_on:'2027-02-04',method:'bank_transfer'},
    {amount_cents:20000,due_on:'2027-03-04',method:'bank_transfer'},
  ];
  let entry;
  await t.test('gestor configura à vista/a prazo e valor de cada parcela; total exato', async () => {
    const result=(await user(1,()=>q('select public.crm_finance_set_terms($1,$2,$3,$4,$5,$6,$7) as sale',[
      company,cardRow.id,90000,100000,'installments',JSON.stringify(schedule),1,
    ]))).rows[0].sale;
    assert.equal(result.payment_kind,'installments');
    assert.equal(Number(result.cash_price_cents),90000);
    assert.equal(Number(result.term_price_cents),100000);
    assert.equal(Number(result.row_version),2);
    const rows=(await user(1,()=>q('select * from public.crm_finance_installments where opportunity_id=$1 order by installment_number',[cardRow.id]))).rows;
    assert.equal(rows.length,5);
    assert.deepEqual(rows.map(x=>x.installment_number),[0,1,2,3,4]);
    assert.equal(rows.reduce((sum,x)=>sum+Number(x.amount_cents),0),100000);
    entry=rows[0];
    await assert.rejects(user(1,()=>q('select public.crm_finance_set_terms($1,$2,$3,$4,$5,$6,$7)',[
      company,cardRow.id,90000,100000,'installments',JSON.stringify([{amount_cents:99999,due_on:'2026-12-04'}]),2,
    ])),/CRM_FINANCE_SCHEDULE_SUM_MISMATCH/);
    await assert.rejects(user(1,()=>q('select public.crm_finance_set_terms($1,$2,$3,$4,$5,$6,$7)',[
      company,cardRow.id,90000,100000,'installments',JSON.stringify(schedule),1,
    ])),/CRM_STALE_VERSION/);
    assert.equal((await user(1,()=>q('select count(*)::int n from public.crm_finance_installments where opportunity_id=$1',[cardRow.id]))).rows[0].n,5);
  });
  await t.test('recebimento parcial idempotente e proteção contra recebimento acima da parcela', async () => {
    const args=[company,entry.id,id(9001),15000,'pix','2026-11-04','Entrada parcial'];
    await user(1,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',args));
    await user(1,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',args));
    assert.equal((await user(1,()=>q("select count(*)::int n from public.crm_finance_movements where kind='income'"))).rows[0].n,1);
    // Conhecer um UUID/ID de transação não concede autorização para consultar retries.
    await assert.rejects(user(2,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',args)),/CRM_FORBIDDEN/);
    await assert.rejects(user(4,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',args)),/CRM_FORBIDDEN/);
    await assert.rejects(user(1,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',[
      company,entry.id,id(9002),5001,'pix','2026-11-04','Excessivo',
    ])),/CRM_FINANCE_OVERPAYMENT/);
    await assert.rejects(user(4,()=>q('select public.crm_finance_record_receipt($1,$2,$3,$4,$5,$6,$7)',[
      other,entry.id,id(9003),100,'pix','2026-11-04','Outro tenant',
    ])),/CRM_FINANCE_NOT_FOUND/);
    await assert.rejects(user(1,()=>q('select public.crm_finance_set_terms($1,$2,$3,$4,$5,$6,$7)',[
      company,cardRow.id,90000,100000,'installments',JSON.stringify(schedule),2,
    ])),/CRM_FINANCE_ALREADY_HAS_MOVEMENTS/);
  });
  await t.test('reabrir card com pagamento sem estorno bloqueia alteração', async () => {
    const current=(await user(1,()=>q('select row_version from public.crm_opportunities where id=$1',[cardRow.id]))).rows[0];
    await assert.rejects(user(2,()=>q('select public.crm_save_card($1,$2,$3,$4)',[
      company,cardRow.id,JSON.stringify({stage_id:id(3101)}),current.row_version,
    ])),/CRM_FINANCE_REFUND_BEFORE_REOPEN/);
    const stage=(await user(1,()=>q('select stage_id from public.crm_opportunities where id=$1',[cardRow.id]))).rows[0].stage_id;
    assert.equal(stage,stageId);
  });
  await t.test('estorno cria saída financeira separada e preserva entrada original', async () => {
    await user(1,()=>q('select public.crm_finance_refund($1,$2,$3,$4,$5,$6,$7)',[
      company,id(9001),id(9004),15000,'2026-11-05','pix','Pagamento estornado',
    ]));
    const rows=(await user(1,()=>q('select kind,amount_cents from public.crm_finance_movements order by created_at,id'))).rows;
    assert.equal(rows.filter(x=>x.kind==='income').length,1);
    assert.equal(rows.filter(x=>x.kind==='refund').length,1);
    assert.equal(rows.reduce((sum,x)=>sum+(x.kind==='refund'?-1:1)*Number(x.amount_cents),0),0);
    await assert.rejects(user(1,()=>q('select public.crm_finance_refund($1,$2,$3,$4,$5,$6,$7)',[
      company,id(9001),id(9005),1,'2026-11-05','pix','Estorno excessivo',
    ])),/CRM_FINANCE_REFUND_TOO_HIGH/);
  });
  await t.test('despesa é auditável, editável com versão e anulável, sem exclusão', async () => {
    const args=[company,id(9010),32000,'pix','2026-11-04','Aluguel','Aluguel do mês',null,null,null];
    let expense=(await user(1,()=>q('select public.crm_finance_save_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as m',args))).rows[0].m;
    assert.equal(expense.kind,'expense');
    assert.equal(Number(expense.amount_cents),32000);
    await assert.rejects(user(2,()=>q('select public.crm_finance_save_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',args)),/CRM_FORBIDDEN/);
    expense=(await user(1,()=>q('select public.crm_finance_save_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as m',[
      company,id(9010),35000,'bank_transfer','2026-11-05','Aluguel','Valor corrigido',null,null,1,
    ]))).rows[0].m;
    assert.equal(Number(expense.row_version),2);
    assert.equal(Number(expense.amount_cents),35000);
    await assert.rejects(user(1,()=>q('select public.crm_finance_save_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[
      company,id(9010),34000,'pix','2026-11-05','Aluguel','stale',null,null,1,
    ])),/CRM_STALE_VERSION/);
    await user(1,()=>q('select public.crm_finance_void_movement($1,$2,$3,$4)',[
      company,id(9010),2,'Lançamento duplicado',
    ]));
    const row=(await user(1,()=>q('select voided_at from public.crm_finance_movements where id=$1',[id(9010)]))).rows[0];
    assert.ok(row.voided_at);
    assert.equal((await user(1,()=>q("select count(*)::int n from public.crm_finance_audit where movement_id=$1",[id(9010)]))).rows[0].n,3);
    assert.equal((await user(2,()=>q('select count(*)::int n from public.crm_finance_movements'))).rows[0].n,0);
  });
  await t.test('vendedor só vê seus registros quando o gestor concede finance.view', async () => {
    const keys=['boards.view','contacts.view','cards.view','finance.view','finance.receive'];
    await user(1,()=>q('select public.crm_set_employee_permissions($1,$2,$3,$4,$5)',[
      company,id(12),keys,'own',0,
    ]));
    const own=(await user(2,()=>q('select opportunity_id from public.crm_finance_sales'))).rows;
    assert.equal(own.length,1);
    const expenses=(await user(2,()=>q("select count(*)::int n from public.crm_finance_movements where kind='expense'"))).rows[0].n;
    assert.equal(expenses,0);
    await assert.rejects(user(2,()=>q('select public.crm_finance_save_expense($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[
      company,id(9020),100,'pix','2026-11-04','Outros','Sem permissão',null,null,null,
    ])),/CRM_FORBIDDEN/);
  });
});
