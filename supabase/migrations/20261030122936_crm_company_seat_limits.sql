begin;
-- Serializa admissões por empresa, inclusive reativação e troca de função.
create function crm_private.enforce_company_seat_limits() returns trigger
language plpgsql security definer set search_path='' as $$
declare occupied integer;
begin
 if not new.active then return new; end if;
 if TG_OP='UPDATE' then
  if old.active and old.company_id=new.company_id and
   (old.role='manager')=(new.role='manager') then return new; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 604));
 select count(*) into occupied from public.crm_memberships m
 where m.company_id=new.company_id and m.active and m.id<>new.id
 and (m.role='manager')=(new.role='manager');
 if (new.role='manager' and occupied>=1) or (new.role<>'manager' and occupied>=5) then
  raise exception 'CRM_SEAT_LIMIT: Limite de 1 gestor e 5 funcionários ativos por empresa.' using errcode='23514';
 end if;
 return new;
end;
$$;
revoke all on function crm_private.enforce_company_seat_limits() from public,anon,authenticated,service_role;
create trigger crm_company_seat_limits before insert or update of active,role,company_id
on public.crm_memberships for each row execute function crm_private.enforce_company_seat_limits();
commit;
