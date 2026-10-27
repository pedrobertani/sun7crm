-- Livro de cobranças: acesso financeiro apenas para ADM e gestor da própria empresa.
begin;

create table public.crm_subscription_charges (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  created_by uuid not null references public.crm_profiles(id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','cancelled','refunded')),
  environment text not null default 'production' check(environment in ('test','production')),
  source text not null default 'manual' check (source in ('manual','mercado_pago')),
  kind text not null default 'one_time' check (kind in ('one_time','subscription')),
  payment_method text not null default 'unknown' check (payment_method in ('unknown','pix','credit_card','other')),
  provider_payment_id text,
  provider_reference text,
  checkout_url text,
  event_id uuid unique references public.crm_subscription_events(id) on delete restrict,
  needs_review boolean not null default false,
  review_reason text not null default '',
  reviewed_by uuid references public.crm_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  review_note text not null default '' check(length(review_note)<=500),
  note text not null default '' check (length(note) <= 500),
  cancelled_reason text not null default '' check (length(cancelled_reason) <= 500),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create index crm_subscription_charges_company_date_idx on public.crm_subscription_charges(company_id,due_date desc,id);
create index crm_subscription_charges_created_by_idx on public.crm_subscription_charges(created_by);
create index crm_subscription_charges_reviewed_by_idx on public.crm_subscription_charges(reviewed_by);
create index crm_subscription_charges_status_date_idx on public.crm_subscription_charges(status,due_date);
create unique index crm_subscription_charges_provider_idx on public.crm_subscription_charges(environment,provider_payment_id) where provider_payment_id is not null;
create unique index crm_subscription_charges_open_cycle_idx on public.crm_subscription_charges(company_id,due_date,environment)
  where status='pending' and kind='one_time';
alter table public.crm_subscription_charges enable row level security;
revoke all on public.crm_subscription_charges from public,anon,authenticated,service_role;
grant select on public.crm_subscription_charges to authenticated;
create policy subscription_charges_read on public.crm_subscription_charges for select to authenticated using (
  crm_private.has_current_acceptance() and
  (crm_private.is_platform_admin() or crm_private.company_role(company_id)='manager')
);

-- Preserva os recebimentos anteriores sem inventar cobranças retroativas.
insert into public.crm_subscription_charges(id,company_id,created_by,amount_cents,due_date,status,event_id,note,paid_at,created_at)
  select id,company_id,actor_user_id,amount_cents,previous_due_date,'paid',id,note,created_at,created_at
  from public.crm_subscription_events where kind='payment';

create function crm_private.sync_subscription_charge() returns trigger
language plpgsql security definer set search_path='' as $$
declare charge uuid;
begin
  if new.kind<>'payment' then return new; end if;
  select id into charge from public.crm_subscription_charges where company_id=new.company_id
    and environment='production' and status='pending' and (id=new.request_id or (due_date=new.previous_due_date and amount_cents=new.amount_cents))
    order by (id=new.request_id) desc limit 1 for update;
  if charge is null then
    insert into public.crm_subscription_charges(id,company_id,created_by,amount_cents,due_date,status,event_id,note,paid_at)
      values(new.id,new.company_id,new.actor_user_id,new.amount_cents,new.previous_due_date,'paid',new.id,new.note,new.created_at);
  else
    update public.crm_subscription_charges set status='paid',event_id=new.id,paid_at=new.created_at,
      updated_at=statement_timestamp() where id=charge;
  end if;
  return new;
end;
$$;
revoke all on function crm_private.sync_subscription_charge() from public,anon,authenticated,service_role;
create trigger crm_subscription_charge_receipt after insert on public.crm_subscription_events
  for each row execute function crm_private.sync_subscription_charge();

create function crm_private.billing_history(p_company uuid,p_status text,p_from date,p_to date,p_query text,p_offset integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date; result jsonb;
begin
  if not crm_private.has_current_acceptance() or not (crm_private.is_platform_admin() or
    (p_company is not null and coalesce(crm_private.company_role(p_company)='manager',false))) then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('all','pending','overdue','paid','cancelled','refunded','review')
    or p_offset is null or p_offset<0 or p_offset>1000000 or p_query is null or length(p_query)>160
    or (p_from is not null and p_to is not null and p_from>p_to) then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  with filtered as (
    select c.*,co.name as company_name,pr.display_name as recorded_by,
      case when c.status='pending' and c.due_date<local_today then 'overdue' else c.status end as display_status,
      e.next_due_date,e.grace_days
    from public.crm_subscription_charges c join public.crm_companies co on co.id=c.company_id
    join public.crm_profiles pr on pr.id=c.created_by
    left join public.crm_subscription_events e on e.id=c.event_id
    where (p_company is null or c.company_id=p_company)
      and (p_from is null or c.due_date>=p_from) and (p_to is null or c.due_date<=p_to)
      and (p_query='' or position(lower(btrim(p_query)) in lower(co.name))>0)
  ), selected as (
    select * from filtered where p_status='all' or display_status=p_status
      or (p_status='pending' and status='pending') or (p_status='review' and needs_review)
  ), page as (
    select * from selected order by created_at desc,id desc limit 20 offset p_offset
  ) select jsonb_build_object('server_date',local_today,'total',(select count(*) from selected),
    'totals',jsonb_build_object(
      'paid_cents',coalesce((select sum(amount_cents) from filtered where status='paid' and environment='production'),0),
      'pending_cents',coalesce((select sum(amount_cents) from filtered where status='pending' and environment='production'),0),
      'overdue_cents',coalesce((select sum(amount_cents) from filtered where display_status='overdue' and environment='production'),0),
      'review_count',(select count(*) from filtered where needs_review),
      'paid_count',(select count(*) from filtered where status='paid' and environment='production'),
      'pending_count',(select count(*) from filtered where status='pending' and environment='production'),
      'overdue_count',(select count(*) from filtered where display_status='overdue' and environment='production')),
    'records',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function crm_private.create_subscription_charge(p_company uuid,p_request_id uuid,p_expected_due date,p_note text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare bill public.crm_company_billing; charge public.crm_subscription_charges; actor uuid:=(select auth.uid());
begin
  if actor is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_request_id is null or p_expected_due is null or p_note is null or length(p_note)>500 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,91));
  select * into charge from public.crm_subscription_charges where id=p_request_id;
  if found then
    if charge.company_id<>p_company or charge.created_by<>actor or charge.due_date<>p_expected_due
      or charge.note<>btrim(p_note) or charge.source<>'manual' then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(charge);
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if bill.due_date<>p_expected_due then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  if exists(select 1 from public.crm_subscription_charges where company_id=p_company and due_date=p_expected_due and status='pending' and environment='production') then
    raise exception 'CRM_CHARGE_EXISTS' using errcode='23505';
  end if;
  insert into public.crm_subscription_charges(id,company_id,created_by,amount_cents,due_date,note)
    values(p_request_id,p_company,actor,bill.monthly_amount_cents,bill.due_date,btrim(p_note)) returning * into charge;
  return to_jsonb(charge);
end;
$$;

create function crm_private.manage_subscription_charge(p_charge uuid,p_action text,p_note text,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare charge public.crm_subscription_charges; result jsonb;
begin
  if (select auth.uid()) is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_action is null or p_action not in ('confirm','cancel','review') or p_note is null or length(p_note)>500
    or p_method is null or p_method not in ('unknown','pix','credit_card','other') then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  -- Sempre bloqueia a empresa antes da cobrança: mesma ordem dos comandos antigos e do webhook.
  perform 1 from public.crm_company_billing where company_id=(select company_id from public.crm_subscription_charges where id=p_charge) for update;
  select * into charge from public.crm_subscription_charges where id=p_charge for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if p_action='review' then
    if length(btrim(p_note))=0 then raise exception 'CRM_REASON_REQUIRED' using errcode='22023'; end if;
    if charge.needs_review then
      update public.crm_subscription_charges set needs_review=false,reviewed_by=(select auth.uid()),
        reviewed_at=statement_timestamp(),review_note=btrim(p_note),updated_at=statement_timestamp() where id=p_charge returning * into charge;
    end if;
    return to_jsonb(charge);
  end if;
  if charge.source<>'manual' then raise exception 'CRM_PROVIDER_MANAGED' using errcode='22023'; end if;
  if p_action='confirm' and charge.status='paid' and charge.event_id is not null then
    select to_jsonb(e) into result from public.crm_subscription_events e where id=charge.event_id;
    return result;
  end if;
  if p_action='cancel' and charge.status='cancelled' then return to_jsonb(charge); end if;
  if charge.status<>'pending' then raise exception 'CRM_CHARGE_CHANGED' using errcode='40001'; end if;
  if p_action='cancel' then
    if length(btrim(p_note))=0 then raise exception 'CRM_REASON_REQUIRED' using errcode='22023'; end if;
    update public.crm_subscription_charges set status='cancelled',cancelled_reason=btrim(p_note),
      cancelled_at=statement_timestamp(),updated_at=statement_timestamp() where id=p_charge returning * into charge;
    return to_jsonb(charge);
  end if;
  update public.crm_subscription_charges set payment_method=p_method where id=p_charge;
  return crm_private.record_subscription_payment(charge.company_id,charge.id,charge.due_date,charge.amount_cents,btrim(p_note));
end;
$$;

create function public.crm_billing_history(p_company uuid default null,p_status text default 'all',p_from date default null,
  p_to date default null,p_query text default '',p_offset integer default 0) returns jsonb
language sql stable security invoker set search_path='' as $$
  select crm_private.billing_history(p_company,p_status,p_from,p_to,p_query,p_offset);$$;
create function public.crm_admin_create_subscription_charge(p_company uuid,p_request_id uuid,p_expected_due date,p_note text default '') returns jsonb
language sql security invoker set search_path='' as $$
  select crm_private.create_subscription_charge(p_company,p_request_id,p_expected_due,p_note);$$;
create function public.crm_admin_manage_subscription_charge(p_charge uuid,p_action text,p_note text default '',p_method text default 'unknown') returns jsonb
language sql security invoker set search_path='' as $$
  select crm_private.manage_subscription_charge(p_charge,p_action,p_note,p_method);$$;
revoke all on function crm_private.billing_history(uuid,text,date,date,text,integer),
  crm_private.create_subscription_charge(uuid,uuid,date,text),crm_private.manage_subscription_charge(uuid,text,text,text),
  public.crm_billing_history(uuid,text,date,date,text,integer),public.crm_admin_create_subscription_charge(uuid,uuid,date,text),
  public.crm_admin_manage_subscription_charge(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.billing_history(uuid,text,date,date,text,integer),
  crm_private.create_subscription_charge(uuid,uuid,date,text),crm_private.manage_subscription_charge(uuid,text,text,text),
  public.crm_billing_history(uuid,text,date,date,text,integer),public.crm_admin_create_subscription_charge(uuid,uuid,date,text),
  public.crm_admin_manage_subscription_charge(uuid,text,text,text) to authenticated;
commit;
