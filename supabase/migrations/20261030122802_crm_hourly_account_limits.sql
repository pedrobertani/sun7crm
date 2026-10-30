-- Limites operacionais por solicitante; não substituem o limite comercial de vagas.
begin;
create or replace function public.crm_edge_prepare_user(
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
      where actor_user_id = p_actor and created_at > statement_timestamp() - interval '1 hour') >= 6 then
    raise exception 'CRM_RATE_LIMITED' using errcode = 'P0003';
  end if;
  insert into crm_private.user_provisioning(request_id, actor_user_id, company_id, role, fingerprint)
    values (p_request_id, p_actor, p_company, p_role, p_fingerprint);
  return jsonb_build_object('state', 'pending', 'user_id', null, 'membership_id', null);
end;
$$;

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
    where company_id = p_company and user_id = p_target and (active or crm_private.is_platform_admin());
  if crm_private.is_platform_admin() then
    if target_role is null or target_role not in ('manager','seller','reception') then
      raise exception 'CRM_FORBIDDEN' using errcode = '42501';
    end if;
  elsif not crm_private.has_permission(p_company,'team.manage')
    or not crm_private.subscription_allows_access(p_company)
    or target_role is null or target_role not in ('seller', 'reception') then
    raise exception 'CRM_FORBIDDEN' using errcode = '42501';
  end if;
  if not crm_private.is_platform_admin() and crm_private.company_role(p_company)<>'manager' and exists(
   select 1 from public.crm_memberships m where m.company_id=p_company and m.user_id=p_target and (
   exists(select 1 from crm_private.permission_catalog c where crm_private.member_permission(m.id,c.key) and not crm_private.has_permission(p_company,c.key))
   or (crm_private.member_company_scope(m.id) and not crm_private.has_company_scope(p_company)))) then raise exception 'CRM_FORBIDDEN' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target::text, 2));
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 3));
  if (select count(*) from crm_private.password_reset_requests where actor_user_id = p_actor
      and created_at > statement_timestamp() - interval '1 hour') >= 30
    or (select count(*) from crm_private.password_reset_requests where target_user_id = p_target
      and created_at > statement_timestamp() - interval '1 hour') >= 5 then
    raise exception 'CRM_RATE_LIMITED' using errcode = 'P0003';
  end if;
  insert into crm_private.password_reset_requests(request_id, actor_user_id, company_id, target_user_id)
    values (p_request_id, p_actor, p_company, p_target);
  -- Block operational access before updating Auth, including uncertain outcomes.
  update public.crm_profiles set password_change_required=true,
    password_change_nonce=gen_random_uuid(),password_changed_at=null where id=p_target;
  insert into public.crm_audit_events(company_id, actor_user_id, entity, record_id, action)
    values (p_company, p_actor, 'crm_password_reset_requested', p_target, 'UPDATE');
end;
$$;
commit;
