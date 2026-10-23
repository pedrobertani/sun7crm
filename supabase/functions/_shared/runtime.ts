import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import type { Backend } from './contracts.ts';
import { databaseError, HttpError } from './errors.ts';
import { createHttpHandler, DEFAULT_ORIGIN } from './http.ts';
import type { Command } from './contracts.ts';

function injectedKey(name: string, prefix: string): string {
  try {
    const values = JSON.parse(Deno.env.get(name) || '{}');
    if (typeof values.default === 'string' && values.default.startsWith(prefix))
      return values.default;
  } catch {
    /* Resposta abaixo não revela o valor da variável. */
  }
  throw new HttpError(503, 'SERVER_CONFIGURATION', 'O serviço ainda não está configurado.');
}

export function serve(command: Command) {
  // Clientes separados: o JWT do solicitante nunca substitui a credencial administrativa.
  const clients = () => {
    const url = Deno.env.get('SUPABASE_URL');
    if (!url)
      throw new HttpError(503, 'SERVER_CONFIGURATION', 'O serviço ainda não está configurado.');
    const options = {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    };
    return {
      auth: createClient(url, injectedKey('SUPABASE_PUBLISHABLE_KEYS', 'sb_publishable_'), options),
      admin: (() => {
        const secret = injectedKey('SUPABASE_SECRET_KEYS', 'sb_secret_');
        const secretFetch: typeof fetch = (input, init) => {
          const request = new Request(input, init);
          const headers = new Headers(request.headers);
          if (headers.get('Authorization') === 'Bearer ' + secret) {
            headers.delete('Authorization');
          }
          return fetch(new Request(request, { headers }));
        };
        return createClient(url, secret, { ...options, global: { fetch: secretFetch } });
      })(),
    };
  };
  const backend: Backend = {
    async authenticate(token) {
      const { data, error } = await clients().auth.auth.getUser(token);
      return error || !data.user || data.user.is_anonymous ? null : data.user.id;
    },
    async rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
      const { data, error } = await clients().admin.rpc(name, args);
      if (error) throw databaseError(error);
      return data as T;
    },
    async createUser({ email, password, operationId }) {
      const { data, error } = await clients().admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { crm_provisioning_id: operationId },
      });
      if (error || !data.user) {
        throw new HttpError(
          ['email_exists', 'user_already_exists'].includes(error?.code || '') ? 409 : 502,
          'AUTH_CREATE_FAILED',
          'Não foi possível criar a conta. Confira os dados e se o e-mail já está cadastrado.',
        );
      }
      return { id: data.user.id };
    },
    async deleteUser(userId) {
      const { error } = await clients().admin.auth.admin.deleteUser(userId);
      if (error)
        throw new HttpError(503, 'CLEANUP_FAILED', 'O cadastro precisa de revisão administrativa.');
    },
    async resetPassword(userId, password) {
      const { error } = await clients().admin.auth.admin.updateUserById(userId, { password });
      if (error)
        throw new HttpError(
          502,
          'AUTH_RESET_FAILED',
          'Não foi possível confirmar a redefinição da senha.',
        );
    },
    report(code, requestId) {
      // Somente códigos controlados e identificadores. Nunca registrar corpo, e-mail, senha, JWT ou chaves.
      console.error(JSON.stringify({ code, request_id: requestId }));
    },
  };
  const origins = (Deno.env.get('CRM_ALLOWED_ORIGINS') || DEFAULT_ORIGIN)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  Deno.serve(createHttpHandler(backend, command, origins));
}
