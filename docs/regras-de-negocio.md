# Regras iniciais — base em elaboração

Decisões confirmadas nesta conversa orientam a casca. Propostas aguardam o retorno de Caio; a base não transforma pendências em compromisso comercial.

| Tema                        | Base atual                                                               | Situação                                                      |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Cobrança                    | Caio informa valor e vencimento por empresa; sem planos                  | Confirmado; cadastro local implementado                       |
| Segmentos                   | Template estética e template genérico                                    | Confirmado; aparência implementada, especializações futuras   |
| Acessos                     | Caio cria gestores; gestores criam equipe                                | Confirmado; somente cadastros fictícios nesta fase            |
| Senha pessoal               | Troca voluntária nas configurações; sem obrigação no primeiro login      | Confirmado; fluxo informativo, sem autenticação               |
| Senha perdida               | Equipe somente pelo gestor; gestor somente por Caio                      | Confirmado; integração futura                                 |
| Recuperação por e-mail      | Sem recuperação autônoma por e-mail                                      | Confirmado                                                    |
| Recuperação do próprio Caio | Procedimento técnico excepcional                                         | Pendente                                                      |
| Temperatura                 | Frio, morno e quente, independente da etapa                              | Categorias confirmadas; preenchimento manual inicial proposto |
| Contatos                    | Responsável, serviços/produtos de interesse e observações                | Base implementada com dados fictícios                         |
| Kanban                      | Nomes e ordem editáveis, arraste e seleção de etapa                      | Confirmado                                                    |
| Quantidade de etapas        | Até 10 por quadro; ao menos uma                                          | Provisório, isolado em configuração                           |
| Quantidade de quadros       | Leads e clientes                                                         | Base inicial; quantidade máxima a validar                     |
| Exclusão de etapa           | Transferir cartões para outra etapa do mesmo quadro                      | Proposta implementada na prévia                               |
| Tarefas                     | Cadastro manual, responsável, prazo e conclusão                          | Base inicial implementada                                     |
| Permissões                  | Gestor vê empresa; vendedor vê seus contatos; recepção consulta contatos | Proposta de interface, sem segurança real                     |
| Gestor ativo                | Um por empresa; autoria preservada na desativação                        | Proposta inicial; substituição pelo administrador a detalhar  |

## Pendências antes das automações

1. Critérios de quente/morno/frio e possibilidade de alterar manualmente.
2. Limite definitivo de etapas e regras de passagem entre elas.
3. Eventos de consulta, comparecimento, no-show, fechamento e cancelamento, sem depender dos nomes das etapas.
4. Follow-up em 24h, 3, 7, 15, 21 e 29 dias e mensal: marco inicial, pausas, encerramento, feriados e retomada.
5. Vencimento, tolerância, bloqueio, pagamentos parciais, atraso acumulado e meses curtos.
6. Embaixadoras: R$ 1.000 por ponto, arredondamento, estorno, premiação e fechamento das campanhas.
7. Permissões definitivas de cada perfil, redistribuição de contatos e substituição de gestor.
8. Auditoria, notificações e confirmação da identidade antes da redefinição administrativa de senha.

## Limites da base

Alterar a etapa apenas muda a posição do cartão. Não registra venda, não dispara mensagens nem cria cadências. O valor das oportunidades é estimativa, não receita. A mensalidade da carteira é soma contratada, não dinheiro recebido. Desativar uma empresa nesta prévia altera sua classificação; o seletor de demonstração continua permitindo visualizá-la.

## Identidade e cores

O gestor escolhe uma paleta em Configurações > Aparência e salva a aparência. Opções: SUN7CRM, Azul, Nude, Neutro, Elegante, Rosé e Clássico. A preferência pertence à empresa, é independente do template e se aplica aos menus, botões, destaques, gráficos e modais de sua equipe. O painel da plataforma mantém a identidade SUN7CRM. Nesta etapa a preferência é persistida somente neste navegador.

