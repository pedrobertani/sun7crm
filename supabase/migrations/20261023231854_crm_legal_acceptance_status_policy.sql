-- Reutiliza a consulta do próprio estado já autorizada, sem conceder EXECUTE
-- à função privada ou alterar os demais privilégios do usuário autenticado.
begin;
alter policy legal_acceptances_insert_self on public.crm_legal_acceptances
with check (
  user_id = (select auth.uid())
  and coalesce((public.crm_first_access_status()->>'password_change_required')::boolean, true) = false
  and exists (
    select 1 from public.crm_legal_requirements r
    where r.kind = crm_legal_acceptances.kind and r.version = crm_legal_acceptances.version
  )
);
commit;
