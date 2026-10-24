import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export const fixtureUserId = '00000000-0000-4000-8000-000000000001';
const requirements = [
  { kind: 'terms', version: 'local-fixture' },
  { kind: 'privacy', version: 'local-fixture' },
];

// Somente testes locais. Estes documentos e identidades nunca são publicados.
export function fakeSupabase() {
  const state = {
    user: {
      id: fixtureUserId,
      email: 'teste@example.invalid',
      is_anonymous: false,
      user_metadata: {} as Record<string, unknown>,
    } as {
      id: string;
      email: string;
      is_anonymous: boolean;
      user_metadata: Record<string, unknown>;
    } | null,
    passwordRequired: false,
    admin: true,
    adminError: null as unknown,
    tableError: null as unknown,
    tables: {
      crm_legal_requirements: requirements.map((row) => ({ ...row })),
      crm_legal_documents: requirements.map((row) => ({
        ...row,
        body: 'Fixture local; não publicar',
        content_sha256: 'a'.repeat(64),
        published_at: '2026-10-23T12:00:00Z',
      })),
      crm_legal_acceptances: requirements.map((row) => ({ ...row })),
      crm_profiles: [{ display_name: 'Pessoa de teste' }],
      crm_companies: [],
      crm_company_billing: [],
      crm_memberships: [],
    } as Record<string, unknown[]>,
  };
  const from = vi.fn((table: string) => {
    let start: number | undefined,
      end: number | undefined,
      single = false;
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      abortSignal: vi.fn(() => query),
      range: vi.fn((a: number, b: number) => {
        start = a;
        end = b;
        return query;
      }),
      single: vi.fn(() => {
        single = true;
        return query;
      }),
      then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => {
        const rows = state.tables[table] || [];
        const data = single
          ? (rows[0] ?? null)
          : start === undefined
            ? rows
            : rows.slice(start, (end ?? 0) + 1);
        return Promise.resolve({ data, error: state.tableError }).then(resolve, reject);
      },
    };
    return query;
  });
  const rpc = vi.fn(async (name: string) =>
    name === 'crm_first_access_status'
      ? { data: { password_change_required: state.passwordRequired }, error: null }
      : { data: state.admin, error: state.adminError },
  );
  const getUser = vi.fn(async () => ({ data: { user: state.user }, error: null }));
  const getSession = vi.fn(async () => ({
    data: { session: state.user ? { user: state.user, access_token: 'local-test-token' } : null },
    error: null,
  }));
  const invoke = vi.fn(
    async (_endpoint: string, _options: unknown): Promise<{ data: unknown; error: unknown }> => ({
      data: { data: { company_id: 'company-local', enabled: false } },
      error: null,
    }),
  );
  const client = {
    auth: { getUser, getSession },
    rpc,
    from,
    functions: { invoke },
  } as unknown as SupabaseClient;
  return { client, state, from, rpc, getUser, getSession, invoke };
}
