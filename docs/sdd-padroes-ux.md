# SDD — padrões globais de UX do SUN7CRM

## Situação consolidada — 29/10/2026 (revisão 88740ec)

Esta seção é o estado atual; os checklists abaixo preservam o histórico de cada rodada. **SDD ainda não encerrado:** testes automatizados aprovados não substituem a homologação autenticada, mobile e por volume.

- [x] Preservar as mudanças recentes do PR #30, incluindo paginação, filtros do Kanban, ModalFooter, Planos compactos, importação paginada e Dashboard.
- [x] Corrigir o acesso às medalhas: o CSS da aba Conquistas ocultava o cabeçalho com o botão do gestor. Agora Conquistas → Configurar medalhas abre diretamente Medalhas; Comercial → Configurar metas continua abrindo Funil e metas. Regra de gestor com settings.edit preservada.
- [x] Prévia 88740ec: navegar até Conquistas, abrir Configurar medalhas, adicionar uma linha de medalha e cancelar sem persistir dados fictícios. Não equivale a salvar medalha na empresa real.
- [x] Prévia desktop 88740ec: conferir Embaixadores sem campanha, tabela/paginação de participantes e modal Nova campanha; foco inicial no nome, datas lado a lado e rodapé sem sobreposição.
- [x] Prévia 88740ec: conferir presença de filtros de criação, rolagem superior e seletor 10/50/100/Todos do Kanban. Arraste em touch e carga de 300+ cards ainda pendentes.
- [x] Build e TypeScript frontend; 219 testes frontend, 183 de banco local e 64 de funções: 466 aprovados. TypeScript das funções aprovado. Não houve execução desses testes contra dados de produção.
- [x] CI Verificações do commit 88740ec aprovado: https://github.com/pedrobertani/sun7crm/actions/runs/40958187683 . Deploy de preview concluído: https://97045e12.sun7crm.pages.dev .
- [ ] Sessão real: Conquistas da Empresa B, inclusão/salvamento de medalha e persistência após recarga; verificar gestor, consultor, recepção e administrador.
- [ ] Sessões distintas: confirmar propagação de alterações e isolamento entre empresas.
- [ ] Última revisão em celular/touch e todos os temas, incluindo tabelas, modais longos e Kanban volumoso. Resultados de previews anteriores não certificam este HEAD.
- [ ] Importação com 1/50/1.000 linhas, erros e duplicados na prévia paginada, sem sobrescrever cadastros.
- [ ] Completar inventário de rodapés customizados/CSS legado e páginas públicas; registrar exceções justificadas antes de declarar padronização integral.

**Limite da validação atual:** navegador está na demo, sem sessão autenticada. As homologações de Planos relatadas pelo usuário continuam registradas como tal; não foram repetidas nesta sessão. Não aprovar merge com base apenas nesta rodada.

## Objetivo e escopo

Revisar demo, aplicativo de gestor/funcionário e administração. Centralizar aparência e comportamento de ações, títulos, abas, tabelas, cards e modais. Não alterar regras financeiras, permissões ou persistência de negócio nesta revisão. A validação funcional final do produto será retomada depois desta etapa.

Base auditada: main `ba47976b3121679707962f10a7ca151d932d4f25` (28/10/2026). PR #29 está aberto e converte históricos de embaixadores da demo em tabelas; preservar essa alteração em vez de sobrescrevê-la.

## Diagnóstico dos PRs recentes

- #21: Tabs compartilhado para Plano, formatos de gráfico e atualização automática.
- #22–24: metas, funil, conquistas e permissões; novas abas locais duplicaram a navegação compartilhada.
- #25: permissões agrupadas por área; manter chaves e autorização.
- #26: Dashboard dividido por assunto, porém com mais um estilo de abas.
- #27–28: compactação local do Dashboard; regras acumuladas e `!important` tratam sintomas.
- #29: histórico tabular da demo; mudança adequada para dados comparáveis.
- Regra de workspace/admin impõe 44px a todos os botões e anula tamanhos compactos.
- Ações de tabela misturam ícones e botões textuais grandes; quebra de linha aumenta desnecessariamente a altura.
- Demo, app e admin usam escalas diferentes de célula e título.

## Contrato visual e de interação

1. Botão principal com verbo e objeto curto (Novo contato, Salvar, Pagar mensalidade). Uma ação principal por contexto.
2. Ações repetidas de linha: ícone de 16px, controle de 32px no desktop, nome acessível e tooltip em hover/foco. Ações que exigem clareza financeira permanecem textuais.
3. Botão normal 36px; pequeno/ícone 32px. Em dispositivo de ponteiro grosso, mínimo 44px. Nunca reduzir só a fonte para esconder overflow.
4. Ações da linha permanecem agrupadas e alinhadas; dados longos quebram em suas células. Rolagem horizontal fica no contêiner da tabela, nunca na página.
5. Tooltips usam tokens do tema, funcionam por foco e Escape e não são o único nome acessível. Ação desabilitada explica o motivo.
6. Título do registro abre o detalhe/edição permitido. Não transformar a linha inteira em botão nem interferir em seleção de texto.
7. Tabelas para comparar registros repetidos; cards para indicadores e unidades visuais (Kanban, medalhas, gráficos). Detalhes singulares usam pares rótulo/valor.
8. Mesma escala de títulos: página 26px, seção/modal 18px, subseção 14px. Descrição só quando explica tarefa, filtro ou consequência; remover frases genéricas repetidas.
9. Abas/seletores reutilizam componentes compartilhados. Não esticar poucas opções por toda a tela. Overflow local em telas pequenas; preservar formulários e permissões.
10. Cor vem da identidade selecionada. Sem cores fixas novas para botões, tooltips ou seleção.
11. Erros, confirmações financeiras, restrições de acesso e informações necessárias não são removidos por concisão.

## Organização e prioridade de uso

Sem telemetria disponível, frequência é uma hipótese de UX: operações de contatos, funil e tarefas são frequentes; configurações, permissões e redefinição de senha são ocasionais. Ações frequentes ficam visíveis. Ações administrativas não disputam destaque com criação/atendimento. Não esconder operações essenciais apenas para diminuir a tela.

