-- Busca parametrizada de cards: filtro antes do LIMIT/OFFSET.
-- INVOKER aplica RLS de oportunidades, contatos e relações por empresa.
begin;
create or replace function public.crm_search_kanban_cards(
  p_company uuid, p_board uuid, p_stage uuid default null,
  p_page integer default 0, p_page_size integer default 10,
  p_search text default '', p_from timestamptz default null, p_until timestamptz default null,
  p_label_ids uuid[] default '{}', p_catalog_ids uuid[] default '{}',
  p_owner uuid default null, p_temperature text default null, p_closed boolean default null
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare response jsonb;
begin
  if not crm_private.has_permission(p_company,'cards.view') then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_board is null or p_page is null or p_page not between 0 and 100000
    or p_page_size is null or p_page_size not in (10,25,50,100)
    or length(coalesce(p_search,'')) > 100
    or p_temperature is not null and p_temperature not in ('unclassified','cold','warm','hot')
    or p_from is not null and p_until is null
    or p_until is not null and p_from is null
    or p_from is not null and p_from >= p_until
    or coalesce(cardinality(p_label_ids),0)>30
    or coalesce(cardinality(p_catalog_ids),0)>30
    or array_position(p_label_ids,null) is not null
    or array_position(p_catalog_ids,null) is not null
  then raise exception 'CRM_INVALID_FILTER' using errcode='22023'; end if;

  with filtered as (
    select o.*
    from public.crm_opportunities o
    join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
    where o.company_id=p_company and o.board_id=p_board
      and (p_stage is null or o.stage_id=p_stage)
      and (p_from is null or (o.created_at>=p_from and o.created_at<p_until))
      and (p_owner is null or c.owner_membership_id=p_owner)
      and (p_temperature is null or c.temperature=p_temperature)
      and (p_closed is null or o.is_closed=p_closed)
      and (coalesce(cardinality(p_label_ids),0)=0 or exists (
         select 1 from public.crm_card_labels cl
         where cl.company_id=o.company_id and cl.opportunity_id=o.id and cl.label_id=any(p_label_ids)
      ))
      and (coalesce(cardinality(p_catalog_ids),0)=0 or exists (
         select 1 from public.crm_card_catalog cc
         where cc.company_id=o.company_id and cc.opportunity_id=o.id and cc.catalog_id=any(p_catalog_ids)
      ))
      and (length(btrim(coalesce(p_search,'')))=0
        or o.title ilike '%'||btrim(p_search)||'%'
        or c.name ilike '%'||btrim(p_search)||'%'
        or c.phone ilike '%'||regexp_replace(p_search,'[^0-9]','','g')||'%'
           and length(regexp_replace(p_search,'[^0-9]','','g'))>=7
      )
  ), paged as (
    select * from filtered order by created_at desc,id desc
    limit p_page_size offset (p_page*p_page_size)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from paged p)
  ) into response;
  return response;
end;
$$;
revoke all on function public.crm_search_kanban_cards(
 uuid,uuid,uuid,integer,integer,text,timestamptz,timestamptz,uuid[],uuid[],uuid,text,boolean
) from public,anon,authenticated,service_role;
grant execute on function public.crm_search_kanban_cards(
 uuid,uuid,uuid,integer,integer,text,timestamptz,timestamptz,uuid[],uuid[],uuid,text,boolean
) to authenticated;
create index if not exists crm_kanban_facets_stage_date_idx
 on public.crm_opportunities(company_id,board_id,stage_id,created_at desc,id desc);
create index if not exists crm_kanban_facets_contact_owner_idx
 on public.crm_contacts(company_id,owner_membership_id,temperature);
commit;