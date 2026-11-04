import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmployeePermissions } from '../modules/permissions/model';
import type { GoalPlan, GoalEmployeeProgress } from '../modules/goals/model';
import { uid } from '../lib/format';

export interface VersionedRow {
  id: string;
  company_id: string;
  row_version: number;
  created_at: string;
  updated_at: string;
}
export interface ContactRow extends VersionedRow {
  owner_membership_id: string;
  name: string;
  phone: string;
  email: string;
  temperature: string;
  interests: string;
  notes: string;
  catalog_ids?: string[];
}
export interface BoardRow extends VersionedRow {
  kind: 'leads' | 'clients' | 'custom';
  name: string;
  position: number;
  stages?: StageRow[];
}
export interface StageRow {
  id: string;
  company_id: string;
  board_id: string;
  name: string;
  position: number;
}
export interface CardRow extends VersionedRow {
  contact_id: string;
  owner_membership_id: string;
  board_id: string;
  stage_id: string;
  title: string;
  value_cents: number;
  source: string;
  strategy_id: string | null;
  follow_up_at: string | null;
  is_closed: boolean;
  label_ids?: string[];
  catalog_ids?: string[];
}
export interface CatalogRow {
  id: string;
  company_id: string;
  kind: 'service' | 'product';
  name: string;
  description: string;
  value_cents: number;
  active: boolean;
}
export interface LabelRow {
  id: string;
  company_id: string;
  name: string;
  color: string;
  active: boolean;
}
export interface StrategyRow {
  id: string;
  company_id: string;
  name: string;
  month: string;
  channel: string;
  status: 'planned' | 'active' | 'completed';
  budget_cents: number;
  owner_membership_id: string;
  notes: string;
  active: boolean;
}
export interface AmbassadorRow {
  id: string;
  company_id: string;
  contact_id: string;
  category: string;
  benefits: string;
  commission_enabled: boolean;
  active: boolean;
  referral_code: string;
}
export interface CampaignRow extends VersionedRow {
  name: string;
  starts_on: string;
  ends_on: string;
  payment_mode: 'per_point' | 'percentage';
  rate_cents: number;
  rate_bps: number;
  status: 'active' | 'closed';
  closed_at: string | null;
}
export interface ReferralRow extends VersionedRow {
  campaign_id: string;
  ambassador_id: string;
  opportunity_id: string;
  contact_id: string;
  value_cents: number;
  sold_on: string;
  paid: boolean;
  attended: boolean;
  cancelled: boolean;
  refunded_cents: number;
  catalog_ids?: string[];
}
export interface TaskRow extends VersionedRow {
  owner_membership_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  title: string;
  due_date: string;
  status: 'todo' | 'in_progress' | 'done';
  completed_at: string | null;
}
export interface MetricRow {
  id: string;
  company_id: string;
  ambassador_id: string;
  name: string;
  value: number | string;
  unit: string;
  measured_on: string;
  source: 'manual';
}
export interface AssignableMember {
  id: string;
  display_name: string;
  active: boolean;
}
export interface TeamRow {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'manager' | 'seller' | 'reception';
  active: boolean;
  row_version: number;
}
export interface CampaignTotals {
  company_id: string;
  campaign_id: string;
  ambassador_id: string;
  ambassador_name: string;
  category: string;
  commission_enabled: boolean;
  indicated_count: number;
  attended_count: number;
  paid_count: number;
  eligible_cents: number;
  points: number;
  amount_cents: number;
  paid_cents: number;
  paid_points: number;
  balance_cents: number;
  remaining_points: number;
  settled: boolean;
}
export interface CardActivity {
  company_id: string;
  opportunity_id: string;
  contact_id: string;
  board_id: string;
  stage_id: string;
  title: string;
  value_cents: number;
  created_at: string;
  follow_up_at: string | null;
  is_closed: boolean;
  contact_name: string;
  phone: string;
  owner_membership_id: string;
  owner_name: string;
  board_name: string;
  stage_name: string;
  first_activity_at: string | null;
  last_activity_at: string | null;
  days_without_activity: number;
  hours_without_activity: number;
  alerts_enabled: true;
  first_response_hours: 24;
  idle_days_threshold: 3;
  escalation_days_threshold: 7;
}
export interface WorkspaceMetrics {
  contacts: number;
  hot_contacts: number;
  open_cards: number;
  estimated_pipeline_cents: number;
  pending_tasks: number;
  overdue_tasks: number;
  contacts_by_day: { day: string; count: number }[];
  cards_by_stage: { board_id: string; stage_id: string; count: number; estimated_cents: number }[];
  cards_by_strategy: { strategy_id: string | null; count: number; estimated_cents: number }[];
}
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
export interface Resources {
  contacts: ContactRow;
  boards: BoardRow;
  stages: StageRow;
  cards: CardRow;
  catalog: CatalogRow;
  labels: LabelRow;
  strategies: StrategyRow;
  ambassadors: AmbassadorRow;
  campaigns: CampaignRow;
  referrals: ReferralRow;
  tasks: TaskRow;
  metrics: MetricRow;
}
const tables: Record<keyof Resources, string> = {
  contacts: 'crm_contacts',
  boards: 'crm_boards',
  stages: 'crm_stages',
  cards: 'crm_opportunities',
  catalog: 'crm_catalog_items',
  labels: 'crm_labels',
  strategies: 'crm_strategies',
  ambassadors: 'crm_ambassadors',
  campaigns: 'crm_ambassador_campaigns',
  referrals: 'crm_ambassador_referrals',
  tasks: 'crm_tasks',
  metrics: 'crm_ambassador_metrics',
};
const managedColumns = {
  catalog: ['kind', 'name', 'description', 'value_cents', 'active'],
  labels: ['name', 'color', 'active'],
  strategies: [
    'name',
    'month',
    'channel',
    'status',
    'budget_cents',
    'owner_membership_id',
    'notes',
    'active',
  ],
  ambassadors: [
    'contact_id',
    'category',
    'benefits',
    'commission_enabled',
    'active',
    'referral_code',
  ],
  campaigns: ['name', 'starts_on', 'ends_on', 'payment_mode', 'rate_cents', 'rate_bps'],
  metrics: ['ambassador_id', 'name', 'value', 'unit', 'measured_on'],
} as const;
type Managed = keyof typeof managedColumns;
type ManagedInput<K extends Managed> = Partial<
  Pick<Resources[K], Extract<(typeof managedColumns)[K][number], keyof Resources[K]>>
