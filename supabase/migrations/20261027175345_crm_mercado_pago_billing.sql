begin;
alter table public.crm_subscription_charges
  add column received_amount_cents integer check(received_amount_cents>=0),
  add column provider_status text,
  add column last_verified_at timestamptz,
  add column checkout_attempted_at timestamptz,
  add column provider_cycle date;

create table public.crm_subscription_agreements (
  id uuid primary key,
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  created_by uuid not null references public.crm_profiles(id) on delete restrict,
  amount_cents integer not null check(amount_cents>0),
  environment text not null default 'production' check(environment in ('test','production')),
  provider_id text,
  status text not null default 'creating' check(status in ('creating','pending','authorized','paused','cancelled')),
  checkout_url text,
  checkout_attempted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create unique index crm_subscription_agreements_active_idx on public.crm_subscription_agreements(company_id,environment) where status<>'cancelled';
create index crm_subscription_agreements_actor_idx on public.crm_subscription_agreements(created_by);
create index crm_subscription_agreements_company_idx on public.crm_subscription_agreements(company_id,created_at desc);
create unique index crm_subscription_agreements_provider_idx on public.crm_subscription_agreements(environment,provider_id) where provider_id is not null;
alter table public.crm_subscription_agreements enable row level security;
revoke all on public.crm_subscription_agreements from public,anon,authenticated,service_role;
grant select on public.crm_subscription_agreements to authenticated;
create policy subscription_agreements_read on public.crm_subscription_agreements for select to authenticated using(
  crm_private.has_current_acceptance() and (crm_private.is_platform_admin() or crm_private.company_role(company_id)='manager'));
alter table public.crm_subscription_charges add column agreement_id uuid references public.crm_subscription_agreements(id) on delete restrict;
create index crm_subscription_charges_agreement_idx on public.crm_subscription_charges(agreement_id,provider_cycle,environment);

-- A regra de renovação é compartilhada pela confirmação administrativa e pelo recibo verificado.
-- O núcleo privado não recebe EXECUTE de nenhum papel de API.
create function crm_private.apply_subscription_payment(p_actor uuid,p_company uuid,p_request_id uuid,
  p_expected_due date,p_amount_cents integer,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bill public.crm_company_billing; previous public.crm_subscription_events; event public.crm_subscription_events;
  local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date; used_days integer; next_due date;
begin
  if p_actor is null or p_request_id is null or p_company is null or p_expected_due is null
    or p_amount_cents is null or p_amount_cents<0 or p_note is null or length(p_note)>500 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,89));
  select * into previous from public.crm_subscription_events where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>p_actor or previous.company_id<>p_company or previous.kind<>'payment'
      or previous.previous_due_date<>p_expected_due or previous.amount_cents<>p_amount_cents or previous.note<>btrim(p_note) then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(previous);
  end if;
  if bill.due_date<>p_expected_due then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  if bill.monthly_amount_cents<>p_amount_cents then raise exception 'CRM_INVALID_AMOUNT' using errcode='22023'; end if;
  used_days:=case when bill.cycle_kind='monthly' then least(7,greatest(0,local_today-bill.due_date)) else 0 end;
  next_due:=(greatest(bill.due_date,local_today)+interval '1 month')::date-used_days;
  update public.crm_company_billing set due_date=next_due,cycle_kind='monthly' where company_id=p_company;
  insert into public.crm_subscription_events(request_id,company_id,actor_user_id,kind,amount_cents,
    grace_days,previous_due_date,next_due_date,note)
    values(p_request_id,p_company,p_actor,'payment',p_amount_cents,used_days,bill.due_date,next_due,btrim(p_note)) returning * into event;
  update public.crm_notifications set active=false where company_id=p_company and kind='subscription_due';
  return to_jsonb(event);
