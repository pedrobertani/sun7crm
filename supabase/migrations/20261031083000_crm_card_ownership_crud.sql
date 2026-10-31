-- O card tem responsável próprio, independente de quem responde pelo contato.
-- Migrar cards existentes para o responsável atual do contato, sem perder histórico.
begin;
alter table public.crm_opportunities add column owner_membership_id uuid;
update public.crm_opportunities o
set owner_membership_id=c.owner_membership_id
from public.crm_contacts c
where c.company_id=o.company_id and c.id=o.contact_id;
alter table public.crm_opportunities alter column owner_membership_id set not null;
alter table public.crm_opportunities add constraint crm_card_owner_company_fk
 foreign key (company_id,owner_membership_id) references public.crm_memberships(company_id,id);
create index crm_card_company_owner_idx on public.crm_opportunities(company_id,owner_membership_id,stage_id);

-- Política obrigatória: apenas gestor enxerga toda a empresa. Funcionários,
-- mesmo com alcance "company" em contatos, só enxergam seus próprios cards.
create function crm_private.card_owner_scope(p_company uuid,p_card uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select crm_private.has_company_access(p_company) and exists(
   select 1 from public.crm_opportunities c where c.company_id=p_company and c.id=p_card
     and (crm_private.company_role(p_company)='manager'
       or crm_private.owns_membership(p_company,c.owner_membership_id))
 );
$$;
revoke all on function crm_private.card_owner_scope(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function crm_private.card_owner_scope(uuid,uuid) to authenticated;

create function crm_private.can_read_card(p_company uuid,p_card uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select crm_private.has_permission(p_company,'cards.view')
    and crm_private.card_owner_scope(p_company,p_card);
$$;
revoke all on function crm_private.can_read_card(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function crm_private.can_read_card(uuid,uuid) to authenticated;

-- O funcionário responsável por um card precisa acessar os dados do contato vinculado
-- mesmo quando a carteira geral do contato pertence a outro funcionário.
create or replace function crm_private.can_read_contact(target_company uuid,target_contact uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select crm_private.has_permission(target_company,'contacts.view') and (
   crm_private.permission_contact_scope(target_company,target_contact)
   or (
     crm_private.has_permission(target_company,'cards.view')
     and exists(select 1 from public.crm_opportunities o
       where o.company_id=target_company and o.contact_id=target_contact
       and o.archived_at is null and crm_private.owns_membership(target_company,o.owner_membership_id))
   )
 );
$$;

drop policy permissions_select on public.crm_contacts;
create policy permissions_select on public.crm_contacts for select to authenticated
 using(crm_private.can_read_contact(company_id,id));

drop policy permissions_select on public.crm_opportunities;
create policy permissions_select on public.crm_opportunities for select to authenticated
 using(crm_private.has_permission(company_id,'cards.view') and
       (crm_private.company_role(company_id)='manager'
       or crm_private.owns_membership(company_id,owner_membership_id)));
drop policy permissions_insert on public.crm_opportunities;
create policy permissions_insert on public.crm_opportunities for insert to authenticated
 with check(crm_private.has_permission(company_id,'cards.create')
            and crm_private.can_read_contact(company_id,contact_id)
            and crm_private.active_membership(company_id,owner_membership_id));
drop policy permissions_update on public.crm_opportunities;
create policy permissions_update on public.crm_opportunities for update to authenticated
 using(crm_private.has_permission(company_id,'cards.edit') and
       (crm_private.company_role(company_id)='manager'
       or crm_private.owns_membership(company_id,owner_membership_id)))
 with check(crm_private.has_permission(company_id,'cards.edit') and
       crm_private.active_membership(company_id,owner_membership_id));

drop policy crm_card_labels_read on public.crm_card_labels;
create policy crm_card_labels_read on public.crm_card_labels for select to authenticated
 using(crm_private.can_read_card(company_id,opportunity_id));
drop policy crm_card_catalog_read on public.crm_card_catalog;
create policy crm_card_catalog_read on public.crm_card_catalog for select to authenticated
 using(crm_private.can_read_card(company_id,opportunity_id));

drop policy contact_history_read on public.crm_contact_history;
create policy contact_history_read on public.crm_contact_history for select to authenticated using(
 crm_private.has_permission(company_id,'history.view') and
 (crm_private.permission_contact_scope(company_id,contact_id) or
   (opportunity_id is not null and crm_private.can_read_card(company_id,opportunity_id)))
 and (opportunity_id is null or crm_private.can_read_card(company_id,opportunity_id))
);
drop policy contact_history_note_insert on public.crm_contact_history;
create policy contact_history_note_insert on public.crm_contact_history for insert to authenticated
 with check(actor_user_id=(select auth.uid()) and
 (crm_private.permission_contact_scope(company_id,contact_id)
  or (opportunity_id is not null and crm_private.can_read_card(company_id,opportunity_id))) and
 ((kind='note' and crm_private.has_permission(company_id,'history.create'))
  or (kind='whatsapp_opened' and crm_private.has_permission(company_id,'history.whatsapp'))));

-- Consulta mínima dos responsáveis, sem emails e sem conceder team.view/team.manage.
-- Respeita o CRUD do recurso escolhido e, para contato/tarefa, o alcance da carteira.
create function public.crm_assignable_members(p_company uuid,p_resource text,p_operation text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; view_key text;
begin
 if p_resource not in ('cards','contacts','tasks','strategies')
    or p_operation not in ('create','edit') then
   raise exception 'CRM_INVALID_INPUT' using errcode='22023';
 end if;
 perform crm_private.require_permission(p_company,p_resource||'.'||p_operation);
 view_key:=p_resource||'.view';
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'display_name',p.display_name,'active',m.active)
     order by p.display_name),'[]'::jsonb)
 into result
 from public.crm_memberships m join public.crm_profiles p on p.id=m.user_id
 where m.company_id=p_company and m.active and
   (p_resource in ('cards','strategies') or crm_private.has_company_scope(p_company)
    or crm_private.owns_membership(p_company,m.id))
   and (crm_private.member_permission(m.id,view_key)
       or (p_resource='strategies' and crm_private.member_permission(m.id,'cards.view')));
 return result;
end;$$;
revoke all on function public.crm_assignable_members(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_assignable_members(uuid,text,text) to authenticated;

create or replace function crm_private.core_save_card(p_company uuid,p_card uuid,p_values jsonb,p_expected_version bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.crm_opportunities;result public.crm_opportunities;contact uuid;board uuid;stage uuid;strategy uuid;labels uuid[];items uuid[];label uuid;item uuid;owner uuid;
begin
 perform crm_private.require_permission(p_company,case when p_card is null then 'cards.create' else 'cards.edit' end);
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['contact_id','board_id','stage_id','title','value_cents','source','strategy_id','label_ids','catalog_ids','follow_up_at','is_closed','owner_membership_id'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 if p_card is not null then
  select * into previous from public.crm_opportunities where company_id=p_company and id=p_card for update;
  if not found or previous.archived_at is not null or not crm_private.card_owner_scope(p_company,p_card) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if p_expected_version is null or previous.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 end if;
 contact:=coalesce((p_values->>'contact_id')::uuid,previous.contact_id);
 if not crm_private.can_read_contact(p_company,contact) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 owner:=coalesce((p_values->>'owner_membership_id')::uuid,previous.owner_membership_id,(select m.id from public.crm_memberships m where m.company_id=p_company and m.user_id=(select auth.uid()) and m.active));
 if not crm_private.active_membership(p_company,owner) then raise exception 'CRM_INVALID_OWNER' using errcode='22023';end if;
 board:=coalesce((p_values->>'board_id')::uuid,previous.board_id);stage:=coalesce((p_values->>'stage_id')::uuid,previous.stage_id);
 if not exists(select 1 from public.crm_stages where company_id=p_company and board_id=board and id=stage) then raise exception 'CRM_INVALID_STAGE' using errcode='22023';end if;
 if p_values ? 'strategy_id' then strategy:=(p_values->>'strategy_id')::uuid;else strategy:=previous.strategy_id;end if;
 if strategy is not null and not exists(select 1 from public.crm_strategies where company_id=p_company and id=strategy and (active or id=previous.strategy_id)) then raise exception 'CRM_INVALID_STRATEGY' using errcode='22023';end if;
 if p_values ? 'label_ids' then
  if jsonb_typeof(p_values->'label_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  select coalesce(array_agg(distinct x::uuid),'{}') into labels from jsonb_array_elements_text(p_values->'label_ids') x;
 else select coalesce(array_agg(label_id),'{}') into labels from public.crm_card_labels where company_id=p_company and opportunity_id=p_card;end if;
 if cardinality(labels)>3 then raise exception 'CRM_LABEL_LIMIT' using errcode='23514';end if;
 if p_values ? 'catalog_ids' then
  if jsonb_typeof(p_values->'catalog_ids') is distinct from 'array' then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  select coalesce(array_agg(distinct x::uuid),'{}') into items from jsonb_array_elements_text(p_values->'catalog_ids') x;
 else select coalesce(array_agg(catalog_id),'{}') into items from public.crm_card_catalog where company_id=p_company and opportunity_id=p_card;end if;
 foreach label in array labels loop
  if not exists(select 1 from public.crm_labels l where l.company_id=p_company and l.id=label and (l.active or exists(select 1 from public.crm_card_labels where company_id=p_company and opportunity_id=p_card and label_id=label))) then raise exception 'CRM_INVALID_LABEL' using errcode='22023';end if;
 end loop;
 foreach item in array items loop
  if not exists(select 1 from public.crm_catalog_items c where c.company_id=p_company and c.id=item and (c.active or exists(select 1 from public.crm_card_catalog where company_id=p_company and opportunity_id=p_card and catalog_id=item))) then raise exception 'CRM_INVALID_CATALOG_ITEM' using errcode='22023';end if;
 end loop;
 if p_card is null then
  insert into public.crm_opportunities(company_id,contact_id,board_id,stage_id,title,value_cents,source,strategy_id,follow_up_at,is_closed,owner_membership_id)
  values(p_company,contact,board,stage,coalesce(p_values->>'title',''),coalesce((p_values->>'value_cents')::integer,0),coalesce(p_values->>'source',''),strategy,(p_values->>'follow_up_at')::timestamptz,coalesce((p_values->>'is_closed')::boolean,false),owner) returning * into result;
 else
  update public.crm_opportunities set contact_id=contact,board_id=board,stage_id=stage,owner_membership_id=owner,title=coalesce(p_values->>'title',previous.title),value_cents=coalesce((p_values->>'value_cents')::integer,previous.value_cents),source=coalesce(p_values->>'source',previous.source),strategy_id=strategy,
  follow_up_at=case when p_values ? 'follow_up_at' then (p_values->>'follow_up_at')::timestamptz else previous.follow_up_at end,
  is_closed=coalesce((p_values->>'is_closed')::boolean,previous.is_closed) where id=p_card returning * into result;
 end if;
 delete from public.crm_card_labels where company_id=p_company and opportunity_id=result.id and not(label_id=any(labels));
 insert into public.crm_card_labels(company_id,opportunity_id,label_id) select p_company,result.id,x from unnest(labels) x where not exists(select 1 from public.crm_card_labels where company_id=p_company and opportunity_id=result.id and label_id=x);
 delete from public.crm_card_catalog where company_id=p_company and opportunity_id=result.id and not(catalog_id=any(items));
 insert into public.crm_card_catalog(company_id,opportunity_id,catalog_id) select p_company,result.id,x from unnest(items) x where not exists(select 1 from public.crm_card_catalog where company_id=p_company and opportunity_id=result.id and catalog_id=x);
 if p_card is not null and (p_values ? 'label_ids' or p_values ? 'catalog_ids') then
  insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body)
  values(p_company,contact,result.id,(select auth.uid()),coalesce((select display_name from public.crm_profiles where id=(select auth.uid())),'Usuário'),'card_updated','Interesses e etiquetas atualizados','Seleções de etiquetas e serviços/produtos conferidas no card.');
 end if;
 return to_jsonb(result)||jsonb_build_object('label_ids',to_jsonb(labels),'catalog_ids',to_jsonb(items));
end;
$$;

create or replace function crm_private.crm_delete_card(p_company uuid,p_card uuid,p_expected_version bigint) returns void
language plpgsql security definer set search_path='' as $$
declare card public.crm_opportunities;
begin
 perform crm_private.require_permission(p_company,'cards.delete');
 select * into card from public.crm_opportunities where company_id=p_company and id=p_card and archived_at is null for update;
 if not found or not crm_private.card_owner_scope(p_company,p_card) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_expected_version is null or p_expected_version<>card.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if exists(select 1 from public.crm_ambassador_referrals where company_id=p_company and opportunity_id=p_card) then raise exception 'CRM_CARD_HAS_REFERRALS' using errcode='23514';end if;
 update public.crm_opportunities set archived_at=statement_timestamp(),is_closed=true where id=p_card;
 insert into public.crm_contact_history(company_id,contact_id,opportunity_id,actor_user_id,actor_name,kind,title,body) values(p_company,card.contact_id,card.id,(select auth.uid()),coalesce((select display_name from public.crm_profiles where id=(select auth.uid())),'Usuário'),'card_updated','Card excluído','O card foi removido do funil. Seu histórico permanece preservado.');
end;$$;

create or replace function crm_private.core_confirm_card_sale(
  p_company uuid,p_card uuid,p_stage uuid,p_expected_version bigint,p_amount_cents integer
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.crm_opportunities;owner uuid;stage_name text;result jsonb;
begin
  perform crm_private.require_permission(p_company,'cards.edit');
  select * into c from public.crm_opportunities
    where company_id=p_company and id=p_card for update;
  if not found or c.archived_at is not null or not crm_private.card_owner_scope(p_company,p_card)
  then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  if c.row_version<>p_expected_version then
    raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
  if p_amount_cents is null or p_amount_cents<=0 then
    raise exception 'CRM_INVALID_CONFIRMED_VALUE' using errcode='22023';end if;
  select lower(translate(btrim(name),'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç','AAAAEEIOOOUCaaaaeeiooouc'))
    into stage_name from public.crm_stages where company_id=p_company and board_id=c.board_id and id=p_stage;
  if stage_name is null or stage_name not in ('fechado','ganho','venda realizada','venda concluida','procedimento realizado','atendimento realizado')
  then raise exception 'CRM_NOT_A_SALE_STAGE' using errcode='22023';end if;
  if exists(select 1 from public.crm_confirmed_sales where company_id=p_company and opportunity_id=p_card and reversed_at is null)
  then raise exception 'CRM_SALE_ALREADY_CONFIRMED' using errcode='23505';end if;
  -- O crédito da venda pertence ao responsável pelo card, não ao dono geral do contato.
  select m.id into owner from public.crm_memberships m
    where m.company_id=p_company and m.id=c.owner_membership_id and m.active;
  if owner is null then raise exception 'CRM_SALE_OWNER_REQUIRED' using errcode='22023';end if;
  result:=crm_private.core_save_card(p_company,p_card,jsonb_build_object(
     'stage_id',p_stage,'value_cents',p_amount_cents),p_expected_version);
  insert into public.crm_confirmed_sales(company_id,opportunity_id,membership_id,value_cents,confirmed_at,confirmed_by,reversed_at)
  values(p_company,p_card,owner,p_amount_cents,now(),(select auth.uid()),null)
  on conflict(company_id,opportunity_id) do update set
    membership_id=excluded.membership_id,value_cents=excluded.value_cents,confirmed_at=excluded.confirmed_at,
    confirmed_by=excluded.confirmed_by,reversed_at=null;
  return result;
end;
$$;

commit;
