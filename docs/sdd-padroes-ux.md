# SDD — padrões globais de UX do SUN7CRM

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
