import type { CrmTheme } from '../lib/themes';
export type Role = 'admin' | 'manager' | 'seller' | 'reception';
export type Template = 'aesthetic' | 'generic';
export type Temperature = 'unclassified' | 'cold' | 'warm' | 'hot';
export type BoardKind = 'leads' | 'clients';
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
  id: string;
  companyId: string;
  name: string;
  email: string;
  role: Exclude<Role, 'admin'>;
  active: boolean;
}
export interface Contact {
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
export interface Snapshot {
  version: 1;
  companies: Company[];
  members: Member[];
  contacts: Contact[];
  boards: Board[];
  opportunities: Opportunity[];
  tasks: Task[];
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
export interface Ambassador {
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
  value: number;
  date: string;
  cancelled: boolean;
}
export interface Session {
  role: Role;
  companyId: string;
  memberId: string;
}
