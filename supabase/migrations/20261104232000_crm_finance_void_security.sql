-- O endpoint público de anulação usa INVOKER; o comando com privilégios
-- fica apenas em crm_private e revalida finance.void e o escopo.
begin;
create or replace function crm_private.finance_void_movement(p_company uuid,p_movement uuid,p_version bigint,p_reason text)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.crm_finance_movements; before_value jsonb;
begin
 select * into m from public.crm_finance_movements where company_id=p_company and id=p_movement for update;
 if not found or m.voided_at is not null or m.kind='refund' then
  raise exception 'CRM_FINANCE_NOT_EDITABLE' using errcode='22023';end if;
 perform crm_private.finance_guard(p_company,m.owner_membership_id,'finance.void');
 if p_version is null or p_version<>m.row_version then raise exception 'CRM_STALE_VERSION' using errcode='40001';end if;
 if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
  raise exception 'CRM_FINANCE_REASON_REQUIRED' using errcode='22023';end if;
 if m.kind='income' and exists(select 1 from public.crm_finance_movements
  where company_id=p_company and origin_id=m.id and kind='refund' and voided_at is null)
 then raise exception 'CRM_FINANCE_REFUND_ALREADY_EXISTS' using errcode='23514';end if;
 before_value:=to_jsonb(m);
 update public.crm_finance_movements set voided_at=now(),void_reason=btrim(p_reason),
  row_version=row_version+1,modified_at=now()
 where company_id=p_company and id=p_movement returning * into m;
 insert into public.crm_finance_audit(company_id,movement_id,opportunity_id,owner_membership_id,action,
  before_data,after_data,reason,performed_by)
 values(p_company,m.id,m.opportunity_id,m.owner_membership_id,'void',before_value,to_jsonb(m),p_reason,(select auth.uid()));
 return to_jsonb(m);
end $$;
revoke all on function crm_private.finance_void_movement(uuid,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function crm_private.finance_void_movement(uuid,uuid,bigint,text) to authenticated;


create or replace function public.crm_finance_void_movement(
 p_company uuid,p_movement uuid,p_version bigint,p_reason text
) returns jsonb language sql security invoker set search_path='' as $$
 select crm_private.finance_void_movement(p_company,p_movement,p_version,p_reason);
$$;
revoke all on function public.crm_finance_void_movement(uuid,uuid,bigint,text)
 from public,anon,authenticated,service_role;
grant execute on function public.crm_finance_void_movement(uuid,uuid,bigint,text)
 to authenticated;
commit;
