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

-- Gravações antigas (fixtures, migração ou integração) sem responsável explícito
-- continuam vinculadas ao dono do contato. O novo CRM sempre envia dono próprio.
create function crm_private.default_card_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_membership_id is null then
   select c.owner_membership_id into new.owner_membership_id from public.crm_contacts c
   where c.company_id=new.company_id and c.id=new.contact_id;
 end if;
 return new;
end;$$;
revoke all on function crm_private.default_card_owner() from public,anon,authenticated,service_role;
create trigger crm_card_owner_default before insert on public.crm_opportunities
 for each row execute function crm_private.default_card_owner();

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
 using(crm_private.has_permission(company_id,'contacts.view') and
  (crm_private.has_company_scope(company_id)
   or crm_private.owns_membership(company_id,owner_membership_id)
   or crm_private.can_read_contact(company_id,id)));

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
 if not crm_private.active_membership(p_company,owner)
 or not crm_private.member_permission(owner,'cards.view') then
   raise exception 'CRM_INVALID_OWNER' using errcode='22023';end if;
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


-- A desativação de um funcionário redistribui também seus cards em aberto,
-- para que nenhum card fique invisível após a transferência de carteira.
create or replace function crm_private.workspace_update_team_member(p_company uuid,p_membership uuid,p_values jsonb,p_reassign_to uuid,p_expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare member public.crm_memberships;target public.crm_memberships;next_active boolean;next_role text;next_name text;
begin
 perform crm_private.require_permission(p_company,'team.manage');
 if jsonb_typeof(p_values) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_values) k where k<>all(array['display_name','role','active'])) then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
 perform 1 from public.crm_companies where id=p_company for update;
 select * into member from public.crm_memberships where company_id=p_company and id=p_membership for update;
 if not found or member.role='manager' or member.user_id=(select auth.uid()) or exists(select 1 from crm_private.platform_admins where user_id=member.user_id) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if crm_private.company_role(p_company)<>'manager' and (
  not exists(select 1 from crm_private.employee_access a where a.membership_id=member.id)
  or exists(select 1 from crm_private.employee_access a,unnest(a.keys) k where a.membership_id=member.id and not crm_private.has_permission(p_company,k))
  or (crm_private.member_company_scope(member.id) and not crm_private.has_company_scope(p_company))
  or (p_values ? 'role' and p_values->>'role' is distinct from member.role)
 ) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
 if p_expected_version is null or member.row_version<>p_expected_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 next_active:=coalesce((p_values->>'active')::boolean,member.active);next_role:=coalesce(p_values->>'role',member.role);
 if next_role not in ('seller','reception') then raise exception 'CRM_INVALID_ROLE' using errcode='22023';end if;
 if p_values ? 'display_name' then
  next_name:=btrim(p_values->>'display_name');
  if next_name is null or length(next_name) not between 1 and 160 then raise exception 'CRM_INVALID_INPUT' using errcode='22023';end if;
  if exists(select 1 from public.crm_memberships where user_id=member.user_id and company_id<>p_company) and next_name is distinct from (select display_name from public.crm_profiles where id=member.user_id) then raise exception 'CRM_SHARED_IDENTITY' using errcode='23514';end if;
 end if;
 if not next_active and member.active then
  if exists(select 1 from public.crm_contacts where company_id=p_company and owner_membership_id=member.id) or exists(select 1 from public.crm_tasks where company_id=p_company and owner_membership_id=member.id and status<>'done') or exists(select 1 from public.crm_opportunities where company_id=p_company and owner_membership_id=member.id and archived_at is null) then
   select * into target from public.crm_memberships where company_id=p_company and id=p_reassign_to and active and id<>member.id and crm_private.member_permission(id,'contacts.view')
    and (not exists(select 1 from public.crm_opportunities where company_id=p_company and owner_membership_id=member.id and archived_at is null) or crm_private.member_permission(id,'cards.view')) for key share;
   if not found then raise exception 'CRM_REASSIGNMENT_REQUIRED' using errcode='23514';end if;
   update public.crm_contacts set owner_membership_id=target.id where company_id=p_company and owner_membership_id=member.id;
   update public.crm_tasks set owner_membership_id=target.id where company_id=p_company and owner_membership_id=member.id and status<>'done';
    update public.crm_opportunities set owner_membership_id=target.id where company_id=p_company and owner_membership_id=member.id and archived_at is null;
  end if;
 end if;
 if next_name is not null then update public.crm_profiles set display_name=next_name where id=member.user_id;end if;
 update public.crm_memberships set active=next_active,role=next_role where id=member.id returning * into member;
 return to_jsonb(member);