| Área                 | Estrutura escolhida                         | Revisão                                                        |
| -------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Dashboard            | KPIs compactos, gráficos e abas por assunto | Unificar navegação; preservar compactação recente              |
| Contatos             | Tabela com título clicável, ações compactas | Demo e app; WhatsApp/histórico/editar/cards                    |
| Funil                | Kanban com cartões                          | Título legível, ações compactas; não converter fluxo em tabela |
| Tarefas              | Lista/tabela e calendário quando aplicável  | Editar compacto; criação textual                               |
| Relatórios           | Tabelas de carteira e equipe                | Separar contagens em colunas, eliminar parágrafo por linha     |
| Estratégias          | Lista/tabela de campanhas e detalhes        | Preservar métricas; encurtar ações repetidas                   |
| Embaixadores         | Cadastro e históricos tabulares             | Aproveitar PR #29; pagamentos/indicações comparáveis           |
| Catálogo e etiquetas | Tabelas                                     | Edição consistente; cores de etiquetas são dados               |
| Equipe/permissões    | Tabela de pessoas e árvore de permissões    | Ações secundárias compactas; não mudar autorização             |
| Metas/conquistas     | Funil e medalhas; configuração em abas      | Unificar abas e remoção de itens                               |
| Plano/cobrança       | Resumo + abas + tabela de histórico         | Manter pagamento explícito, erros e valores                    |
| Empresas/admin       | Tabela de empresas; detalhes por assunto    | Usuários tabulares; ações e abas compartilhadas                |
| Configurações/conta  | Formulários e pares rótulo/valor            | Preservar clareza de escolhas                                  |

## Checklist executável

- [x] Inspecionar imagens enviadas e localizar relatório correspondente.
- [x] Ler PRs recentes e atualizar fonte local sem perder alterações posteriores.
- [x] Definir contrato visual, critérios de tabela/card e prioridades de uso.
- [x] Centralizar tokens de tamanho, espaçamento, títulos e células.
- [x] Remover overrides que anulam variantes compactas.
- [x] Implementar tooltip compartilhado acessível e resistente a clipping.
- [x] Padronizar ações de linha da demo, app e admin.
- [x] Corrigir relatório de atividade: ações alinhadas e contagens tabulares.
- [x] Unificar seletores de Dashboard, metas, relatórios e cobrança.
- [x] Revisar textos genéricos e excesso de instruções por linha.
- [x] Incorporar histórico tabular de embaixadores sem conflitar com PR #29.
- [ ] Revisar modais, estados vazios, overflow e responsividade.
- [ ] Remover CSS substituído e componentes/importações sem uso.
- [x] Executar TypeScript, testes pertinentes e build.
- [ ] Conferir visualmente desktop e viewport estreito, foco/tooltip e troca de abas.
- [x] Registrar evidências e limites de validação por perfil/tema.
- [x] Preparar PR com escopo final e verificação; não declarar produção atualizada antes do deploy.

## Critérios de aceite

- Ações do relatório enviado ficam na mesma linha, com o mesmo tamanho.
- Tooltips não ficam cortados por cards/tabelas/modais e têm nome acessível independente.
- Não há nova cor fora dos tokens; contraste deve ser conferido em cada identidade.
- Não há scroll horizontal da página a 390px; tabelas extensas podem rolar localmente.
- Redimensionar não esconde ação, valor ou mensagem de erro.
- Componentes têm documentação e verificação de regressão de seus contratos.
- Checklist distingue revisão de código, teste automatizado e teste real autenticado.

## Evidências e pendências

Build e TypeScript aprovados; 199 testes frontend passaram (34 arquivos), incluindo 4 cenários novos de nomes acessíveis, links, não submissão ao trocar visualização e contagens do relatório. Contrato de cores existente passou. Nenhuma alteração de banco/backend.

Revisão visual ainda pendente: o navegador remoto recusou conexão ao servidor local (ERR_CONNECTION_REFUSED). Será usada prévia Cloudflare. Testes autenticados de cada perfil não foram executados nesta rodada. O trabalho não será considerado validação completa do sistema enquanto houver essas pendências.

## Revisão complementar — 29/10/2026

- Commit de revisão inicial do Work: `cc41a45`. GitHub Actions #111 passou em TypeScript, testes frontend, testes de banco, Edge Functions e build.
- A inspeção do CSS identificou que `body .themed-workspace[data-theme] .page` tinha especificidade suficiente para sobrepor a largura compacta do Dashboard real. Corrigido com override específico para Dashboard em desktop (1120px).
- `.icon-button` ainda recebia altura/largura mínimas da variante normal no workspace e administração, contrariando o padrão de 32px. Corrigido para `--control-compact`, preservando 44px em ponteiro grosso e tamanhos explícitos dos controles de conta.
- Tabelas administrativas: regra de `flex-wrap` das ações tinha especificidade maior que o estilo genérico de célula. Corrigida para manter ações repetidas na mesma linha, com rolagem no contêiner.
- O motivo de indisponibilidade agora é alcançável pelo teclado via wrapper focável de tooltip para botões nativamente desabilitados; adicionada asserção no teste existente. O botão permanece desabilitado.
- GitHub Actions #113 (`7fe5896`) aprovado depois desses ajustes (TypeScript, testes, banco, funções e build).
- Inspeção de navegador via Cloudflare Browser Rendering na prévia `cc41a45`: Dashboard da demo em 390×844 expôs os seletores e KPIs esperados na árvore de acessibilidade. Embaixadores em 390px exibiu cabeçalho, ações primárias e informações iniciais sem cortes evidentes na captura; o HTML renderizado confirmou tabelas de indicações anteriores e estado vazio explícito para pagamentos.
- **Limites de evidência:** a captura móvel examinou apenas a parte visível da página, e as inspeções de navegador acima foram feitas antes dos últimos ajustes CSS. Elas não substituem testes completos de rolagem, tooltip em bordas, modais, temas e usuários autenticados no aplicativo real. O CI valida compilação e comportamento automatizado, não equivalência visual de todos os perfis.

### Itens restantes para homologação visual de produção

- [ ] Testar no navegador a visualização completa e o overflow local de tabelas, menus e modais em 390px, tablet e desktop, com mouse e teclado.
- [ ] Percorrer as identidades claro/escuro e os perfis reais gestor, consultor e recepção, incluindo permissões, pagamento e confirmações de funil.
- [ ] Revisar CSS legado e importações restantes antes do merge, registrando remoções ou justificando exceções.

**Regra de liberação:** manter PR #30 aberto e sem merge até os três testes manuais acima. O PR #29 continua preservado; sua mudança de históricos já está incluída no #30 e poderá ser fechado como substituído após integração segura.

## Campanhas e paginação — 29/10/2026

