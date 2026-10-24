-- SUN7CRM: comandos exclusivos das três Edge Functions.
-- Aplicar UMA VEZ, depois da fundação. Não altera usuários nem senhas existentes.
begin;

-- Infraestrutura de autorização: a identidade só chega de uma Edge Function autenticada.
create function crm_private.edge_require_actor(p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  if not crm_private.has_current_acceptance() then
    raise exception 'CRM_LEGAL_REQUIRED' using errcode = '42501';
  end if;
end;
$$;
create function crm_private.edge_require_admin(p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform crm_private.edge_require_actor(p_actor);
  if not crm_private.is_platform_admin() then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

-- 1. Cadastro da empresa: dados, cobrança e quadros em uma transação.
create table crm_private.company_provisioning (
  request_id uuid primary key,
  actor_user_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp()
);
alter table crm_private.company_provisioning enable row level security;
revoke all on crm_private.company_provisioning from public, anon, authenticated, service_role;

create function public.crm_edge_create_company(
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
    values (p_values->>'name', p_values->>'segment', selected_template, p_values->>'theme', false)
    returning id into company;
  insert into public.crm_company_billing(company_id, monthly_amount_cents, due_date)
    values (company, (p_values->>'monthly_amount_cents')::integer, (p_values->>'due_date')::date);
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

-- 2. Cadastro de usuário: reserva, confirmação e cancelamento são internos ao endpoint.
-- Esta tabela guarda identificadores; nunca senha, token ou e-mail.
create table crm_private.user_provisioning (
  request_id uuid primary key,
  actor_user_id uuid not null,
  company_id uuid not null references public.crm_companies(id) on delete restrict,
  role text not null check (role in ('manager', 'seller', 'reception')),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  state text not null default 'pending' check (state in ('pending', 'complete', 'cancelled')),
  user_id uuid,
  membership_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  finished_at timestamptz
);
alter table crm_private.user_provisioning enable row level security;
revoke all on crm_private.user_provisioning from public, anon, authenticated, service_role;
create index crm_user_provisioning_actor_time_idx on crm_private.user_provisioning(actor_user_id, created_at);

create function crm_private.edge_authorize_user_creation(p_actor uuid, p_company uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform crm_private.edge_require_actor(p_actor);
  if not exists (select 1 from public.crm_companies where id = p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if crm_private.is_platform_admin() then
    if p_role is distinct from 'manager' then
      raise exception 'CRM_FORBIDDEN' using errcode = '42501';
    end if;
  elsif p_role is null or p_role not in ('seller', 'reception')
    or crm_private.company_role(p_company) is distinct from 'manager' then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create function public.crm_edge_prepare_user(
  p_actor uuid, p_request_id uuid, p_company uuid, p_role text, p_fingerprint text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare item crm_private.user_provisioning;
begin
  perform crm_private.edge_authorize_user_creation(p_actor, p_company, p_role);
  if p_request_id is null or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_INVALID_INPUT' using errcode = '22023';
  end if;
  -- Serializa reservas do mesmo solicitante e aplica limite operacional, sem plano comercial.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 1));
  select * into item from crm_private.user_provisioning where request_id = p_request_id for update;
  if found then
    if item.actor_user_id <> p_actor or item.company_id <> p_company or item.role <> p_role
      or item.fingerprint <> p_fingerprint or item.state <> 'complete' then
      raise exception 'CRM_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('state', item.state, 'user_id', item.user_id, 'membership_id', item.membership_id);
  end if;
  if (select count(*) from crm_private.user_provisioning
      where actor_user_id = p_actor and created_at > statement_timestamp() - interval '1 hour') >= 30 then
    raise exception 'CRM_RATE_LIMITED' using errcode = 'P0003';
  end if;
  insert into crm_private.user_provisioning(request_id, actor_user_id, company_id, role, fingerprint)
    values (p_request_id, p_actor, p_company, p_role, p_fingerprint);
  return jsonb_build_object('state', 'pending', 'user_id', null, 'membership_id', null);
end;
$$;

create function public.crm_edge_finish_user(
  p_actor uuid, p_request_id uuid, p_user uuid, p_display_name text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare item crm_private.user_provisioning; member uuid;
begin
  select * into item from crm_private.user_provisioning where request_id = p_request_id for update;
  if not found or item.actor_user_id is distinct from p_actor then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  perform crm_private.edge_authorize_user_creation(p_actor, item.company_id, item.role);
  if item.state = 'complete' and item.user_id = p_user then
    return jsonb_build_object('state', 'complete', 'user_id', item.user_id, 'membership_id', item.membership_id);
  end if;
  if item.state <> 'pending' then
    raise exception 'CRM_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if not exists (select 1 from auth.users where id = p_user
      and raw_app_meta_data->>'crm_provisioning_id' = p_request_id::text)
    or exists (select 1 from public.crm_profiles where id = p_user)
    or exists (select 1 from crm_private.platform_admins where user_id = p_user) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.crm_profiles(id, display_name) values (p_user, p_display_name);
  insert into public.crm_memberships(company_id, user_id, role)
    values (item.company_id, p_user, item.role) returning id into member;
  update crm_private.user_provisioning set state = 'complete', user_id = p_user,
    membership_id = member, finished_at = statement_timestamp() where request_id = p_request_id;
  return jsonb_build_object('state', 'complete', 'user_id', p_user, 'membership_id', member);
end;
$$;

create function public.crm_edge_cancel_user(p_actor uuid, p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item crm_private.user_provisioning;
begin
  -- Cleanup permanece possível se a permissão do solicitante mudou durante a criação.
  select * into item from crm_private.user_provisioning where request_id = p_request_id for update;
  if not found or item.actor_user_id is distinct from p_actor then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if item.state = 'pending' then
    update crm_private.user_provisioning set state = 'cancelled', finished_at = statement_timestamp()
      where request_id = p_request_id;
    item.state := 'cancelled';
  end if;
  return jsonb_build_object('state', item.state, 'user_id', item.user_id, 'membership_id', item.membership_id);
end;
$$;

-- 3. Redefinição de senha: autorização por vínculo e registro de tentativa/resultado.
create table crm_private.password_reset_requests (
  request_id uuid primary key,
  actor_user_id uuid not null,
  company_id uuid not null,
  target_user_id uuid not null,
  outcome text not null default 'pending' check (outcome in ('pending', 'succeeded', 'unconfirmed')),
  created_at timestamptz not null default statement_timestamp(),
  finished_at timestamptz
);
alter table crm_private.password_reset_requests enable row level security;
revoke all on crm_private.password_reset_requests from public, anon, authenticated, service_role;
create index crm_password_reset_actor_time_idx on crm_private.password_reset_requests(actor_user_id, created_at);
create index crm_password_reset_target_time_idx on crm_private.password_reset_requests(target_user_id, created_at);

create function public.crm_edge_begin_password_reset(
  p_actor uuid, p_request_id uuid, p_company uuid, p_target uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare target_role text;
begin
  perform crm_private.edge_require_actor(p_actor);
  if p_request_id is null or p_target is null or p_actor = p_target
    or exists (select 1 from crm_private.platform_admins where user_id = p_target)
    -- Senhas do Auth são globais. Não permitir reset se o usuário tiver vínculo em outra empresa.
    or exists (select 1 from public.crm_memberships where user_id = p_target and company_id <> p_company) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  select role into target_role from public.crm_memberships
    where company_id = p_company and user_id = p_target and active;
  if crm_private.is_platform_admin() then
    if target_role is distinct from 'manager' then
      raise exception 'CRM_FORBIDDEN' using errcode = '42501';
    end if;
  elsif crm_private.company_role(p_company) is distinct from 'manager'
    or target_role is null or target_role not in ('seller', 'reception') then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target::text, 2));
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 3));
  if (select count(*) from crm_private.password_reset_requests where actor_user_id = p_actor
      and created_at > statement_timestamp() - interval '15 minutes') >= 30
    or (select count(*) from crm_private.password_reset_requests where target_user_id = p_target
      and created_at > statement_timestamp() - interval '15 minutes') >= 5 then
    raise exception 'CRM_RATE_LIMITED' using errcode = 'P0003';
  end if;
  insert into crm_private.password_reset_requests(request_id, actor_user_id, company_id, target_user_id)
    values (p_request_id, p_actor, p_company, p_target);
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (p_company, p_actor, 'crm_password_reset_requested', p_target, 'UPDATE');
end;
$$;

create function public.crm_edge_end_password_reset(
  p_actor uuid, p_request_id uuid, p_succeeded boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare item crm_private.password_reset_requests;
begin
  select * into item from crm_private.password_reset_requests where request_id = p_request_id for update;
  if not found or item.actor_user_id is distinct from p_actor then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if item.outcome <> 'pending' then return; end if;
  update crm_private.password_reset_requests set
    outcome = case when p_succeeded then 'succeeded' else 'unconfirmed' end,
    finished_at = statement_timestamp() where request_id = p_request_id;
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (item.company_id, item.actor_user_id,
      case when p_succeeded then 'crm_password_reset_succeeded' else 'crm_password_reset_unconfirmed' end,
      item.target_user_id, 'UPDATE');
end;
$$;

-- Nenhum comando aceita chamadas diretas do navegador. Somente a credencial do backend.
revoke all on function crm_private.edge_require_actor(uuid) from public, anon, authenticated, service_role;
revoke all on function crm_private.edge_require_admin(uuid) from public, anon, authenticated, service_role;
revoke all on function crm_private.edge_authorize_user_creation(uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_create_company(uuid,uuid,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_prepare_user(uuid,uuid,uuid,text,text) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_finish_user(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_cancel_user(uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_begin_password_reset(uuid,uuid,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.crm_edge_end_password_reset(uuid,uuid,boolean) from public, anon, authenticated, service_role;
grant execute on function public.crm_edge_create_company(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.crm_edge_prepare_user(uuid,uuid,uuid,text,text) to service_role;
grant execute on function public.crm_edge_finish_user(uuid,uuid,uuid,text) to service_role;
grant execute on function public.crm_edge_cancel_user(uuid,uuid) to service_role;
grant execute on function public.crm_edge_begin_password_reset(uuid,uuid,uuid,uuid) to service_role;
grant execute on function public.crm_edge_end_password_reset(uuid,uuid,boolean) to service_role;

commit;
