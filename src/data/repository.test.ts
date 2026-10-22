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