- [x] Reutilizar `ViewSwitcher` para as seções **Resumo, Indicações e Histórico** da campanha, tanto na demo quanto no aplicativo real.
- [x] Manter seletor de campanha e ações de gestão fora das abas internas.
- [x] Restaurar aba Resumo ao selecionar outra campanha; resetar paginação da campanha.
- [x] Usar `Pagination` compartilhado para limitar tabelas a 10 registros por página; deixar controles fora da rolagem horizontal.
- [x] Paginar participantes, indicações, registros antigos e pagamentos da demo.
- [x] Paginar participantes, indicações e quitações da campanha real, além da lista de embaixadores e métricas.
- [x] Preservar indicadores e totais calculados sobre todo o conjunto, não somente a página visível.
- [x] Adicionar teste automatizado de opções de abas e faixas de paginação, incluindo última página.
- [ ] Conferir visualmente troca de abas e páginas no desktop e celular, demo e perfis reais.

**Observação de homologação:** a paginação de indicações no app real é feita pela API com tamanho de página 10; os totais e quitações já retornam coleções completas e são paginados para exibição no cliente. Para volumes muito grandes, avaliar paginação backend específica também para essas coleções sem afetar a apuração financeira.

## UX transversal — listas, filtros e relatórios (29/10/2026)

**Contrato de paginação:** listas tabulares usam `Pagination`, com seletor 10/50/100, indicador de página/total e anterior/próxima. Padrão inicial: 10. A escolha do tamanho volta para a primeira página; filtros de texto implementados na tela fazem o mesmo. Em telas com consulta por página (contatos, catálogo, estratégias, tarefas, card activity, indicações, métricas), o limite é enviado ao backend. Em listas já carregadas, o corte é apenas de apresentação. Os totais agregados sempre representam a coleção completa.

**Cobertura implementada no PR #30:**
- [x] Demo — contatos, tarefas em lista, estratégias, catálogo, etiquetas, integrantes, empresas, campanhas (participantes, indicações, registros legados e pagamentos), relatórios de carteira e equipe.
- [x] App real — contatos, tarefas, estratégias, catálogo, etiquetas, relatórios de cards, carteira e equipe, integrantes, embaixadores, métricas, campanhas (apuração, indicações e quitações).
- [x] Admin — lista de empresas, contas de usuários da empresa e lista lateral de planos.
- [x] Cobrança — histórico de cobranças e movimentações de acesso. O RPC existente do histórico de cobranças entrega janelas de 20; para seleção de 50/100, são combinadas janelas de leitura sem alterar as funções que registram pagamentos.
- [x] Relatórios — `ViewSwitcher` com Carteira de clientes e Atividade da equipe (dentro da opção superior Clientes e equipe no app real); espaçamento de filtros, tabelas e paginação revisado.
- [x] Testes de renderização para abas e seletor de 10/50/100.
- [ ] Homologar alteração de tamanho e mudança de páginas em ambiente real e demo, com volume acima de 100 itens, mobile/desktop, temas e permissões.

**Exceções:** Kanban e gráficos não são tabelas de registros, e portanto não recebem paginação. O histórico de acesso carrega apenas os eventos recentes expostos pela API atual, não o histórico ilimitado; valores maiores no seletor não criam eventos adicionais. A apuração de comissão não muda quando a tabela é paginada.

**Critérios de aceite visual adicionais:** controles de paginação visíveis mesmo com menos de 10 itens; após mudar 10/50/100 não se deve exibir página vazia nem usar totais parciais; filtros e botões não devem quebrar as tabelas ou provocar scroll horizontal da página; estados vazios e permissão de usuário mantidos; sem merge até CI e testes visuais.

## Kanban com muitos cards — 29/10/2026

Decisão de UX baseada na arquitetura de quadros Jira 2026: a altura do quadro não cresce proporcionalmente à quantidade de cards; rolagem vertical por etapa, rolagem horizontal com acesso no topo e no rodapé, e paginação segmentada. Referência: anúncio oficial de julho de 2026, "A faster, more flexible board for software teams" da Atlassian. Rolagens aninhadas têm um custo, então só a lista de cards de cada etapa recebe rolagem vertical; cabeçalho, total da etapa e paginação permanecem fixos.

- [x] Aplicar `KanbanScroll` reutilizável na demo e no app real: rolagem horizontal superior e inferior sincronizadas.
- [x] Limitar altura das colunas de forma responsiva, com rolagem vertical dentro de cada lista.
- [x] Mostrar título e quantidade real da etapa sem rolar junto com os cards.
- [x] Selecionar 10/50/100 cards por etapa; paginação Anterior/Próxima independente em cada coluna.
- [x] Demo: paginar o conjunto já disponível de cards por etapa, sem alterar regras de arraste, venda ou filtros.
- [x] App real: trocar paginação global de 50 cards por consultas filtradas por `board_id` e `stage_id` com paginação independente, mantendo RLS no backend e metadados de contatos/histórico.
- [x] Arraste próximo ao topo/rodapé de cada coluna ativa rolagem vertical; arraste nas bordas do quadro mantém rolagem horizontal.
- [x] Corrigir condição de última página vazia após movimento entre etapas e manter totais reais visíveis.
- [x] Testar renderização do componente compartilhado de rolagem e acesso via teclado.
- [ ] Testar no navegador com 300+ cards distribuídos em etapas, em 390px/desktop e com perfis/permissões reais; confirmar movimentação, rolagens simultâneas e se o filtro retorna os cards esperados.

**Trade-off:** etapa com muitos cards faz uma consulta própria ao backend quando muda a página. Isso custa mais chamadas iniciais do que a antiga página global, mas impede que colunas pareçam vazias por os cards estarem em outra página. Monitorar desempenho em instalações com 10 etapas, e considerar cache de páginas se necessário.

**Aviso de liberação:** o PR #30 continua sem merge até o CI final e a homologação visual/manual. Não confundir preview da Cloudflare com publicação de produção.

## Kanban — revisão Azure Boards após avaliação visual (29/10/2026)

**A versão anterior, com rolagem vertical por coluna e altura forçada de até 670px, foi rejeitada após inspeção da prévia em zoom 90%. Este item substitui as regras visuais anteriores de rolagem vertical independente.** Referência de produto: Azure DevOps Blog, *Condensed views on Kanban and Sprint boards* (16/02/2026), que introduziu alternância entre cards completos/condensados para mostrar mais itens por viewport; documentação oficial Azure Boards de personalização de cards.

