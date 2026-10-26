import type { CrmTheme } from '../lib/themes';
export type Role = 'admin' | 'manager' | 'seller' | 'reception';
export type Template = 'aesthetic' | 'generic';
export type Temperature = 'unclassified' | 'cold' | 'warm' | 'hot';
export type BoardKind = 'leads' | 'clients' | 'custom';
export interface Company {
  id: string;
  name: string;
  displayName?: string;
  segment: string;
  template: Template;
  monthlyAmount: number;
  dueDate: string;
  createdAt: string;
  enabled: boolean;
  logo?: string;
  theme?: CrmTheme;
}
export interface Member {
  permissions?: import('../modules/permissions/model').EmployeePermissions;
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Exclude<Role, 'admin'>;
  active: boolean;
}
export interface Contact {
  catalogIds?: string[];
  id: string;
  companyId: string;
  name: string;
  phone: string;
  email: string;
  temperature: Temperature;
  ownerId: string;
  interests: string;
  notes: string;
  createdAt: string;
}
export interface Stage {
  id: string;
  name: string;
}
export interface Board {
  id: string;
  companyId: string;
  kind: BoardKind;
  name?: string;
  stages: Stage[];
}
export interface Opportunity {
  id: string;
  companyId: string;
  contactId: string;
  boardId: string;
  stageId: string;
  value: number;
  source: string;
  title?: string;
  strategyId?: string;
  labelIds?: string[];
  catalogIds?: string[];
  createdAt: string;
}
export interface Task {
  id: string;
  companyId: string;
  title: string;
  contactId: string;
  ownerId: string;
  dueDate: string;
  done: boolean;
  status?: 'todo' | 'in_progress' | 'done';
}
export interface ContactHistoryEvent {
  id: string;
  companyId: string;
  contactId: string;
  actorId?: string;
  actorName: string;
  occurredAt: string;
  kind:
    | 'contact_created'
    | 'contact_updated'
    | 'card_created'
    | 'card_updated'
    | 'card_moved'
    | 'note'
    | 'whatsapp_opened';
  title: string;
  body: string;
  opportunityId?: string;
}
export interface Snapshot {
  contactHistory?: ContactHistoryEvent[];
  version: 1;
  companies: Company[];
  members: Member[];
  contacts: Contact[];
  boards: Board[];
  opportunities: Opportunity[];
  tasks: Task[];
  labels?: Label[];
  catalog?: CatalogItem[];
  ambassadorCampaigns?: AmbassadorCampaign[];
  ambassadorPayments?: AmbassadorPayment[];
  strategies: Strategy[];
  ambassadors: Ambassador[];
  ambassadorSales: AmbassadorSale[];
}
export interface Strategy {
  id: string;
  companyId: string;
  name: string;
  month: string;
  channel: string;
  status: 'planned' | 'active' | 'completed';
  budget: number;
  ownerId: string;
  notes: string;
}
export interface Label {
  id: string;
  companyId: string;
  name: string;
  color: string;
}
export interface CatalogItem {
  id: string;
  companyId: string;
  kind: 'service' | 'product';
  name: string;
  description: string;
  value: number;
  active: boolean;
}
export interface AmbassadorCampaign {
  id: string;
  companyId: string;
  name: string;
  start: string;
  end: string;
  status: 'active' | 'closed';
  paymentMode: 'per_point' | 'percentage';
  rate: number;
  closedAt?: string;
  commissionedAmbassadorIds?: string[];
}
export interface AmbassadorPayment {
  id: string;
  companyId: string;
  campaignId: string;
  ambassadorId: string;
  points: number;
  amount: number;
  paidAt: string;
}
export interface Ambassador {
  category?: string;
  commissionEnabled?: boolean;
  contactId?: string;
  id: string;
  companyId: string;
  name: string;
  commissionRate: number;
  active: boolean;
  reward: string;
}
export interface AmbassadorSale {
  id: string;
  companyId: string;
  ambassadorId: string;
  customer: string;
  campaignId?: string;
  paid?: boolean;
  attended?: boolean;
  refunded?: number;
  value: number;
  date: string;
  cancelled: boolean;
}
export interface Session {
  role: Role;
  companyId: string;
  memberId: string;
}
