import { type FilterField, filterSelectedValues } from '../../components/ui/global-filters';
import type { Temperature, Contact, Opportunity } from '../../domain/types';
import type { LabelRow, CatalogRow, StageRow, TeamRow } from '../../data/backend';
import type { Stage, Label, CatalogItem, Member } from '../../domain/types';

export interface CardFacetValues {
  stage: string;
  labels: string;
  catalog: string;
  owner: string;
  temperature: string;
  status: string;
}
export const emptyCardFacets:CardFacetValues={
  stage:'all',labels:'[]',catalog:'[]',owner:'all',temperature:'all',status:'all',
};
export interface CardFacetCriteria {
  labelIds:string[];
  catalogIds:string[];
  ownerId?:string;
  temperature?:'cold'|'warm'|'hot';
  closed?:boolean;
}
export function cardFacetCriteria(
  facets:CardFacetValues,ownMembershipId:string,
):CardFacetCriteria {
  return {
    labelIds:filterSelectedValues(facets.labels),
    catalogIds:filterSelectedValues(facets.catalog),
    ownerId:facets.owner==='mine'?ownMembershipId:
      facets.owner==='all'?undefined:facets.owner,
    temperature:facets.temperature==='cold'||facets.temperature==='warm'||facets.temperature==='hot'
      ? facets.temperature:undefined,
    closed:facets.status==='closed'?true:facets.status==='open'?false:undefined,
  };
}
type Choice={id:string;name:string;active?:boolean;kind?:string};
export function cardFacetFields({
  stages,labels,catalog,team,includeOwners=true,
}: {
  stages:readonly Pick<StageRow,'id'|'name'>[] | readonly Stage[];
  labels:readonly Choice[] | readonly LabelRow[] | readonly Label[];
  catalog:readonly Choice[] | readonly CatalogRow[] | readonly CatalogItem[];
  team?:readonly Pick<TeamRow,'id'|'name'>[] | readonly Member[];
  includeOwners?:boolean;
}):FilterField[] {
  const opt=(items:readonly Choice[]) => items
    .filter(item=>item.active!==false).map(item=>({value:item.id,label:item.name}))
    .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'));
  const fields:FilterField[]=[
    {key:'stage',label:'Etapa do funil',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todas as etapas'},...stages.map(s=>({value:s.id,label:s.name}))]},
    {key:'labels',label:'Etiquetas',type:'multi-select',defaultValue:'[]',options:opt(labels)},
    {key:'catalog',label:'Serviços e produtos',type:'multi-select',defaultValue:'[]',options:opt(catalog)},
    {key:'temperature',label:'Temperatura do contato',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todas'},{value:'cold',label:'Frio'},
        {value:'warm',label:'Morno'},{value:'hot',label:'Quente'}]},
    {key:'status',label:'Situação do card',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todos'},{value:'open',label:'Em aberto'},
        {value:'closed',label:'Encerrados'}]},
  ];
  if(includeOwners){
    fields.splice(3,0,{key:'owner',label:'Responsável pelo contato',type:'select',defaultValue:'all',
      options:[{value:'all',label:'Todos os permitidos'},{value:'mine',label:'Minha carteira'},
        ...(team||[]).filter(m=>m.active!==false).map(m=>({value:m.id,label:m.name}))
          .sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))]});
  }
  return fields;
}
export function matchDemoCardFacets(
  card:Opportunity,contact:Contact|undefined,facets:CardFacetValues,ownMembershipId:string,
):boolean {
  const criteria=cardFacetCriteria(facets,ownMembershipId);
  return (facets.stage==='all'||facets.stage===card.stageId)
    && (!!contact)
    && (!criteria.labelIds.length||criteria.labelIds.some(id=>card.labelIds?.includes(id)))
    && (!criteria.catalogIds.length||criteria.catalogIds.some(id=>card.catalogIds?.includes(id)))
    && (!criteria.ownerId||contact.ownerId===criteria.ownerId)
    && (!criteria.temperature||contact.temperature===criteria.temperature)
    && (criteria.closed===undefined||Boolean(card.confirmedSaleAt)===criteria.closed);
}