- [x] Remover rolagem vertical de dentro de cada coluna e usar **uma rolagem vertical única na lateral do quadro** quando o conteúdo exceder a altura escolhida.
- [x] Manter rolagem horizontal superior sincronizada com a barra nativa inferior do quadro (somente duas horizontais).
- [x] Evitar colunas artificiais do tamanho da coluna mais longa; altura natural por quantidade de cards exibidos.
- [x] Mostrar por padrão cards compactos com espaçamentos reduzidos; alternância Compactos/Completos no cabeçalho do quadro.
- [x] Permitir altura máxima ajustável do quadro: Automática (responsiva), 560, 720 e 900px.
- [x] Preservar paginação independente 10/50/100 por etapa, permitindo navegar por conjuntos grandes sem renderizar 300 cards.
- [x] Adaptar autoscroll do arraste para a única área vertical do quadro.
- [x] Manter título, contagem e totais por etapa e regras de confirmação de venda.
- [ ] Homologação visual em navegador **100% zoom**, 390px, desktop médio, monitor amplo, temas claro/escuro e colunas com 1, 3, 10 e 300 cards, inclusive arraste e paginação.
- [ ] Ajustar dimensões finais conforme inspeção visual real, se necessário.

**Não confundir** resultados automatizados com homologação visual completa; nenhum merge de #30 enquanto esses casos estiverem pendentes.

## Filtro temporal e barra de ferramentas do funil — 29/10/2026

- [x] Alinhar a navegação por funis em uma faixa e os filtros em outra, com largura flexível e quebra organizada em mobile.
- [x] Reaproveitar `KanbanPeriodFilter` na demo e no aplicativo real.
- [x] Oferecer filtro da **data de criação do card**: Todo o período (padrão), Dia, Mês, Ano e Intervalo personalizado.
- [x] Tratar a data final como inclusiva por meio do limite superior exclusivo do dia seguinte; respeitar viradas de mês/ano.
- [x] Fazer o filtro do app real na consulta ao banco, antes de paginar as etapas; respeitar RLS e manter os totais por etapa consistentes.
- [x] Limpar as páginas de cada etapa ao mudar busca, período ou quantidade por página.
- [x] Reconhecer links existentes com parâmetros `de` e `ate` na demo, sem impor filtragem por data à navegação padrão.
- [x] Testar faixas de dia, mês bissexto, ano, intervalo e estados inválidos.
- [ ] Validar visualmente as duas versões em 100% de zoom, desktop e celular, com filtro preenchido e sem filtro.
- [ ] Testar filtros combinados a 10/50/100 e movimentações com grande volume de dados reais.

**Sem alteração do significado financeiro:** o período filtra cards pela **criação**, não pela data do fechamento ou pagamento. Não alterar apuração de vendas nem regras de confirmação.

## Correção de densidade e alinhamento — revisão do usuário (29/10/2026)

**Decisão final de UX:** responsividade é de responsabilidade do CSS; **não apresentar controles de Cards compactos/completos nem de Altura automática/manual no sistema**. Os seletores adicionados anteriormente foram rejeitados pelo usuário e removidos. A configuração permanente é cards compactos e altura máxima responsiva por CSS. Preservar as duas rolagens horizontais sincronizadas e a rolagem vertical única do quadro.

- [x] Remover estados, seletores e propriedades da tela de altura/densidade do componente `KanbanScroll`.
- [x] Converter as regras condicionais `data-card-density` em estilos compactos permanentes.
- [x] Deixar altura automática por `clamp(460px, calc(100dvh - 260px), 840px)`, sem opção de configurar pelo usuário.
- [x] Deixar abas Leads/Clientes, botão +, busca, filtro temporal, quantidade por etapa e total na mesma faixa visual, alinhados pela borda inferior, com quebra responsiva apenas quando necessário.
- [x] Aplicar o mesmo alinhamento na demo e no workspace real, preservando os controles de administração do funil e o botão de adicionar funil mesmo sem quadros cadastrados.
- [x] Atualizar teste de renderização para garantir a ausência dos seletores removidos.
- [ ] Homologar a barra e o quadro com viewport 390px, 1366px e 1920px a 100% de zoom em tema claro/escuro e arraste entre etapas.

**Critério visual:** não deixar faixas vazias ou botões flutuando entre a navegação e o topo do quadro; nenhuma configuração de compactação/altura deve aparecer no sistema.

## Posição dos controles no funil — aprovação de layout (29/10/2026)

- [x] Preservar integralmente a navegação **Leads / Clientes / +** acima do Kanban.
- [x] Manter busca e filtro **Período** acima do Kanban; alinhar Período à **direita** no desktop, quebrando responsivamente no mobile.
- [x] Mover o seletor **10/50/100 cards por etapa** e o total de oportunidades para **abaixo do quadro**, como no padrão de paginação das listas.
- [x] Aplicar o mesmo posicionamento na demo e no app real sem alterar consulta, filtros ou regras de movimentação.
- [ ] Homologar visualmente a nova disposição em zoom 100%, desktop e mobile, após prévia Cloudflare do commit correspondente.

**Nota:** não mover o seletor de funil, suas abas ou o botão +. A paginação por etapa permanece dentro do rodapé de cada coluna, como já implementado; o controle global de quantidade fica abaixo do quadro.

## Filtro explícito por data — correção UX (29/10/2026)

- [x] Substituir o rótulo ambíguo `Período` por `Data` e opções `Todas as datas / Dia / Mês / Ano / Intervalo`.
- [x] Exibir campo nativo de calendário mesmo no estado `Todas as datas` (vazio, sem restringir resultados); escolher uma data ativa automaticamente o filtro por dia.
- [x] Manter seleção de mês, ano e intervalo, com suas respectivas entradas de data; não confundir período dos cards com paginação.
- [x] Reutilizar o mesmo componente em demo e app real; manter filtro à direita em cima, com controle de quantidade e total embaixo.
- [x] Adicionar teste de markup para verificar a presença direta do calendário e acessibilidade.
- [ ] Homologar visualmente a prévia publicada e os diferentes modos em desktop e celular.

**Sem alterar regra de negócio:** o filtro existente atua na data de criação do card. Mudanças de critério para data de movimentação/fechamento devem ser tratadas separadamente para não alterar totais silenciosamente.

## Kanban — opção Todos na quantidade por etapa (29/10/2026)

- [x] Oferecer **10, 50, 100 e Todos** exclusivamente no controle do Kanban, no rodapé, sem alterar os seletores padrão de outras listas.
- [x] Compartilhar o seletor e as opções entre demo e app real.
- [x] Quando Todos: renderizar a lista inteira de cada etapa e ocultar a paginação individual daquela etapa.
- [x] No app real: carregar todos os resultados filtrados por empresa, quadro, etapa, busca, contato e datas usando lotes de 200; não truncar no limite de uma consulta.
- [x] Buscar contatos, histórico e etiquetas de listas longas em lotes de até 100 identificadores, respeitando o isolamento existente por empresa.
- [x] Ao alternar 10/50/100/Todos, reiniciar a página de cada etapa para não manter índices antigos.
- [x] Testes: seletor compartilhado; 305 cards reais simulados em duas consultas; histórico e etiquetas em lotes de 100.
- [ ] Homologar visualmente e testar arraste em Todos com 300+ cards e zoom de 100% no desktop e celular.

