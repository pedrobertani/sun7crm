/** Isolated visual fixture, never imported by the application or production build. No Supabase session. */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import '../../src/styles.css';
import '../../src/modules/admin/admin.css';
import '../../src/modules/workspace/operational.css';
import { OperationalProvider } from '../../src/modules/workspace/operational';
import { RealKanban } from '../../src/modules/workspace/RealKanban';
import {
  RealCatalog,
  RealContacts,
  RealStrategies,
  RealTasks,
} from '../../src/modules/workspace/RealRecords';
import { RealAmbassadors } from '../../src/modules/workspace/RealAmbassadors';
import {
  RealDashboard,
  RealReports,
  RealSettings,
  RealTeam,
} from '../../src/modules/workspace/RealManagement';
import { OperationalBackend, BackendError } from '../../src/data/backend';
import { ThemeProvider } from '../../src/components/theme-provider';
import { themeStyle } from '../../src/lib/themes';
// Even legacy history/export views cannot reach a signed-in or remote service from this fixture.
window.fetch = async () => {
  throw new Error('Fixture local: acesso de rede desabilitado.');
};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = new Date().toISOString(),
  base = { company_id: id(100), row_version: 1, created_at: now, updated_at: now };
const contacts = [
  {
    ...base,
    id: id(1001),
    owner_membership_id: id(12),
    name: 'Cliente de teste A',
    phone: '',
    email: 'teste-a@example.invalid',
    temperature: 'warm',
    notes: '',
    interests: '',
    catalog_ids: [],
  },
  {
    ...base,
    id: id(1002),
    owner_membership_id: id(11),
    name: 'Cliente de teste B',
    phone: '',
    email: '',
    temperature: 'unclassified',
    notes: '',
    interests: '',
    catalog_ids: [],
  },
];
const rows: any = {
  contacts,
  boards: [
    { ...base, id: id(3001), kind: 'leads', name: 'Leads', position: 0 },
    { ...base, id: id(3002), kind: 'clients', name: 'Clientes', position: 1 },
  ],
  stages: [
    ['Primeiro contato', 3101, 3001, 0],
    ['Em atendimento', 3102, 3001, 1],
    ['Retorno', 3103, 3001, 2],
    ['Cliente ativo', 3201, 3002, 0],
  ].map(([name, n, board, position]) => ({
    id: id(n as number),
    company_id: id(100),
    board_id: id(board as number),
    name,
    position,
  })),
  cards: [
    {
      ...base,
      id: id(5001),
      contact_id: id(1001),
      board_id: id(3001),
      stage_id: id(3101),
      title: 'Consulta de avaliação',
      value_cents: 150000,
      source: '',
      strategy_id: null,
      follow_up_at: null,
      is_closed: false,
      label_ids: [id(6001)],
      catalog_ids: [],
    },
    {
      ...base,
      id: id(5002),
      contact_id: id(1002),
      board_id: id(3001),
      stage_id: id(3102),
      title: 'Novo atendimento',
      value_cents: 250000,
      source: '',
      strategy_id: null,
      follow_up_at: null,
      is_closed: false,
      label_ids: [],
      catalog_ids: [],
    },
  ],
  catalog: [],
  labels: [
    { ...base, id: id(6001), name: 'Alto padrão', color: '#8b5cf6', active: true },
    { ...base, id: id(6002), name: 'Retorno', color: '#236d62', active: true },
    { ...base, id: id(6003), name: 'Prioridade', color: '#b65f73', active: true },
    { ...base, id: id(6004), name: 'Indicação', color: '#315ba2', active: true },
  ],
  strategies: [
    {
      ...base,
      id: id(7001),
      name: 'Campanha de avaliação',
      month: '2026-10-01',
      channel: 'Instagram',
      status: 'active',
      budget_cents: 50000,
      owner_membership_id: id(11),
      notes: 'Estratégia fictícia para QA',
      active: true,
    },
  ],
  tasks: [
    {
      ...base,
      id: id(8001),
      title: 'Confirmar retorno de avaliação',
      due_date: '2026-10-25',
      status: 'todo',
      owner_membership_id: id(12),
      contact_id: id(1001),
      opportunity_id: id(5001),
      completed_at: null,
    },
  ],
  ambassadors: [
    {
      ...base,
      id: id(9001),
      contact_id: id(1002),
      category: 'Consultora',
      benefits: '',
      commission_enabled: true,
      active: true,
      referral_code: 'TESTE123',
    },
  ],
  campaigns: [
    {
      ...base,
      id: id(9101),
      name: 'Campanha fictícia de outubro',
      starts_on: '2026-10-01',
      ends_on: '2026-10-31',
      payment_mode: 'per_point',
      rate_cents: 15000,
      rate_bps: 0,
      status: 'active',
      closed_at: null,
    },
  ],
  referrals: [
    {
      ...base,
      id: id(9201),
      campaign_id: id(9101),
      ambassador_id: id(9001),
      opportunity_id: id(5001),
      contact_id: id(1001),
      value_cents: 150000,
      sold_on: '2026-10-24',
      paid: true,
      attended: true,
      cancelled: false,
      refunded_cents: 0,
      catalog_ids: [],
    },
  ],
  metrics: [],
};
const team = [
  {
    ...base,
    id: id(11),
    user_id: id(1),
    display_name: 'Gestor de teste',
    email: 'gestor@example.invalid',
    role: 'manager',
    active: true,
  },
  {
    ...base,
    id: id(12),
    user_id: id(2),
    display_name: 'Consultora de teste',
    email: 'consultora@example.invalid',
    role: 'seller',
    active: true,
  },
];
let sequence = 10000,
  conflict = false,
  uncertain = false;