end;
$$;
revoke all on function crm_private.apply_subscription_payment(uuid,uuid,uuid,date,integer,text) from public,anon,authenticated,service_role;
create or replace function crm_private.record_subscription_payment(p_company uuid,p_request_id uuid,
  p_expected_due date,p_amount_cents integer,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  return crm_private.apply_subscription_payment((select auth.uid()),p_company,p_request_id,p_expected_due,p_amount_cents,p_note);
end;
$$;

create function crm_private.edge_billing_context(p_actor uuid,p_company uuid,p_environment text default 'production') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform crm_private.edge_require_actor(p_actor);
  if not (crm_private.is_platform_admin() or coalesce(crm_private.company_role(p_company)='manager',false)) then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  select jsonb_build_object('company_id',b.company_id,'company_name',c.name,'amount_cents',b.monthly_amount_cents,
    'due_date',b.due_date,'server_date',(statement_timestamp() at time zone 'America/Sao_Paulo')::date,
    'is_admin',crm_private.is_platform_admin(),'email',(select email from auth.users where id=p_actor),
    'agreement',(select to_jsonb(a) from public.crm_subscription_agreements a where a.company_id=p_company and a.environment=p_environment and a.status<>'cancelled' limit 1))
    into result from public.crm_company_billing b join public.crm_companies c on c.id=b.company_id where b.company_id=p_company;
  if result is null then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  return result;
end;
$$;

create function crm_private.edge_begin_checkout(p_actor uuid,p_company uuid,p_request_id uuid,p_mode text,p_environment text default 'production') returns jsonb
language plpgsql security definer set search_path='' as $$
declare context jsonb; bill public.crm_company_billing; charge public.crm_subscription_charges; agreement public.crm_subscription_agreements;
begin
  context:=crm_private.edge_billing_context(p_actor,p_company,p_environment);
  if coalesce(context->>'is_admin','true')='true' or p_environment is null or p_environment not in ('test','production') or p_request_id is null or p_mode is null or p_mode not in ('one_time','subscription') then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if bill.monthly_amount_cents<=0 then raise exception 'CRM_INVALID_AMOUNT' using errcode='22023'; end if;
  select * into agreement from public.crm_subscription_agreements where company_id=p_company and environment=p_environment and status<>'cancelled' for update;
  if p_mode='subscription' then
    if agreement.id is null then
      if exists(select 1 from public.crm_subscription_charges where company_id=p_company and environment=p_environment and status='pending' and source='mercado_pago') then
        raise exception 'CRM_CHECKOUT_PENDING' using errcode='23505';
      end if;
      insert into public.crm_subscription_agreements(id,company_id,created_by,amount_cents,environment)
        values(p_request_id,p_company,p_actor,bill.monthly_amount_cents,p_environment) returning * into agreement;
      update public.crm_subscription_charges set source='mercado_pago',kind='subscription',agreement_id=agreement.id
        where company_id=p_company and environment=p_environment and due_date=bill.due_date and status='pending' and source='manual';
    end if;
    return context || jsonb_build_object('checkout',to_jsonb(agreement));
  end if;
  if agreement.id is not null then raise exception 'CRM_SUBSCRIPTION_EXISTS' using errcode='23505'; end if;
  select * into charge from public.crm_subscription_charges where company_id=p_company and environment=p_environment and status='pending' and due_date=bill.due_date for update;
  if charge.id is null then
    insert into public.crm_subscription_charges(id,company_id,created_by,amount_cents,due_date,source,environment)
      values(p_request_id,p_company,p_actor,bill.monthly_amount_cents,bill.due_date,'mercado_pago',p_environment) returning * into charge;
  else
    update public.crm_subscription_charges set source='mercado_pago',updated_at=statement_timestamp() where id=charge.id returning * into charge;
  end if;
  return context || jsonb_build_object('checkout',to_jsonb(charge));
end;
$$;

create function crm_private.edge_claim_checkout(p_actor uuid,p_company uuid,p_id uuid,p_mode text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform crm_private.edge_billing_context(p_actor,p_company);
  if p_mode='subscription' then
    update public.crm_subscription_agreements set checkout_attempted_at=statement_timestamp()
      where id=p_id and company_id=p_company and checkout_attempted_at is null;
  elsif p_mode='one_time' then
    update public.crm_subscription_charges set checkout_attempted_at=statement_timestamp()
      where id=p_id and company_id=p_company and source='mercado_pago' and checkout_attempted_at is null;
  else raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  return found;
end;
$$;

create function crm_private.edge_finish_checkout(p_actor uuid,p_company uuid,p_id uuid,p_mode text,p_provider_id text,p_url text) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform crm_private.edge_billing_context(p_actor,p_company);
  if p_provider_id is null or length(p_provider_id)>160 or p_url is null or
    p_url !~ '^https://(www\.)?mercadopago\.com\.br/' or length(p_url)>2000 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  if p_mode='subscription' then
    update public.crm_subscription_agreements set provider_id=p_provider_id,checkout_url=p_url,
      status=case when status='creating' then 'pending' else status end,updated_at=statement_timestamp()
      where id=p_id and company_id=p_company and (provider_id is null or provider_id=p_provider_id);
  elsif p_mode='one_time' then
    update public.crm_subscription_charges set provider_reference=p_provider_id,checkout_url=p_url,updated_at=statement_timestamp()
      where id=p_id and company_id=p_company and source='mercado_pago' and (provider_reference is null or provider_reference=p_provider_id);
  else raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
end;
$$;

create function crm_private.edge_update_agreement(p_id uuid,p_provider_id text,p_status text,p_environment text default 'production') returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_status is null or p_status not in ('pending','authorized','paused','cancelled') then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  update public.crm_subscription_agreements set status=p_status,provider_id=p_provider_id,updated_at=statement_timestamp()
    where id=p_id and environment=p_environment and (provider_id is null or provider_id=p_provider_id);
  if found and p_status='cancelled' then
    update public.crm_subscription_charges set status='cancelled',cancelled_at=statement_timestamp(),
      cancelled_reason='Assinatura cancelada no Mercado Pago.',updated_at=statement_timestamp()
      where agreement_id=p_id and status='pending';
  end if;
end;
$$;

create function crm_private.edge_apply_provider_payment(p_reference uuid,p_subscription boolean,p_payment_id text,
  p_amount_cents integer,p_status text,p_method text,p_paid_at timestamptz,p_cycle date default null,p_environment text default 'production') returns jsonb
language plpgsql security definer set search_path='' as $$
declare charge public.crm_subscription_charges; original public.crm_subscription_charges;
  agreement public.crm_subscription_agreements; bill public.crm_company_billing; event public.crm_subscription_events;
  company uuid; reason text:=''; result jsonb; cycle date;
begin
  if p_environment is null or p_environment not in ('test','production') or p_reference is null or p_subscription is null or p_payment_id is null or p_payment_id !~ '^[0-9]{1,30}$'
    or p_amount_cents is null or p_amount_cents<0 or p_status is null
    or p_status not in ('approved','pending','in_process','authorized','rejected','cancelled','refunded','charged_back')
    or p_method is null or p_method not in ('unknown','pix','credit_card','other') then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_payment_id,93));
  if p_subscription then
    select * into agreement from public.crm_subscription_agreements where id=p_reference and environment=p_environment;
    company:=agreement.company_id;
  else
    select * into original from public.crm_subscription_charges where id=p_reference and source='mercado_pago' and environment=p_environment;
    company:=original.company_id;
  end if;
  if company is null then return jsonb_build_object('ignored',true); end if;
  select * into bill from public.crm_company_billing where company_id=company for update;
  select * into charge from public.crm_subscription_charges where provider_payment_id=p_payment_id and environment=p_environment for update;
  if charge.id is not null and charge.company_id<>company then raise exception 'CRM_REFERENCE_CONFLICT' using errcode='23505'; end if;
  if p_status in ('refunded','charged_back') then
    if charge.status='refunded' and charge.provider_status=p_status then return jsonb_build_object('duplicate',true); end if;
    if charge.id is null and not p_subscription then charge:=original; end if;
    if charge.id is null and p_subscription then
      insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,status,source,kind,agreement_id,provider_cycle,environment)
        values(company,agreement.created_by,agreement.amount_cents,bill.due_date,'refunded','mercado_pago','subscription',agreement.id,p_cycle,p_environment) returning * into charge;
    end if;
    if charge.id is not null then
      update public.crm_subscription_charges set status='refunded',provider_status=p_status,last_verified_at=statement_timestamp(),
        provider_payment_id=p_payment_id,received_amount_cents=p_amount_cents,
        needs_review=true,review_reason='Pagamento estornado ou contestado. Confira o acesso e a regularização desta empresa.',updated_at=statement_timestamp() where id=charge.id;
    end if;
    return jsonb_build_object('refunded',true);
  end if;
  if charge.status in ('paid','refunded') then return jsonb_build_object('duplicate',true); end if;
  if not p_subscription then charge:=original;
  else
    cycle:=date_trunc('month',coalesce(p_cycle,(p_paid_at at time zone 'America/Sao_Paulo')::date,
      (statement_timestamp() at time zone 'America/Sao_Paulo')::date))::date;
    if charge.id is null then
      select * into charge from public.crm_subscription_charges where agreement_id=p_reference and (provider_cycle=cycle or provider_cycle is null) and status='pending' for update;
    end if;
    if charge.id is null then
      select * into charge from public.crm_subscription_charges where company_id=company and environment=p_environment and due_date=bill.due_date and status='pending' and source='manual' for update;
    end if;
    if charge.id is null then
      insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,source,kind,agreement_id,provider_cycle,environment)
        values(company,agreement.created_by,agreement.amount_cents,bill.due_date,'mercado_pago','subscription',agreement.id,cycle,p_environment)
        returning * into charge;
    end if;
    update public.crm_subscription_charges set source='mercado_pago',kind='subscription',agreement_id=agreement.id,provider_cycle=cycle where id=charge.id;
  end if;
  if p_status<>'approved' then
    update public.crm_subscription_charges set provider_status=p_status,last_verified_at=statement_timestamp(),updated_at=statement_timestamp() where id=charge.id;
    return jsonb_build_object('pending',true);
  end if;
  if p_paid_at is null then raise exception 'CRM_PAYMENT_DATE_REQUIRED' using errcode='22023'; end if;
  if p_subscription and agreement.status='cancelled' then reason:='Recebimento de uma assinatura cancelada. Confira a aplicação deste pagamento.';
  elsif charge.status<>'pending' then reason:='Outro recebimento já encerrou esta cobrança. Confira este pagamento adicional.';
  elsif charge.amount_cents<>p_amount_cents or bill.monthly_amount_cents<>p_amount_cents then reason:='O valor recebido difere do valor contratado. Confira antes de renovar o acesso.';
  elsif charge.due_date<>bill.due_date then reason:='O plano mudou depois da criação da cobrança. Confira a aplicação deste recebimento.';
  elsif p_subscription and exists(select 1 from public.crm_subscription_charges where agreement_id=p_reference and provider_cycle=cycle and event_id is not null) then
    reason:='Já houve renovação neste ciclo da assinatura. Confira o pagamento adicional.';
  end if;
  if charge.status<>'pending' then
    insert into public.crm_subscription_charges(company_id,created_by,amount_cents,due_date,status,source,kind,agreement_id,provider_cycle,environment)
      values(company,charge.created_by,charge.amount_cents,charge.due_date,'paid','mercado_pago',charge.kind,charge.agreement_id,charge.provider_cycle,p_environment) returning * into charge;
  end if;
  update public.crm_subscription_charges set provider_payment_id=p_payment_id,received_amount_cents=p_amount_cents,
    provider_status=p_status,payment_method=p_method,paid_at=p_paid_at,last_verified_at=statement_timestamp(),
    needs_review=(reason<>''),review_reason=reason,updated_at=statement_timestamp() where id=charge.id;
  if p_environment='test' then
    update public.crm_subscription_charges set status='paid',needs_review=false,review_reason='Pagamento de teste. Nenhuma renovação de acesso foi realizada.' where id=charge.id;
    result:=jsonb_build_object('test',true);
  elsif reason='' then
    result:=crm_private.apply_subscription_payment(charge.created_by,company,charge.id,bill.due_date,p_amount_cents,'Pagamento confirmado pelo Mercado Pago.');
    update public.crm_subscription_charges set paid_at=p_paid_at where id=charge.id;
  else
    update public.crm_subscription_charges set status='paid' where id=charge.id;
    result:=jsonb_build_object('review',true);
  end if;
  return result;