>;
export type ContactInput = Partial<
  Pick<
    ContactRow,
    'name' | 'phone' | 'email' | 'temperature' | 'interests' | 'notes' | 'owner_membership_id'
  >
> & { catalog_ids?: string[] };
export type CardInput = Partial<
  Pick<
    CardRow,
    | 'contact_id'
    | 'owner_membership_id'
    | 'board_id'
    | 'stage_id'
    | 'title'
    | 'value_cents'
    | 'source'
    | 'strategy_id'
    | 'follow_up_at'
    | 'is_closed'
  >
> & { label_ids?: string[]; catalog_ids?: string[] };
export type TaskInput = Partial<
  Pick<
    TaskRow,
    'owner_membership_id' | 'contact_id' | 'opportunity_id' | 'title' | 'due_date' | 'status'
  >
>;
export type BackendErrorKind = 'access' | 'validation' | 'conflict' | 'missing' | 'transport';
export class BackendError extends Error {
  constructor(
    message: string,
    public code: string,
    public kind: BackendErrorKind,
    public resultUncertain = false,
  ) {
    super(message);
    this.name = 'BackendError';
  }
}
function failure(
  error: { code?: string; message?: string } | null,
  mutation = false,
): BackendError {
  const raw = error?.code || '';
  const code = /^CRM_[A-Z_]+$/.test(error?.message || '')
    ? error!.message!
    : raw || 'TRANSPORT_ERROR';
  if (code === 'CRM_CARD_HAS_REFERRALS')
    return new BackendError(
      'Este card possui uma venda indicada vinculada. Encerre o card para preservar o registro financeiro.',
      code,
      'validation',
    );
  if (code === 'CRM_PERMISSION_REQUIRES_VIEW')
    return new BackendError(
      'Ative também as permissões de visualização necessárias para estas ações.',
      code,
      'validation',
    );
  if (['42501', 'PGRST301', 'PGRST302'].includes(raw))
    return new BackendError('Seu acesso precisa ser verificado novamente.', code, 'access');
  if (raw === '40001')
    return new BackendError(
      'O registro mudou. Atualize os dados antes de salvar novamente.',
      code,
      'conflict',
    );
  if (raw === '23505')
    return new BackendError(
      'Já existe um registro ou uma confirmação para esta solicitação. Confira os dados atuais.',
      code,
      'conflict',
    );
  if (raw === 'P0002' || raw === 'PGRST116')
    return new BackendError('O registro não está disponível para o seu acesso.', code, 'missing');
  if (raw.startsWith('22') || ['23514', '23502', '23503'].includes(raw))
    return new BackendError('Confira os campos e os vínculos selecionados.', code, 'validation');
  return new BackendError(
    mutation
      ? 'Não foi possível confirmar o resultado. Confira o registro e repita usando a mesma solicitação quando aplicável.'
      : 'Não foi possível consultar os dados. Tente novamente.',
    code,
    'transport',
    mutation,
  );
}
function uuid(value: string) {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value))
    throw new BackendError(
      'O registro não pertence ao ambiente autenticado.',
      'INVALID_IDENTIFIER',
      'validation',
    );
  return value;
}
function version(value?: number) {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new BackendError('Atualize o registro antes de editar.', 'VERSION_REQUIRED', 'conflict');
  return value!;
}
function integer(value: unknown) {
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isSafeInteger(number))
    throw new BackendError(
      'O valor retornado precisa de conferência.',
      'INVALID_SERVER_AMOUNT',
      'validation',
    );
  return number;
}

