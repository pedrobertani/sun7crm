begin;

-- Somente metadados operacionais. Nenhum cartão, token ou documento do pagador é persistido.
create table crm_private.payment_attempts (
  id uuid primary key,
  company_id uuid not null references public.crm_companies(id),
  charge_id uuid not null references public.crm_subscription_charges(id),
  created_by uuid not null references public.crm_profiles(id),
  environment text not null check(environment in ('test','production')),
  method text not null check(method in ('pix','credit_card')),
  provider_order_id text check(provider_order_id ~ '^ORD[A-Z0-9]{26}$'),
  status text not null default 'creating' check(status in ('creating','pending','approved','rejected','cancelled','refunded','charged_back')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);
create unique index payment_attempts_active_idx on crm_private.payment_attempts(charge_id)
  where status in ('creating','pending');
create unique index payment_attempts_provider_idx on crm_private.payment_attempts(environment,provider_order_id)
  where provider_order_id is not null;
create index payment_attempts_company_idx on crm_private.payment_attempts(company_id,environment,created_at desc);
create index payment_attempts_actor_idx on crm_private.payment_attempts(created_by);
alter table crm_private.payment_attempts enable row level security;
revoke all on crm_private.payment_attempts from public,anon,authenticated,service_role;

create function crm_private.edge_prepare_order(p_actor uuid,p_company uuid,p_request_id uuid,p_method text,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb; attempt crm_private.payment_attempts; charge public.crm_subscription_charges;
begin
  context:=crm_private.edge_billing_context(p_actor,p_company,p_environment);
  if coalesce(context->>'is_admin','true')='true' or p_request_id is null or p_method is null or
    p_method not in ('pix','credit_card') or p_environment is null or p_environment not in ('test','production') then
    raise exception 'CRM_FORBIDDEN' using errcode='42501';
  end if;
  perform 1 from public.crm_company_billing where company_id=p_company for update;
  select * into attempt from crm_private.payment_attempts where id=p_request_id;
  if found then
    if attempt.company_id<>p_company or attempt.created_by<>p_actor or attempt.environment<>p_environment or attempt.method<>p_method then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    select * into charge from public.crm_subscription_charges where id=attempt.charge_id;
    return context || jsonb_build_object('attempt',to_jsonb(attempt),'created',false,'amount_cents',charge.amount_cents);
  end if;
  context:=crm_private.edge_begin_checkout(p_actor,p_company,p_request_id,'one_time',p_environment);
  select * into charge from public.crm_subscription_charges where id=(context->'checkout'->>'id')::uuid;
  -- Uma solicitação incerta ou Pix pendente deve ser recuperada antes de tentar outro pagamento.
  select * into attempt from crm_private.payment_attempts where charge_id=charge.id and status in ('creating','pending') for update;
  if found then return context || jsonb_build_object('attempt',to_jsonb(attempt),'created',false,'amount_cents',charge.amount_cents); end if;
  insert into crm_private.payment_attempts(id,company_id,charge_id,created_by,environment,method)
    values(p_request_id,p_company,charge.id,p_actor,p_environment,p_method) returning * into attempt;
  return context || jsonb_build_object('attempt',to_jsonb(attempt),'created',true,'amount_cents',charge.amount_cents);
end;
$$;

create function crm_private.edge_order_context(p_actor uuid,p_company uuid,p_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt crm_private.payment_attempts; context jsonb; amount integer;
begin
  context:=crm_private.edge_billing_context(p_actor,p_company,p_environment);
  select * into attempt from crm_private.payment_attempts where company_id=p_company and environment=p_environment
    and ((p_id is not null and id=p_id) or (p_id is null and status in ('creating','pending')))
    order by created_at desc limit 1;
  if attempt.id is null then return null; end if;
  select amount_cents into amount from public.crm_subscription_charges where id=attempt.charge_id;
  return jsonb_build_object('attempt',to_jsonb(attempt),'amount_cents',amount);
end;
$$;

create function crm_private.edge_record_order(p_id uuid,p_order_id text,p_status text,p_payment_id text,
  p_amount_cents integer,p_method text,p_paid_at timestamptz,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare attempt crm_private.payment_attempts; result jsonb;
begin
  if p_status is null or p_status not in ('pending','approved','rejected','cancelled','refunded','charged_back') or
    p_order_id is null or p_order_id !~ '^ORD[A-Z0-9]{26}$' or p_environment is null or
    p_environment not in ('test','production') then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  select * into attempt from crm_private.payment_attempts where id=p_id and environment=p_environment for update;
  if not found then return jsonb_build_object('ignored',true); end if;
  if attempt.provider_order_id is not null and attempt.provider_order_id<>p_order_id then
    raise exception 'CRM_REFERENCE_CONFLICT' using errcode='23505';
  end if;
  if p_method is not null and p_method<>attempt.method then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  update crm_private.payment_attempts set provider_order_id=p_order_id,updated_at=statement_timestamp(),
    status=case when status in ('refunded','charged_back') then status
      when status='approved' and p_status not in ('refunded','charged_back') then status
      when status in ('rejected','cancelled') and p_status='pending' then status else p_status end where id=p_id;
  if p_payment_id is not null then
    result:=crm_private.edge_apply_provider_payment(attempt.charge_id,false,p_payment_id,p_amount_cents,p_status,p_method,p_paid_at,null,p_environment);
  elsif p_status='approved' then raise exception 'CRM_INVALID_INPUT' using errcode='22023'; end if;
  return coalesce(result,'{}'::jsonb) || jsonb_build_object('method',attempt.method);
end;
$$;

create function crm_private.edge_reject_order_input(p_actor uuid,p_company uuid,p_id uuid,p_environment text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform crm_private.edge_billing_context(p_actor,p_company,p_environment);
  update crm_private.payment_attempts set status='rejected',updated_at=statement_timestamp()
    where id=p_id and company_id=p_company and environment=p_environment and created_by=p_actor
    and status='creating' and provider_order_id is null;
end;
$$;

create function public.crm_edge_prepare_order(p_actor uuid,p_company uuid,p_request_id uuid,p_method text,p_environment text)
returns jsonb language sql security invoker set search_path='' as $$ select crm_private.edge_prepare_order(p_actor,p_company,p_request_id,p_method,p_environment); $$;
create function public.crm_edge_order_context(p_actor uuid,p_company uuid,p_id uuid,p_environment text)
returns jsonb language sql security invoker set search_path='' as $$ select crm_private.edge_order_context(p_actor,p_company,p_id,p_environment); $$;
create function public.crm_edge_record_order(p_id uuid,p_order_id text,p_status text,p_payment_id text,p_amount_cents integer,p_method text,p_paid_at timestamptz,p_environment text)
returns jsonb language sql security invoker set search_path='' as $$ select crm_private.edge_record_order(p_id,p_order_id,p_status,p_payment_id,p_amount_cents,p_method,p_paid_at,p_environment); $$;
create function public.crm_edge_reject_order_input(p_actor uuid,p_company uuid,p_id uuid,p_environment text)
returns void language sql security invoker set search_path='' as $$ select crm_private.edge_reject_order_input(p_actor,p_company,p_id,p_environment); $$;

revoke all on function crm_private.edge_prepare_order(uuid,uuid,uuid,text,text),public.crm_edge_prepare_order(uuid,uuid,uuid,text,text),
  crm_private.edge_order_context(uuid,uuid,uuid,text),public.crm_edge_order_context(uuid,uuid,uuid,text),
  crm_private.edge_record_order(uuid,text,text,text,integer,text,timestamptz,text),public.crm_edge_record_order(uuid,text,text,text,integer,text,timestamptz,text),
  crm_private.edge_reject_order_input(uuid,uuid,uuid,text),public.crm_edge_reject_order_input(uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role;
grant execute on function crm_private.edge_prepare_order(uuid,uuid,uuid,text,text),public.crm_edge_prepare_order(uuid,uuid,uuid,text,text),
  crm_private.edge_order_context(uuid,uuid,uuid,text),public.crm_edge_order_context(uuid,uuid,uuid,text),
  crm_private.edge_record_order(uuid,text,text,text,integer,text,timestamptz,text),public.crm_edge_record_order(uuid,text,text,text,integer,text,timestamptz,text),
  crm_private.edge_reject_order_input(uuid,uuid,uuid,text),public.crm_edge_reject_order_input(uuid,uuid,uuid,text) to service_role;

-- A versão compartilhada de aplicação de recibos abaixo também aceita IDs PAY da API de Orders.

create or replace function crm_private.edge_apply_provider_payment(p_reference uuid,p_subscription boolean,p_payment_id text,
  p_amount_cents integer,p_status text,p_method text,p_paid_at timestamptz,p_cycle date default null,p_environment text default 'production') returns jsonb
language plpgsql security definer set search_path='' as $$
declare charge public.crm_subscription_charges; original public.crm_subscription_charges;
  agreement public.crm_subscription_agreements; bill public.crm_company_billing; event public.crm_subscription_events;
  company uuid; reason text:=''; result jsonb; cycle date;
begin
  if p_environment is null or p_environment not in ('test','production') or p_reference is null or p_subscription is null or p_payment_id is null or p_payment_id !~ '^([0-9]{1,30}|PAY[A-Z0-9]{26})$'
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

commit;
