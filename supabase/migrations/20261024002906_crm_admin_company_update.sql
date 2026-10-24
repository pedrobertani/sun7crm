-- Alteração administrativa: cadastro, cobrança e habilitação, sem recriar quadros.
begin;
create table crm_private.company_updates (
  request_id uuid primary key,
  actor_user_id uuid not null,
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default statement_timestamp()
);
alter table crm_private.company_updates enable row level security;
revoke all on crm_private.company_updates from public,anon,authenticated,service_role;
create index crm_company_updates_company_idx on crm_private.company_updates(company_id);

create function public.crm_edge_update_company(p_actor uuid,p_request_id uuid,p_company uuid,p_fingerprint text,p_values jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare previous crm_private.company_updates;
begin
  perform crm_private.edge_require_admin(p_actor);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,12));
  select * into previous from crm_private.company_updates where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>p_actor or previous.company_id<>p_company or previous.fingerprint<>p_fingerprint then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return;
  end if;
  perform 1 from public.crm_companies where id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if (p_values->>'enabled')::boolean and not exists (
    select 1 from public.crm_memberships where company_id=p_company and role='manager' and active
  ) then raise exception 'CRM_MANAGER_REQUIRED' using errcode='23514'; end if;

  update public.crm_companies set name=p_values->>'name',segment=p_values->>'segment',
    template=p_values->>'template',theme=p_values->>'theme',enabled=(p_values->>'enabled')::boolean
    where id=p_company;
  update public.crm_company_billing set monthly_amount_cents=(p_values->>'monthly_amount_cents')::integer,
    due_date=(p_values->>'due_date')::date where company_id=p_company;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  insert into crm_private.company_updates(request_id,actor_user_id,company_id,fingerprint)
    values(p_request_id,p_actor,p_company,p_fingerprint);
end;
$$;
revoke all on function public.crm_edge_update_company(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_update_company(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
