begin;
create or replace function public.crm_import_contacts(p_company_id uuid, p_owner_membership_id uuid, p_contacts jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare inserted integer;
begin
  if not crm_private.has_permission(p_company_id,'contacts.import') or auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required';
  end if;
  if p_contacts is null or jsonb_typeof(p_contacts) <> 'array' then
    raise exception using errcode='22023', message='Expected contacts array';
  end if;
  if jsonb_array_length(p_contacts) not between 1 and 1000 then
    raise exception using errcode='22023', message='Import between 1 and 1000 contacts';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_contacts) item
    where jsonb_typeof(item) <> 'object'
      or coalesce(jsonb_typeof(item->'name'),'null') <> 'string'
      or coalesce(jsonb_typeof(item->'phone'),'null') <> 'string'
      or length(btrim(item->>'name')) not between 1 and 100
      or (btrim(item->>'phone') <> '' and ((item->>'phone') !~ '^[0-9]{2}([2-5][0-9]{7}|9[0-9]{8})$'
      or left(item->>'phone',2) not in ('11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99')))
  ) then
    raise exception using errcode='22023', message='Invalid name or Brazilian phone with DDD';
  end if;
  -- Serialize imports for this company; retain caller permissions and RLS.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_company_id::text, 0));
  with candidates as (
    select distinct on (case when btrim(item->>'phone') = '' then 'name:' || lower(btrim(item->>'name')) else 'phone:' || (item->>'phone') end)
      btrim(item->>'name') as name, btrim(item->>'phone') as phone, position
    from jsonb_array_elements(p_contacts) with ordinality as rows(item, position)
    order by case when btrim(item->>'phone') = '' then 'name:' || lower(btrim(item->>'name')) else 'phone:' || (item->>'phone') end, position
  ), added as (
    insert into public.crm_contacts(company_id, owner_membership_id, name, phone)
    select p_company_id, p_owner_membership_id, candidate.name, candidate.phone
    from candidates candidate
    where candidate.phone <> '' or not exists (
      select 1 from public.crm_contacts existing
      where existing.company_id = p_company_id and btrim(existing.phone) = ''
        and lower(btrim(existing.name)) = lower(candidate.name)
    )
    order by position
    on conflict do nothing
    returning id
  ) select count(*)::integer into inserted from added;
  return inserted;
end;
$$;
create or replace function crm_private.member_permission(p_member uuid,p_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when p_key='plan.view' then m.role='manager'
 when a.membership_id is not null then p_key=any(a.keys)
 when m.role='manager' then true
 when p_key in ('boards.view','catalog.view','labels.view','strategies.view','dashboard.view') then true
 when m.role='seller' then split_part(p_key,'.',1) in ('cards','contacts','history','tasks') and p_key<>'cards.delete'
 else p_key in ('cards.view','contacts.view','history.view','history.whatsapp','tasks.view','tasks.create','tasks.edit') end
 from public.crm_memberships m join public.crm_companies c on c.id=m.company_id
 left join crm_private.employee_access a on a.membership_id=m.id
 where m.id=p_member and m.active and c.enabled and exists(select 1 from crm_private.permission_catalog where key=p_key)),false);
$$;
commit;
