-- Executar no SQL Editor SOMENTE após a migração e a criação do usuário no Auth.
-- Troque o UUID abaixo pelo ID do usuário do Caio em Authentication > Users.
-- Não informe senha neste arquivo. O UUID não é uma senha nem uma chave de API.
begin;
do $$
declare
  target_user uuid := '00000000-0000-0000-0000-000000000000';
begin
  if target_user = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Substitua target_user pelo UUID do usuário do Caio no Supabase Auth.';
  end if;
  if not exists (select 1 from auth.users where id = target_user) then
    raise exception 'O usuário informado não existe no Supabase Auth.';
  end if;
  insert into public.crm_profiles(id, display_name)
    values (target_user, 'Caio') on conflict (id) do nothing;
  insert into crm_private.platform_admins(user_id, active)
    values (target_user, true) on conflict (user_id) do update set active = true;
end;
$$;
commit;
