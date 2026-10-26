import type { SupabaseClient } from '@supabase/supabase-js';
import type { Company, Template } from '../../domain/types';
import { CRM_THEMES, type CrmTheme } from '../../lib/themes';
import { requireReadyAdmin } from '../auth/access';
import { passwordValidation } from '../auth/flow';

export interface AdminCompany extends Company {
  managers: { id: string; userId: string; name: string }[];
  userCounts?: { total: number; activeEmployees: number; inactive: number };
  cycleKind?: import('../billing/subscription').CycleKind;
}
export interface CompanyInput {
  name: string;
  segment: string;
  template: Template;
  theme: CrmTheme;
  monthly_amount_cents: number;
  due_date: string;
}
export interface ManagerInput {
  company_id: string;
  role: 'manager';
  display_name: string;
  email: string;
  password: string;
}
export interface CompanyUpdateInput extends CompanyInput {
  company_id: string;
  enabled: boolean;
}
interface CompanyRow {
  id: string;
  name: string;
  display_name: string | null;
  segment: string;
  template: Template;
  theme: CrmTheme;
  enabled: boolean;
  created_at: string;
}
export interface AdminCompanyUser {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'manager' | 'seller' | 'reception';
  active: boolean;
  created_at: string;
  password_change_required: boolean;
  can_reset: boolean;
}
interface PasswordResetInput {
  company_id: string;
  user_id: string;
  password: string;
}
export async function loadAdminCompanyUsers(
  client: SupabaseClient,
  userId: string,
  companyId: string,
) {
  await requireReadyAdmin(client, userId);
  const result = await client.rpc('crm_admin_company_users', { p_company: companyId });
  if (result.error || !Array.isArray(result.data))
    throw result.error || Error('Usuários indisponíveis.');
  return result.data as AdminCompanyUser[];
}
export async function resetAdminCompanyPassword(
  client: SupabaseClient,
  userId: string,
  input: PasswordResetInput,
  operationId: string,
) {
  const invalid = passwordValidation(input.password, input.password);
  if (invalid) throw Error(invalid);
  const result = await invoke<{ password_changed: boolean }>(
    client,
    userId,
    'crm-reset-password',
    input,
    operationId,
  );
  if (result.password_changed !== true) throw commandFailure('MISSING_RESULT');
  return result;
}
interface BillingRow {
  company_id: string;
  monthly_amount_cents: number;
  due_date: string;
  cycle_kind?: import('../billing/subscription').CycleKind;
}
interface ManagerRow {
  id: string;
  company_id: string;
  user_id: string;
  role?: string;
  active?: boolean;
  crm_profiles: { display_name: string } | { display_name: string }[] | null;
}
type Page<T> = { data: T[] | null; error: unknown };
const PAGE_SIZE = 500;

// Paginação explícita: os totais não ficam limitados às primeiras linhas da API.
export async function readAllPages<T>(query: (from: number, to: number) => PromiseLike<Page<T>>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await query(from, from + PAGE_SIZE - 1);
    if (page.error) throw page.error;
    if (!page.data) throw Error('Consulta indisponível.');
    rows.push(...page.data);
    if (page.data.length < PAGE_SIZE) return rows;
  }
}

export function mapPortfolio(
  companies: CompanyRow[],
  billing: BillingRow[],
  managers: ManagerRow[],
): AdminCompany[] {
  const amounts = new Map(billing.map((row) => [row.company_id, row]));
  return companies.map((row) => {
    const bill = amounts.get(row.id);
    if (
      !bill ||
      !Number.isSafeInteger(bill.monthly_amount_cents) ||
      bill.monthly_amount_cents < 0 ||
      !isDate(bill.due_date)
    ) {
      throw Error('Não foi possível carregar a cobrança de todas as empresas. Tente atualizar.');
    }
    const createdAt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(row.created_at));
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name || undefined,
      segment: row.segment,
      template: row.template,
      theme: row.theme,
      enabled: row.enabled,
      createdAt,
      monthlyAmount: bill.monthly_amount_cents,
      dueDate: bill.due_date,
      cycleKind: bill.cycle_kind || 'monthly',
      userCounts: {
        total: managers.filter((m) => m.company_id === row.id).length,
        activeEmployees: managers.filter(
          (m) =>
            m.company_id === row.id && m.role !== undefined && m.role !== 'manager' && m.active,
        ).length,
        inactive: managers.filter((m) => m.company_id === row.id && m.active === false).length,
      },
      managers: managers
        .filter(
          (member) =>
            member.company_id === row.id &&
            (member.role === undefined || member.role === 'manager') &&
            member.active !== false,
        )
        .map((member) => {
          const profile = Array.isArray(member.crm_profiles)
            ? member.crm_profiles[0]
            : member.crm_profiles;
          return { id: member.id, userId: member.user_id, name: profile?.display_name || 'Gestor' };
        }),
    };
  });
}

