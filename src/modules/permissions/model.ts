export interface PermissionResource {
  id: string;
  label: string;
  actions: readonly string[];
}
export interface PermissionModule {
  id: string;
  label: string;
  resources: PermissionResource[];
}
export const permissionModules: PermissionModule[] = [
  {
    id: 'funnel',
    label: 'Funil',
    resources: [
      { id: 'cards', label: 'Cards', actions: ['view', 'create', 'edit', 'delete'] },
      { id: 'boards', label: 'Funis', actions: ['view', 'create', 'edit'] },
      { id: 'stages', label: 'Etapas', actions: ['create', 'edit', 'reorder', 'delete'] },
    ],
  },
  {
    id: 'contacts',
    label: 'Contatos',
    resources: [
      {
        id: 'contacts',
        label: 'Cadastros',
        actions: ['view', 'create', 'edit', 'import', 'export'],
      },
      { id: 'history', label: 'Histórico', actions: ['view', 'create', 'whatsapp'] },
    ],
  },
  {
    id: 'tasks',
    label: 'Tarefas',
    resources: [{ id: 'tasks', label: 'Tarefas', actions: ['view', 'create', 'edit'] }],
  },
  {
    id: 'catalog',
    label: 'Serviços e produtos',
    resources: [{ id: 'catalog', label: 'Catálogo', actions: ['view', 'create', 'edit'] }],
  },
  {
    id: 'labels',
    label: 'Etiquetas',
    resources: [{ id: 'labels', label: 'Etiquetas', actions: ['view', 'create', 'edit'] }],
  },
  {
    id: 'strategies',
    label: 'Estratégias',
    resources: [{ id: 'strategies', label: 'Estratégias', actions: ['view', 'create', 'edit'] }],
  },
  {
    id: 'ambassadors',
    label: 'Embaixadores',
    resources: [
      { id: 'ambassadors', label: 'Cadastros e métricas', actions: ['view', 'create', 'edit'] },
      { id: 'campaigns', label: 'Campanhas', actions: ['view', 'create', 'edit', 'close', 'pay'] },
      { id: 'referrals', label: 'Vendas indicadas', actions: ['view', 'create', 'edit', 'adjust'] },
    ],
  },
  {
    id: 'management',
    label: 'Gestão',
    resources: [
      { id: 'dashboard', label: 'Dashboard', actions: ['view'] },
      { id: 'reports', label: 'Relatórios', actions: ['view'] },
      { id: 'team', label: 'Funcionários e permissões', actions: ['view', 'manage'] },
      { id: 'settings', label: 'Identidade da empresa', actions: ['view', 'edit'] },
    ],
  },
];
export const actionLabels: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
  reorder: 'Reordenar',
  import: 'Importar',
  export: 'Exportar',
  whatsapp: 'Abrir WhatsApp',
  close: 'Encerrar',
  pay: 'Registrar pagamento',
  adjust: 'Estornar ou cancelar',
  manage: 'Administrar funcionários e permissões',
};
export const allPermissionKeys = permissionModules.flatMap((m) =>
  m.resources.flatMap((r) => r.actions.map((a) => `${r.id}.${a}`)),
);
export interface EmployeePermissions {
  keys: string[];
  scope: 'own' | 'company';
  version: number;
}
export function resourceKeys(r: PermissionResource) {
  return r.actions.map((a) => `${r.id}.${a}`);
}
export const permissionDependencies: Record<string, string[]> = {
  'cards.view': ['contacts.view', 'boards.view'],
  'stages.create': ['boards.view'],
  'stages.edit': ['boards.view'],
  'stages.reorder': ['boards.view'],
  'stages.delete': ['boards.view'],
  'history.view': ['contacts.view'],
  'reports.view': ['contacts.view', 'cards.view', 'history.view', 'boards.view'],
  'ambassadors.view': ['contacts.view'],
  'referrals.view': ['campaigns.view', 'ambassadors.view', 'cards.view'],
};
export function togglePermissions(current: string[], keys: string[], enabled: boolean): string[] {
  const next = new Set(current);
  const dependencies = (key: string) => [
    ...(permissionDependencies[key] || []),
    ...(key.endsWith('.view') || !allPermissionKeys.includes(key.split('.')[0] + '.view')
      ? []
      : [key.split('.')[0] + '.view']),
  ];
  function add(key: string) {
    if (next.has(key)) return;
    next.add(key);
    for (const d of dependencies(key)) add(d);
  }
  if (enabled) for (const key of keys) add(key);
  else {
    for (const key of keys) next.delete(key);
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of [...next])
        if (dependencies(key).some((d) => !next.has(d))) {
          next.delete(key);
          changed = true;
        }
    }
  }
  return allPermissionKeys.filter((k) => next.has(k));
}
export function legacyPermissions(role: string): EmployeePermissions {
  if (role === 'manager')
    return { keys: [...allPermissionKeys, 'plan.view'], scope: 'company', version: 0 };
  const resources = ['cards', 'contacts', 'history', 'tasks'];
  return {
    keys: allPermissionKeys.filter(
      (k) =>
        [
          'boards.view',
          'catalog.view',
          'labels.view',
          'strategies.view',
          'dashboard.view',
        ].includes(k) ||
        (resources.includes(k.split('.')[0]) &&
          (role === 'seller'
            ? !k.endsWith('.delete')
            : k.endsWith('.view') || k.startsWith('tasks.') || k === 'history.whatsapp')),
    ),
    scope: role === 'reception' ? 'company' : 'own',
    version: 0,
  };
}
