export const changeResources = [
  'contacts',
  'cards',
  'tasks',
  'catalog',
  'labels',
  'strategies',
  'growth',
  'settings',
  'team',
  'billing',
  'notifications',
  'access',
] as const;
export type ChangeResource = (typeof changeResources)[number];

const dependencies: Record<string, readonly ChangeResource[]> = {
  '/app': ['contacts', 'cards', 'tasks', 'strategies', 'growth', 'team'],
  '/app/contatos': ['contacts', 'catalog', 'labels', 'team'],
  '/app/funil': ['cards', 'contacts', 'catalog', 'labels', 'strategies', 'team', 'settings'],
  '/app/tarefas': ['tasks', 'contacts', 'cards', 'team'],
  '/app/catalogo': ['catalog'],
  '/app/etiquetas': ['labels'],
  '/app/estrategias': ['strategies', 'team'],
  '/app/embaixadores': ['growth', 'contacts', 'cards', 'catalog', 'team'],
  '/app/relatorios': ['contacts', 'cards', 'team', 'settings'],
  '/app/equipe': ['team'],
  '/app/configuracoes': ['settings'],
};
const connections = new Set<string>();
export function setChangeConnection(scope: string, connected: boolean) {
  if (connected) connections.add(scope);
  else connections.delete(scope);
}
export function hasChangeConnection(group: string) {
  const [kind, id] = group.split(':');
  if (kind === 'workspace') return connections.has(`company:${id}`);
  if (kind === 'billing') return connections.has(`company:${id}`) || connections.has('admin');
  if (kind === 'admin') return connections.has('admin');
  if (kind === 'notifications' || kind === 'access') return connections.has(`user:${id}`);
  return false;
}
export function changeAffects(
  group: string,
  scope: string,
  resources: ReadonlySet<ChangeResource>,
) {
  const [kind, id, page] = group.split(':');
  if (scope === 'admin') return kind === 'admin' || kind === 'billing';
  if (scope.startsWith('user:')) {
    if (id !== scope.slice(5)) return false;
    return kind === 'notifications' || (kind === 'access' && resources.has('access'));
  }
  if (!scope.startsWith('company:') || id !== scope.slice(8)) return false;
  if (kind === 'billing') return resources.has('billing');
  if (kind !== 'workspace') return false;
  if (resources.has('access')) return true;
  return (dependencies[page] || changeResources).some((resource) => resources.has(resource));
}
