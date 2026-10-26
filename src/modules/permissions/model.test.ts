import { describe, it, expect } from 'vitest';
import {
  allPermissionKeys,
  togglePermissions,
  legacyPermissions,
  permissionModules,
  resourceKeys,
} from './model';
describe('árvore de permissões', () => {
  it('todos de Cards não marca exclusão de etapas nem administração', () => {
    const keys = togglePermissions([], resourceKeys(permissionModules[0].resources[0]), true);
    expect(keys).toContain('cards.delete');
    expect(keys).not.toContain('stages.delete');
    expect(keys).not.toContain('team.manage');
    expect(keys).toContain('contacts.view');
  });
  it('criação e edição são independentes; dependências ficam consistentes', () => {
    const keys = togglePermissions([], ['cards.create'], true);
    expect(keys).toContain('cards.view');
    expect(keys).toContain('boards.view');
    expect(keys).toContain('contacts.view');
    expect(keys).not.toContain('cards.edit');
    expect(togglePermissions(keys, ['contacts.view'], false)).not.toContain('cards.create');
  });
  it('ativar e desativar todas é determinístico', () => {
    expect(togglePermissions([], allPermissionKeys, true)).toEqual(allPermissionKeys);
    expect(togglePermissions(allPermissionKeys, allPermissionKeys, false)).toEqual([]);
    expect(new Set(allPermissionKeys).size).toBe(allPermissionKeys.length);
  });
  it('preserva carteiras e direitos existentes antes da primeira personalização', () => {
    expect(legacyPermissions('manager').scope).toBe('company');
    expect(legacyPermissions('seller').scope).toBe('own');
    expect(legacyPermissions('reception').keys).not.toContain('cards.edit');
  });
});
