import { describe, expect, it } from 'vitest';
import { helpTopics } from './topics';
import { legacyPermissions } from '../../modules/permissions/model';

const ids = (role: 'admin' | 'manager' | 'seller' | 'reception', keys: string[], demo = false) =>
  helpTopics({ role, keys, demo }).map((t) => t.id);

describe('central de ajuda por permissões', () => {
  it('administrador da plataforma só recebe seus fluxos administrativos', () => {
    const names = ids('admin', []);
    expect(names).toContain('companies');
    expect(names).toContain('platform-plans');
    expect(names).not.toContain('contacts');
    expect(names).not.toContain('goals');
  });
  it('gestor com acesso total encontra os fluxos comerciais e de gestão', () => {
    const names = ids('manager', legacyPermissions('manager').keys);
    expect(names).toEqual(expect.arrayContaining([
      'dashboard', 'funnel', 'contacts', 'import', 'export',
      'tasks', 'catalog', 'goals', 'team', 'reports', 'settings', 'plan',
    ]));
  });
  it('recepção sem permissão financeira não vê plano, gestão nem operações não concedidas', () => {
    const names = ids('reception', legacyPermissions('reception').keys);
    expect(names).toContain('contacts');
    expect(names).toContain('tasks');
    expect(names).not.toContain('plan');
    expect(names).not.toContain('team');
    expect(names).not.toContain('goals');
    expect(names).not.toContain('import');
  });
  it('permissões específicas controlam cada tutorial mesmo quando o cargo permanece igual', () => {
    const names = ids('seller', ['cards.view', 'contacts.view', 'contacts.import', 'tasks.view']);
    expect(names).toEqual(['overview', 'funnel', 'contacts', 'import', 'tasks']);
    expect(names).not.toContain('export');
    expect(names).not.toContain('ambassadors');
  });
  it('apontamentos da demo não direcionam para URLs operacionais reais', () => {
    const topics = helpTopics({
      role: 'manager', keys: legacyPermissions('manager').keys, demo: true,
    });
    expect(topics.some((topic) => topic.route?.startsWith('/app'))).toBe(false);
    expect(topics.some((topic) => topic.route?.startsWith('/admin'))).toBe(false);
  });
  it('o escopo próprio é informado sem revelar outras carteiras', () => {
    const topics = helpTopics({ role: 'seller', keys: ['contacts.view'], scope: 'own' });
    expect(topics.find((topic) => topic.id === 'overview')?.steps.join(' ')).toMatch(/carteira é individual/);
  });
});
