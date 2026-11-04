-- Cadastro imediato: administrador habilita a empresa ao criar, cobranca vence na data informada.
-- Migracao prospectiva: nunca reativa automaticamente empresas historicamente suspensas.
-- Regras de sessao, documentos, pagamento e 7 dias de carencia permanecem no banco.
begin;
create or replace function public.crm_edge_create_company(
  p_actor uuid, p_request_id uuid, p_fingerprint text, p_values jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  previous crm_private.company_provisioning;
  company uuid := gen_random_uuid();
  board uuid;
  board_kind text;
  stage_names text[];
  stage_name text;
  stage_position integer;
  selected_template text := p_values->>'template';
begin
  perform crm_private.edge_require_admin(p_actor);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from crm_private.company_provisioning where request_id = p_request_id;
  if found then
    if previous.actor_user_id <> p_actor or previous.fingerprint <> p_fingerprint then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return previous.company_id;
  end if;
  insert into public.crm_companies(name, segment, template, theme, enabled)
    values (p_values->>'name', p_values->>'segment', selected_template, p_values->>'theme', true)
    returning id into company;
  insert into public.crm_company_billing(company_id, monthly_amount_cents, due_date, cycle_kind)
    values (company, (p_values->>'monthly_amount_cents')::integer, (p_values->>'due_date')::date, 'monthly');
  foreach board_kind in array array['leads', 'clients'] loop
    insert into public.crm_boards(company_id, kind, name, position)
      values (company, board_kind, case when board_kind = 'leads' then 'Novos contatos' else 'Clientes' end,
        case when board_kind = 'leads' then 0 else 1 end) returning id into board;
    if board_kind = 'clients' then
      stage_names := array['Clientes ativos', 'Relacionamento', 'Indicação', 'Nova oportunidade'];
    elsif selected_template = 'generic' then
      stage_names := array['Lead novo', 'Nutrição', 'Visita agendada', 'No-show', 'Atendimento realizado', 'Fechado'];
    else
      stage_names := array['Lead novo', 'Nutrição', 'Agendado', 'No-show', 'Compareceu', 'Fechado'];
    end if;
    stage_position := 0;
    foreach stage_name in array stage_names loop
      insert into public.crm_stages(company_id, board_id, name, position)
        values (company, board, stage_name, stage_position);
      stage_position := stage_position + 1;
    end loop;
  end loop;
  insert into crm_private.company_provisioning(request_id, actor_user_id, fingerprint, company_id)
    values (p_request_id, p_actor, p_fingerprint, company);
  return company;
end;
$$;

create or replace function public.crm_edge_update_company(
  p_actor uuid,p_request_id uuid,p_company uuid,p_fingerprint text,p_values jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare
  previous crm_private.company_updates;
  bill public.crm_company_billing;
  new_amount integer := (p_values->>'monthly_amount_cents')::integer;
  new_due date := (p_values->>'due_date')::date;
  desired_enabled boolean := (p_values->>'enabled')::boolean;
begin
  perform crm_private.edge_require_admin(p_actor);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
    or new_amount is null or new_amount<0 or new_due is null or desired_enabled is null then
    raise exception 'CRM_INVALID_INPUT' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,12));
  select * into previous from crm_private.company_updates where request_id=p_request_id;
  if found then
    if previous.actor_user_id<>p_actor or previous.company_id<>p_company
      or previous.fingerprint<>p_fingerprint then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode='23505';
    end if;
    return;
  end if;
  perform 1 from public.crm_companies where id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  select * into bill from public.crm_company_billing where company_id=p_company for update;
  if not found then raise exception 'CRM_NOT_FOUND' using errcode='P0002'; end if;
  if bill.monthly_amount_cents<>new_amount or bill.due_date<>new_due then
    -- A edição não invalida checkouts já entregues ao gestor ou assinaturas vinculadas.
    if exists (
      select 1 from public.crm_subscription_charges ch where ch.company_id=p_company
      and ch.status='pending' and
      (ch.source<>'manual' or ch.checkout_url is not null or ch.agreement_id is not null
        or ch.provider_payment_id is not null)
    ) then
      raise exception 'CRM_BILLING_CHANGED: Existem cobranças em andamento. Conclua ou cancele antes de alterar valor ou vencimento.'
        using errcode='40001';
    end if;
    -- Cobranças manuais ainda abertas acompanham o novo valor/vencimento; histórico pago permanece intacto.
    update public.crm_subscription_charges
      set amount_cents=new_amount,due_date=new_due,updated_at=statement_timestamp()
      where company_id=p_company and status='pending' and source='manual'
        and checkout_url is null and agreement_id is null and provider_payment_id is null
        and event_id is null;
  end if;
  update public.crm_companies set name=p_values->>'name',segment=p_values->>'segment',
    template=p_values->>'template',theme=p_values->>'theme',enabled=desired_enabled
    where id=p_company;
  update public.crm_company_billing set monthly_amount_cents=new_amount,due_date=new_due,
    cycle_kind=case when desired_enabled and cycle_kind='awaiting_payment'
      then 'monthly' else cycle_kind end where company_id=p_company;
  insert into crm_private.company_updates(request_id,actor_user_id,company_id,fingerprint)
    values(p_request_id,p_actor,p_company,p_fingerprint);
end;
$$;
commit;
