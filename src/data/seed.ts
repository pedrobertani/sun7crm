import type { Snapshot } from '../domain/types';
import { today, shiftDate } from '../lib/format';
import { defaultStages } from '../domain/config';
import { starterMedals } from '../modules/goals/model';
import { marketingSeed } from './marketingSeed';
export function createSeed(): Snapshot {
  const date = today();
  const companies: Snapshot['companies'] = [
    {
      id: 'aurora',
      name: 'Clínica Aurora',
      segment: 'Estética e bem-estar',
      template: 'aesthetic',
      monthlyAmount: 19900,
      dueDate: shiftDate(date, 5),
      createdAt: shiftDate(date, -43),
      enabled: true,
    },
    {
      id: 'casa',
      name: 'Casa & Forma',
      segment: 'Decoração e interiores',
      template: 'generic',
      monthlyAmount: 24900,
      dueDate: shiftDate(date, 18),
      createdAt: shiftDate(date, -8),
      enabled: true,
    },
    {
      id: 'essencia',
      name: 'Essência Estética',
      segment: 'Estética facial',
      template: 'aesthetic',
      monthlyAmount: 19900,
      dueDate: shiftDate(date, -3),
      createdAt: shiftDate(date, -70),
      enabled: true,
    },
    {
      id: 'lumina',
      name: 'Lumina Clinic',
      segment: 'Estética corporal',
      template: 'aesthetic',
      monthlyAmount: 17900,
      dueDate: shiftDate(date, 2),
      createdAt: shiftDate(date, -2),
      enabled: true,
    },
    {
      id: 'forma',
      name: 'Forma Design',
      segment: 'Móveis planejados',
      template: 'generic',
      monthlyAmount: 22900,
      dueDate: shiftDate(date, -20),
      createdAt: shiftDate(date, -100),
      enabled: false,
    },
  ];
  const members = companies.flatMap((c) => [
    {
      id: c.id + '-manager',
      companyId: c.id,
      name: c.id === 'aurora' ? 'Mariana Costa' : 'Gestor ' + c.name,
      email: 'gestor@' + c.id + '.example',
      role: 'manager' as const,
      active: true,
    },
    {
      id: c.id + '-seller',
      companyId: c.id,
      name: c.id === 'aurora' ? 'Ana Ribeiro' : 'Carolina Silva',
      email: 'vendas@' + c.id + '.example',
      role: 'seller' as const,
      active: true,
    },
    {
      id: c.id + '-reception',
      companyId: c.id,
      name: 'Beatriz Lima',
      email: 'recepcao@' + c.id + '.example',
      role: 'reception' as const,
      active: true,
    },
  ]);
  // Exemplo comercial fictício: Ana começa sem vendas, Lucas conquistou todas as medalhas.
  members.push({
    id:'aurora-champion',companyId:'aurora',name:'Lucas Ferreira',
    email:'lucas@aurora.example',role:'seller',active:true,
  });
  const boards = companies.flatMap((c) =>
    (['leads', 'clients'] as const).map((kind) => ({
      id: c.id + '-' + kind,
      companyId: c.id,
      kind,
      stages: defaultStages[kind].map((name, i) => ({
        id: c.id + '-' + kind + '-' + i,
        name:
          c.template === 'generic' && name === 'Agendado'
            ? 'Visita agendada'
            : c.template === 'generic' && name === 'Compareceu'
              ? 'Visita realizada'
              : name,
      })),
    })),
  );
  const names = [
    'Juliana Martins',
    'Fernanda Souza',
    'Camila Oliveira',
    'Patrícia Santos',
    'Renata Lima',
    'Larissa Almeida',
    'Amanda Rocha',
    'Carolina Mendes',
    'Bruna Pereira',
    'Isabela Costa',
    'Marina Carvalho',
    'Daniela Ferreira',
  ];
  const contacts = companies.flatMap((c) =>
    names.map((name, i) => ({
      id: c.id + '-contact-' + i,
      companyId: c.id,
      name,
      phone: '1190000' + String(1000 + i),
      email: 'contato' + i + '@example.com',
      temperature: (['hot', 'warm', 'cold', 'unclassified'] as const)[i % 4],
      ownerId: c.id + '-seller',
      interests:
        c.template === 'aesthetic'
          ? ['Limpeza de pele', 'Harmonização facial', 'Tratamento corporal'][i % 3]
          : ['Cortinas sob medida', 'Piso vinílico', 'Projeto de interiores'][i % 3],
      notes: i === 0 ? 'Prefere contato no período da tarde.' : '',
      createdAt: shiftDate(date, -i * 2),
    })),
  );
  const opportunities: Snapshot['opportunities'] = contacts.map((c, i) => {
    const b = boards.find(
      (b) => b.companyId === c.companyId && b.kind === (i % 12 < 9 ? 'leads' : 'clients'),
    )!;
    return {
      id: c.id + '-opp',
      companyId: c.companyId,
      contactId: c.id,
      boardId: b.id,
      stageId: b.stages[i % b.stages.length].id,
      value: [45000, 89000, 120000, 65000][i % 4],
      source: ['Tráfego pago', 'Indicação', 'Instagram', 'Parceria'][i % 4],
      createdAt: c.createdAt,
    };
  });
  // Oito vendas confirmadas de R$ 450 para mostrar 100% da meta individual.
  // Registros exclusivamente ilustrativos; nunca são enviados ao app real.
  for (let i=0;i<8;i++) {
    const id='aurora-champion-contact-'+i;
    contacts.push({
      id,companyId:'aurora',name:'Cliente exemplo '+(i+1),
      phone:'1197777'+String(1000+i),email:'lucas-cliente-'+i+'@example.com',
      temperature:'hot',ownerId:'aurora-champion',interests:'Tratamento estético',
      notes:'Venda fictícia usada para demonstração de conquistas',
      createdAt:date,
    });
    opportunities.push({
      id:id+'-opp',companyId:'aurora',contactId:id,
      boardId:'aurora-leads',stageId:'aurora-leads-5',
      value:45000,source:'Indicação',createdAt:date,
      confirmedSaleAt:date+'T12:00:00.000Z',
      confirmedSaleOwnerId:'aurora-champion',confirmedSaleCents:45000,
    });
  }
  const tasks = companies.flatMap((c) => [
    {
      id: c.id + '-task1',
      companyId: c.id,
      title: 'Retomar conversa sobre orçamento',
      contactId: c.id + '-contact-0',
      ownerId: c.id + '-seller',
      dueDate: date,
      done: false,
    },
    {
      id: c.id + '-task2',
      companyId: c.id,
      title:
        c.template === 'aesthetic' ? 'Confirmar consulta de amanhã' : 'Confirmar visita de amanhã',
      contactId: c.id + '-contact-1',
      ownerId: c.id + '-reception',
      dueDate: date,
      done: false,
    },
    {
      id: c.id + '-task3',
      companyId: c.id,
      title: 'Enviar opções de serviços e produtos',
      contactId: c.id + '-contact-2',
      ownerId: c.id + '-seller',
      dueDate: shiftDate(date, -1),
      done: false,
    },
    {
      id: c.id + '-task4',
      companyId: c.id,
      title: 'Acompanhar indicação recebida',
      contactId: c.id + '-contact-9',
      ownerId: c.id + '-manager',
      dueDate: shiftDate(date, 2),
      done: false,
    },
    {
      id: c.id + '-task5',
      companyId: c.id,
      title: 'Atualizar interesses do contato',
      contactId: c.id + '-contact-3',
      ownerId: c.id + '-seller',
      dueDate: shiftDate(date, -2),
      done: true,
    },
  ]);
  return {
    version: 1,
    companies,
    members,
    boards,
    contacts,
    goalPlans:companies.map(c=>({
      companyId:c.id,month:date.slice(0,7),targetCents:10000000,ticketCents:300000,
      stages:[
        {label:'Contatos',rate:null},{label:'Agendamentos',rate:50},
        {label:'Comparecimentos',rate:80},{label:'Vendas',rate:10}
      ],
      medals:starterMedals.map(m=>({...m})),
    })),
    employeeGoals:[...companies.map(c=>({companyId:c.id,month:date.slice(0,7),memberId:c.id+'-seller',goalCents:1500000})),{companyId:'aurora',month:date.slice(0,7),memberId:'aurora-champion',goalCents:300000}],
    opportunities: opportunities.map((o) => ({
      ...o,
      labelIds: [
        o.companyId + '-' + contacts.find((c) => c.id === o.contactId)!.temperature,
      ].filter((id) => !id.endsWith('unclassified')),
    })),
    tasks,
    labels: companies.flatMap((c) => [
      { id: c.id + '-cold', companyId: c.id, name: 'Frio', color: '#3b82f6' },
      { id: c.id + '-warm', companyId: c.id, name: 'Morno', color: '#eab308' },
      { id: c.id + '-hot', companyId: c.id, name: 'Quente', color: '#ef4444' },
    ]),
    catalog: [],
    ambassadorCampaigns: [],
    ambassadorPayments: [],
    ...marketingSeed(companies),
  };
}
