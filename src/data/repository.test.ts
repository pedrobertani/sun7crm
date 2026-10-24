import { describe, it, expect } from 'vitest';
import { BrowserRepository } from './repository';
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    length: 0,
    key: (i) => [...map.keys()][i] || null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
}
describe('persistência local', () => {
  it('adiciona estratégias e embaixadores sem apagar uma demo salva na versão anterior', () => {
    const storage = memoryStorage();
    const previous = new BrowserRepository(storage).read();
    previous.contacts[0].name = 'Nome preservado';
    const legacy = { ...previous } as Partial<typeof previous>;
    delete legacy.strategies;
    delete legacy.ambassadors;
    delete legacy.ambassadorSales;
    storage.setItem('sun7crm:prototype:v1', JSON.stringify(legacy));
    const migrated = new BrowserRepository(storage).read();
    expect(migrated.contacts[0].name).toBe('Nome preservado');
    expect(migrated.strategies.some((s) => s.companyId === previous.companies[0].id)).toBe(true);
    expect(migrated.ambassadors.length).toBeGreaterThan(0);
    migrated.strategies = [];
    migrated.ambassadors = [];
    migrated.ambassadorSales = [];
    new BrowserRepository(storage).write(migrated);
    expect(new BrowserRepository(storage).read().strategies).toEqual([]);
    expect(new BrowserRepository(storage).read().ambassadors).toEqual([]);
  });
  it('persiste alterações ao abrir uma nova instância', () => {
    const storage = memoryStorage(),
      r = new BrowserRepository(storage),
      data = r.read();
    data.contacts[0].name = 'Contato editado';
    r.write(data);
    expect(new BrowserRepository(storage).read().contacts[0].name).toBe('Contato editado');
  });
  it('recupera dados fictícios quando o conteúdo está corrompido', () => {
    const storage = memoryStorage();
    storage.setItem('sun7crm:prototype:v1', '{corrompido');
    expect(new BrowserRepository(storage).read().version).toBe(1);
  });
  it('não informa sucesso quando o navegador recusa a gravação', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const r = new BrowserRepository(storage);
    expect(() => r.write(r.read())).toThrow('QuotaExceededError');
  });
});