end;
$$;

-- Alerta de card pertence ao responsável do card; gestor mantém visão geral.
create or replace view public.crm_card_activity with(security_invoker=true) as
with activity as (
 select o.company_id,o.id as opportunity_id,o.contact_id,o.board_id,o.stage_id,o.title,o.value_cents,o.created_at,o.follow_up_at,o.is_closed,
 c.name as contact_name,c.phone,o.owner_membership_id,coalesce(p.display_name,'Sem responsável') as owner_name,b.name as board_name,s.name as stage_name,
 true as alerts_enabled,24 as first_response_hours,3 as idle_days_threshold,7 as escalation_days_threshold,
 min(h.occurred_at) as first_activity_at,max(h.occurred_at) as last_activity_at
 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
 join public.crm_boards b on b.company_id=o.company_id and b.id=o.board_id
 join public.crm_stages s on s.company_id=o.company_id and s.board_id=o.board_id and s.id=o.stage_id
 left join public.crm_memberships m on m.company_id=o.company_id and m.id=o.owner_membership_id
 left join public.crm_profiles p on p.id=m.user_id
 left join public.crm_contact_history h on h.company_id=o.company_id and h.opportunity_id=o.id and h.kind in ('note','whatsapp_opened','card_moved')
 group by o.company_id,o.id,c.id,c.name,c.phone,o.owner_membership_id,p.display_name,b.id,b.name,s.id,s.name
), effective as (
 select *,greatest(coalesce(last_activity_at,created_at),follow_up_at) as effective_since from activity
)
select *,greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/3600))::integer as hours_without_activity,
 greatest(0,floor(extract(epoch from statement_timestamp()-effective_since)/86400))::integer as days_without_activity,
 extract(epoch from effective_since)::text as activity_key
from effective;

create or replace function crm_private.notification_candidates(p_recipient uuid)
returns table(company_id uuid,recipient_user_id uuid,kind text,entity_id uuid,event_key text,
  title text,body text,priority smallint,contact_id uuid)
