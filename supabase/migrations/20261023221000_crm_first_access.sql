-- SUN7CRM: primeira troca de senha obrigatoria e confirmacao individual dos documentos.
-- Cadastro sem SMTP; nenhum e-mail ou convite sera enviado.
begin;

alter table public.crm_profiles
  add column password_change_required boolean not null default true,
  add column password_change_nonce uuid not null default gen_random_uuid(),
  add column password_changed_at timestamptz;

-- Privado: estado confiavel, ignorando claims editaveis pelo usuario.
create function crm_private.has_completed_first_access() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.crm_profiles p
    where p.id = (select auth.uid()) and not p.password_change_required
  );
$$;
revoke all on function crm_private.has_completed_first_access() from public, anon, authenticated, service_role;

-- Acesso operacional requer senha propria E versoes legais aceitas.
create or replace function crm_private.has_current_acceptance() returns boolean
language sql stable security definer set search_path = '' as $$
  select crm_private.has_completed_first_access()
    and (select count(*) from public.crm_legal_requirements) = 2
    and not exists (
      select 1 from public.crm_legal_requirements r
      where not exists (
        select 1 from public.crm_legal_acceptances a
        where a.user_id = (select auth.uid()) and a.kind = r.kind and a.version = r.version
      )
    );
$$;

-- Nem mesmo gravar o aceite e permitido com a senha temporaria.
drop policy if exists legal_acceptances_insert_self on public.crm_legal_acceptances;
create policy legal_acceptances_insert_self on public.crm_legal_acceptances
for insert to authenticated with check (
  user_id = (select auth.uid())
  and crm_private.has_completed_first_access()
  and exists (
    select 1 from public.crm_legal_requirements r
    where r.kind = crm_legal_acceptances.kind and r.version = crm_legal_acceptances.version
  )
);

-- Consultar o proprio estado, mesmo antes de confirmar os documentos.
create function public.crm_first_access_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('password_change_required',
    coalesce((select p.password_change_required from public.crm_profiles p
      where p.id = (select auth.uid())), true));
$$;
revoke all on function public.crm_first_access_status() from public, anon, authenticated, service_role;
grant execute on function public.crm_first_access_status() to authenticated;

-- A Edge Function valida o JWT antes de receber o ID da conta.
-- Nonce impede que um reset administrativo concorrente seja marcado como concluido.
create function public.crm_first_access_begin(p_actor uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if p_actor is null or not exists (select 1 from auth.users where id = p_actor) then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  select p.password_change_nonce into result from public.crm_profiles p
    where p.id = p_actor and p.password_change_required;
  if not found then
    raise exception 'CRM_FIRST_ACCESS_NOT_REQUIRED' using errcode = '42501';
  end if;
  return result;
end;
$$;

create function public.crm_first_access_complete(p_actor uuid, p_nonce uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_actor is null or p_nonce is null then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  update public.crm_profiles p
    set password_change_required = false, password_changed_at = statement_timestamp()
    where p.id = p_actor and p.password_change_required and p.password_change_nonce = p_nonce;
  if not found then
    raise exception 'CRM_FIRST_ACCESS_CONFLICT' using errcode = '42501';
  end if;
  insert into public.crm_audit_events(actor_user_id, entity, record_id, action)
    values (p_actor, 'crm_first_access_password', p_actor, 'UPDATE');
  return true;
end;
$$;
revoke all on function public.crm_first_access_begin(uuid) from public, anon, authenticated, service_role;
revoke all on function public.crm_first_access_complete(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.crm_first_access_begin(uuid) to service_role;
grant execute on function public.crm_first_access_complete(uuid,uuid) to service_role;

-- O reset administrativo marca a senha como temporaria novamente.
create or replace function public.crm_edge_begin_password_reset(
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
  -- Marcar antes da operação Auth: qualquer sessão existente perde acesso operacional.
  update public.crm_profiles
    set password_change_required = true, password_change_nonce = gen_random_uuid(), password_changed_at = null
    where id = p_target;
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (p_company, p_actor, 'crm_password_reset_requested', p_target, 'UPDATE');
end;
$$;

commit;
