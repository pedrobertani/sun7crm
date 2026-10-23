-- A consulta do proprio estado nao precisa ignorar RLS.
-- crm_profiles ja permite ler o proprio perfil antes do aceite.
begin;
create or replace function public.crm_first_access_status() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('password_change_required',
    coalesce((select p.password_change_required from public.crm_profiles p
      where p.id = (select auth.uid())), true));
$$;
commit;