language sql stable security invoker set search_path='' as $$
  with memberships as materialized (
    select m.id,m.company_id,m.role,m.user_id,
      (statement_timestamp() at time zone 'America/Sao_Paulo')::date as local_today
    from public.crm_memberships m
    join public.crm_companies c on c.id=m.company_id
    where (p_recipient is null or m.user_id=p_recipient) and m.active and c.enabled
      and exists(select 1 from public.crm_profiles p where p.id=m.user_id and not p.password_change_required)
      and (select count(*) from public.crm_legal_requirements)=2
      and not exists(
        select 1 from public.crm_legal_requirements r where not exists(
          select 1 from public.crm_legal_acceptances a
          where a.user_id=m.user_id and a.kind=r.kind and a.version=r.version
        )
      )
  ), card_activity as materialized (
    select v.* from public.crm_card_activity v
    where not v.is_closed and exists(select 1 from memberships m where m.company_id=v.company_id)
  ), candidates as (
    select m.company_id,m.user_id as recipient_user_id,'subscription_due'::text as kind,m.company_id as entity_id,
      b.due_date::text || ':' || b.cycle_kind || ':' || crm_private.subscription_state(b.due_date,b.cycle_kind,local_today)
        || case when b.cycle_kind='monthly' and local_today>b.due_date and local_today<=b.due_date+7
          then ':' || (local_today-b.due_date)::text else '' end as event_key,
      case when b.cycle_kind='awaiting_payment' then 'Plano aguardando liberação'
        when b.cycle_kind='complimentary' and local_today<b.due_date then 'Seu período gratuito termina em breve'
        when b.cycle_kind='complimentary' then 'Seu período gratuito terminou'
        when local_today>b.due_date+7 then 'Acesso suspenso: pagamento pendente'
        when local_today>b.due_date then 'Pagamento pendente: período de carência'
        when local_today=b.due_date then 'Seu plano vence hoje'
        else 'Seu plano vence em breve' end as title,
      case when b.cycle_kind='awaiting_payment' then 'O administrador precisa confirmar o pagamento ou conceder dias gratuitos para liberar o acesso.'
        when b.cycle_kind='complimentary' then 'Gratuidade até ' || to_char(b.due_date-1,'DD/MM/YYYY') || '. Combine a continuidade do plano com a administração.'
        when local_today>b.due_date+7 then 'A carência terminou em ' || to_char(b.due_date+7,'DD/MM/YYYY') || '. Solicite a confirmação do pagamento à administração.'
        when local_today>b.due_date then 'Dia ' || (local_today-b.due_date)::text || ' de 7 de carência. Acesso até ' || to_char(b.due_date+7,'DD/MM/YYYY') || '. Os dias utilizados serão descontados do próximo período.'
        else 'Vencimento: ' || to_char(b.due_date,'DD/MM/YYYY') || '. Combine o pagamento com a administração.' end as body
    from memberships m join public.crm_company_billing b on b.company_id=m.company_id
    where crm_private.member_permission(m.id,'plan.view') and b.due_date<=local_today+7

    union all
    select m.company_id,m.user_id,'task_assigned',t.id,t.id::text || ':' || m.id::text,
      'Tarefa atribuída a você','Há uma tarefa pendente sob sua responsabilidade. Confira os detalhes e o prazo.'
    from memberships m join public.crm_tasks t on t.company_id=m.company_id and t.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'tasks.view') and t.status<>'done' and t.due_date>local_today

    union all
    select m.company_id,m.user_id,'task_due',t.id,t.id::text || ':' || t.due_date::text || ':' || case when t.due_date<local_today then 'overdue' else 'today' end,
      case when t.due_date<local_today then 'Tarefa com prazo vencido' else 'Tarefa com prazo para hoje' end,
      case when (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) then 'Há uma tarefa da equipe que precisa de acompanhamento.' else 'Confira a tarefa sob sua responsabilidade e atualize o andamento.' end
    from memberships m join public.crm_tasks t on t.company_id=m.company_id
    where crm_private.member_permission(m.id,'tasks.view') and t.status<>'done' and t.due_date<=local_today and ((crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) or t.owner_membership_id=m.id)

    union all
    select m.company_id,m.user_id,'new_contact',c.id,c.id::text,
      'Novo contato na empresa','Um novo contato entrou na carteira da empresa. Confira o responsável pelo atendimento.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id
    where crm_private.member_permission(m.id,'contacts.view') and (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) and c.created_at>=statement_timestamp()-interval '7 days'

    union all
    select m.company_id,m.user_id,'contact_assigned',c.id,c.id::text || ':' || m.id::text,
      'Contato atribuído a você','Há um contato atribuído ao seu usuário. Confira o atendimento e o próximo passo.'
    from memberships m join public.crm_contacts c on c.company_id=m.company_id and c.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'contacts.view') and m.role in ('seller','reception') and c.updated_at>=statement_timestamp()-interval '7 days'
    union all
    select m.company_id,m.user_id,'card_first_response',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':first',
      'Card aguardando primeiro acompanhamento','Uma oportunidade aguarda acompanhamento há mais de '||v.first_response_hours::text||' horas. Abra o contato e confira o próximo passo.'
    from memberships m join card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and v.alerts_enabled and not v.is_closed and v.first_activity_at is null and v.hours_without_activity>=v.first_response_hours and v.days_without_activity<v.idle_days_threshold
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,m.user_id,'card_idle',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':idle',
      'Card sem acompanhamento','Uma oportunidade está sem acompanhamento há '||v.idle_days_threshold::text||' dias ou mais. Confira o retorno combinado e registre o atendimento.'
    from memberships m join card_activity v on v.company_id=m.company_id and v.owner_membership_id=m.id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.idle_days_threshold
      and (not (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) or v.days_without_activity<v.escalation_days_threshold)
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())
    union all
    select m.company_id,m.user_id,'card_escalation',v.opportunity_id,v.opportunity_id::text||':'||v.activity_key||':escalation',
      'Card precisa de acompanhamento da gestão','Uma oportunidade da equipe está sem acompanhamento há '||v.escalation_days_threshold::text||' dias ou mais. Confira o responsável e as atividades registradas.'
    from memberships m join card_activity v on v.company_id=m.company_id
    where crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view') and (crm_private.member_permission(m.id,'reports.view') and crm_private.member_company_scope(m.id)) and v.alerts_enabled and not v.is_closed and v.days_without_activity>=v.escalation_days_threshold
      and (m.role='manager' or v.owner_membership_id=m.id)
      and (v.follow_up_at is null or v.follow_up_at<=statement_timestamp())

  )
  select c.company_id,c.recipient_user_id,c.kind,c.entity_id,c.event_key,c.title,c.body,
    (case when c.kind='subscription_due' then 3 when c.kind in ('task_due','card_escalation') then 2 else 1 end)::smallint,
    case when c.kind in ('card_first_response','card_idle','card_escalation') then
      (select o.contact_id from public.crm_opportunities o where o.company_id=c.company_id and o.id=c.entity_id)
    else null end
  from candidates c
  where (c.kind='subscription_due' or crm_private.subscription_allows_access(c.company_id))
 and exists(select 1 from memberships m where m.company_id=c.company_id and m.user_id=c.recipient_user_id and
 case when c.kind in ('task_assigned','task_due') then crm_private.member_permission(m.id,'tasks.view')
 when c.kind in ('new_contact','contact_assigned') then crm_private.member_permission(m.id,'contacts.view')
 when c.kind in ('card_first_response','card_idle','card_escalation') then crm_private.member_permission(m.id,'cards.view') and crm_private.member_permission(m.id,'contacts.view')
 else crm_private.member_permission(m.id,'plan.view') end);
