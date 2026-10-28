-- Individual access to goal achievements and compatible configurable medal icons.
begin;
insert into crm_private.permission_catalog(key) values ('goals.view') on conflict do nothing;
-- Keep manager access and default seller access for legacy memberships.
create or replace function crm_private.member_permission(p_member uuid,p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when a.membership_id is not null then p_key=any(a.keys)
 when m.role='manager' then true
 when m.role='seller' and p_key='goals.view' then true
 when p_key in ('boards.view','catalog.view','labels.view','strategies.view','dashboard.view') then true
 when m.role='seller' then split_part(p_key,'.',1) in ('cards','contacts','history','tasks') and p_key<>'cards.delete'
 else p_key in ('cards.view','contacts.view','history.view','history.whatsapp','tasks.view','tasks.create','tasks.edit') end
 from public.crm_memberships m join public.crm_companies c on c.id=m.company_id
 left join crm_private.employee_access a on a.membership_id=m.id
 where m.id=p_member and m.active and c.enabled and exists(select 1 from crm_private.permission_catalog where key=p_key)),false);
$$;
drop policy if exists crm_goals_read on public.crm_goal_plans;
create policy crm_goals_read on public.crm_goal_plans for select to authenticated
using (crm_private.has_company_access(company_id) and crm_private.has_permission(company_id,'goals.view'));
drop policy if exists crm_goals_progress_read on public.crm_goal_employee_progress;
create policy crm_goals_progress_read on public.crm_goal_employee_progress for select to authenticated
using (crm_private.has_company_access(company_id) and crm_private.has_permission(company_id,'goals.view')
 and (crm_private.company_role(company_id)='manager' or crm_private.owns_membership(company_id,membership_id)));
drop policy if exists crm_confirmed_sales_read on public.crm_confirmed_sales;
create policy crm_confirmed_sales_read on public.crm_confirmed_sales for select to authenticated
using (crm_private.has_company_access(company_id) and crm_private.has_permission(company_id,'goals.view')
 and (crm_private.company_role(company_id)='manager' or crm_private.owns_membership(company_id,membership_id)));
create or replace function crm_private.validate_goal_plan() returns trigger
language plpgsql security invoker set search_path='' as $$
declare s jsonb; m jsonb; n integer:=0; t text; rate numeric;
begin
  if jsonb_typeof(new.stages)<>'array' or jsonb_array_length(new.stages) not between 2 and 8
    or jsonb_typeof(new.medals)<>'array' or jsonb_array_length(new.medals)>8
  then raise exception 'CRM_INVALID_GOAL_CONFIGURATION' using errcode='23514'; end if;
  for s in select value from jsonb_array_elements(new.stages) loop
    t:=btrim(s->>'label');
    if jsonb_typeof(s)<>'object' or t is null or char_length(t) not between 1 and 50
      or exists(select 1 from jsonb_object_keys(s) k where k not in ('label','rate')) then
      raise exception 'CRM_INVALID_GOAL_STAGE' using errcode='23514';
    end if;
    if n=0 then
      if s->'rate' is distinct from 'null'::jsonb and s ? 'rate'
      then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514'; end if;
    else
      if jsonb_typeof(s->'rate')<>'number' then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514'; end if;
      rate:=(s->>'rate')::numeric;
      if rate<=0 or rate>100 then raise exception 'CRM_INVALID_GOAL_RATE' using errcode='23514';end if;
    end if;
    n:=n+1;
  end loop;
  if lower(new.stages->(n-1)->>'label') <> 'vendas' then
     raise exception 'CRM_LAST_GOAL_STAGE_SALES' using errcode='23514';
  end if;
  for m in select value from jsonb_array_elements(new.medals) loop
    if jsonb_typeof(m)<>'object' or nullif(btrim(m->>'label'),'') is null
      or char_length(m->>'label')>60
      or (m->>'kind') not in ('sales','percent')
      or (m ? 'icon' and ((m->>'icon') is null or (m->>'icon') not in ('bronze','silver','gold','trophy','diamond','crown','fire','star','rocket')))
      or jsonb_typeof(m->'threshold')<>'number'
      or (m->>'threshold')::numeric<>trunc((m->>'threshold')::numeric)
      or (m->>'threshold')::numeric not between 1 and 1000
      or exists(select 1 from jsonb_object_keys(m) k where k not in ('label','kind','threshold','icon'))
    then raise exception 'CRM_INVALID_GOAL_MEDAL' using errcode='23514';end if;
  end loop;
  new.updated_at:=now();
  return new;
end;$$;

commit;
