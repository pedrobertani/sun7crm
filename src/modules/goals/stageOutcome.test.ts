import {describe,it,expect} from 'vitest';
import {highImpactStage} from './stageOutcome';
import {createSeed} from '../../data/seed';
import {moveOpportunity,removeStage,saveCard} from '../../domain/operations';

describe('Kanban e gamificação de vendas',()=>{
 it('não confunde comparecimento com venda, e detecta etapas de conclusão',()=>{
  expect(highImpactStage('Compareceu')).toBeNull();
  expect(highImpactStage('Procedimento realizado')).toBe('sale');
  expect(highImpactStage('Fechado')).toBe('sale');
  expect(highImpactStage('No-show')).toBe('other');
 });
 it('preserva vendedor histórico na venda confirmada, mas reabrir cancela a conquista da demo',()=>{
  const seed=createSeed();
  const sale=seed.opportunities.find(o=>o.confirmedSaleAt&&o.confirmedSaleOwnerId==='aurora-champion');
  expect(sale).toBeDefined();
  const original=sale!;
  expect(original.confirmedSaleOwnerId).toBe('aurora-champion');
  const session={role:'manager' as const,companyId:'aurora',memberId:'aurora-manager'};
  const next=moveOpportunity(seed,session,original.id,'aurora-leads-0');
  const moved=next.opportunities.find(o=>o.id===original.id)!;
  expect(moved.confirmedSaleAt).toBeUndefined();
  expect(moved.confirmedSaleCents).toBeUndefined();
 });
 it('não exclui etapa com uma venda confirmada',()=>{
  const seed=createSeed();
  const board=seed.boards.find(b=>b.id==='aurora-leads')!;
  const sale=seed.opportunities.find(o=>o.confirmedSaleAt&&o.companyId==='aurora')!;
  expect(()=>removeStage(board,seed.opportunities,sale.stageId,board.stages[0].id)).toThrow('vendas confirmadas');
 });
 it('edição do card reaberto cancela venda contabilizada e não cria venda por si só',()=>{
  const seed=createSeed();
  const session={role:'manager' as const,companyId:'aurora',memberId:'aurora-manager'};
  const sale=seed.opportunities.find(o=>o.confirmedSaleAt&&o.companyId==='aurora')!;
  const result=saveCard(seed,session,{...sale,stageId:'aurora-leads-0'}).opportunities.find(o=>o.id===sale.id)!;
  expect(result.confirmedSaleAt).toBeUndefined();
  expect(result.confirmedSaleOwnerId).toBeUndefined();
 });
});