**Trade-off consciente:** Todos pode exigir mais consultas e renderizar centenas de cards; altura e rolagem continuam automáticas por CSS, sem qualquer configuração visual no aplicativo. Não alterar paginação global de tabelas fora do Kanban.

## Tarefas — restauração do layout aprovado e paginação no quadro (29/10/2026)

Contexto: a substituição geral de grupos segmentados por `ViewSwitcher` com sublinhado prejudicou a hierarquia desta tela. Os prints de comparação mostram que o formato anterior, com **Quadro Kanban / Lista** e **Todas / Pendentes / Atrasadas / Concluídas** como botões segmentados compactos, era mais claro. Evitar aplicar padrões globais sem considerar a função do componente.

- [x] Recriar o seletor segmentado original de Quadro Kanban/Lista com ícones, sem alterar seus destinos e mantendo estados `aria-pressed`.
- [x] Recriar o filtro de situações em grupo segmentado compacto, junto da busca no painel, com padding e bordas alinhados.
- [x] Corrigir a barra superior do módulo para manter contador junto da visualização e manter o botão Nova tarefa no cabeçalho.
- [x] Preservar paginação da lista (10/50/100) e adicionar no quadro por etapa (10/50/100/Todos), sem truncar cards.
- [x] Testes de markup do seletor original, estados e página com 305 tarefas.
- [ ] Conferir a prévia Cloudflare com zoom 100% em desktop e mobile e validar scroll/arraste.
- [ ] Conferir paridade entre demo e app real: o app real permanece com lista operacional e paginação; o quadro de tarefas da demo ainda demanda decisão separada sobre implementação real. Não afirmar equivalência funcional sem essa validação.

Regra: **restauração de layout não implica regressão de acessibilidade nem eliminação de paginação**. Não substituir seletores segmentados por abas sublinhadas em Tarefas.

## Relatórios — alinhamento dos filtros da Carteira de clientes (29/10/2026)

- [x] Buscar cliente/telefone, Responsável e Sem atividade há seguem a mesma linha de base, com alturas de controle idênticas (42px) e rótulos com a mesma altura.
- [x] Remover desalinhamento vertical causado pela mistura entre campo de busca sem cabeçalho e selects rotulados; mostrar o rótulo **Buscar** acima do campo.
- [x] Aplicar grade responsiva de três colunas no desktop, duas no tablet e uma no celular, sem sobreposição nem largura fixa excessiva.
- [x] Reduzir padding e espaçamento vertical em `report-table-section`; preservar linha divisória, tabela, ordenação, filtros e paginação.
- [x] Teste de regressão exige os três controles com estrutura rotulada no componente compartilhado `ActivityReportView`, reutilizado pela demo e pelo app real.
- [ ] Inspeção visual da prévia Cloudflare a zoom 100%, temas claro/escuro e mobile/tablet/desktop; confirmar a posição da busca ao lado dos selects e a tabela com paginação.

Não modificar outras abas e controles globais para corrigir este componente. Todos os ajustes são escopados à classe `report-table-section`.

## Auditoria sistêmica de densidade visual e alinhamento — rodada 29/10/2026

**Objetivo:** eliminar ajustes isolados repetitivos e validar o CRM de ponta a ponta em termos de espaços, hierarquia, painéis, controles, largura de tabelas e paridade demo/real. *Não significa redesenhar todos os módulos: manter o que funciona e só reduzir contêineres cuja única função seja criar uma borda/padding duplicado.*

### Regras globais verificáveis por pixels

- [x] Definir espaçamento de conteúdo com unidades de 4px e variações de 8/12/16/20/24px. Evitar margem extra entre painel, toolbar e tabela.
- [x] Padronizar filtros no mesmo plano: rótulos de altura consistente e campos de 42px no Relatório de Atividade. A busca não pode ficar flutuando sem rótulo, e nenhum controle deve deslocar o vizinho.
- [x] Evitar barrinhas, caixas e cards dentro de outro card sem uma função semântica: no Histórico de Cobranças retirar card de filtros; em Embaixadores substituir banner verboso por detalhes expansíveis.
- [x] Tabelas devem preservar coluna Ações: Relatório de Atividade usa `table-layout:fixed`, distribuição por coluna e cabeçalhos que podem quebrar linha em telas desktop.
- [x] Paginação não deve ser filha de um elemento com `overflow-x:auto`: corrigido em Equipe real.
- [ ] Validar com o DOM renderizado/prints a 390, 768, 1366 e 1920px e zoom 100%: label e campo com desvio vertical <= 2px, nenhuma sobreposição, controles com mesma altura, conteúdo horizontal totalmente acessível.
- [ ] Em tabelas longas no mobile, confirmar rolagem horizontal apenas dentro do contêiner e exibição de Ações quando o usuário rolar; nenhuma rolagem horizontal do *documento*.
- [ ] Checar tema claro e escuro, modais e acessibilidade do foco na versão publicada de cada perfil.

### Inventário por módulo (verificação estática e inspeção de prévia)

| Área | Inspecionado no código | Inspeção visual | Ajuste/status |
| --- | --- | --- | --- |
| Demo Relatórios — Carteira e Atividade | [x] | [x] preview bda5d832 desktop 1440, mobile 390 | [x] filtros, tabela, padding; [ ] revalidar commit novo |
| Dashboard demo/real | [x] | [ ] | [ ] comparar cards, tabelas, espaçamento e KPIs |
| Kanban demo/real | [x] | [ ] nova versão | [x] largura/rolagem/paginação/data já no PR; [ ] alto volume + 390px |
| Contatos demo/real | [x] | [x] demo desktop | [x] paginação já no PR; [ ] mobile e ações |
| Tarefas demo/real | [x] | [x] demo desktop | [x] restaurado visual segmentado e paginação; [ ] paridade do quadro real |
| Estratégias demo/real | [x] | [x] demo desktop | [x] barra/tabela avaliadas; [ ] mobile e detalhe |
| Embaixadores demo/real | [x] | [x] demo desktop | [x] regra longa recolhida, espaçamento; [ ] campanha com dados e mobile |
| Catálogo / etiquetas demo/real | [x] | [ ] | [x] paginação já no PR; [ ] tabelas e ações no mobile |
| Equipe demo/real | [x] | [ ] | [x] real: paginador separado da rolagem horizontal; [ ] mobile |
| Administração — empresas e usuários | [x] | [ ] | [ ] verificar cards de detalhe e tabelas por perfil |
| Planos / histórico de cobranças | [x] | [ ] | [x] filtros sem card duplicado; [ ] colunas e painel de detalhe |
| Configurações | [x] | [ ] | [ ] painéis/abas/modais e barra responsiva |
| Permissões | [x] | [ ] | [ ] densidade de matriz e ações |
| Shell da demo / workspace / admin | [x] | [ ] | [ ] margens e breadcrumb em 390/768/1366/1920 |
| Login, landing, páginas públicas | [ ] | [ ] | [ ] verificar coerência do sistema visual fora do CRM |