/** Contrato assíncrono do ambiente real. Não lê nem grava BrowserRepository/localStorage. */
export class OperationalBackend {
  readonly companyId: string;
  constructor(
    private client: SupabaseClient,
    companyId: string,
  ) {
    this.companyId = uuid(companyId);
  }
  private async rpc<T>(name: string, args: Record<string, unknown>, mutation = false): Promise<T> {
    let result;
    try {
      result = await this.client.rpc(name, { ...args, p_company: this.companyId });
    } catch {
      throw failure(null, mutation);
    }
    if (result.error) throw failure(result.error, mutation);
    if (result.data === null || result.data === undefined) throw failure(null, mutation);
    return result.data as T;
  }
  async list<K extends keyof Resources>(
    resource: K,
    page = 0,
    pageSize = 50,
    filters: Partial<Record<keyof Resources[K], string | boolean | null>> = {},
    search = '',
    createdBetween?: { from: string; until: string },
  ): Promise<Page<Resources[K]>> {
    if (
      !tables[resource] ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 100000 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 200
    )
      throw new BackendError('Confira a paginação.', 'INVALID_PAGE', 'validation');
    let query = this.client
      .from(tables[resource])
      .select('*', { count: 'exact' })
      .eq('company_id', this.companyId);
    const allowed = [
      'id',
      'board_id',
      'stage_id',
      'contact_id',
      'campaign_id',
      'ambassador_id',
      'opportunity_id',
      'owner_membership_id',
      'active',
      'status',
      'is_closed',
    ];
    for (const [column, value] of Object.entries(filters)) {
      if (!allowed.includes(column))
        throw new BackendError('Filtro inválido.', 'INVALID_FILTER', 'validation');
      if (value !== null && (column === 'id' || column.endsWith('_id'))) {
        if (typeof value !== 'string')
          throw new BackendError('Identificador inválido.', 'INVALID_IDENTIFIER', 'validation');
        uuid(value);
      }
      query = value === null ? query.is(column, null) : query.eq(column, value);
    }
    if (createdBetween) {
      if (
        resource !== 'cards' ||
        ![createdBetween.from, createdBetween.until].every(
          (value) => !Number.isNaN(Date.parse(value)) && /T\d{2}:\d{2}:\d{2}/.test(value),
        ) ||
        Date.parse(createdBetween.from) >= Date.parse(createdBetween.until)
      ) throw new BackendError('Confira o período selecionado.', 'INVALID_FILTER', 'validation');
      query = query.gte('created_at', createdBetween.from).lt('created_at', createdBetween.until);
    }
    if (search.trim()) {
      const column =
        resource === 'contacts' && /^[+\d\s().-]+$/.test(search)
          ? 'phone'
          : resource === 'cards' || resource === 'tasks'
            ? 'title'
            : 'name';
      if (
        !['contacts', 'cards', 'tasks', 'catalog', 'labels', 'strategies', 'campaigns'].includes(
          resource,
        )
      )
        throw new BackendError('Busca inválida.', 'INVALID_FILTER', 'validation');
      const term = column === 'phone' ? search.replace(/\D/g, '') : search.trim().slice(0, 100);
      query = query.ilike(column, `%${term.replace(/[\\%_]/g, '\\$&')}%`);
    }
    const result = await query.order('id').range(page * pageSize, page * pageSize + pageSize - 1);
    if (result.error || result.count === null || !result.data) throw failure(result.error);
    return {
      rows: result.data as unknown as Resources[K][],
      total: result.count,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < result.count,
    };
  }
  async get<K extends keyof Resources>(resource: K, id: string): Promise<Resources[K]> {
    const page = await this.list(resource, 0, 1, { id: uuid(id) } as Partial<
      Record<keyof Resources[K], string>
    >);
    if (!page.rows[0])
      throw new BackendError(
        'O registro não está disponível para o seu acesso.',
        'NOT_FOUND',
        'missing',
      );
    return page.rows[0];
  }
  /** Fetch all matching rows in bounded pages, rather than silently capping at 200. */
  async listAllMatching<K extends keyof Resources>(
    resource: K,
    filters: Partial<Record<keyof Resources[K], string | boolean | null>> = {},
    search = '',
    createdBetween?: { from: string; until: string },
  ): Promise<{ rows: Resources[K][]; total: number }> {
    const rows: Resources[K][] = [];
    for (let page = 0; ; page++) {
      const result = await this.list(resource, page, 200, filters, search, createdBetween);
      rows.push(...result.rows);
      if (!result.hasMore) return { rows, total: rows.length };
    }
  }

