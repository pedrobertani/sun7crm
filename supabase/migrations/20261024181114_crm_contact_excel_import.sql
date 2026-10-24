begin;
-- Normalize only for uniqueness. Existing values and records are never rewritten.
create unique index crm_contacts_company_phone_unique on public.crm_contacts (
  company_id,
  (nullif(case
    when length(regexp_replace(phone, '[^0-9]', '', 'g')) in (12,13)
      and left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '55'
    then substring(regexp_replace(phone, '[^0-9]', '', 'g') from 3)
    else regexp_replace(phone, '[^0-9]', '', 'g') end, ''))
);

-- Runs as the caller: company, role, active membership, first access and legal
-- requirements remain enforced by the existing INSERT policies. No UPDATE grant.
create function public.crm_import_contacts(p_company_id uuid, p_owner_membership_id uuid, p_contacts jsonb)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare inserted integer;
begin
  if auth.uid() is null then
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
      or (item->>'phone') !~ '^[0-9]{2}([2-5][0-9]{7}|9[0-9]{8})$'
      or left(item->>'phone',2) not in ('11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99')
  ) then
    raise exception using errcode='22023', message='Invalid name or Brazilian phone with DDD';
  end if;
  with added as (
    insert into public.crm_contacts(company_id, owner_membership_id, name, phone)
    select p_company_id, p_owner_membership_id, btrim(item->>'name'), item->>'phone'
    from jsonb_array_elements(p_contacts) with ordinality as rows(item, position)
    order by position
    on conflict do nothing
    returning id
  ) select count(*)::integer into inserted from added;
  return inserted;
end;
$$;
revoke all on function public.crm_import_contacts(uuid,uuid,jsonb) from public, anon;
grant execute on function public.crm_import_contacts(uuid,uuid,jsonb) to authenticated;
comment on function public.crm_import_contacts(uuid,uuid,jsonb) is 'Atomic contact import with RLS; existing phones are skipped, never updated.';
commit;