export async function loadAdminPortfolio(
  client: SupabaseClient,
  userId: string,
  signal?: AbortSignal,
) {
  await requireReadyAdmin(client, userId);
  const [companies, billing, managers] = await Promise.all([
    readAllPages<CompanyRow>((from, to) => {
      const q = client
        .from('crm_companies')
        .select('id,name,display_name,segment,template,theme,enabled,created_at')
        .order('id')
        .range(from, to);
      return signal ? q.abortSignal(signal) : q;
    }),
    readAllPages<BillingRow>((from, to) => {
      const q = client
        .from('crm_company_billing')
        .select('company_id,monthly_amount_cents,due_date,cycle_kind')
        .order('company_id')
        .range(from, to);
      return signal ? q.abortSignal(signal) : q;
    }),
    readAllPages<ManagerRow>((from, to) => {
      const q = client
        .from('crm_memberships')
        .select('id,company_id,user_id,role,active,crm_profiles(display_name)')
        .order('id')
        .range(from, to);
      return signal ? q.abortSignal(signal) : q;
    }),
  ]);
  return mapPortfolio(companies, billing, managers);
}

export function isDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function companyInput(form: {
  name: string;
  segment: string;
  template: Template;
  theme: CrmTheme;
  amount: string;
  dueDate: string;
}): CompanyInput {
  const name = form.name.trim(),
    segment = form.segment.trim();
  const cents = Math.round(Number(form.amount) * 100);
  if (!name || name.length > 160 || !segment || segment.length > 160) {
    throw Error('Informe o nome e o segmento da empresa, com até 160 caracteres.');
  }
  if (
    !/^\d+(\.\d{1,2})?$/.test(form.amount) ||
    !Number.isSafeInteger(cents) ||
    cents > 2_147_483_647
  ) {
    throw Error('Informe um valor mensal válido.');
  }
  if (!isDate(form.dueDate)) throw Error('Informe um vencimento válido.');
  if (
    !['aesthetic', 'generic'].includes(form.template) ||
    !CRM_THEMES.some((t) => t.value === form.theme)
  ) {
    throw Error('Confira o modelo e a cor selecionados.');
  }
  return {
    name,
    segment,
    template: form.template,
    theme: form.theme,
    monthly_amount_cents: cents,
    due_date: form.dueDate,
  };
}

export function managerInput(
  companyId: string,
  name: string,
  email: string,
  password: string,
): ManagerInput {
  const displayName = name.trim(),
    address = email.trim().toLowerCase();
  if (
    !displayName ||
    displayName.length > 160 ||
    address.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
  ) {
    throw Error('Confira o nome e o e-mail do gestor.');
  }
  const invalid = passwordValidation(password, password);
  if (invalid) throw Error(invalid);
  return {
    company_id: companyId,
    role: 'manager',
    display_name: displayName,
    email: address,
    password,
  };
}

export class AdminCommandError extends Error {
  constructor(
    message: string,
    public recovery: 'edit' | 'retry' | 'review' | 'access',
  ) {
    super(message);
  }
}