As configurações são organizadas em Minha conta, Empresa, Aparência e Sobre a prévia. Empresa e Aparência são exclusivas do gestor. As abas usam links com URL própria; rascunhos de dados e de cores permanecem ao alternar as seções, e cada formulário salva somente o seu grupo de configurações.

## Atalhos dos indicadores

Os ícones dos cards do dashboard são atalhos acessíveis. O restante do card é informativo, sem uma seta adicional. Novos contatos e quentes abrem Contatos com período e temperatura aplicáveis; valor do funil de leads abre o mesmo quadro e período; tarefas abre as pendentes. No painel do Caio, os cards abrem Empresas preservando o filtro da carteira e aplicando o critério do indicador. A mensalidade abre as empresas ativas que compõem a soma contratada. Filtros recebidos são exibidos e podem ser limpos.

## Kanban de tarefas

Tarefas podem ser visualizadas em Lista ou Quadro Kanban. As etapas iniciais são A fazer, Em andamento e Concluídas. Arrastar ou selecionar uma etapa altera o mesmo cadastro; não duplica a tarefa. Em andamento continua contando como pendente no dashboard. Concluir e reabrir mantêm prazo, contato e responsável. Os filtros são preservados ao trocar de visualização. Dados antigos sem etapa aparecem em A fazer ou Concluídas conforme a conclusão já registrada. O gestor acompanha as tarefas da empresa; os outros perfis veem e movimentam as próprias.

## Identidade própria e controle de segmento

O gestor personaliza o nome exibido, logo e cores da empresa. O nome exibido é independente do nome cadastral e aparece no topo da área de trabalho e no título da aba; sem personalização, usa o nome cadastral. Sem logo, são exibidas as iniciais. A identidade é compartilhada pelos perfis da mesma empresa; o painel do Caio mantém SUN7CRM.

Somente Caio define e altera segmento e template no cadastro administrativo. Segmento e template não aparecem na área da empresa, nem em configurações, menus ou textos de orientação. Alterar segmento/template preserva os dados existentes, tarefas e nomes, ordem e posições dos funis personalizados. A referência ao Monday orienta apenas a organização simples do trabalho, sem ampliar o escopo funcional.

## Movimentação dos cartões no celular

Nos funis e nas tarefas, arrastar começa pela alça de pontinhos. O gesto usa eventos de ponteiro e uma prévia limitada ao cartão, evitando o arraste nativo do navegador. Fora da alça, o quadro continua rolável. Aproximar o cartão das bordas laterais rola somente o quadro. Soltar fora do quadro, cancelar o toque ou pressionar Escape cancela a movimentação. A seleção de etapa continua disponível para toque e teclado.

## Site e primeiro acesso

Site público, recursos, Termos de Uso e Política de Privacidade ficam disponíveis antes da entrada. Cada pessoa confirma os Termos e a leitura da Política no primeiro acesso e quando houver alteração relevante que exija nova confirmação. O gestor não confirma pela equipe. A prévia simula essa regra por identidade/empresa/versão em armazenamento local, sem criar autenticação ou evidência jurídica de identidade. Detalhes e pendências de produção: `privacidade-e-primeiro-acesso.md`.

O botão Acessar do cabeçalho abre o login da conta. Explorar a demo abre a demonstração com empresas e perfis fictícios, sem senha. A tela de login está preparada visualmente, com campos indisponíveis enquanto não houver autenticação. O administrador da plataforma cadastra o gestor, que cadastra a equipe. Não há cadastro público ou recuperação automática por e-mail. Recuperação de senha fica oculta na tela de login por enquanto. A regra prevista de redefinição mantém a hierarquia equipe → gestor → administrador da plataforma.

## Identidade institucional SUN7CRM

O site público e a página de acesso usam a identidade preta e dourada inspirada na marca fornecida pelo cliente. O símbolo original está em `public/brand/sun7-symbol.jpg`; o enquadramento de exibição é feito por CSS, sem redesenhar o arquivo recebido. A assinatura do produto usa SUN7CRM. As cores institucionais são limitadas à apresentação pública, incluindo funcionalidades e documentos. O ambiente de cada empresa continua utilizando sua própria identidade configurável.
