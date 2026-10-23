# Validação da base — 22/10/2026

## Verificações locais

- TypeScript em modo estrito.
- Build estático de produção com Vite.
- Testes automatizados de persistência, corrupção do armazenamento, erro de quota, datas, valores, filtros de visualização, movimentos e personalização do Kanban.
- Auditoria das dependências de execução: nenhuma vulnerabilidade reportada na verificação inicial (`npm audit --omit=dev`).

## Conferência no navegador

- Dashboard da empresa com gráficos Recharts renderizados.
- Criação de contato, vínculo com o funil de leads e persistência após recarregar.
- Contato de teste ausente ao alternar para outra empresa.
- Adição de etapa no Kanban.
- Cadastro de empresa com gestor fictício e template genérico.
- Máscara monetária: entrada `123456` salva como R$ 1.234,56.
- Painel do Caio filtrado para vencimentos em até sete dias: cartões e tabela coerentes.
- Cadastro de integrante na nova empresa.
- Criação e conclusão de tarefa, com visualização na aba Concluídas.

A inspeção visual foi feita no navegador desktop da prévia. Media queries e alternativas por toque estão implementadas; não houve validação em aparelho físico. Autenticação, RLS e segurança de servidor não foram testadas porque ainda não existem nesta fase. Não interpretar os testes de filtros da prévia como validação de segurança de produção.

## Paletas

Testes de compatibilidade com empresas sem preferência anterior, independência do template, lista de paletas, contraste do texto nos botões e consistência dos tokens.

## Abas e atalhos

Configurações: conferidas alternância entre seções, preservação de rascunho, salvamento independente de cores e dados, URL da seção após recarregar e ausência das abas de gestão na visão de vendedor. Filtros dos atalhos têm testes de fronteiras do período, D+7 e interseção da carteira.

No navegador, o ícone de quentes abriu três contatos com a temperatura e o período corretos; o ícone do valor de leads abriu quatro oportunidades no período de sete dias com o mesmo total do card (R$ 3.190,00); o ícone de próximos vencimentos no painel administrativo abriu as duas empresas correspondentes.

## Rodapé e saída

Conferidos um único link Configurações, botão Sair no rodapé, saída para a tela de entrada simulada, persistência dessa tela ao recarregar e ao navegar diretamente para Contatos, retorno voluntário à prévia e botão visível com menu recolhido. Build e TypeScript passaram após a alteração.

## Tarefas em Kanban

Testes cobrem a compatibilidade dos registros antigos, andamento e conclusão no indicador do dashboard, reabertura sem perder vínculos, preservação de outras empresas e escopo por responsável.

No navegador, uma tarefa foi movida para Em andamento e a mesma etapa apareceu na lista; depois foi concluída e permaneceu em Concluídas após recarregar. A rolagem do quadro permanece dentro da área de trabalho.

## Apresentação das funcionalidades

A página inicial concentra a apresentação principal, a ilustração do quadro e os acessos à demo e às funcionalidades. A página `/#/recursos` reúne os exemplos interativos e detalha os 12 grupos de recursos da prévia, o painel administrativo, seis frentes em alinhamento e integrações futuras. Os exemplos da apresentação não alteram cadastros do CRM. O quadro ilustrativo da abertura permanece sem inclinação. Na apresentação pública, os termos usados são contatos, quadros de atendimento e etapas; os nomes dos módulos internos do CRM foram preservados.

## Contato e simplificação da home — 23/10/2026

Página `/#/contato` acessível pelo menu e pelo rodapé, com botão para o WhatsApp em nova aba. O número é usado apenas no destino do link. A mensagem pré-preenchida é “Olá, vim pelo SUN7CRM e gostaria de saber mais sobre o sistema.” O botão apenas abre a conversa; não envia mensagens automaticamente. Conferidos no navegador a home sem as seções duplicadas de funcionalidades, a navegação pública, o endereço exato do WhatsApp, a seleção de etapa no exemplo e a rolagem da página de recursos (4.531 px de conteúdo em uma área de 936 px, com deslocamento de 1.872 px). TypeScript e build de produção passaram.

## Rolagem das páginas públicas

O shell público possui altura limitada à viewport e rolagem vertical própria, pois html/body/root são fixos para manter a rolagem interna do CRM. Home, recursos, acesso, primeiro acesso e documentos compartilham esse shell. Ao trocar de rota, a posição é reiniciada no contêiner público, e não em window. A área de trabalho continua com rolagem própria em `.workspace`.

## Espaçamento da abertura e cabeçalho responsivo — 23/10/2026

Texto e quadro da home alinhados pelo topo, com 32 px após o cabeçalho no desktop e 24 px nas telas menores. O cabeçalho compacto organiza logo e acesso à demo na primeira linha; Funcionalidades, Contato e Privacidade ficam agrupados na segunda, com espaçamento fixo. Até 1.000 px, a apresentação usa uma coluna para evitar apertar o texto ao lado do quadro.

Conferência no navegador com áreas de 320, 390, 760, 1.000 e 1.920 px, além da janela desktop: nenhuma rolagem horizontal na página, links dentro da largura disponível e espaçamentos superiores de 24/32 px. Em 320 px, o título ocupa três linhas sem transbordar. Navegação para Contato e retorno pela logo conferidos na área de 390 px. As larguras foram simuladas em iframes locais; não houve teste em aparelho físico. A página temporária de conferência foi removida antes do pacote de produção.

## Login separado da demonstração — 23/10/2026

