/**
 * Tutoriais operacionais vinculados às mesmas chaves do controle de acesso.
 * Este filtro orienta a interface; a autorização permanece nas rotas, RPCs e RLS.
 */
export type HelpRole = 'admin' | 'manager' | 'seller' | 'reception';
export interface HelpTopic {
  id: string;
  section: string;
  title: string;
  intro: string;
  steps: string[];
  route?: string;
}
export interface HelpAccess {
  role: HelpRole;
  keys: readonly string[];
  scope?: 'own' | 'company';
  demo?: boolean;
}
export function helpRoleLabel(role: HelpRole): string {
  return {
    admin: 'Administrador da plataforma',
    manager: 'Gestor',
    seller: 'Consultor / Vendedor',
    reception: 'Recepção',
  }[role];
}
export function helpTopics({ role, keys, scope = 'own', demo = false }: HelpAccess): HelpTopic[] {
  if (role === 'admin') return [
    {
      id: 'platform', section: 'Primeiros passos', title: 'Conhecer o SUN7CRM',
      intro: 'Administre empresas, acessos e cobranças sem misturar dados das empresas.',
      steps: [
        'No painel da plataforma, acompanhe empresas ativas, novas e próximas do vencimento.',
        'Os dados comerciais pertencem a cada empresa e não são um caixa da plataforma.',
        'Use o menu do usuário para consultar Minha conta ou encerrar a sessão.',
      ],
      route: demo ? '/demo/painel' : '/admin',
    },
    {
      id: 'companies', section: 'Administração', title: 'Cadastrar e gerenciar empresas',
      intro: 'Cadastre empresas, vincule gestores e acompanhe as condições do acesso.',
      steps: [
        'Abra Empresas e confira o cadastro antes de criar ou alterar uma organização.',
        'Defina identificação, condições comerciais e vencimento nos formulários disponíveis.',
        'Revise os usuários vinculados e as condições de acesso antes de concluir.',
      ],
      route: demo ? undefined : '/admin/empresas',
    },
    {
      id: 'platform-plans', section: 'Administração', title: 'Acompanhar cobranças da plataforma',
      intro: 'Acompanhe o histórico de cobranças e os status dos pagamentos.',
      steps: [
        'Abra Planos e cobranças.',
        'Consulte a empresa e o histórico correspondente antes de realizar uma ação.',
        'Cobranças da plataforma são distintas das vendas comerciais de cada empresa.',
      ],
      route: demo ? undefined : '/admin/planos',
    },
  ];
  const base = demo ? '/demo' : '/app';
  const routes = {
    dashboard: demo ? '/demo/painel' : '/app',
    funnel: demo ? '/demo/funil/leads' : '/app/funil',
    contacts: base + '/contatos',
    tasks: base + '/tarefas',
    strategies: base + '/estrategias',
    ambassadors: base + '/embaixadores',
    catalog: base + '/catalogo',
    labels: base + '/etiquetas',
    reports: base + '/relatorios',
    team: base + '/equipe',
    settings: base + '/configuracoes',
    plan: base + '/plano',
  };
  const allowed = (key: string) => keys.includes(key);
  const topics: HelpTopic[] = [{
    id: 'overview', section: 'Primeiros passos', title: 'Seu acesso e sua área de trabalho',
    intro: 'As opções do menu são liberadas pelo gestor conforme seu perfil.',
    steps: [
      'Use o menu lateral para navegar entre as áreas disponíveis.',
      'O ícone de interrogação abre esta ajuda; o ícone de usuário mostra Minha conta e Sair.',
      demo ? 'Na demonstração, os dados são fictícios e ficam somente neste navegador.'
        : 'Se uma função não aparecer, solicite ao gestor a liberação da permissão correspondente.',
      scope === 'own'
        ? 'Sua carteira é individual: você pode ver somente seus contatos, cards ou tarefas permitidos.'
        : 'Sua carteira pode abranger a empresa inteira, conforme as permissões concedidas.',
    ],
  }];
  const add = (key: string, topic: HelpTopic) => { if (allowed(key)) topics.push(topic); };
  add('dashboard.view', {
    id: 'dashboard', section: 'Dia a dia', title: 'Entender o Dashboard',
    intro: 'Acompanhe os indicadores do período e abra os detalhes permitidos.',
    steps: [
      'Selecione o período dos indicadores.',
      'Acesse as abas e os gráficos disponíveis para seu perfil.',
      'O pipeline é uma estimativa comercial, diferente das vendas confirmadas.',
    ],
    route: routes.dashboard,
  });
  add('cards.view', {
    id: 'funnel', section: 'Dia a dia', title: 'Acompanhar oportunidades no funil',
    intro: 'Organize os cards de acordo com as etapas comerciais.',
    steps: [
      'Abra Funil, escolha a etapa e localize o card.',
      allowed('cards.edit') ? 'Abra um card permitido para atualizar informações ou movimentá-lo.'
        : 'Consulte as informações; a edição depende de uma permissão específica.',
      allowed('cards.edit')
        ? 'Ao mover para uma etapa de venda, confirme explicitamente se houve venda; apenas mover não contabiliza receita.'
        : 'As vendas dependem de confirmação por um usuário com permissão de edição.',
    ],
    route: routes.funnel,
  });
  add('contacts.view', {
    id: 'contacts', section: 'Dia a dia', title: 'Consultar contatos e histórico',
    intro: 'Encontre as pessoas da carteira disponível para seu perfil.',
    steps: [
      'Abra Contatos e utilize a busca e os filtros.',
      allowed('contacts.create') ? 'Use o cadastro para adicionar contatos.'
        : 'O cadastro só é liberado para quem possui a permissão Criar.',
      allowed('history.view') ? 'Abra o histórico do contato para consultar interações anteriores.'
        : 'O histórico detalhado depende da permissão do gestor.',
    ],
    route: routes.contacts,
  });
  add('contacts.import', {
    id: 'import', section: 'Contatos', title: 'Importar contatos do Excel',
    intro: 'Importe até 1.000 contatos por arquivo .xlsx, sem sobrescrever registros existentes.',
    steps: [
      'Em Contatos, escolha Importar Excel e baixe o modelo diretamente no link azul.',
      'Preencha Nome e Contato. O telefone é opcional; quando informado, inclua DDD.',
      'Selecione o arquivo, revise a prévia e confirme apenas os registros válidos.',
    ],
    route: routes.contacts,
  });
  add('contacts.export', {
    id: 'export', section: 'Contatos', title: 'Exportar contatos do Excel',
    intro: 'Exporte apenas os registros permitidos pela carteira do seu usuário.',
    steps: [
      'Em Contatos, escolha Exportar Excel.',
      'Selecione o escopo disponível e gere a planilha.',
      'Clique em Baixar Excel para salvar o arquivo gerado.',
    ],
    route: routes.contacts,
  });
  add('tasks.view', {
    id: 'tasks', section: 'Dia a dia', title: 'Acompanhar tarefas e retornos',
    intro: 'Consulte as tarefas e prazos vinculados à sua carteira.',
    steps: [
      'Abra Tarefas e filtre os registros pendentes ou concluídos.',
      allowed('tasks.create') ? 'Cadastre uma tarefa com prazo e responsável permitido.'
        : 'Criar tarefas exige uma permissão adicional.',
      allowed('tasks.edit') ? 'Atualize o andamento de tarefas permitidas.'
        : 'Alterar tarefas exige uma permissão adicional.',
    ],
    route: routes.tasks,
  });
  add('catalog.view', {
    id: 'catalog', section: 'Cadastros', title: 'Serviços e produtos',
    intro: 'Consulte o catálogo usado nos cards e atendimentos.',
    steps: [
      'Abra Serviços e produtos para consultar os itens cadastrados.',
      allowed('catalog.create') ? 'Inclua novos serviços ou produtos com nome e valor.'
        : 'O cadastro de itens depende da permissão de criação.',
      'Os itens podem ser vinculados às oportunidades pelo fluxo comercial disponível.',
    ],
    route: routes.catalog,
  });
  add('labels.view', {
    id: 'labels', section: 'Cadastros', title: 'Etiquetas',
    intro: 'Organize os cadastros com etiquetas personalizadas.',
    steps: [
      'Abra Etiquetas para consultar as classificações da empresa.',
      allowed('labels.edit') ? 'Edite as etiquetas quando necessário.'
        : 'Alterações dependem da permissão de edição.',
    ],
    route: routes.labels,
  });
  add('strategies.view', {
    id: 'strategies', section: 'Crescimento', title: 'Estratégias',
    intro: 'Organize iniciativas comerciais e acompanhe seu andamento.',
    steps: [
      'Abra Estratégias para consultar as iniciativas cadastradas.',
      allowed('strategies.create') ? 'Crie uma nova estratégia com responsável e período.'
        : 'A criação de estratégias depende da permissão recebida.',
    ],
    route: routes.strategies,
  });
  add('ambassadors.view', {
    id: 'ambassadors', section: 'Crescimento', title: 'Embaixadores e indicações',
    intro: 'Acompanhe embaixadores e campanhas de indicação.',
    steps: [
      'Abra Embaixadores e consulte os indicadores.',
      allowed('campaigns.create') ? 'Cadastre campanhas, regras de pontos e comissão conforme a empresa.'
        : 'Criar campanhas depende de autorização.',
      'Pontos e comissões dependem das regras e dos pagamentos registrados.',
    ],
    route: routes.ambassadors,
  });
  add('goals.view', {
    id: 'goals', section: 'Crescimento', title: 'Metas e medalhas',
    intro: 'Consulte a meta e as conquistas liberadas por vendas confirmadas.',
    steps: [
      'Abra o Dashboard e consulte a aba Conquistas, se estiver disponível.',
      role === 'manager' ? 'Use Configurar metas para definir contatos, porcentagens, ticket médio e medalhas.'
        : 'As metas e premiações são definidas pelo gestor.',
      'As medalhas dependem de vendas confirmadas no Kanban; o prêmio não é pago automaticamente.',
    ],
    route: routes.dashboard,
  });
  add('reports.view', {
    id: 'reports', section: 'Gestão', title: 'Relatórios',
    intro: 'Acompanhe atividades da carteira, movimentações e indicadores.',
    steps: [
      'Abra Relatórios e selecione o período.',
      'Use os filtros para examinar os dados autorizados.',
      'Consulte os registros de origem para interpretar cada indicador.',
    ],
    route: routes.reports,
  });
  add('team.view', {
    id: 'team', section: 'Gestão', title: 'Funcionários e permissões',
    intro: 'Acompanhe os integrantes cadastrados na empresa.',
    steps: [
      'Abra Equipe para consultar funcionários e perfis.',
      allowed('team.manage') ? 'Cadastre ou edite integrantes e configure quais ações podem executar.'
        : 'Somente um perfil autorizado pode administrar permissões.',
      'As regras de acesso são verificadas também no banco de dados.',
    ],
    route: routes.team,
  });
  add('settings.view', {
    id: 'settings', section: 'Gestão', title: 'Configurações da empresa',
    intro: 'Consulte a identidade e as preferências da empresa.',
    steps: [
      'Abra Configurações para conferir os dados da empresa.',
      allowed('settings.edit') ? 'Altere nome ou aparência conforme os controles disponíveis.'
        : 'Alterações dependem de permissão adicional.',
    ],
    route: routes.settings,
  });
  if (role === 'manager' && allowed('plan.view')) topics.push({
    id: 'plan', section: 'Gestão', title: 'Plano e vencimento da empresa',
    intro: 'Consulte a situação da assinatura do SUN7CRM.',
    steps: [
      'Abra Plano para visualizar vencimentos e cobranças.',
      'Verifique instruções disponíveis para pagamento ou regularização.',
      'A mensalidade do SUN7CRM não é receita das vendas da sua empresa.',
    ],
    route: routes.plan,
  });
  return topics;
}
