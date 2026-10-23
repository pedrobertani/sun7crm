import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { LEGAL } from '../../domain/legal';
import { PublicShell } from './PublicShell';
const privacy = [
  [
    'Sobre este documento',
    'Esta é uma versão preliminar para validar a experiência do SUN7CRM. A demo usa cadastros fictícios e armazenamento no navegador. Não há autenticação real, banco de dados de clientes nem integração ativa com WhatsApp, Meta, Google ou inteligência artificial. Não insira dados reais ou informações de saúde nesta prévia. A confirmação na demo é uma simulação de ciência, sem contratação de serviço.',
  ],
  [
    'Quem trata os dados',
    'Na operação prevista, a empresa que utiliza o CRM decide as finalidades do tratamento dos dados de seus contatos e clientes e atua, em regra, como controladora. O fornecedor do SUN7CRM atua como operador desses dados, conforme instruções legítimas da empresa, e como controlador dos dados necessários à gestão das contas e da própria relação contratual. A identificação jurídica do fornecedor e o canal oficial de privacidade precisam ser definidos antes do uso com dados reais. O nome e o logo personalizados de uma empresa não alteram essas responsabilidades.',
  ],
  [
    'Dados e finalidades',
    'A base do CRM prevê nome, telefone, e-mail, responsável pelo atendimento, interesses, temperatura comercial, observações, etapas do funil, valores estimados e tarefas. Os cadastros da equipe contêm nome, e-mail e perfil. O cadastro administrativo contém dados da empresa, valor contratado e vencimento. Essas informações servem para organizar o atendimento, acompanhar oportunidades e administrar o serviço. Na demo, as alterações e confirmações são guardadas neste navegador; não são sincronizadas entre dispositivos.',
  ],
  [
    'Bases legais e informações sensíveis',
    'Na operação real, cada finalidade deverá ter uma base legal adequada, como execução de contrato, obrigação legal, legítimo interesse quando cabível ou consentimento específico. A leitura desta política não é autorização irrestrita para tratar dados. A empresa deve informar seus contatos e justificar o cadastro e as comunicações comerciais. O aceite do gestor ou da equipe não substitui os direitos ou o eventual consentimento dos clientes. Dados de saúde recebem proteção específica pela LGPD; esta demo não é um prontuário e não deve receber anamneses, diagnósticos, fotos clínicas ou informações sensíveis.',
  ],
  [
    'Armazenamento local e tecnologias',
    'A aplicação grava os dados fictícios e o registro simulado de confirmação no armazenamento local do navegador (localStorage). Um indicador de saída da prévia usa o armazenamento da sessão (sessionStorage). Limpar esses dados remove os cadastros locais e pode exigir nova confirmação. O código desta demo não instala ferramentas de publicidade, pixels de marketing ou cookies opcionais de análise. O provedor de hospedagem pode tratar registros técnicos necessários para disponibilizar o site, conforme suas próprias condições.',
  ],
  [
    'Compartilhamento e infraestrutura',
    'Nesta fase, a hospedagem disponibiliza o site; os cadastros fictícios permanecem no navegador. Antes da produção, serão documentados os provedores efetivamente utilizados para hospedagem, autenticação, armazenamento e suporte, os dados compartilhados, eventuais transferências internacionais e as salvaguardas aplicáveis. Não há promessa de residência dos dados no Brasil nesta prévia. Integrações futuras terão suas finalidades e permissões apresentadas antes da ativação.',
  ],
  [
    'Segurança e limites da prévia',
    'Os seletores de empresa e perfil são recursos de demonstração, não controles de segurança. Qualquer pessoa com acesso ao mesmo navegador pode visualizar ou alterar os dados locais. A operação real dependerá de autenticação, isolamento entre empresas, autorização no servidor, registros de acesso, cópias de segurança e procedimentos de resposta a incidentes. Esses controles não devem ser considerados implementados apenas por constarem neste documento.',
  ],
  [
    'Retenção e eliminação',
    'Na demo, os dados locais permanecem até serem substituídos pela restauração dos exemplos ou removidos nas configurações do navegador. A restauração de cadastros de exemplo não apaga o registro separado de confirmação. Para remover todos os registros locais, limpe os dados deste site no navegador. Na produção, prazos de retenção, exclusão, anonimização e cópias de segurança deverão ser definidos conforme a finalidade, o contrato e as obrigações legais aplicáveis.',
  ],
  [
    'Direitos e solicitações',
    'A LGPD prevê, conforme a situação, confirmação de tratamento, acesso, correção, informação sobre compartilhamento, anonimização, bloqueio ou eliminação, portabilidade, oposição e revogação do consentimento. Pedidos sobre contatos cadastrados por uma empresa deverão ser direcionados à empresa responsável, com apoio do fornecedor quando necessário. Pedidos sobre a conta na plataforma deverão ser encaminhados ao fornecedor. O canal oficial e o procedimento de verificação de identidade estão em definição e deverão estar disponíveis antes do tratamento de dados reais. Não envie dados pessoais sensíveis para contatos não verificados.',
  ],
  [
    'Versões e alterações',
    'Os documentos ficam disponíveis no site e nas configurações da conta. A demo registra a versão dos Termos, a versão desta Política, a identidade simulada e a data da confirmação no navegador. Alterações relevantes que exijam nova ciência serão apresentadas antes do acesso à área de trabalho. A produção precisará de registro verificável no servidor; o registro local da demo não comprova identidade ou consentimento de clientes.',
  ],
];
const terms = [
  [
    'Natureza da prévia',
    'Este documento preliminar descreve as condições de exploração da demo do SUN7CRM. A demo é um ambiente de validação, não um serviço contratado ou uma operação de CRM com dados reais. Os perfis são simulados e não são solicitadas credenciais. A confirmação exibida neste ambiente é apenas uma simulação do fluxo de primeiro acesso e não celebra contrato, gera cobrança ou inicia assinatura.',
  ],
  [
    'Recursos disponíveis',
    'A prévia permite explorar contatos, classificação de temperatura, funis de leads e clientes, etapas editáveis, tarefas em lista ou Kanban, indicadores, equipe e identidade visual. Os dados são fictícios e ficam no navegador. A movimentação de cartões não registra uma venda contábil e não dispara mensagens ou automações. Os valores do funil são estimativas e os valores da carteira administrativa são contratuais, não comprovantes de recebimento.',
  ],
  [
    'Acesso e responsabilidades',
    'Na operação planejada, o administrador cadastra empresas e gestores; os gestores cadastram sua equipe. Cada pessoa deverá confirmar os documentos vigentes no primeiro acesso. Na prévia, a troca de perfis serve somente à validação. Utilize apenas informações fictícias. É proibido inserir conteúdo ilícito, código malicioso, credenciais, dados sensíveis reais ou tentar acessar informações sem autorização.',
  ],
  [
    'Dados dos contatos',
    'A empresa é responsável pelas finalidades, bases legais, exatidão, necessidade e transparência dos dados de seus contatos. Também é responsável por revisar mensagens e respeitar as preferências e direitos dessas pessoas. A confirmação dos documentos por um integrante da equipe não autoriza, por si só, o tratamento de dados de terceiros ou o envio de publicidade. A Política de Privacidade detalha essa separação.',
  ],
  [
    'Identidade e personalização',
    'O nome exibido, o logo e as cores da empresa podem ser personalizados pelo gestor. Essa apresentação não muda a titularidade dos direitos sobre o software, as responsabilidades da empresa ou as condições acordadas com o fornecedor.',
  ],
  [
    'Condições comerciais',
    'A demo não oferece contratação automática, planos ou período gratuito de serviço. Na operação real, valor, vencimento, escopo, suporte, encerramento e condições de acesso deverão ser informados e acordados individualmente antes da contratação. Nenhum preço ou obrigação de pagamento é criado ao explorar esta prévia.',
  ],
  [
    'Integrações e evolução',
    'WhatsApp Business, canais de mensagens, Meta, inteligência artificial, módulo financeiro e Google Agenda são possibilidades de evolução. Não fazem parte das integrações ativas da prévia. A implementação e eventuais custos de provedores dependem de avaliação e contratação específicas; a apresentação dessas possibilidades não garante entrega ou data.',
  ],
  [
    'Disponibilidade e segurança',
    'A demo pode ser alterada, interrompida ou ter seus exemplos substituídos durante o desenvolvimento. Não a utilize como fonte única de informações de um negócio. Não há isolamento seguro entre os perfis simulados e os dados locais não têm sincronização ou cópia de segurança oferecida pela aplicação. As condições de continuidade e segurança da operação real serão documentadas antes de sua ativação.',
  ],
  [
    'Documentos e confirmação',
    'A confirmação da demo vincula apenas a pessoa e a empresa simuladas selecionadas, com as versões exibidas e uma data local. A produção exigirá confirmação individual associada ao usuário autenticado e registro no servidor. Os documentos podem ser consultados sem confirmar e a pessoa pode sair da prévia sem prosseguir. Mudanças relevantes poderão exigir nova confirmação.',
  ],
  [
    'Identificação e contato',
    'A identificação jurídica do fornecedor, o canal de suporte, o canal de privacidade e as condições finais de contratação ainda serão definidos. Estes textos são uma base para revisão e não devem ser apresentados como documentos finais de um serviço em produção.',
  ],
];
export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const isPrivacy = kind === 'privacy';
  const title = isPrivacy ? 'Política de Privacidade' : 'Termos de Uso';
  const items = isPrivacy ? privacy : terms;
  return (
    <PublicShell title={title + ' · SUN7CRM'}>
      <main className="legal-page public-container">
        <Link className="home-text-link" to="/acessar">
          <ArrowLeft size={16} /> Voltar ao acesso
        </Link>
        <div className="legal-heading">
          <FileText size={26} />
          <span className="home-eyebrow">TRANSPARÊNCIA</span>
          <h1>{title}</h1>
          <p>
            {LEGAL.label} · versão {isPrivacy ? LEGAL.privacy : LEGAL.terms}
          </p>
        </div>
        <aside className="legal-draft">
          <strong>Documento preliminar para validação</strong>
          <p>
            Esta demo é destinada apenas a dados fictícios e não representa contratação. A
            identificação do fornecedor, os canais de atendimento e as condições da operação real
            ainda precisam ser definidos.
          </p>
        </aside>
        <div className="legal-layout">
          <nav aria-label="Neste documento">
            {items.map(([heading], i) => (
              <a
                key={heading}
                href={'#secao-' + i}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById('secao-' + i)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                {i + 1}. {heading}
              </a>
            ))}
          </nav>
          <article>
            {items.map(([heading, body], i) => (
              <section id={'secao-' + i} key={heading}>
                <h2>
                  {i + 1}. {heading}
                </h2>
                <p>{body}</p>
              </section>
            ))}
            <div className="legal-related">
              <Link to={isPrivacy ? '/termos' : '/privacidade'}>
                {isPrivacy ? 'Consultar Termos de Uso' : 'Consultar Política de Privacidade'}{' '}
                <ArrowRightIcon />
              </Link>
              <Link to="/demo">Voltar à demo</Link>
            </div>
          </article>
        </div>
      </main>
    </PublicShell>
  );
}
function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}