Conferidos o botão Acessar do cabeçalho abrindo `/acessar`, Explorar a demo abrindo `/demo`, entrada no dashboard fictício por Continuar e saída retornando a `/demo`. `/login` redireciona para `/acessar`, e `/entrar` permanece como entrada compatível da prévia. O aviso e os três controles de acesso (e-mail, senha e Entrar) indicam indisponibilidade: nenhum dado de autenticação é recebido, enviado ou persistido. A orientação Esqueci minha senha abre e respeita a hierarquia equipe → gestor → administrador.

Áreas de 320, 390 e 900 px conferidas em iframes locais, além da janela desktop: sem transbordamento horizontal, formulário antes da apresentação nas telas menores e título dentro da largura disponível. A ferramenta temporária de conferência foi removida antes do build. Os 33 testes existentes passaram; a autenticação real continua fora da validação desta etapa.

Ajuste visual posterior: removido o ícone decorativo acima de Acesse sua conta e ocultada a opção Esqueci minha senha. O título passa a iniciar junto ao espaçamento interno do cartão, sem reservar o espaço do ícone.

## Redução de elementos decorativos

Removidos ícones de abertura e avisos em Primeiro acesso, Login, Demo, Contato e documentos. A apresentação de funcionalidades usa rótulos e texto, sem ícones decorativos nos seletores, cartões, listas e exemplos. Botões principais das páginas públicas têm altura mínima de 44 px CSS. Identidade visual, ações de navegação e indicadores de estado dos controles permanecem funcionais. As confirmações de documentos mantêm os mesmos estados e validações.

As referências de interação indicadas pelo usuário estão em `diretrizes-de-interface.md`. Progresso e porcentagens ficam vinculados a etapas ou quantidades verificáveis; esta alteração não adiciona progresso fictício aos fluxos.

O exemplo interativo Tarefas e rotina da apresentação mostra uma barra, a contagem de tarefas concluídas e a porcentagem calculada sobre as três tarefas do próprio exemplo. Marcar e desmarcar atualiza o mesmo estado local do exemplo; não altera os cadastros da demo.

Conferidos no navegador os estados de 0/3 (0%), 1/3 (33%), 3/3 (100%) e a reabertura para 2/3 (67%). A contagem de pendências acompanha as mesmas tarefas.

No navegador, Primeiro acesso sem confirmações e com somente uma confirmação manteve o botão indisponível; com as duas, o botão foi habilitado. Nenhuma confirmação final foi enviada nessa conferência. O exemplo de etapa em Funcionalidades continuou atualizando o texto ao selecionar Agendado; não houve transbordamento horizontal na janela desktop, e o botão Acessar mediu 44 px de altura. Os quatro testes de domínio de aceite passaram.

## Retorno da demo ao site — 23/10/2026

O cabeçalho fixo da área de demonstração apresenta Voltar ao site, com destino à página inicial na mesma aba. O link fica disponível em todas as telas do shell e não encerra a sessão simulada nem altera cadastros. A entrada da demo e o primeiro acesso já mantêm a navegação pública.

Conferidos no navegador o percurso site → demo → dashboard → Voltar ao site e o retorno em uma área de 320 px. O link mediu 44 px de altura. Cabeçalho sem transbordamento horizontal nas áreas de 320, 390 e 1.001 px, simuladas em iframes locais; não houve teste em aparelho físico. A página temporária de conferência foi removida antes do build.

## Demo com entrada direta — 23/10/2026

Esta decisão substitui o fluxo de confirmação simulada descrito nas validações anteriores. A demo não apresenta tela de aceite ao entrar ou trocar de empresa/perfil; não lê nem grava novas confirmações. O requisito de aceite individual no primeiro acesso à conta real continua previsto para a futura autenticação, com registro no servidor. Documentos públicos e consultas opcionais continuam disponíveis.

No navegador, Continuar abriu diretamente o painel do administrador. Trocas para Recepção e Casa & Forma mantiveram o dashboard sem apresentar documentos ou botão de confirmação. Após recarregar, o dashboard do perfil inicial continuou acessível e Voltar ao site permaneceu visível. O aviso de confirmação simulada foi retirado do cartão de entrada e da página de funcionalidades; Configurações não indica falta de aceite da demo.

## Administração reservada e fundação Supabase — 23/10/2026

A decisão posterior retira a administração do Caio da demo pública. Entrada e seletor interno oferecem gestor, vendedor/consultora e recepção. O provider rejeita perfil administrativo, as rotas da demo não montam o dashboard administrativo ou o cadastro de empresas e `/admin/*` e `/empresas` direcionam ao acesso ainda indisponível. As telas administrativas foram preservadas no código. A apresentação pública também deixou de incluir a vitrine e os itens administrativos entre os recursos exploráveis.

Conferidos no navegador os três perfis disponíveis na entrada e no seletor interno, a entrada direta no dashboard do gestor e o direcionamento de `/empresas` e `/admin` à tela de acesso. Nenhum dos seletores apresentou a opção de Caio.

O script de migração foi aplicado a PostgreSQL em memória (PGlite), com fixture local de Auth, duas empresas e diferentes vínculos. Os 25 testes passaram, incluindo RLS entre empresas, ausência de acesso anônimo, ausência de promoção de perfil pelo cliente, cobrança restrita, chaves estrangeiras compostas, etapa do quadro, desativação de vínculo/empresa, conclusão/reabertura de tarefas, versões e autoria dos aceites reais, auditoria e bootstrap administrativo. Os 33 testes existentes da aplicação também passaram. Não houve execução de SQL ou provisão de contas no Supabase remoto; JWT, Auth, Data API, Storage e Edge Functions do projeto real ainda precisam de validação.

`getSupabaseClient()` foi preparado sob demanda, com armazenamento de sessão próprio e somente variáveis públicas. O provider da demo não usa esse cliente. Nenhuma chave secreta foi colocada nos arquivos; as configurações públicas locais permanecem fora do Git.
