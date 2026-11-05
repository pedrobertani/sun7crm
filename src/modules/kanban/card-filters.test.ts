import { describe,expect,it } from 'vitest';
import { cardFacetCriteria,cardFacetFields,emptyCardFacets,matchDemoCardFacets } from './card-filters';
import { toggleFilterSelection } from '../../components/ui/global-filters';
import type { Contact,Opportunity } from '../../domain/types';
const a='00000000-0000-4000-8000-000000000001';
const b='00000000-0000-4000-8000-000000000002';
const c='00000000-0000-4000-8000-000000000003';
const contact={id:a,name:'Ana',temperature:'hot',ownerId:a} as Contact;
const card={id:a,stageId:a,labelIds:[a,b],catalogIds:[b],confirmedSaleAt:'2026-11-05'} as Opportunity;
describe('filtros combináveis do Kanban',()=>{
 it('normaliza múltiplas etiquetas e produtos e respeita responsável próprio',()=>{
  const f={...emptyCardFacets,labels:JSON.stringify([a,b]),catalog:JSON.stringify([b]),owner:'mine',temperature:'hot',status:'closed'};
  expect(cardFacetCriteria(f,a)).toEqual({
   labelIds:[a,b],catalogIds:[b],ownerId:a,temperature:'hot',closed:true,
  });
  expect(matchDemoCardFacets(card,contact,f,a)).toBe(true);
  expect(matchDemoCardFacets(card,contact,{...f,catalog:JSON.stringify([c])},a)).toBe(false);
  expect(matchDemoCardFacets(card,contact,{...f,owner:b},a)).toBe(false);
  expect(matchDemoCardFacets(card,contact,{...f,status:'open'},a)).toBe(false);
 });
 it('filtra por etapa mesmo quando etiquetas e produtos coincidem',()=>{
  const f={...emptyCardFacets,stage:b,labels:JSON.stringify([a])};
  expect(matchDemoCardFacets(card,contact,f,a)).toBe(false);
  expect(matchDemoCardFacets(card,contact,{...f,stage:a},a)).toBe(true);
 });
 it('oferece seletores só com registros do contexto da empresa',()=>{
  const fields=cardFacetFields({stages:[{id:a,name:'Lead novo'}],labels:[{id:b,name:'VIP',active:true}],
   catalog:[{id:c,name:'Limpeza',active:true}]});
  expect(fields.map(x=>x.key)).toEqual(['stage','labels','catalog','owner','temperature','status']);
  expect(fields.find(x=>x.key==='labels')?.type).toBe('multi-select');
  expect(fields.find(x=>x.key==='catalog')?.options?.[0].label).toBe('Limpeza');
  expect(fields.find(x=>x.key==='owner')?.options?.map(x=>x.value)).toEqual(['all','mine']);
 });
 it('permite escolher e remover etiquetas individualmente',()=>{
  let selected=toggleFilterSelection('[]',a);
  selected=toggleFilterSelection(selected,b);
  expect(JSON.parse(selected)).toEqual([a,b]);
  selected=toggleFilterSelection(selected,a);
  expect(JSON.parse(selected)).toEqual([b]);
 });
});