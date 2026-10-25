/** Prévia visual local. Não é importada pela aplicação nem incluída no build de produção. */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import '../../src/styles.css';
import { AdminWorkspace } from '../../src/modules/admin/AdminWorkspace';
import { getSupabaseClient } from '../../src/lib/supabase';

// Impede que qualquer ação da prévia consulte ou grave dados reais.
window.fetch = async () => {
  throw new Error('QA local: rede desabilitada.');
};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const user = { id: id(1), email: 'qa@example.invalid', displayName: 'Administrador fictício' };
const today = new Date().toISOString().slice(0, 10);
const documents = ['terms', 'privacy'].map((kind) => ({
  kind,
  version: 'qa-local',
  body: 'Documento exclusivamente local de teste.',
  content_sha256: 'a'.repeat(64),
  published_at: '2026-10-23T12:00:00Z',
}));
const tables: Record<string, unknown[]> = {
  crm_legal_requirements: documents.map(({ kind, version }) => ({ kind, version })),
  crm_legal_documents: documents,
  crm_legal_acceptances: documents.map(({ kind, version }) => ({ kind, version })),
  crm_profiles: [{ display_name: user.displayName }],
  crm_companies: [
    {
      id: id(100),
      name: 'Clínica fictícia Aurora',
      display_name: null,
      segment: 'Estética',
      template: 'aesthetic',
      theme: 'sun7',
      enabled: true,
      created_at: today + 'T12:00:00Z',
    },
    {
      id: id(200),
      name: 'Empresa fictícia Casa & Forma',
      display_name: null,
      segment: 'Decoração',
      template: 'generic',
      theme: 'blue',
      enabled: true,
      created_at: today + 'T12:00:00Z',
    },
    {
      id: id(300),
      name: 'Clínica fictícia Essência',
      display_name: null,
      segment: 'Estética',
      template: 'aesthetic',
      theme: 'rose',
      enabled: false,
      created_at: today + 'T12:00:00Z',
    },
  ],
  crm_company_billing: [100, 200, 300].map((n) => ({
    company_id: id(n),
    monthly_amount_cents: 18990,
    due_date: today,
    cycle_kind: 'monthly',
  })),
  crm_memberships: [100, 200, 300].map((n) => ({
    id: id(n + 1),
    company_id: id(n),
    user_id: id(n + 2),
    crm_profiles: { display_name: 'Gestor fictício' },
  })),
  crm_notifications: [],
};
const client = getSupabaseClient() as any;
client.auth.getUser = async () => ({
  data: { user: { ...user, is_anonymous: false } },
  error: null,
});
client.auth.getSession = async () => ({ data: { session: null }, error: null });
client.rpc = async (name: string, args: Record<string, string> = {}) => {
  const data =
    name === 'crm_first_access_status'
      ? { password_change_required: false }
      : name === 'crm_is_platform_admin'
        ? true
        : name === 'crm_subscription_summary'
          ? {
              company_id: args.p_company,
              plan_name: 'Mensal',
              monthly_amount_cents: 18990,
              due_date: today,
              cycle_kind: 'monthly',
              status: 'active',
              server_date: today,
              access_allowed: true,
              grace_days_used: 0,
              grace_ends_on: null,
              events: [],
            }
          : undefined;
  if (data === undefined) throw new Error('QA local: comando não permitido.');
  return { data, error: null };
};
client.from = (name: string) => {
  let single = false;
  const q: any = {
    select: () => q,
    eq: () => q,
    order: () => q,
    limit: () => q,
    is: () => q,
    range: () => q,
    abortSignal: () => q,
    single: () => {
      single = true;
      return q;
    },
    then: (resolve: any, reject: any) =>
      Promise.resolve({
        data: single ? (tables[name]?.[0] ?? null) : (tables[name] ?? []),
        count: 0,
        error: null,
      }).then(resolve, reject),
  };
  return q;
};
const stableRecheck = () => {};
function Preview() {
  const [width, setWidth] = useState(1200);
  if (new URLSearchParams(location.search).get('embedded') !== '1')
    return (
      <div style={{ background: '#0c0d0b', color: '#eee8d9', minHeight: '100vh', padding: 16 }}>
        <p>PRÉVIA VISUAL LOCAL · Dados fictícios · Sem acesso ao banco</p>
        <label style={{ display: 'block', margin: '14px 0' }}>
          Tamanho da tela{' '}
          <select
            aria-label="Tamanho da tela"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={1200}>Desktop 1200</option>
            <option value={1920}>Monitor 1920</option>
            <option value={2560}>Monitor 2560</option>
            <option value={780}>Tablet 780</option>
            <option value={390}>Celular 390</option>
          </select>
        </label>
        <div style={{ width: '100%', overflow: 'auto' }}>
          <iframe
            title="Prévia isolada do painel administrativo"
            src="./admin.html?embedded=1#/admin"
            style={{
              width,
              height: 900,
              border: '1px solid #34362e',
              display: 'block',
              maxWidth: 'none',
            }}
          />
        </div>
      </div>
    );
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <AdminWorkspace user={user} onLogout={async () => {}} onRecheck={stableRecheck} />
          }
        />
      </Routes>
    </HashRouter>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
