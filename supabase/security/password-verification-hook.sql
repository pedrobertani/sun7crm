-- PREPARADO, NÃO ATIVADO. Fora de migrations intencionalmente.
-- O Password Verification Attempt Hook exige plano Team/Enterprise (documentação 31/10/2026); Free e Pro não incluem.
-- Instalar e vincular no Auth apenas em plano compatível, após homologação do fluxo nativo.
-- ATENÇÃO: tentativas inválidas não autenticadas podem ser usadas para bloquear contas de terceiros.
-- Revisar proteção contra abuso antes de ativar. A aprovação local não implica liberação remota.
-- pg-functions://postgres/public/crm_password_verification_hook
begin;

create table if not exists crm_private.login_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failures smallint not null check (failures between 0 and 5),
  window_started_at timestamptz not null,
  locked_until timestamptz
);
alter table crm_private.login_attempts enable row level security;
revoke all on crm_private.login_attempts from public, anon, authenticated, service_role;
grant usage on schema public, crm_private to supabase_auth_admin;
grant select, insert, update, delete on crm_private.login_attempts to supabase_auth_admin;
-- O papel de Auth é o único leitor/escritor. Não há acesso pela API do aplicativo.
drop policy if exists login_attempts_auth_only on crm_private.login_attempts;
create policy login_attempts_auth_only on crm_private.login_attempts
  for all to supabase_auth_admin using (true) with check (true);

create or replace function public.crm_password_verification_hook(event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid;
  valid boolean;
  attempted_at timestamptz;
  previous crm_private.login_attempts;
begin
  if jsonb_typeof(event) is distinct from 'object'
    or jsonb_typeof(event->'valid') is distinct from 'boolean'
    or jsonb_typeof(event->'user_id') is distinct from 'string' then
    raise exception 'CRM_INVALID_AUTH_EVENT' using errcode = '22023';
  end if;
  actor := (event->>'user_id')::uuid;
  valid := (event->>'valid')::boolean;

  -- O upsert bloqueia a linha até o fim da transação, inclusive nas primeiras
  -- tentativas concorrentes e quando um login válido remove a linha anterior.
  insert into crm_private.login_attempts(user_id, failures, window_started_at)
    values (actor, 0, clock_timestamp()) on conflict (user_id)
    do update set user_id = excluded.user_id returning * into previous;
  attempted_at := clock_timestamp();

  if previous.locked_until > attempted_at then
    -- Erros durante o bloqueio não prolongam o prazo nem encerram sessões existentes.
    if valid then
      return jsonb_build_object(
        'decision', 'reject', 'should_logout_user', false,
        'message', 'Não foi possível entrar. Aguarde alguns minutos e tente novamente.'
      );
    end if;
    -- Preserva a resposta genérica de senha inválida; não revela se a conta está bloqueada.
    return jsonb_build_object('decision', 'continue');
  end if;

  if valid then
    delete from crm_private.login_attempts where user_id = actor;
    return jsonb_build_object('decision', 'continue');
  end if;

  -- Conta a tentativa atual uma única vez, inclusive na primeira chamada.
  if previous.locked_until is not null
    or attempted_at - previous.window_started_at >= interval '15 minutes' then
    update crm_private.login_attempts set failures = 1,
      window_started_at = attempted_at, locked_until = null where user_id = actor;
  else
    update crm_private.login_attempts set failures = least(previous.failures + 1, 5),
      locked_until = case when previous.failures + 1 >= 5
        then attempted_at + interval '15 minutes' else null end where user_id = actor;
  end if;
  return jsonb_build_object('decision', 'continue');
end;
$$;
revoke all on function public.crm_password_verification_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.crm_password_verification_hook(jsonb) to supabase_auth_admin;

commit;
