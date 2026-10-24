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
      // Migração aditiva: preserva os cadastros locais de versões anteriores.
      return {
        ...data,
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