$$;

create or replace function crm_private.can_read_notification(p_company uuid,p_recipient uuid,p_kind text,p_entity uuid,p_contact uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare role text;
begin
 if p_recipient is distinct from (select auth.uid()) or not crm_private.has_current_acceptance() then return false;end if;
 role:=crm_private.company_role(p_company);
 if p_kind='subscription_due' then return crm_private.has_permission(p_company,'plan.view');end if;
 if not crm_private.has_company_access(p_company) then return false;end if;
 if p_kind='new_contact' then return crm_private.has_permission(p_company,'reports.view') and crm_private.can_read_contact(p_company,p_entity);end if;
 if p_kind in ('task_assigned','task_due') then return crm_private.has_permission(p_company,'tasks.view') and exists(select 1 from public.crm_tasks t where t.company_id=p_company and t.id=p_entity and t.status<>'done' and (crm_private.owns_membership(t.company_id,t.owner_membership_id) or (p_kind='task_due' and crm_private.has_permission(p_company,'reports.view') and crm_private.has_company_scope(p_company))) and (t.contact_id is null or crm_private.can_read_contact(t.company_id,t.contact_id)));end if;
 if p_kind='contact_assigned' then return crm_private.has_permission(p_company,'contacts.view') and exists(select 1 from public.crm_contacts c where c.company_id=p_company and c.id=p_entity and crm_private.owns_membership(c.company_id,c.owner_membership_id));end if;
 if p_kind in ('card_first_response','card_idle','card_escalation') then return crm_private.has_permission(p_company,'cards.view') and exists(
  select 1 from public.crm_opportunities o join public.crm_contacts c on c.company_id=o.company_id and c.id=o.contact_id
  where o.company_id=p_company and o.id=p_entity and o.contact_id=p_contact and not o.is_closed
  and crm_private.can_read_contact(p_company,p_contact)
  and crm_private.card_owner_scope(p_company,p_entity)
   and (p_kind<>'card_escalation' or crm_private.has_permission(p_company,'reports.view')));end if;
 return false;
end;$$;

commit;
