import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  KanbanSquare,
  ListTodo,
  ChartNoAxesCombined,
  UsersRound,
  Palette,
  Building2,
  Clock3,
  CheckCircle2,
  Plus,
  CalendarDays,
  MessageSquareText,
  Target,
  Gift,
  Package,
  HeartHandshake,
} from 'lucide-react';
import { PublicShell } from './PublicShell';
const modules = [
  {
    id: 'atendimento',
    icon: KanbanSquare,
    label: 'Atendimento por etapas',
    title: 'Entenda o interesse. Acompanhe a conversa.',
    description:
      'O contato reúne o que sua equipe precisa saber. Em quadros visuais, cada pessoa aparece na etapa atual do atendimento: primeiro contato, conversa ou agendamento. Há um quadro para novos contatos e outro para quem já é cliente.',
    bullets: [
      'Nome, telefone, e-mail, responsável, interesses e observações.',
      'Temperatura quente, morna ou fria, independente da etapa.',
      'Quadros separados para novos contatos e clientes, com nomes e ordem das etapas editáveis.',
    ],
    action: 'Experimente mudar a etapa e a temperatura no exemplo.',
  },
  {
    id: 'tarefas',
    icon: ListTodo,
    label: 'Tarefas e rotina',
    title: 'Toda conversa merece um próximo passo.',
    description:
      'Transforme uma pendência em uma tarefa clara. Defina quem faz, até quando e a qual contato ela pertence, para que a continuidade do atendimento fique visível.',
    bullets: [
      'Visualização em lista ou quadro com etapas, com os mesmos registros.',
      'Etapas A fazer, Em andamento e Concluídas.',
      'Prazo, contato e responsável, com filtros para pendências e atrasos.',
    ],
    action: 'Marque uma tarefa como concluída para ver o exemplo atualizar.',
  },
  {
    id: 'gestao',
    icon: ChartNoAxesCombined,
    label: 'Indicadores',
    title: 'Veja o movimento antes de decidir a prioridade.',
    description:
      'Uma visão comercial para acompanhar a entrada de contatos, os interesses mais aquecidos e o trabalho que precisa continuar. Os gráficos ajudam a entender o conjunto; os atalhos levam aos detalhes.',
    bullets: [
      'Novos contatos, oportunidades quentes e tarefas pendentes.',
      'Filtros de período e gráficos de origens e etapas.',
      'Valor estimado das oportunidades, separado de receita recebida.',
    ],
    action: 'Troque o período para explorar os indicadores ilustrativos.',
  },
  {
    id: 'equipe',
    icon: UsersRound,
    label: 'Equipe',
    title: 'Responsáveis definidos. Atendimento mais organizado.',
    description:
      'Gestor, consultora e recepção têm rotinas diferentes. A prévia permite explorar cada visão e validar o que cada pessoa precisa acompanhar no dia a dia.',
    bullets: [
      'Cadastro de integrantes e atribuição de responsável aos contatos.',
      'Gestor acompanha a empresa; consultora acompanha sua carteira na prévia.',
      'Criação de contas e redefinição de senhas por hierarquia estão definidas para a autenticação real.',
    ],
    action: 'Os perfis da demo são simulados; o controle seguro depende da autenticação.',
  },
  {
    id: 'identidade',
    icon: Palette,
    label: 'Sua identidade',
    title: 'A sua empresa também aparece no sistema.',
    description:
      'Um ambiente com nome, logo e cores da empresa ajuda a equipe a reconhecer seu próprio espaço. A organização se adapta ao negócio sem perder a simplicidade.',
    bullets: [
      'Nome exibido independente do nome cadastral da empresa.',
      'Logo no topo da área de trabalho e paletas de cores para toda a equipe.',
      'Escolha visual aplicada a menus, botões, gráficos e modais.',
    ],
    action: 'Edite o nome e escolha uma cor para visualizar a ideia.',
  },
];
function ContactExample() {
  const [stage, setStage] = useState('Em conversa'),
    [temp, setTemp] = useState('Quente');
  return (
    <div className="fx-contact">
      <div className="fx-example-top">
        <strong>Novos contatos</strong>
        <span>Exemplo interativo</span>
      </div>
      <div className="fx-stage-track">
        {['Novo contato', 'Em conversa', 'Agendado'].map((s, i) => (
          <div key={s} className={s === stage ? 'selected' : ''}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {s}
          </div>
        ))}
      </div>
      <article className="fx-contact-card">
        <div>
          <span className={'fx-temp ' + temp.toLowerCase()}>{temp}</span>
          <span className="fx-avatar">AR</span>
        </div>
        <h4>Juliana Martins</h4>
        <p>Interesse em harmonização facial</p>
        <strong>
          R$ 890,00 <small>valor estimado</small>
        </strong>
        <div className="fx-next-action">
          <Clock3 size={15} />
          <span>Próxima ação: retomar orçamento</span>
        </div>
        <div className="fx-example-fields">
          <label>
            Etapa
            <select
              value={stage}
              aria-label="Etapa do exemplo"
              onChange={(e) => setStage(e.target.value)}
            >
              {['Novo contato', 'Em conversa', 'Agendado'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Temperatura
            <select
              value={temp}
              aria-label="Temperatura do exemplo"
              onChange={(e) => setTemp(e.target.value)}
            >
              {['Quente', 'Morno', 'Frio'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </article>
      <p className="fx-example-note" role="status">
        Juliana está em {stage.toLowerCase()} · temperatura {temp.toLowerCase()}.
      </p>
    </div>
  );
}
function TasksExample() {
  const [done, setDone] = useState<string[]>([]);
  const tasks = [
    ['Confirmar avaliação', 'Mariana · Hoje'],
    ['Retomar orçamento', 'Juliana · Hoje'],
    ['Acompanhar indicação', 'Bruna · Amanhã'],
  ];
  return (
    <div className="fx-tasks">
      <div className="fx-example-top">
        <strong>Minha rotina</strong>
        <span>Exemplo interativo</span>
      </div>
      <div className="fx-task-summary">
        <strong>
          {3 - done.length}
          <small>tarefas pendentes</small>
        </strong>
        <span>
          <CalendarDays size={16} /> Próximas ações
        </span>
      </div>
      {tasks.map(([title, detail]) => (
        <label className={'fx-task-row ' + (done.includes(title) ? 'is-done' : '')} key={title}>
          <input
            type="checkbox"
            checked={done.includes(title)}
            onChange={(e) =>
              setDone(e.target.checked ? [...done, title] : done.filter((v) => v !== title))
            }
          />
          <span>
            <strong>{title}</strong>
            <small>{detail}</small>
          </span>
          {done.includes(title) ? (
            <CheckCircle2 size={18} />
          ) : (
            <span className="fx-avatar">AR</span>
          )}
        </label>
      ))}
      <p className="fx-example-note" role="status">
        {done.length} de 3 tarefas concluídas neste exemplo.
      </p>
    </div>
  );
}
function DashboardExample() {
  const [period, setPeriod] = useState('30');
  const entries = period === '7' ? [2, 4, 3, 6, 5, 8, 4] : [6, 9, 7, 13, 10, 17, 12];
  const total = entries.reduce((a, b) => a + b, 0);
  return (
    <div className="fx-dashboard">
      <div className="fx-example-top">
        <strong>Visão comercial</strong>
        <label>
          <span className="sr-only">Período do exemplo</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>
        </label>
      </div>
      <div className="fx-kpis">
        <div>
          <small>Novos contatos</small>
          <strong>{total}</strong>
        </div>
        <div>
          <small>Quentes</small>
          <strong>{period === '7' ? 4 : 11}</strong>
        </div>
        <div>
          <small>Pendências</small>
          <strong>3</strong>
        </div>
      </div>
      <div className="fx-chart">
        <div>
          <strong>Entrada de contatos</strong>
          <small>Valores ilustrativos</small>
        </div>
        <div
          className="fx-bars"
          aria-label={`Contatos por intervalo: ${entries.join(', ')}`}
          role="img"
        >
          {entries.map((v, i) => (
            <div key={i}>
              <span>{v}</span>
              <i style={{ height: `${(v / Math.max(...entries)) * 115}px` }} />
              <small>{i + 1}</small>
            </div>
          ))}
        </div>
      </div>
      <p className="fx-example-note">
        Números fictícios para demonstrar a leitura dos indicadores.
      </p>
    </div>
  );
}
function TeamExample() {
  return (
    <div className="fx-team">
      <div className="fx-example-top">
        <strong>Pessoas e responsabilidades</strong>
        <UsersRound size={18} />
      </div>
      {[
        ['MC', 'Mariana Costa', 'Gestor', 'Acompanha a empresa'],
        ['AR', 'Ana Ribeiro', 'Consultora', 'Cuida da própria carteira'],
        ['BF', 'Beatriz Ferreira', 'Recepção', 'Consulta contatos na prévia'],
      ].map(([a, n, r, d]) => (
        <div key={r} className="fx-team-row">
          <span className="fx-avatar">{a}</span>
          <div>
            <strong>{n}</strong>
            <small>{d}</small>
          </div>
          <span>{r}</span>
        </div>
      ))}
      <div className="fx-team-flow">
        <strong>Contas com uma organização clara</strong>
        <p>Administrador → gestor → equipe</p>
        <small>Autenticação real em desenvolvimento.</small>
      </div>
    </div>
  );
}
function IdentityExample() {
  const [name, setName] = useState('Espaço Bella'),
    [color, setColor] = useState('#236d62');
  return (
    <div className="fx-branding">
      <div className="fx-example-top">
        <strong>A identidade da sua empresa</strong>
        <Palette size={18} />
      </div>
      <div className="fx-brand-preview" style={{ '--sample-brand': color } as CSSProperties}>
        <div>
          <span>
            {name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase() || 'E'}
          </span>
          <strong>{name.trim() || 'Sua empresa'}</strong>
        </div>
        <nav aria-label="Menu ilustrativo">
          <span>
            <ChartNoAxesCombined size={15} /> Visão geral
          </span>
          <span>
            <KanbanSquare size={15} /> Novos contatos
          </span>
          <span>
            <ListTodo size={15} /> Tarefas
          </span>
        </nav>
      </div>
      <label className="fx-brand-name">
        Nome no sistema
        <input maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <fieldset className="fx-palette">
        <legend>Escolha uma cor para o exemplo</legend>
        {[
          ['#236d62', 'Verde'],
          ['#456e99', 'Azul'],
          ['#9c7580', 'Rosé'],
          ['#7b705f', 'Neutro'],
        ].map(([c, label]) => (
          <label key={c} title={label}>
            <input
              type="radio"
              name="feature-palette"
              value={c}
              checked={color === c}
              onChange={() => setColor(c)}
            />
            <span style={{ background: c }}>
              <span className="sr-only">{label}</span>
              {color === c && <Check size={15} />}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
export function FeatureExplorer() {
  const [active, setActive] = useState(0);
  const module = modules[active];
  const examples = [ContactExample, TasksExample, DashboardExample, TeamExample, IdentityExample];
  const Example = examples[active];
  return (
    <div className="feature-explorer">
      <div className="fx-switcher" aria-label="Explorar funcionalidades">
        {modules.map(({ id, icon: Icon, label }, i) => (
          <button
            type="button"
            key={id}
            aria-pressed={active === i}
            onClick={() => setActive(i)}
            className={active === i ? 'active' : ''}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="fx-panel" aria-live="polite">
        <div className="fx-copy">
          <span className="fx-status">
            <i /> Disponível para explorar na demo
          </span>
          <h3>{module.title}</h3>
          <p>{module.description}</p>
          <ul>
            {module.bullets.map((text) => (
              <li key={text}>
                <Check size={15} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Link to="/demo" className="home-text-link">
            Explorar no CRM <ArrowRight size={16} />
          </Link>
        </div>
        <div className="fx-visual">
          <Example />
          <p className="fx-hint">{module.action}</p>
        </div>
      </div>
    </div>
  );
}
const catalog = [
  ['Contatos', 'Dados de contato, interesses, observações, responsável e busca.'],
  ['Temperatura comercial', 'Quente, morno, frio ou ainda sem classificação.'],
  [
    'Quadros de atendimento',
    'Acompanhe novos contatos e clientes por etapas, do primeiro interesse à próxima ação.',
  ],
  [
    'Etapas personalizáveis',
    'Adicionar, renomear, reordenar e transferir cartões ao excluir uma etapa.',
  ],
  ['Movimentação de cartões', 'Arraste pela alça ou selecione a etapa no próprio cartão.'],
  ['Tarefas', 'Prazo, responsável, contato, conclusão e filtros, em lista ou quadro com etapas.'],
  ['Visão do atendimento', 'Indicadores, gráficos, filtros de período e atalhos para os detalhes.'],
  ['Equipe', 'Cadastros fictícios e visões de gestor, consultora e recepção.'],
  ['Identidade da empresa', 'Nome exibido, logo e paletas de cores personalizáveis.'],
  ['Administração da plataforma', 'Empresas, gestor, valor e vencimento individuais, sem planos.'],
  ['Visão da plataforma', 'Empresas ativas, novas, próximas do vencimento e soma contratada.'],
  [
    'Documentos e primeiro acesso',
    'Termos, privacidade e confirmação individual simulada por versão.',
  ],
];
function PlannedFeatures() {
  return (
    <section className="features-planned public-container">
      <div className="home-section-heading">
        <div>
          <span className="home-eyebrow">PRÓXIMAS CAMADAS DO PRODUTO</span>
          <h2>O relacionamento continua depois do primeiro atendimento.</h2>
        </div>
        <p>
          Estes recursos estão em alinhamento para o CRM. Ainda não estão disponíveis na demo e suas
          regras serão validadas antes da implementação.
        </p>
      </div>
      <div className="planned-grid">
        {[
          [
            Clock3,
            'Acompanhamento após a consulta',
            'Sequência após a consulta sem fechamento: 24 horas, 3, 7, 15, 21 e 29 dias; depois, acompanhamento mensal. Gatilhos, pausas e encerramento ainda serão definidos.',
          ],
          [
            Target,
            'Estratégias do mês',
            'Organização de ações como tráfego pago, indicação, parcerias e campanhas sazonais.',
          ],
          [
            Package,
            'Serviços e produtos',
            'Evolução do campo de interesse atual para um cadastro estruturado do que cada empresa oferece.',
          ],
          [
            MessageSquareText,
            'Apoio à conversa',
            'Materiais de quebra de objeções e orientações por etapa, com conteúdo específico para cada operação.',
          ],
          [
            HeartHandshake,
            'Indicações de clientes',
            'Relacionamento com quem já é cliente e acompanhamento das oportunidades que chegam por indicação.',
          ],
          [
            Gift,
            'Embaixadores e campanhas',
            'Cadastro, pontuação, comissões e premiações. Períodos, estornos e regras de cálculo ainda precisam ser definidos.',
          ],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof Clock3;
          return (
            <article key={String(title)}>
              <I size={21} />
              <span>Em alinhamento</span>
              <h3>{String(title)}</h3>
              <p>{String(text)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
export function FeaturesPage() {
  return (
    <PublicShell title="Funcionalidades · SUN7CRM">
      <main>
        <section className="features-intro public-container">
          <span className="home-eyebrow">FUNCIONALIDADES DO SUN7CRM</span>
          <h1>
            Da oportunidade à rotina.
            <br />
            <em>Cada parte se conecta.</em>
          </h1>
          <p>
            Conheça o que já pode ser explorado e como a base do CRM está sendo preparada para
            acompanhar o relacionamento com seus clientes.
          </p>
          <div>
            <span className="fx-status">
              <i /> Prévia disponível
            </span>
            <span className="scope-pill">Em alinhamento</span>
            <span className="scope-pill future">Integrações futuras</span>
          </div>
        </section>
        <section className="features-explore public-container">
          <FeatureExplorer />
        </section>
        <section className="features-catalog public-container">
          <div className="home-section-heading">
            <div>
              <span className="home-eyebrow">O QUE VOCÊ JÁ PODE VALIDAR</span>
              <h2>Uma visão completa da prévia.</h2>
            </div>
            <p>
              Os fluxos estão disponíveis com dados fictícios salvos no navegador. Perfis, acesso e
              confirmação de documentos são simulações.
            </p>
          </div>
          <div className="features-catalog-grid">
            {catalog.map(([title, text], i) => (
              <article key={title}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <Check size={16} />
              </article>
            ))}
          </div>
        </section>
        <section className="features-admin public-container">
          <div className="features-admin-heading">
            <Building2 size={24} />
            <div>
              <span className="home-eyebrow">PARA QUEM ADMINISTRA A PLATAFORMA</span>
              <h2>Uma visão própria para cuidar das empresas.</h2>
            </div>
          </div>
          <p>
            O painel administrativo reúne a carteira de empresas. O valor e o vencimento são
            definidos individualmente, enquanto a equipe de cada empresa utiliza seu próprio
            ambiente de trabalho.
          </p>
          <div className="admin-showcase">
            <div>
              <small>Empresas ativas</small>
              <strong>12</strong>
            </div>
            <div>
              <small>Próximas do vencimento</small>
              <strong>3</strong>
            </div>
            <div>
              <small>Novas no período</small>
              <strong>2</strong>
            </div>
            <div className="admin-showcase-note">
              <ChartNoAxesCombined size={21} />
              <span>
                Filtros para acompanhar
                <br />
                cada parte da carteira.
              </span>
            </div>
          </div>
          <small>
            Números ilustrativos. A soma contratada do painel não representa receita recebida.
          </small>
        </section>
        <PlannedFeatures />
        <section className="features-future public-container">
          <div>
            <span className="home-eyebrow">INTEGRAÇÕES FUTURAS</span>
            <h2>
              Conectar mais canais.
              <br />
              Quando for o momento.
            </h2>
            <p>
              WhatsApp Business, Instagram e Messenger em um só lugar, resultados do Meta, Google
              Agenda, inteligência artificial e um módulo financeiro são possibilidades futuras.
            </p>
            <p>
              Essas conexões não estão ativas na demo. Dependem de avaliação técnica, definição de
              escopo e dos custos e condições de cada provedor.
            </p>
          </div>
          <div className="future-connectors">
            {[
              'WhatsApp Business',
              'Instagram e Messenger',
              'Campanhas do Meta',
              'Google Agenda',
              'Assistentes de IA',
              'Módulo financeiro',
            ].map((s) => (
              <span key={s}>
                {s}
                <ArrowUpRight size={16} />
              </span>
            ))}
          </div>
        </section>
        <section className="features-faq public-container">
          <span className="home-eyebrow">PARA EXPLORAR COM CLAREZA</span>
          <h2>Algumas respostas antes de entrar.</h2>
          {[
            [
              'É só para clínicas de estética?',
              'O piloto atende clínicas de estética, mas a proposta também contempla negócios de outros segmentos. A organização de contatos, etapas, tarefas e identidade pode ser validada em ambos os exemplos da demo.',
            ],
            [
              'Consigo adaptar as etapas e a aparência?',
              'Sim. Na prévia, o gestor pode editar as etapas, o nome exibido, o logo e as cores da empresa. O limite de etapas ainda é provisório e será validado.',
            ],
            [
              'A etapa Agendado significa uma agenda integrada?',
              'Não. Agendado é uma etapa de acompanhamento da oportunidade. Uma agenda com horários e a integração com Google Agenda não estão disponíveis nesta prévia.',
            ],
            [
              'As tarefas já enviam mensagens automaticamente?',
              'Não. As tarefas organizam o trabalho manual da equipe. Mover um cartão ou concluir uma tarefa não envia mensagens automáticas.',
            ],
            [
              'A demo já pode receber dados reais?',
              'Não. Ela usa dados fictícios no navegador, sem autenticação ou isolamento seguro entre perfis. O uso real dependerá do backend, dos controles de acesso e da finalização dos documentos e regras.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>
                {question}
                <Plus size={17} />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </section>
        <section className="home-cta public-container">
          <span className="home-eyebrow">VEJA COMO TUDO SE ENCAIXA</span>
          <h2>O próximo passo é explorar a sua rotina.</h2>
          <p>Entre na demo e avalie os fluxos com os dados de exemplo.</p>
          <Link className="home-primary" to="/demo">
            Explorar a demo <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </PublicShell>
  );
}
