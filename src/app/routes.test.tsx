import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { BrowserRepository } from '../data/repository';

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    length: 0,
    key: () => null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}
function page(path: string) {
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Demonstração e sistema oficial', () => {
  it('renderiza o login oficial sem inicializar dados fictícios ou storage da demo', () => {
    const read = vi.spyOn(BrowserRepository.prototype, 'read');
    const html = page('/acessar');
    expect(html).toContain('Acesse sua conta');
    expect(html).toContain('name="email"');
    expect(read).not.toHaveBeenCalled();
    expect(html).not.toContain('Prévia em desenvolvimento');
  });
  it('abre a simulacao juridica sem consultar dados reais e sem habilitar acesso oficial', () => {
    const read = vi.spyOn(BrowserRepository.prototype, 'read');
    const html = page('/teste/primeiro-acesso');
    expect(html).toContain('SIMULAÇÃO DE PRIMEIRO ACESSO');
    expect(html).toContain('SEM VALIDADE DE ACEITE');
    expect(html).toContain('Começar simulação');
    expect(html).not.toContain('crm_legal_acceptances');
    expect(html).not.toContain('Painel de administração');
    expect(read).not.toHaveBeenCalled();
  });
  it('protege rotas oficiais antes de renderizar qualquer painel ou cadastro', () => {
    const read = vi.spyOn(BrowserRepository.prototype, 'read');
    for (const route of [
      '/admin',
      '/admin/empresas',
      '/conta',
      '/app',
      '/app/tarefas',
      '/app/contatos',
    ]) {
      const html = page(route);
      expect(html).toContain('Verificando sua sessão e permissões');
      expect(html).not.toContain('Nova empresa');
      expect(html).not.toContain('Clínica Aurora');
    }
    expect(read).not.toHaveBeenCalled();
  });
  it('mantém a entrada demonstrativa em /demo, com identificação clara', () => {
    vi.stubGlobal('window', { localStorage: storage(), sessionStorage: storage() });
    const html = page('/demo');
    expect(html).toContain('DEMONSTRAÇÃO DO SUN7CRM');
    expect(html).toContain('Empresa de exemplo');
    expect(html).not.toContain('Confirmação individual');
  });
  it('mantém navegação e atalhos do demonstrativo dentro de /demo', () => {
    vi.stubGlobal('window', { localStorage: storage(), sessionStorage: storage() });
    const html = page('/demo/painel');
    expect(html).toContain('Dados fictícios salvos neste navegador');
    expect(html).toContain('href="/demo/contatos');
    expect(html).toContain('href="/demo/configuracoes');
    expect(html).not.toContain('href="/contatos');
    expect(html).not.toContain('href="/admin');
  });
});