const journal = new Map(),
  payments: any[] = [];
const log = (name: string, input: any) => {
  document.querySelector('#qa-log')!.textContent = JSON.stringify({ action: name, input }, null, 2);
};
function activity() {
  return rows.cards.map((c: any) => ({
    ...c,
    opportunity_id: c.id,
    contact_name: contacts.find((p) => p.id === c.contact_id)?.name,
    phone: '',
    owner_membership_id: contacts.find((p) => p.id === c.contact_id)?.owner_membership_id,
    owner_name: 'Consultora de teste',
    board_name: rows.boards.find((b: any) => b.id === c.board_id)?.name,
    stage_name: rows.stages.find((s: any) => s.id === c.stage_id)?.name,
    first_activity_at: null,
    last_activity_at: null,
    hours_without_activity: 100,
    days_without_activity: 4,
    alerts_enabled: true,
    first_response_hours: 24,
    idle_days_threshold: 3,
    escalation_days_threshold: 7,
  }));
}
async function finance(key: string, action: () => any) {
  if (journal.has(key)) {
    log('retry', { requestId: key, records: journal.size });
    return structuredClone(journal.get(key));
  }
  const result = action();
  journal.set(key, result);
  log('financial', { requestId: key, records: journal.size });
  if (uncertain) {
    uncertain = false;
    throw new BackendError(
      'Resultado de rede incerto. Confira a mesma solicitação.',
      'TRANSPORT_ERROR',
      'transport',
      true,
    );
  }
  return result;
}
const api = {
  all: async (k: string) => structuredClone(rows[k]),
  list: async (k: string, page = 0, size = 50, filters: any = {}, search = '') => {
    let result = rows[k].filter((r: any) =>
      Object.entries(filters).every(([key, value]) => r[key] === value),
    );
    if (search)
      result = result.filter((r: any) =>
        (r.name || r.title || '').toLowerCase().includes(search.toLowerCase()),
      );
    return {
      rows: structuredClone(result.slice(page * size, (page + 1) * size)),
      total: result.length,
      page,
      pageSize: size,
      hasMore: (page + 1) * size < result.length,
    };
  },
  get: async (k: string, key: string) => structuredClone(rows[k].find((r: any) => r.id === key)),
  contactsByIds: async (ids: string[]) =>
    structuredClone(contacts.filter((c) => ids.includes(c.id))),
  activityByIds: async (ids: string[]) => activity().filter((c: any) => ids.includes(c.id)),
  labelsByCardIds: async (ids: string[]) =>
    rows.cards
      .filter((c: any) => ids.includes(c.id))
      .flatMap((c: any) =>
        c.label_ids.map((label_id: string) => ({ opportunity_id: c.id, label_id })),
      ),
  cardActivity: async () => ({ rows: activity(), total: 2, page: 0, pageSize: 50, hasMore: false }),
  team: async () => structuredClone(team),
  contactDetails: async (key: string) => structuredClone(contacts.find((c) => c.id === key)),
  cardDetails: async (key: string) => structuredClone(rows.cards.find((r: any) => r.id === key)),
  referralDetails: async (key: string) =>
    structuredClone(rows.referrals.find((r: any) => r.id === key)),
  create: async (k: string, input: any) => {
    const row = { ...base, id: id(sequence++), ...input };
    rows[k].push(row);
    log('create:' + k, input);
    return row;
  },
  patch: async (k: string, key: string, input: any) => {
    const row = rows[k].find((r: any) => r.id === key);
    Object.assign(row, input);
    row.row_version++;
    log('patch:' + k, input);
    return structuredClone(row);
  },
  saveContact: async (input: any, key?: string) => {
    let row = contacts.find((c) => c.id === key);
    if (!row) {
      row = { ...base, id: id(sequence++), catalog_ids: [], interests: '', ...input };
      contacts.push(row!);
    } else Object.assign(row, input);
    log('save-contact', input);
    return structuredClone(row);
  },
  saveCard: async (input: any, key?: string) => {
    if (conflict) {
      conflict = false;
      throw new BackendError(
        'O registro mudou. Atualize os dados antes de salvar novamente.',
        '40001',
        'conflict',
      );
    }
    let row = rows.cards.find((c: any) => c.id === key);
    if (!row) {
      row = { ...base, id: id(sequence++), label_ids: [], catalog_ids: [], ...input };
      rows.cards.push(row);
    } else Object.assign(row, input, { row_version: row.row_version + 1 });
    log('save-card', input);
    return structuredClone(row);
  },
  saveTask: async (input: any, key?: string) => {
    const row = rows.tasks.find((c: any) => c.id === key) || { ...base, id: id(sequence++) };
    if (!rows.tasks.includes(row)) rows.tasks.push(row);
    Object.assign(row, input);
    log('save-task', input);
    return row;
  },
  createBoard: async (name: string) => {
    const row = { ...base, id: id(sequence++), kind: 'custom', name, position: 2 };
    rows.boards.push(row);
    rows.stages.push({
      id: id(sequence++),
      company_id: id(100),
      board_id: row.id,
      name: 'Novo card',
      position: 0,
    });
    return row;
  },
  configureBoard: async (key: string, name: string, stages: any[]) => {
    const row = rows.boards.find((b: any) => b.id === key);
    row.name = name;
    row.row_version++;
    rows.stages = [
      ...rows.stages.filter((s: any) => s.board_id !== key),
      ...stages.map((s: any, position: number) => ({
        ...s,
        board_id: key,
        company_id: id(100),
        position,
      })),
    ];
    return row;
  },
  recordCardWhatsapp: async () => {},
  recordCardNote: async () => {},
  campaignTotals: async () => [
    {
      company_id: id(100),
      campaign_id: id(9101),
      ambassador_id: id(9001),
      ambassador_name: 'Cliente de teste B',
      category: 'Consultora',
      commission_enabled: true,
      indicated_count: 1,
      attended_count: 1,
      paid_count: 1,
      eligible_cents: 150000,
      points: 1,
      amount_cents: 15000,
      paid_cents: payments.length ? 15000 : 0,
      paid_points: payments.length ? 1 : 0,
      balance_cents: payments.length ? 0 : 15000,
      remaining_points: payments.length ? 0 : 1,
      settled: payments.length > 0,
    },
  ],
  campaignPayments: async () => structuredClone(payments),
  closeCampaign: async (key: string, _v: number, requestId: string) =>
    finance(requestId, () => {
      const row = rows.campaigns.find((c: any) => c.id === key);
      row.status = 'closed';
      row.closed_at = now;
      return structuredClone(row);
    }),
  recordCampaignPayment: async (
    campaign: string,
    ambassador: string,
    amount: number,
    requestId: string,
    note: string,
  ) =>
    finance(requestId, () => {
      const p = {
        id: id(sequence++),
        ambassador_id: ambassador,
        ambassador_name: 'Cliente de teste B',
        amount_cents: amount,
        points: 1,
        paid_at: now,
        note,
      };
      payments.push(p);
      return p;
    }),
  saveReferral: async (input: any) =>
    finance(input.requestId, () => ({ id: id(sequence++), ...input })),
  adjustReferral: async (
    key: string,
    _v: number,
    value: number,
    cancelled: boolean,
    reason: string,
    requestId: string,
  ) =>
    finance(requestId, () => {
      const row = rows.referrals.find((r: any) => r.id === key);
      Object.assign(row, { refunded_cents: value, cancelled });
      return row;
    }),
  metrics: async () => ({
    contacts: 2,
    hot_contacts: 0,
    open_cards: 2,
    estimated_pipeline_cents: 400000,
    pending_tasks: 1,
    overdue_tasks: 0,
    contacts_by_day: [{ day: '2026-10-24', count: 2 }],
    cards_by_stage: [
      { board_id: id(3001), stage_id: id(3101), count: 1, estimated_cents: 150000 },
      { board_id: id(3001), stage_id: id(3102), count: 1, estimated_cents: 250000 },
    ],
    cards_by_strategy: [{ strategy_id: null, count: 2, estimated_cents: 400000 }],
  }),
  company: async () => ({
    ...base,
    id: id(100),
    name: 'Empresa de teste',
    display_name: null,
    theme: 'sun7',
    logo_path: null,
  }),
  updateBrand: async () => ({}),
  downloadLogo: async () => null,
  updateMember: async () => ({}),
} as unknown as OperationalBackend;
const query = new URLSearchParams(location.search),
  embedded = query.get('embedded') === '1';
