import type { Snapshot } from '../domain/types';
import { createSeed } from './seed';
import { marketingSeed } from './marketingSeed';
export interface CrmRepository {
  read(): Snapshot;
  write(data: Snapshot): void;
  reset(): Snapshot;
}
const KEY = 'sun7crm:prototype:v1';
// Adaptador exclusivo de /demo. Páginas oficiais usam seus próprios repositórios Supabase.
export class BrowserRepository implements CrmRepository {
  constructor(private storage: Storage) {}
  read(): Snapshot {
    const raw = this.storage.getItem(KEY);
    if (!raw) return createSeed();
    try {
      const data: unknown = JSON.parse(raw);
      if (!isSnapshot(data)) throw Error('Formato incompatível');
      const examples = marketingSeed(data.companies);
      const defaultGoals=createSeed();
      const demoChampion='aurora-champion';
      const seededShowcase=defaultGoals.opportunities.filter(o=>o.confirmedSaleOwnerId===demoChampion);
      // Migração aditiva: preserva os cadastros locais de versões anteriores.
      return {
        ...data,
        members:[...data.members,...defaultGoals.members.filter(m=>m.id===demoChampion&&!data.members.some(old=>old.id===m.id))],
        contacts:[...data.contacts,...defaultGoals.contacts.filter(c=>c.ownerId===demoChampion&&!data.contacts.some(old=>old.id===c.id))],
        labels:
          data.labels ||
          data.companies.flatMap((c) => [
            { id: c.id + '-cold', companyId: c.id, name: 'Frio', color: '#3b82f6' },
            { id: c.id + '-warm', companyId: c.id, name: 'Morno', color: '#eab308' },
            { id: c.id + '-hot', companyId: c.id, name: 'Quente', color: '#ef4444' },
          ]),
        opportunities: [...data.opportunities.map((o) =>
          o.labelIds
            ? o
            : {
                ...o,
                labelIds: (() => {
                  const t = data.contacts.find((c) => c.id === o.contactId)?.temperature;
                  return ['cold', 'warm', 'hot'].includes(t || '') && !data.labels
                    ? [o.companyId + '-' + t]
                    : [];
                })(),
              },
        ),...seededShowcase.filter(o=>!data.opportunities.some(old=>old.id===o.id))],
        goalPlans:Array.isArray(data.goalPlans)?data.goalPlans:(defaultGoals.goalPlans||[]).filter(p=>data.companies.some(c=>c.id===p.companyId)),
        employeeGoals:[...(Array.isArray(data.employeeGoals)?data.employeeGoals:(defaultGoals.employeeGoals||[]).filter(p=>data.companies.some(c=>c.id===p.companyId))),...(defaultGoals.employeeGoals||[]).filter(p=>p.memberId===demoChampion&&!data.employeeGoals?.some(old=>old.memberId===p.memberId&&old.month===p.month))],
        contactHistory: Array.isArray(data.contactHistory) ? data.contactHistory : [],
        catalog: data.catalog || [],
        ambassadorCampaigns: data.ambassadorCampaigns || [],
        ambassadorPayments: data.ambassadorPayments || [],
        strategies: Array.isArray(data.strategies) ? data.strategies : examples.strategies,
        ambassadors: Array.isArray(data.ambassadors) ? data.ambassadors : examples.ambassadors,
        ambassadorSales: Array.isArray(data.ambassadorSales)
          ? data.ambassadorSales
          : examples.ambassadorSales,
      };
    } catch {
      this.storage.removeItem(KEY);
      return createSeed();
    }
  }
  write(data: Snapshot) {
    this.storage.setItem(KEY, JSON.stringify(data));
  }
  reset() {
    const data = createSeed();
    this.write(data);
    return data;
  }
}
function isSnapshot(x: unknown): x is Snapshot {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  if (d.version !== 1) return false;
  return (
    ['companies', 'members', 'contacts', 'boards', 'opportunities', 'tasks'].every(
      (k) =>
        Array.isArray(d[k]) &&
        (d[k] as unknown[]).every(
          (v) =>
            v !== null && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string',
        ),
    ) && (d.boards as { stages?: unknown }[]).every((b) => Array.isArray(b.stages))
  );
}
