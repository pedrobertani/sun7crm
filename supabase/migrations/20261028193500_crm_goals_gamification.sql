-- Metas configuradas pelo gestor por empresa e competência.
-- Os resultados são lançamentos de homologação manuais, sem inferir venda de card.
create table public.crm_goal_plans (
  company_id uuid not null references public.crm_companies(id) on delete cascade,
  goal_month date not null,
  target_cents bigint not null check (target_cents > 0 and target_cents <= 1000000000000),
  ticket_cents bigint not null check (ticket_cents > 0 and ticket_cents <= 1000000000000),
  stages jsonb not null,
  medals jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (company_id,goal_month),
  check (goal_month = date_trunc('month',goal_month)::date),
  check (jsonb_typeof(stages)='array' and jsonb_array_length(stages) between 2 and 8),
  check (jsonb_typeof(medals)='array' and jsonb_array_length(medals) <= 8)
);
create table public.crm_goal_employee_progress (
  company_id uuid not null,
  goal_month date not null,
  membership_id uuid not null,
  goal_cents bigint not null check (goal_cents > 0 and goal_cents <= 1000000000000),
  sales_cents bigint not null default 0 check (sales_cents >= 0 and sales_cents <= 1000000000000),
  sales_count integer not null default 0 check (sales_count between 0 and 1000000),
  contacts_count integer not null default 0 check (contacts_count between 0 and 1000000),
  updated_at timestamptz not null default now(),
  primary key(company_id,goal_month,membership_id),
  foreign key(company_id,goal_month) references public.crm_goal_plans(company_id,goal_month) on delete cascade,
  foreign key(company_id,membership_id) references public.crm_memberships(company_id,id) on delete restrict
);
create index crm_goal_employee_month_idx on public.crm_goal_employee_progress(company_id,goal_month);
create function crm_private.validate_goal_plan() returns trigger
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
      or jsonb_typeof(m->'threshold')<>'number'
      or (m->>'threshold')::numeric<>trunc((m->>'threshold')::numeric)
      or (m->>'threshold')::numeric not between 1 and 1000
      or exists(select 1 from jsonb_object_keys(m) k where k not in ('label','kind','threshold'))
    then raise exception 'CRM_INVALID_GOAL_MEDAL' using errcode='23514';end if;
  end loop;
  new.updated_at:=now();
  return new;
end;$$;
create trigger crm_validate_goal_plan before insert or update on public.crm_goal_plans
for each row execute function crm_private.validate_goal_plan();
create function crm_private.touch_goal_employee_progress() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  new.updated_at:=now();
  return new;
end;$$;
create trigger crm_touch_goal_progress before insert or update on public.crm_goal_employee_progress
for each row execute function crm_private.touch_goal_employee_progress();
revoke all on function crm_private.validate_goal_plan() from public,anon,authenticated,service_role;
revoke all on function crm_private.touch_goal_employee_progress() from public,anon,authenticated,service_role;
alter table public.crm_goal_plans enable row level security;
alter table public.crm_goal_employee_progress enable row level security;
create policy crm_goals_read on public.crm_goal_plans for select to authenticated
using(crm_private.has_company_access(company_id));
create policy crm_goals_create on public.crm_goal_plans for insert to authenticated
with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_goals_update on public.crm_goal_plans for update to authenticated
using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager')
with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager');
create policy crm_goals_progress_read on public.crm_goal_employee_progress for select to authenticated
using(crm_private.has_company_access(company_id) and
(crm_private.company_role(company_id)='manager' or crm_private.owns_membership(company_id,membership_id)));
create policy crm_goals_progress_create on public.crm_goal_employee_progress for insert to authenticated
with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager'
and exists(select 1 from public.crm_memberships m
  where m.company_id=crm_goal_employee_progress.company_id and m.id=membership_id
    and m.active and m.role in ('manager','seller')));
create policy crm_goals_progress_update on public.crm_goal_employee_progress for update to authenticated
using(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager')
with check(crm_private.has_company_access(company_id) and crm_private.company_role(company_id)='manager'
and exists(select 1 from public.crm_memberships m
  where m.company_id=crm_goal_employee_progress.company_id and m.id=membership_id
    and m.active and m.role in ('manager','seller')));
revoke all on public.crm_goal_plans,public.crm_goal_employee_progress from anon,authenticated;
grant select,insert,update on public.crm_goal_plans,public.crm_goal_employee_progress to authenticated;
-- Sem DELETE: metas e progresso não podem ser apagados por clique acidental.