**Evidência visual inicial:** snapshots do Cloudflare na revisão anterior (`114a2957`) em 1440×850 para Tarefas, Relatórios, Estratégias, Contatos, Embaixadores; Relatórios também em 390×844. Isso verifica a aparência *daquela versão*, **não** constitui homologação do último commit. As alterações posteriores devem passar por uma segunda rodada de captura.

### Checklists de regressão da rodada

- [x] Ler as principais telas da demo, admin e workspace real e classificar se contêm cards, filtros, tabelas, navegação e paginação.
- [x] Corrigir os três problemas adicionais confirmados por inspeção: filtro duplicado de cobranças, banner permanente de regra em Embaixadores, paginação de Equipe em área rolável.
- [x] Manter lógica de dados, filtros, busca, RLS e permissões sem mudanças.
- [ ] Testar build, typecheck, frontend, banco e funções no commit final desta rodada.
- [ ] Atestar visualmente o commit final no Cloudflare antes do merge.
- [ ] Revisar operações de importação, dialogs e ações de cada papel com sessão real (gestor, vendedor, recepção, plataforma).

**Critério de bloqueio:** o PR #30 não deve ir à `main` apenas com CI verde. Exigir homologação visual dos pontos marcados como pendentes, sem confundir screenshots de uma prévia anterior com a prévia do HEAD.

### Inspeção adicional de screenshots e correções — rodada 2, 29/10/2026

As capturas abaixo são evidência **visual** em tamanhos reais de viewport, porém de prévias já publicadas **anteriores ao HEAD**; telas autenticadas de outros papéis continuam fora desta validação visual.

- [x] Desktop 1440×850: Dashboard, Tarefas, Relatórios, Contatos, Estratégias, Embaixadores, Configurações, Plano e landing pública.
- [x] Celular 390×844: Relatórios, Contatos, Tarefas e Embaixadores.
- [x] Revisão do Relatório de Atividade na prévia do commit `18415440`: labels e campos uniformes, coluna Ações no enquadramento desktop e menor espaço vertical entre filtros e resultados.
- [x] Identificado por screenshot que a regra de Embaixadores consumia várias linhas no mobile antes da seleção de campanha. Substituída por `details` recolhível, mantendo as informações acessíveis.
- [x] Identificado por screenshot que Minha conta ocupava um painel muito amplo para poucos controles; abas e painel de Configurações limitados juntos a 940px, sem impor largura fixa no celular.
- [x] Plano já limita o painel principal a aproximadamente 920px; não criar outra camada nem alterar regra financeira.
- [x] Contatos e Tarefas apresentam tabela/quadro contidos em 390px. A tabela de Contatos requer rolagem horizontal interna para ver as colunas restantes (condição normal para tabelas densas).
- [ ] Repetir screenshots de Relatórios, Embaixadores, Configurações e Cobranças **na prévia exata do HEAD**, quando estiver publicada, para confirmar as alterações desta rodada.
- [ ] Testar arraste em Tarefas e Kanban, navegação de tabelas e ações no touch real, não apenas em captura estática.
- [ ] Verificar impressão visual e modais no ambiente real autenticado, inclusive perfis de gestor, recepção e vendedor.
- [ ] Revisar ainda as telas completas de administração, importação de Excel e formulários públicos antes de marcar a auditoria como encerrada.

**Resultado desta rodada:** mudanças já aplicadas em Relatórios (busca, largura de colunas, Ações e padding), Equipe real (paginação fora da rolagem), Histórico de Cobranças (filtros sem card redundante), Embaixadores demo (regras recolhíveis), Configurações (largura responsiva alinhada). A documentação e o CI não substituem a inspeção da nova prévia: este checklist continua aberto.

## Continuação — estratégias da demo (29/10/2026)

- [x] Compactar exclusivamente os indicadores de Estratégias (sem alterar Embaixadores ou outros módulos que reutilizam `growth-summary`): menos padding e separação; em 390px, duas métricas lado a lado e orçamento abaixo.
- [x] Remover o texto integral de observações de cada linha da tabela de Estratégias. A observação continua disponível no modal de detalhes/edição; isto evita altura irregular e preserva o dado.
- [ ] Comparar em navegador a versão alterada em 390/768/1366/1920px, claro/escuro e zoom 100%.
- [ ] Verificar paridade do módulo real de Estratégias; esta alteração é visual e restrita à demo.
- [ ] Confirmar CI do novo commit e não integrar na main antes dos testes autenticados e da homologação da prévia.

## Auditoria de Embaixadores — formulários demo/real (29/10/2026)

**Evidência:** capturas fornecidas de Nova campanha e Novo embaixador na demo, em tema escuro, mostram formulários verticais excessivamente altos e textos de orientação que empurram o rodapé.

- [x] Demo: alinhar datas Início/Encerramento em duas colunas no desktop; regra e valor em duas colunas, responsivas no celular.
- [x] Demo: alinhar função e benefícios no desktop, reduzir altura e remover dois parágrafos explicativos duplicados, sem esconder os campos ou retirar a lógica de comissão.
- [x] Real: agrupar função/código, datas, regra/valor e os estados em linhas compactas; manter validação e persistência existentes.
- [x] Não alterar diálogos de quitação/encerramento nem a apuração de pontos ou permissões.
- [ ] Verificar no CI TypeScript, build e testes da branch após esta revisão.
- [ ] Validar visualmente os dois modais na prévia exata do HEAD, tema claro/escuro, 390px e desktop, inclusive foco, rolagem e botões.
- [ ] Revisar em seguida campanha selecionada, indicadores, histórico e registro de indicação em demo/real.

**Regra de liberação:** não fazer merge do PR #30 até completar as homologações restantes.