end;
$$;

create or replace function crm_private.grant_subscription_days(p_company uuid,p_request_id uuid,
  p_expected_due date,p_days integer,p_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); bill public.crm_company_billing;
  previous public.crm_subscription_events; event public.crm_subscription_events;
  local_today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date; next_due date;
begin
  if actor is null or not crm_private.is_platform_admin() or not crm_private.has_current_acceptance() then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  if p_request_id is null or p_company is null or p_expected_due is null
    or p_days is null or p_days not in (7,15,30) or p_note is null or length(p_note)>500 then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,89));
  select * into previous from public.crm_subscription_events where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>actor or previous.company_id<>p_company or previous.kind<>'complimentary'
      or previous.previous_due_date<>p_expected_due or previous.free_days<>p_days or previous.note<>btrim(p_note) then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return to_jsonb(previous);
  end if;
  if bill.due_date<>p_expected_due then raise exception 'CRM_BILLING_CHANGED' using errcode='40001'; end if;
  next_due:=greatest(bill.due_date,local_today)+p_days;
  update public.crm_company_billing set due_date=next_due,cycle_kind='complimentary' where company_id=p_company;
  insert into public.crm_subscription_events(request_id,company_id,actor_user_id,kind,free_days,
    previous_due_date,next_due_date,note)
    values(p_request_id,p_company,actor,'complimentary',p_days,bill.due_date,next_due,btrim(p_note)) returning * into event;
  update public.crm_notifications set active=false where company_id=p_company and kind='subscription_due';
  return to_jsonb(event);