function Fixture() {
  const [screen, setScreen] = useState('funil'),
    [role, setRole] = useState('manager'),
    [mobile, setMobile] = useState(false);
  if (!embedded)
    return (
      <div style={{ padding: 16, background: '#e8edef', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 18 }}>QA LOCAL — dados fictícios, sem conexão com o banco</h1>
        <div className="actions" style={{ margin: '16px 0' }}>
          <label>
            Tela{' '}
            <select value={screen} onChange={(e) => setScreen(e.target.value)}>
              {[
                'funil',
                'contatos',
                'tarefas',
                'catalogo',
                'etiquetas',
                'estrategias',
                'embaixadores',
                'equipe',
                'configuracoes',
                'dashboard',
                'relatorios',
              ].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Perfil{' '}
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="manager">Gestor</option>
              <option value="seller">Consultor</option>
              <option value="reception">Recepção</option>
            </select>
          </label>
          <button onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop' : 'Celular'}</button>
        </div>
        <iframe
          title="Prévia operacional isolada"
          src={`./operational.html?embedded=1&screen=${screen}&role=${role}`}
          style={{
            width: mobile ? 390 : 1180,
            maxWidth: '100%',
            height: 900,
            border: '1px solid #cbd8da',
            background: '#f7f9fa',
          }}
        />
      </div>
    );
  const selected = query.get('screen') || 'funil',
    activeRole = (query.get('role') || 'manager') as 'manager' | 'seller' | 'reception',
    company = {
      id: id(100),
      membershipId: activeRole === 'seller' ? id(12) : id(11),
      name: 'Empresa fictícia · QA',
      role: activeRole,
    };
  const screens: any = {
    funil: <RealKanban />,
    contatos: <RealContacts />,
    tarefas: <RealTasks />,
    catalogo: <RealCatalog />,
    etiquetas: <RealCatalog labels />,
    estrategias: <RealStrategies />,
    embaixadores: <RealAmbassadors />,
    equipe: <RealTeam />,
    configuracoes: <RealSettings onCompanyChanged={() => {}} />,
    dashboard: <RealDashboard />,
    relatorios: <RealReports />,
  };
  return (
    <HashRouter>
      <ThemeProvider style={themeStyle('sun7')}>
        <OperationalProvider
          company={company}
          user={{ id: id(1), displayName: 'Gestor fictício', email: 'qa@example.invalid' }}
          onRecheck={() => {}}
          backend={api}
        >
          <div
            className="official-member"
            style={{
              ...themeStyle('sun7'),
              padding: 20,
              background: '#f7f9fa',
              minHeight: '100vh',
            }}
          >
            <div className="actions" style={{ marginBottom: 20 }}>
              <small>FIXTURE LOCAL · SEM BANCO</small>
              <button
                onClick={() => {
                  conflict = true;
                }}
              >
                Simular conflito na próxima gravação de card
              </button>
              <button
                onClick={() => {
                  uncertain = true;
                }}
              >
                Simular falha após operação financeira
              </button>
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 24 }}>
              {selected === 'funil' ? 'Funil' : selected}
            </h1>
            {screens[selected]}
            <pre id="qa-log" style={{ fontSize: 10, whiteSpace: 'pre-wrap', marginTop: 30 }}>
              Nenhuma operação realizada.
            </pre>
          </div>
        </OperationalProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