  async all<K extends keyof Resources>(resource: K): Promise<Resources[K][]> {
    const rows: Resources[K][] = [];
    for (let page = 0; ; page++) {
      const result = await this.list(resource, page, 200);
      rows.push(...result.rows);
      if (!result.hasMore) return rows;
    }
  }
  async contactsByIds(ids: string[]): Promise<ContactRow[]> {
    const keys = [...new Set(ids)].map(uuid),
      rows: ContactRow[] = [];
    for (let from = 0; from < keys.length; from += 100) {
      const result = await this.client
        .from('crm_contacts')
        .select('*')
        .eq('company_id', this.companyId)
        .in('id', keys.slice(from, from + 100));
      if (result.error || !result.data) throw failure(result.error);
      rows.push(...(result.data as ContactRow[]));
    }
    return rows;
  }
  async activityByIds(ids: string[]): Promise<CardActivity[]> {
    const keys = [...new Set(ids)].map(uuid);
    const rows: CardActivity[] = [];
    for (let offset = 0; offset < keys.length; offset += 100) {
      const result = await this.client
        .from('crm_card_activity')
        .select('*')
        .eq('company_id', this.companyId)
        .in('opportunity_id', keys.slice(offset, offset + 100));
      if (result.error || !result.data) throw failure(result.error);
      rows.push(...(result.data as CardActivity[]));
    }
    return rows;
  }
  async labelsByCardIds(ids: string[]): Promise<{ opportunity_id: string; label_id: string }[]> {
    const keys = [...new Set(ids)].map(uuid);
    const rows: { opportunity_id: string; label_id: string }[] = [];
    for (let offset = 0; offset < keys.length; offset += 100) {
      const result = await this.client
        .from('crm_card_labels')
        .select('opportunity_id,label_id')
        .eq('company_id', this.companyId)
        .in('opportunity_id', keys.slice(offset, offset + 100));
      if (result.error || !result.data) throw failure(result.error);
      rows.push(...result.data);
    }
    return rows;
  }
  async contactDetails(id: string) {
    const contact = await this.get('contacts', id);
    const items = await this.client
      .from('crm_contact_catalog')
      .select('catalog_id')
      .eq('company_id', this.companyId)
      .eq('contact_id', uuid(id));
    if (items.error || !items.data) throw failure(items.error);
    return { ...contact, catalog_ids: items.data.map((r) => r.catalog_id) };
  }
  async create<K extends Managed>(resource: K, input: ManagedInput<K>): Promise<Resources[K]> {
    return this.write(resource, input);
  }
  async patch<K extends Managed>(
    resource: K,
    id: string,
    input: ManagedInput<K>,
    expectedVersion?: number,
  ): Promise<Resources[K]> {
    return this.write(
      resource,
      input,
      uuid(id),
      resource === 'campaigns' ? version(expectedVersion) : undefined,
    );
  }
  private async write<K extends Managed>(
    resource: K,
    input: ManagedInput<K>,
    id?: string,
    expectedVersion?: number,
  ): Promise<Resources[K]> {
    const columns = managedColumns[resource] as readonly string[];
    if (
      !columns ||
      !Object.keys(input).length ||
      Object.keys(input).some((key) => !columns.includes(key)) ||
      (id && resource === 'ambassadors' && 'contact_id' in input)
    )
      throw new BackendError('Confira os campos alterados.', 'INVALID_FIELDS', 'validation');
    const values: Record<string, unknown> = { ...input };
    let query = id
      ? this.client
          .from(tables[resource])
          .update(values)
          .eq('company_id', this.companyId)
          .eq('id', id)
      : this.client.from(tables[resource]).insert({ ...values, company_id: this.companyId });
    if (expectedVersion !== undefined) query = query.eq('row_version', expectedVersion);
    let result;
    try {
      result = await query.select('*').single();
    } catch {
      throw failure(null, true);
    }
    if (expectedVersion !== undefined && result.error?.code === 'PGRST116')
      throw new BackendError(
        'A campanha mudou. Atualize os dados antes de salvar novamente.',
        'STALE_VERSION',
        'conflict',
      );
    if (result.error || !result.data) throw failure(result.error, true);
    return result.data as unknown as Resources[K];
  }
  createBoard(name: string) {
    return this.rpc<BoardRow>('crm_create_board', { p_name: name }, true);
  }
  configureBoard(
    boardId: string,
    name: string,
    stages: { id: string; name: string }[],
    expectedVersion: number,
  ) {
    return this.rpc<BoardRow>(
      'crm_configure_board',
      {
        p_board: uuid(boardId),
        p_name: name,
        p_stages: stages.map((s) => ({ id: uuid(s.id), name: s.name })),
        p_expected_version: version(expectedVersion),
      },
      true,
    );
  }
  saveContact(input: ContactInput, id?: string, expectedVersion?: number) {
    return this.rpc<ContactRow>(
      'crm_save_contact',
      {
        p_contact: id ? uuid(id) : null,
        p_values: input,
        p_expected_version: id ? version(expectedVersion) : null,
      },
      true,
    );
  }
  saveCard(input: CardInput, id?: string, expectedVersion?: number) {
    return this.rpc<CardRow>(
      'crm_save_card',
      {
        p_card: id ? uuid(id) : null,
        p_values: input,
        p_expected_version: id ? version(expectedVersion) : null,
      },
      true,
    );
  }
  confirmCardSale(id: string, stage: string, expectedVersion: number, amountCents: number) {
    return this.rpc<CardRow>(
      'crm_confirm_card_sale',
      {p_card:uuid(id),p_stage:uuid(stage),p_expected_version:version(expectedVersion),p_amount_cents:amountCents},
      true
    );
  }
  async confirmedSales(month: string):Promise<{membership_id:string;value_cents:number}[]>{
    const first=month+'-01', end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10);
    const result=await this.client.from('crm_confirmed_sales').select('membership_id,value_cents')
      .eq('company_id',this.companyId).gte('confirmed_at',first+'T00:00:00Z')
      .lt('confirmed_at',end+'T00:00:00Z').is('reversed_at',null);
    if(result.error)throw failure(result.error);
    return result.data as {membership_id:string;value_cents:number}[];
  }
  saveTask(input: TaskInput, id?: string, expectedVersion?: number) {
    return this.rpc<TaskRow>(
      'crm_save_task',
      {
        p_task: id ? uuid(id) : null,
        p_values: input,
        p_expected_version: id ? version(expectedVersion) : null,
      },
      true,
    );
  }
  async cardDetails(cardId: string) {
    const card = uuid(cardId);
    const results = await Promise.all([
      this.client
        .from('crm_opportunities')
        .select('*')
        .eq('company_id', this.companyId)
        .eq('id', card)
        .single(),
      this.client
        .from('crm_card_labels')
        .select('label_id')
        .eq('company_id', this.companyId)
        .eq('opportunity_id', card),
      this.client
        .from('crm_card_catalog')
        .select('catalog_id')
        .eq('company_id', this.companyId)
        .eq('opportunity_id', card),
    ]);
    const error = results.find((r) => r.error)?.error;
    if (error) throw failure(error);
    if (!results[0].data)
      throw new BackendError('O card não está disponível.', 'NOT_FOUND', 'missing');
    return {
      ...results[0].data,
      label_ids: (results[1].data || []).map((r) => r.label_id),
      catalog_ids: (results[2].data || []).map((r) => r.catalog_id),
    } as CardRow;
  }
  async recordCardNote(contactId: string, cardId: string, body: string) {
    const result = await this.client
      .from('crm_contact_history')
      .insert({
        company_id: this.companyId,
        contact_id: uuid(contactId),
        opportunity_id: uuid(cardId),
        kind: 'note',
        title: 'Anotação de atendimento',
        body,
      })
      .select('id,occurred_at,actor_name')
      .single();
    if (result.error || !result.data) throw failure(result.error, true);
    return result.data;
  }
  async recordCardWhatsapp(contactId: string, cardId: string) {
    const result = await this.client
      .from('crm_contact_history')
      .insert({
        company_id: this.companyId,
        contact_id: uuid(contactId),
        opportunity_id: uuid(cardId),
        kind: 'whatsapp_opened',
        title: 'WhatsApp acionado',
      })
      .select('id,occurred_at')
      .single();
    if (result.error || !result.data) throw failure(result.error, true);
    return result.data;
  }
  async cardActivity(page = 0, pageSize = 50, managerReport = false): Promise<Page<CardActivity>> {
    if (
      !Number.isInteger(page) ||
      page < 0 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 200
    )
      throw new BackendError('Confira a paginação.', 'INVALID_PAGE', 'validation');
    const result = await this.client
      .from(managerReport ? 'crm_card_idle_report' : 'crm_card_activity')
      .select('*', { count: 'exact' })
      .eq('company_id', this.companyId)
      .order('days_without_activity', { ascending: false })
      .order('opportunity_id')
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (result.error || result.count === null || !result.data) throw failure(result.error);
    return {
      rows: result.data as unknown as CardActivity[],
      total: result.count,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < result.count,
    };
  }
  saveReferral(input: {
    campaignId: string;
    ambassadorId: string;
    cardId: string;
    valueCents: number;
    soldOn: string;
    paid: boolean;
    attended: boolean;
    catalogIds: string[];
    requestId: string;
    id?: string;
    expectedVersion?: number;
  }) {
    return this.rpc<ReferralRow>(
      'crm_save_referral',
      {
        p_referral: input.id ? uuid(input.id) : null,
        p_campaign: uuid(input.campaignId),
        p_ambassador: uuid(input.ambassadorId),
        p_opportunity: uuid(input.cardId),
        p_values: {
          value_cents: integer(input.valueCents),
          sold_on: input.soldOn,
          paid: input.paid,
          attended: input.attended,
          catalog_ids: input.catalogIds.map(uuid),
        },
        p_request_id: uuid(input.requestId),
        p_expected_version: input.id ? version(input.expectedVersion) : null,
      },
      true,
    );
  }
  async referralDetails(id: string) {
    const row = await this.get('referrals', id);
    const items = await this.client
      .from('crm_referral_catalog')
      .select('catalog_id')
      .eq('company_id', this.companyId)
      .eq('referral_id', uuid(id));
    if (items.error || !items.data) throw failure(items.error);
    return { ...row, catalog_ids: items.data.map((r) => r.catalog_id) };
  }
  async campaignPayments(campaignId: string) {
    const rows: {
      id: string;
      ambassador_id: string;
      ambassador_name: string;
      amount_cents: number;
      points: number;
      paid_at: string;
      note: string;
    }[] = [];
    for (let offset = 0; ; offset += 200) {
      const result = await this.client
        .from('crm_campaign_payments')
        .select('id,ambassador_id,ambassador_name,amount_cents,points,paid_at,note')
        .eq('company_id', this.companyId)
        .eq('campaign_id', uuid(campaignId))
        .order('id')
        .range(offset, offset + 199);
      if (result.error || !result.data) throw failure(result.error);
      rows.push(
        ...result.data.map((row) => ({
          ...row,
          amount_cents: integer(row.amount_cents),
          points: integer(row.points),
        })),
      );
      if (result.data.length < 200) return rows;
    }
  }
  closeCampaign(id: string, expectedVersion: number, requestId: string, confirmPending = false) {
    return this.rpc<CampaignRow>(
      'crm_close_campaign',
      {
        p_campaign: uuid(id),
        p_expected_version: version(expectedVersion),
        p_request_id: uuid(requestId),
        p_confirm_pending: confirmPending,
      },
      true,
    );
  }
  async campaignTotals(campaignId: string): Promise<CampaignTotals[]> {
    const rows: CampaignTotals[] = [];
    for (let offset = 0; ; offset += 200) {
      const result = await this.client
        .from('crm_ambassador_campaign_totals')
        .select('*')
        .eq('company_id', this.companyId)
        .eq('campaign_id', uuid(campaignId))
        .order('ambassador_id')
        .range(offset, offset + 199);
      if (result.error || !result.data) throw failure(result.error);
      rows.push(
        ...result.data.map((raw) => {
          const row = { ...raw };
          for (const key of [
            'indicated_count',
            'attended_count',
            'paid_count',
            'eligible_cents',
            'points',
            'amount_cents',
            'paid_cents',
            'paid_points',
            'balance_cents',
            'remaining_points',
          ])
            row[key] = integer(row[key]);
          return row as CampaignTotals;
        }),
      );
      if (result.data.length < 200) return rows;
    }
  }
  recordCampaignPayment(
    campaignId: string,
    ambassadorId: string,
    expectedAmountCents: number,
    requestId: string,
    note = '',
  ) {
    return this.rpc<{ id: string; points: number; amount_cents: number; paid_at: string }>(
      'crm_record_campaign_payment',
      {
        p_campaign: uuid(campaignId),
        p_ambassador: uuid(ambassadorId),
        p_expected_amount_cents: integer(expectedAmountCents),
        p_request_id: uuid(requestId),
        p_note: note,
      },
      true,
    );
  }
  adjustReferral(
    id: string,
    expectedVersion: number,
    refundedCents: number,
    cancelled: boolean,
    reason: string,
    requestId: string,
  ) {
    return this.rpc<ReferralRow>(
      'crm_adjust_referral',
      {
        p_referral: uuid(id),
        p_expected_version: version(expectedVersion),
        p_refunded_cents: integer(refundedCents),
        p_cancelled: cancelled,
        p_reason: reason,
        p_request_id: uuid(requestId),
      },
      true,
    );
  }
  assignableMembers(resource: 'cards' | 'contacts' | 'tasks' | 'strategies', operation: 'create' | 'edit') {
    return this.rpc<AssignableMember[]>('crm_assignable_members', { p_resource: resource, p_operation: operation });
  }
  team() {
    return this.rpc<TeamRow[]>('crm_team_members', {});
  }
  private async teamCommand<T>(
    endpoint: string,
    body: Record<string, unknown>,
    requestId: string,
  ): Promise<T> {
    let result;
    try {
      result = await this.client.functions.invoke(endpoint, {
        body: { ...body, company_id: this.companyId },
        headers: { 'Idempotency-Key': uuid(requestId) },
      });
    } catch {
      throw failure(null, true);
    }
    if (result.error) {
      let code = '';
      const response = result.error.context;
      if (response instanceof Response) {
        try {
          code = (await response.clone().json()).error?.code || '';
        } catch {
          /* controlled envelope only */
        }
      }
      if (['UNAUTHENTICATED', 'LEGAL_REQUIRED', 'FORBIDDEN'].includes(code))
        throw new BackendError('Seu acesso precisa ser verificado novamente.', code, 'access');
      if (code === 'INVALID_INPUT')
        throw new BackendError(
          'Confira os campos, o e-mail e a senha inicial (12 caracteres a 72 bytes).',
          code,
          'validation',
        );
      if (code === 'RATE_LIMITED')
        throw new BackendError(
          'Aguarde alguns minutos antes de tentar novamente.',
          code,
          'validation',
        );
      throw new BackendError(
        'Não foi possível confirmar a operação. Confira o cadastro e o acesso antes de iniciar outra solicitação.',
        code || 'COMMAND_UNCONFIRMED',
        'transport',
        true,
      );
    }
    if (!result.data?.data) throw failure(null, true);
    return result.data.data as T;
  }
  employeePermissions(id?: string) {
    return this.rpc<EmployeePermissions>('crm_employee_permissions', {
      p_membership: id ? uuid(id) : null,
    });
  }
  saveEmployeePermissions(id: string, value: EmployeePermissions) {
    return this.rpc<EmployeePermissions>(
      'crm_set_employee_permissions',
      {
        p_membership: uuid(id),
        p_keys: value.keys,
        p_scope: value.scope,
        p_expected_version: value.version,
      },
      true,
    );
  }
  deleteCard(id: string, expectedVersion: number) {
    return this.rpc<void>(
      'crm_delete_card',
      { p_card: uuid(id), p_expected_version: version(expectedVersion) },
      true,
    );
  }
  createMember(
    input: { display_name: string; email: string; password: string; role: 'seller' | 'reception' },
    requestId: string,
  ) {
    return this.teamCommand<{ user_id: string; membership_id: string }>(
      'crm-create-user',
      input,
      requestId,
    );
  }
  resetMember(userId: string, password: string, requestId: string) {
    return this.teamCommand<{ password_changed: boolean }>(
      'crm-reset-password',
      { user_id: uuid(userId), password },
      requestId,
    );
  }
  updateMember(
    id: string,
    expectedVersion: number,
    values: { display_name?: string; role?: 'seller' | 'reception'; active?: boolean },
    reassignTo?: string,
  ) {
    return this.rpc<Omit<TeamRow, 'display_name' | 'email'>>(
      'crm_update_team_member',
      {
        p_membership: uuid(id),
        p_values: values,
        p_reassign_to: reassignTo ? uuid(reassignTo) : null,
        p_expected_version: version(expectedVersion),
      },
      true,
    );
  }
  async goalPlan(month: string): Promise<GoalPlan | null> {
    const result=await this.client.from('crm_goal_plans').select('*')
      .eq('company_id',this.companyId).eq('goal_month',month).maybeSingle();
    if(result.error) throw failure(result.error);
    return result.data as GoalPlan | null;
  }
  async goalEmployeeProgress(month: string):Promise<GoalEmployeeProgress[]> {
    const result=await this.client.from('crm_goal_employee_progress').select('*')
      .eq('company_id',this.companyId).eq('goal_month',month)
      .order('membership_id');
    if(result.error||!result.data)throw failure(result.error);
    return result.data as GoalEmployeeProgress[];
  }
  async saveGoalPlan(input:Omit<GoalPlan,'company_id'>):Promise<void> {
    const result=await this.client.from('crm_goal_plans').upsert(
      {...input,company_id:this.companyId},{onConflict:'company_id,goal_month'});
    if(result.error)throw failure(result.error,true);
  }
  async saveGoalEmployeeProgress(input:Omit<GoalEmployeeProgress,'company_id'>):Promise<void> {
    uuid(input.membership_id);
    const result=await this.client.from('crm_goal_employee_progress').upsert(
      {...input,company_id:this.companyId},{onConflict:'company_id,goal_month,membership_id'});
    if(result.error)throw failure(result.error,true);
  }
  metrics(from: string, to: string) {
    return this.rpc<WorkspaceMetrics>('crm_workspace_metrics', { p_from: from, p_to: to });
  }
  async company() {
    const result = await this.client
      .from('crm_companies')
      .select('id,name,display_name,theme,logo_path,row_version')
      .eq('id', this.companyId)
      .single();
    if (result.error || !result.data) throw failure(result.error);
    return result.data;
  }
  updateBrand(
    expectedVersion: number,
    values: { display_name?: string | null; theme?: string; logo_path?: string | null },
  ) {
    return this.rpc<Record<string, unknown>>(
      'crm_update_company_brand',
      { p_values: values, p_expected_version: version(expectedVersion) },
      true,
    );
  }
  async uploadLogo(file: Blob) {
    const extensions: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    if (!extensions[file.type] || file.size > 2097152)
      throw new BackendError('Use PNG, JPG ou WebP de até 2 MB.', 'INVALID_LOGO', 'validation');
    const path = `${this.companyId}/${uid()}.${extensions[file.type]}`;
    const result = await this.client.storage
      .from('crm-company-logos')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (result.error) throw failure(result.error, true);
    return path;
  }
  async downloadLogo(path: string) {
    if (!path.startsWith(this.companyId + '/'))
      throw new BackendError('Arquivo não disponível.', 'INVALID_LOGO', 'validation');
    const result = await this.client.storage.from('crm-company-logos').download(path);
    if (result.error || !result.data) throw failure(result.error);
    return result.data;
  }
}