function commandFailure(code: string, status?: number) {
  if (code === 'AUTH_RESET_UNCONFIRMED')
    return new AdminCommandError(
      'Não foi possível confirmar a redefinição. Confira o acesso antes de tentar novamente.',
      'review',
    );
  if (code === 'BILLING_CHANGED')
    return new AdminCommandError(
      'O plano foi atualizado. Atualize a lista e gerencie o vencimento na aba Planos.',
      'edit',
    );
  if (
    ['UNAUTHENTICATED', 'LEGAL_REQUIRED', 'FORBIDDEN'].includes(code) ||
    status === 401 ||
    status === 403
  ) {
    return new AdminCommandError('Seu acesso precisa ser verificado novamente.', 'access');
  }
  if (code === 'INVALID_INPUT')
    return new AdminCommandError('Confira os dados preenchidos.', 'edit');
  if (code === 'MANAGER_REQUIRED')
    return new AdminCommandError('Cadastre um gestor ativo antes de habilitar a empresa.', 'edit');
  if (code === 'AUTH_CREATE_FAILED' && status === 409) {
    return new AdminCommandError(
      'Não foi possível criar a conta. Confira se o e-mail já está cadastrado.',
      'edit',
    );
  }
  if (code === 'RATE_LIMITED')
    return new AdminCommandError('Aguarde alguns minutos antes de cadastrar novamente.', 'edit');
  if (
    ['PROVISIONING_REVIEW_REQUIRED', 'AUTH_CREATE_FAILED', 'CONFLICT', 'CLEANUP_FAILED'].includes(
      code,
    )
  ) {
    return new AdminCommandError(
      'O resultado deste cadastro precisa ser conferido antes de uma nova tentativa. Atualize a lista e procure o responsável técnico.',
      'review',
    );
  }
  return new AdminCommandError(
    'Não foi possível confirmar o resultado. Repita esta mesma solicitação para conferir o cadastro.',
    'retry',
  );
}

async function invoke<T>(
  client: SupabaseClient,
  userId: string,
  endpoint: string,
  body: CompanyInput | ManagerInput | PasswordResetInput,
  operationId: string,
): Promise<T> {
  await requireReadyAdmin(client, userId);
  const session = await client.auth.getSession();
  if (session.error || !session.data.session || session.data.session.user.id !== userId) {
    throw new AdminCommandError('Entre novamente na sua conta.', 'access');
  }
  let result;
  try {
    result = await client.functions.invoke(endpoint, {
      body,
      headers: {
        Authorization: `Bearer ${session.data.session.access_token}`,
        'Idempotency-Key': operationId,
      },
    });
  } catch {
    throw commandFailure('TRANSPORT_ERROR');
  }
  if (result.error) {
    // Somente o envelope controlado da função. Nunca exibir/logar o corpo enviado.
    const response = result.error.context;
    let code = '';
    if (response instanceof Response) {
      try {
        code = (await response.clone().json()).error?.code || '';
      } catch {
        /* Sem JSON seguro. */
      }
    }
    throw commandFailure(code, response instanceof Response ? response.status : undefined);
  }
  if (!result.data?.data) throw commandFailure('MISSING_RESULT');
  return result.data.data as T;
}

export async function createAdminCompany(
  client: SupabaseClient,
  userId: string,
  input: CompanyInput,
  operationId: string,
) {
  const result = await invoke<{ company_id: string; enabled: boolean }>(
    client,
    userId,
    'crm-create-company',
    input,
    operationId,
  );
  if (typeof result.company_id !== 'string' || !result.company_id)
    throw commandFailure('MISSING_RESULT');
  return result;
}

export async function createAdminManager(
  client: SupabaseClient,
  userId: string,
  input: ManagerInput,
  operationId: string,
) {
  const result = await invoke<{ user_id: string; membership_id: string }>(
    client,
    userId,
    'crm-create-user',
    input,
    operationId,
  );
  if (!result.user_id || !result.membership_id) throw commandFailure('MISSING_RESULT');
  return result;
}

export async function updateAdminCompany(
  client: SupabaseClient,
  userId: string,
  input: CompanyUpdateInput,
  operationId: string,
) {
  const result = await invoke<{ company_id: string; enabled: boolean }>(
    client,
    userId,
    'crm-update-company',
    input,
    operationId,
  );
  if (!result.company_id) throw commandFailure('MISSING_RESULT');
  return result;
}
