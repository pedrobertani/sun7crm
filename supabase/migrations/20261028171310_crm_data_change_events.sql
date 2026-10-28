-- Private, data-free invalidations. No client can publish or choose recipients.
begin;

create function crm_private.can_receive_data_change(p_topic text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); target uuid;
begin
  if actor is null or not crm_private.has_current_acceptance()
    or not exists(select 1 from public.crm_profiles where id=actor and not password_change_required)
  then return false; end if;
  if p_topic='crm:user:'||actor::text then return true; end if;
  if p_topic='crm:admin' then return crm_private.is_platform_admin(); end if;
  if p_topic !~ '^crm:company:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return false; end if;
  target := split_part(p_topic,':',3)::uuid;
  return crm_private.has_company_access(target)
    or (crm_private.company_role(target)='manager' and crm_private.has_permission(target,'plan.view'));
end;
$$;
revoke all on function crm_private.can_receive_data_change(text) from public,anon,authenticated,service_role;
grant execute on function crm_private.can_receive_data_change(text) to authenticated;

do $policy$
begin
  if to_regclass('realtime.messages') is not null then
    execute $sql$create policy crm_private_change_receivers on realtime.messages for select to authenticated
      using (extension='broadcast' and topic=(select realtime.topic())
        and crm_private.can_receive_data_change(topic))$sql$;
  end if;
end;
$policy$;

create function crm_private.emit_data_change(p_scope text,p_resource text) returns void
language plpgsql security definer set search_path='' as $$
declare sent jsonb; marker text := p_scope||'/'||p_resource;
begin
  if p_scope is null or to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
  sent := coalesce(nullif(current_setting('crm.sent_changes',true),''),'[]')::jsonb;
  if sent ? marker then return; end if;
  perform set_config('crm.sent_changes',(sent||jsonb_build_array(marker))::text,true);
  perform realtime.send(jsonb_build_object('resource',p_resource,'revision',txid_current()::text),
    'changed','crm:'||p_scope,true);
exception when others then
  -- Notification delivery must never reject a valid business transaction.
  raise warning 'CRM_CHANGE_DELIVERY_FAILED (%)',sqlstate;
end;
$$;
revoke all on function crm_private.emit_data_change(text,text) from public,anon,authenticated,service_role;

create function crm_private.broadcast_data_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; company uuid; recipient uuid; notified jsonb; target record;
  resource text := tg_argv[0];
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return null; end if;
  row_data := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  company := (row_data->>'company_id')::uuid;
  recipient := (row_data->>'user_id')::uuid;
  if tg_table_name='crm_companies' then company := (row_data->>'id')::uuid; end if;
  if tg_table_name='crm_profiles' then recipient := (row_data->>'id')::uuid; end if;
  if tg_table_name in ('crm_legal_requirements','crm_legal_documents') then
    for target in select id from public.crm_profiles
    loop perform crm_private.emit_data_change('user:'||target.id::text,'access'); end loop;
  end if;
  if tg_table_name='employee_access' then
    select m.company_id,m.user_id into company,recipient from public.crm_memberships m
      where m.id=(row_data->>'membership_id')::uuid;
  end if;
  if resource='notifications' then
    perform crm_private.emit_data_change('user:'||(row_data->>'recipient_user_id'),'notifications');
    -- A deadline can change a projection without changing the source record.
    if tg_op<>'UPDATE' or (row_data->'active') is distinct from (to_jsonb(old)->'active') then
      if row_data->>'kind'='subscription_due' then
        perform crm_private.emit_data_change('company:'||company::text,'billing');
        perform crm_private.emit_data_change('user:'||(row_data->>'recipient_user_id'),'access');
      elsif row_data->>'kind' in ('task_due','task_assigned') then
        perform crm_private.emit_data_change('company:'||company::text,'tasks');
      elsif row_data->>'kind' in ('card_first_response','card_idle','card_escalation') then
        perform crm_private.emit_data_change('company:'||company::text,'cards');
      end if;
    end if;
    return null;
  end if;
  if company is not null then
    perform crm_private.emit_data_change('company:'||company::text,resource);
    -- Deferred triggers see the complete import/transaction, and reconcile each company once.
    notified := coalesce(nullif(current_setting('crm.notification_companies',true),''),'[]')::jsonb;
    if not notified ? company::text then
      perform set_config('crm.notification_companies',(notified||jsonb_build_array(company::text))::text,true);
      for target in select distinct user_id from public.crm_memberships where company_id=company and active
      loop perform crm_private.reconcile_notifications(target.user_id); end loop;
    end if;
  end if;
  if recipient is not null then perform crm_private.emit_data_change('user:'||recipient::text,'access'); end if;
  if resource in ('access','team','settings','billing') then perform crm_private.emit_data_change('admin',resource); end if;
  return null;
exception when others then
  raise warning 'CRM_CHANGE_PROJECTION_FAILED (%)',sqlstate;
  return null;
end;
$$;
revoke all on function crm_private.broadcast_data_change() from public,anon,authenticated,service_role;

do $triggers$
declare item record;
begin
  for item in select * from (values
    ('public','crm_contacts','contacts'),('public','crm_contact_catalog','contacts'),
    ('public','crm_contact_history','cards'),('public','crm_opportunities','cards'),
    ('public','crm_boards','cards'),('public','crm_stages','cards'),
    ('public','crm_card_labels','cards'),('public','crm_card_catalog','cards'),
    ('public','crm_tasks','tasks'),('public','crm_catalog_items','catalog'),
    ('public','crm_labels','labels'),('public','crm_strategies','strategies'),
    ('public','crm_ambassadors','growth'),('public','crm_ambassador_campaigns','growth'),
    ('public','crm_ambassador_referrals','growth'),('public','crm_campaign_participants','growth'),
    ('public','crm_campaign_payments','growth'),('public','crm_referral_catalog','growth'),
    ('public','crm_referral_revisions','growth'),('public','crm_ambassador_metrics','growth'),
    ('public','crm_companies','access'),('public','crm_memberships','team'),
    ('crm_private','employee_access','team'),('crm_private','platform_admins','access'),
    ('public','crm_profiles','access'),('public','crm_legal_acceptances','access'),
    ('public','crm_legal_requirements','access'),('public','crm_legal_documents','access'),
    ('public','crm_company_billing','billing'),('public','crm_subscription_events','billing'),
    ('public','crm_subscription_charges','billing'),('public','crm_subscription_agreements','billing'),
    ('public','crm_notifications','notifications')
  ) as resources(schema_name,table_name,resource)
  loop
    execute format('create constraint trigger crm_data_change after insert or update or delete on %I.%I deferrable initially deferred for each row execute function crm_private.broadcast_data_change(%L)',item.schema_name,item.table_name,item.resource);
  end loop;
end;
$triggers$;
commit;