## Contrato global — rodapé de modais (29/10/2026)

**Problema transversal identificado:** o CSS compartilhado usava `bottom: -23px` (e `-19px` no mobile) com padding assimétrico, deslocando visualmente os botões para baixo. A primeira correção só alcançava Campanhas/Embaixadores, mas o defeito era global.

- [x] Corrigir a regra compartilhada `.dialog-body .form-actions` para `bottom: 0`, altura mínima de 68px, padding simétrico de 12px e alinhamento vertical centralizado.
- [x] Manter ações alinhadas à direita e espaçamento horizontal consistente; não trocar rótulos ou ordens de ações.
- [x] Remover override duplicado de Campanhas/Embaixadores após promover a correção ao padrão compartilhado.
- [ ] Inventariar modais com ações personalizadas fora de `.form-actions` e avaliar sua adequação caso a caso (especialmente pagamento, confirmação e seleção).
- [ ] Validar em navegador os modais de contato, tarefa, campanha, embaixador, equipe, importação, administração e cobrança, desktop/mobile, rolagem, foco e telas claro/escuro.
- [ ] Confirmar CI do commit final e verificar que o rodapé não se sobrepõe aos últimos campos ou mensagens de erro.

**Critério:** ações visivelmente centralizadas na barra inferior, completamente acessíveis com teclado, sem corte nem deslocamento, inclusive em modal com conteúdo rolável. Sem merge antes da homologação.

## Padronização estrutural do rodapé — continuidade (29/10/2026)

- [x] Criar `ModalFooter`, componente único para ações no rodapé com classe global `.form-actions`.
- [x] Migrar `FormActions` da demo e `SaveActions` do aplicativo real para o mesmo componente, herdando centralização vertical e posicionamento global do CSS.
- [x] CSS de `.dialog-body .form-actions` permanece global, cobrindo também ações especiais de Administração e Cobrança que ainda usam a classe diretamente; não alterar suas confirmações.
- [x] Adicionar teste estático de regressão para alinhamento CSS compartilhado.
- [ ] Migrar gradualmente os rodapés personalizados restantes para `ModalFooter` e homologar acessibilidade, estados ocupados, ações destrutivas e rolagem em todos os perfis.
- [ ] Executar CI final e inspeção no HEAD em desktop/mobile e temas claro/escuro.

**Importante:** herança visual global está implementada nos rodapés que usam `.form-actions`, mas a cobertura estrutural por `ModalFooter` ainda não foi comprovada em 100% dos modais especiais. Não declarar a auditoria terminada antes desse inventário.

## Correção regressiva — rodapé flutuante dos modais (29/10/2026)

O print de Nova estratégia revelou que `position: sticky` no rodapé compartilhado sobrepunha os últimos campos e parecia uma barra solta no meio da área rolável. A geometria anterior do SDD foi substituída: **o rodapé de ações deve integrar o fluxo normal do conteúdo do modal**, sem sobreposição.

- [x] Remover `position: sticky`, offset, sombra e plano opaco da regra global `.dialog-body .form-actions`.
- [x] Manter alinhamento à direita e centralização vertical das ações na linha; usar separador discreto, sem flutuação.
- [ ] Homologar Nova estratégia e demais formulários longos no navegador, incluindo a rolagem até o último campo e até os botões em 390px/desktop.
- [ ] Considerar um rodapé verdadeiramente externo à área rolável apenas se validado como nova estrutura do `Modal`, preservando associação dos botões ao formulário.
- [ ] Confirmar o CI do commit desta correção antes de merge.

**Critério de aceite:** ações não cobrem campos nem mensagens de erro e não aparentam flutuar; o usuário alcança os botões rolando o próprio modal.

## Auditoria SDD — rodapés administrativos e financeiros (29/10/2026)

- [x] Manter o padrão aprovado: rodapé em fluxo normal, sem `sticky`, centralização vertical e separador discreto.
- [x] Migrar quatro áreas de ações em `admin/Companies.tsx` para `ModalFooter`, incluindo cadastro/edição de empresa, gestor e detalhes.
- [x] Migrar confirmação de redefinição de senha em `admin/CompanyUsers.tsx` para `ModalFooter`.
- [x] Migrar dois grupos de ações de `billing/BillingHistory.tsx` para `ModalFooter`, sem alterar as confirmações ou estados de cobrança.
- [x] Preservar rótulos, permissões, bloqueios de ações em progresso e regras de pagamento existentes.
- [ ] Inventariar demais modais com botões personalizados fora de `form-actions`; o CSS global ainda não cobre elementos que não usam o contrato.
- [ ] Validar foco, fechamento, mensagens de erro e rolagem dos modais migrados no navegador, desktop/mobile e claro/escuro.
- [ ] Confirmar CI no HEAD e não integrar PR #30 antes da homologação.

**Validação já comunicada pelo usuário:** Relatórios/filtros e Estratégias aprovados visualmente; não refazer o layout aprovado para resolver outros módulos.

## Homologação dos rodapés e revisão administrativa — 29/10/2026

**Homologação informada pelo usuário:** os 14 itens de Administração/Empresas, cadastro de gestor, redefinição de senha, cobrança e comportamento global foram aprovados: alinhamento, estados desabilitados, confirmação financeira, rolagem, acesso ao último campo, responsividade desktop/mobile, temas e fechamento pelo X/Cancelar/teclado. Essa evidência é uma validação manual relatada pelo usuário, não um teste automatizado.

- [x] Registrar aprovação dos 14 casos de rodapé reportados.
- [x] Remover o selo redundante "Conta real" e o banner permanente "HOMOLOGAÇÃO INTERNA" do cabeçalho da Administração, sem alterar ambiente, permissões ou dados.
- [x] Evitar que o modal foque automaticamente no botão Fechar e abra seu tooltip quando há campo de formulário; manter foco acessível dentro do diálogo.
- [x] Separar gestão de plano por empresa em abas internas **Plano e acesso**, **Cobranças** e **Integração**, preservando as operações e o histórico.
- [x] Alinhar a altura dos filtros e dos botões de busca no Histórico de cobranças (42px).
- [ ] Homologar a nova organização de planos/cobranças e o comportamento do foco/tooltip em modais com e sem formulário no desktop e no mobile.
- [ ] Conferir se o seletor lateral de empresa é redundante no fluxo principal ou ainda necessário para trocar rapidamente de empresa: não remover sem validação funcional da navegação.
- [ ] Executar e confirmar CI do HEAD; não liberar o PR #30 apenas com homologação de rodapés.
- [ ] Retomar auditoria de importação Excel e telas autenticadas por perfil.