end;
$$;

create or replace function crm_private.billing_history(p_company uuid,p_status text,p_from date,p_to date,p_query text,p_offset integer)
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
      'paid_cents',coalesce((select sum(coalesce(received_amount_cents,amount_cents)) from filtered where status='paid' and environment='production'),0),
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

-- Fachadas sem elevação de privilégios; implementações ficam no esquema privado.
create function public.crm_edge_billing_context(p_actor uuid,p_company uuid,p_environment text default 'production') returns jsonb
language sql security invoker set search_path='' as $$ select crm_private.edge_billing_context(p_actor,p_company,p_environment); $$;
revoke all on function public.crm_edge_billing_context(uuid,uuid,text),crm_private.edge_billing_context(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_billing_context(uuid,uuid,text),crm_private.edge_billing_context(uuid,uuid,text) to service_role;
create function public.crm_edge_begin_checkout(p_actor uuid,p_company uuid,p_request_id uuid,p_mode text,p_environment text default 'production') returns jsonb
language sql security invoker set search_path='' as $$ select crm_private.edge_begin_checkout(p_actor,p_company,p_request_id,p_mode,p_environment); $$;
revoke all on function public.crm_edge_begin_checkout(uuid,uuid,uuid,text,text),crm_private.edge_begin_checkout(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_begin_checkout(uuid,uuid,uuid,text,text),crm_private.edge_begin_checkout(uuid,uuid,uuid,text,text) to service_role;
create function public.crm_edge_claim_checkout(p_actor uuid,p_company uuid,p_id uuid,p_mode text) returns boolean
language sql security invoker set search_path='' as $$ select crm_private.edge_claim_checkout(p_actor,p_company,p_id,p_mode); $$;
revoke all on function public.crm_edge_claim_checkout(uuid,uuid,uuid,text),crm_private.edge_claim_checkout(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_claim_checkout(uuid,uuid,uuid,text),crm_private.edge_claim_checkout(uuid,uuid,uuid,text) to service_role;
create function public.crm_edge_finish_checkout(p_actor uuid,p_company uuid,p_id uuid,p_mode text,p_provider_id text,p_url text) returns void
language sql security invoker set search_path='' as $$ select crm_private.edge_finish_checkout(p_actor,p_company,p_id,p_mode,p_provider_id,p_url); $$;
revoke all on function public.crm_edge_finish_checkout(uuid,uuid,uuid,text,text,text),crm_private.edge_finish_checkout(uuid,uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_finish_checkout(uuid,uuid,uuid,text,text,text),crm_private.edge_finish_checkout(uuid,uuid,uuid,text,text,text) to service_role;
create function public.crm_edge_update_agreement(p_id uuid,p_provider_id text,p_status text,p_environment text default 'production') returns void
language sql security invoker set search_path='' as $$ select crm_private.edge_update_agreement(p_id,p_provider_id,p_status,p_environment); $$;
revoke all on function public.crm_edge_update_agreement(uuid,text,text,text),crm_private.edge_update_agreement(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_update_agreement(uuid,text,text,text),crm_private.edge_update_agreement(uuid,text,text,text) to service_role;
create function public.crm_edge_apply_provider_payment(p_reference uuid,p_subscription boolean,p_payment_id text,p_amount_cents integer,p_status text,p_method text,p_paid_at timestamptz,p_cycle date default null,p_environment text default 'production') returns jsonb
language sql security invoker set search_path='' as $$ select crm_private.edge_apply_provider_payment(p_reference,p_subscription,p_payment_id,p_amount_cents,p_status,p_method,p_paid_at,p_cycle,p_environment); $$;
revoke all on function public.crm_edge_apply_provider_payment(uuid,boolean,text,integer,text,text,timestamptz,date,text),crm_private.edge_apply_provider_payment(uuid,boolean,text,integer,text,text,timestamptz,date,text) from public,anon,authenticated,service_role;
grant execute on function public.crm_edge_apply_provider_payment(uuid,boolean,text,integer,text,text,timestamptz,date,text),crm_private.edge_apply_provider_payment(uuid,boolean,text,integer,text,text,timestamptz,date,text) to service_role;
grant usage on schema crm_private to service_role;
commit;