**Regra:** avisos de teste devem ser exibidos apenas quando o sistema estiver de fato em modo de teste. Nunca ocultar alertas financeiros ou dados operacionais relevantes apenas para compactar a tela.

## Verificação complementar — Mercado Pago e CI (29/10/2026)

- [x] GitHub Actions #238, commit `8a3bfb38`: sucesso após corrigir o uso de `event.currentTarget` no foco inicial do modal com uma referência tipada.
- [x] Conferir código de `OnlineBilling`: status da integração, ambiente test/production, webhook, redirecionamento para Developers e fluxos do gestor permanecem implementados.
- [x] Remover o painel administrativo isolado que usava sempre `companies[0].id`; agora a aba Integração de Planos por empresa utiliza `company.id` da empresa selecionada.
- [ ] Validar visualmente as abas Plano e acesso / Cobranças / Integração e a troca de empresa sem expor informações da anterior.
- [ ] Confirmar na sessão administrativa real o status do Mercado Pago, ambiente correto, URL de webhook e ausência de consultas indevidas durante a troca de abas.
- [ ] Verificar fluxo de pagamento do gestor com contas de teste, sem realizar cobrança real durante a auditoria UX.

**Escopo:** revisão do código e CI não confirmam que credenciais, webhooks e pagamentos reais estão operacionalmente corretos. A configuração do provedor pode ser global, enquanto os dados exibidos e operações são vinculados à empresa selecionada; não confundir os dois conceitos.

## Simplificação de Planos por empresa — 29/10/2026

**Evidência:** print com painel lateral de seleção/paginação para apenas 3 empresas, duas barras de abas, três botões de ação, card de resumo alto e outro card com uma única movimentação.

- [x] Remover a coluna lateral permanente de empresas (mantendo a troca rápida via seletor e a busca).
- [x] Manter ações financeiras em contexto da empresa escolhida: criar cobrança, registrar pagamento, conceder gratuidade.
- [x] Substituir resumo e histórico simultaneamente abertos por um cartão de resumo compacto e detalhe expansível de regras/movimentações.
- [x] Preservar as abas da área financeira (Cobranças / Planos por empresa; dentro de cada empresa: Plano e acesso / Cobranças / Integração), sem alterar APIs e persistência.
- [ ] Verificar CI/typecheck e build exatos após a nova estrutura.
- [ ] Homologar a navegação por empresa, busca, estados vazio/erro, valores e datas, acessibilidade de details, mobile e desktop.
- [ ] Avaliar unificação da segunda faixa de abas caso a navegação ainda pareça excessiva após o compacto; não fazer alteração radical na arquitetura sem teste da primeira revisão.

**Regra:** histórico de acesso não é histórico de cobranças; preservar ambos, mas apresentar histórico de acesso sob demanda.

## Regressão visual — seletor de empresas (29/10/2026)

- [x] Screenshot do usuário mostrou campo de busca separado por grande área vazia e seletor de empresa deslocado para baixo.
- [x] Remover a busca redundante do painel de Planos por empresa: o seletor já permite escolher entre todas as empresas disponíveis.
- [x] Compactar faixa de seleção e remover dependência de filtros de busca desnecessários.
- [ ] Validar o HEAD em desktop/mobile e garantir que as abas e o resumo fiquem imediatamente abaixo da seleção.
- [ ] Confirmar CI do commit novo e avaliar busca novamente apenas se a escala real de empresas justificar uma solução de seleção pesquisável integrada ao mesmo controle.

## Homologação de Planos e início da auditoria de importação — 29/10/2026

- [x] Usuário aprovou a disposição atual de **Planos por empresa** após correção do espaço vazio. Manter esta versão sem reabrir decisões já validadas.
- [x] Classificar o erro de consulta do Mercado Pago na URL de preview como **ORIGIN_DENIED (OPTIONS 403)** da função de homologação, não como falha comprovada do provedor. Manter a política de origens restrita; homologar integração em ambiente autorizado futuramente.
- [x] Importação Excel: compactar instruções e colocar regras opcionais em seção expansível.
- [x] Importação Excel: paginar a prévia de até 1.000 linhas com tamanho 10/50/100, sem reduzir o conjunto completo analisado ou importado.
- [x] Importação Excel: utilizar rodapé compartilhado para ações, preservando bloqueios durante processamento.
- [ ] Validar visualmente a prévia com arquivo de 1, 50 e 1.000 linhas, erros e duplicados, desktop/mobile.
- [ ] Executar typecheck/testes/build e CI do novo commit.
- [ ] Continuar revisão de exportação, arquivos inválidos, seleção por perfil e consistência de controles sem sobrescrever dados existentes.

## Retomada do SDD — 29/10/2026: Dashboard e banco

- [x] Usuário aprovou o layout atualizado de Planos por empresa; não refazer.
- [x] Confirmada migration `crm_goals_visibility_and_icons` aplicada; permissão `goals.view` do gestor da QA SUN7 — Empresa B validada no banco.
- [x] Inserido planejamento fictício de outubro na Empresa B e quatro medalhas inicialmente bloqueadas, sem inventar vendas.
- [x] Migration `crm_data_change_events` aplicada e registrada no Supabase; 33 triggers, política e funções presentes. Propagação entre sessões ainda exige teste funcional.
- [x] Dashboard real: aproximar filtros de período das abas; alinhar 'Abrir funil' na faixa de navegação e reduzir espaçamento vertical.
- [ ] Testar o layout revisado no preview, desktop/mobile, e os 3 perfis operacionais.
- [ ] Validar carregamento da aba Conquistas da Empresa B, incluindo medalhas bloqueadas, após atualizar a sessão.
- [ ] Verificar CI/typecheck/build do HEAD antes do merge.

## Dashboard real — remover banner e espaços excedentes (29/10/2026)

- [x] Remover o banner permanente `HOMOLOGAÇÃO INTERNA` do shell autenticado do gestor/funcionários; manter mecanismos reais de proteção, RLS e sinalização de erros.
- [x] Reduzir `padding-top` da página Dashboard e margem inferior do título, em CSS específico sem afetar modais nem outras páginas.
- [x] Preservar agrupamento aprovado de filtros, abas e KPIs.
- [ ] Conferir visualmente no preview desktop/mobile, temas claro/escuro, inclusive navegação de Conquistas na Empresa B.
- [ ] Confirmar execução do CI com commits de ajuste e revisar qualquer falha.
- [ ] Seguir por Kanban e listas operacionais para localizar excesso de card/controles e gargalos de rolagem.
