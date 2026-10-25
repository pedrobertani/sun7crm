# Histórico de clientes, WhatsApp e acompanhamento — 24/10/2026

## Entrega

Histórico por pessoa acessível em Contatos e nos cards. A demo grava no navegador. Nos contatos do painel autenticado, histórico e relatório usam o Supabase com a sessão do usuário, sem dados fictícios compartilhados com o ambiente real.

## Linha do tempo

- Cadastro, edição de dados, criação/vinculação de cards, troca de etapa/funil, alterações no card e anotações de atendimento.
- Cada evento possui data/hora e autor. Nomes das etapas são registrados no momento da ação para não mudar retroativamente ao renomeá-las.
- As anotações aceitam até 2.000 caracteres e não podem ser editadas ou excluídas pela interface/API do usuário.
- Novos eventos começam a ser registrados com a funcionalidade. A migração recupera somente registros reais já existentes da auditoria de contatos; não infere etapas passadas.
- No ambiente autenticado, os eventos de cadastro e oportunidade são gerados por triggers dentro da mesma transação da alteração. O cliente só pode inserir notas e acionamentos do WhatsApp.

## WhatsApp

O botão verde utiliza `https://wa.me/55<DDD+número>`, normalizado com ou sem máscara e prefixo +55. Números inválidos não geram links. O controle aparece na lista de contatos, cards, detalhes e histórico.

O link abre uma nova aba/conversa conforme o navegador e o aplicativo configurado. Não é possível escolher programaticamente entre WhatsApp Messenger e Business. O CRM não envia mensagens, confirma abertura efetiva do app, importa conversas ou confirma resposta.

O evento “WhatsApp acionado” representa exclusivamente o clique no atalho. Também é contabilizado no relatório, separado das notas e movimentações. Se o registro remoto falhar, a conversa continua acessível e o painel informa a falha de registro.

## Relatório do gestor

- Filtros por responsável atual, cliente/telefone e tempo sem atividade: todos, 3, 7, 15 ou 30 dias.
- Última atividade, último acionamento do WhatsApp, dias desde a última atividade e contagens por cliente, com atalho para o histórico.
- Quando não há eventos, o tempo usa a data de cadastro e isso fica explícito. Datas antigas sem horário não ganham horários fictícios.
- Resumo de atividades por colaborador nos últimos 30 dias. A ação é atribuída ao autor que a executou, independentemente do responsável atual pela carteira.
- Contagens de cliente abrangem o histórico disponível. Resumo por colaborador e o indicador de WhatsApp têm janela explícita de 30 dias.
- “Sem atividade” mede registros no CRM, sem presumir que houve ou não atendimento em outro canal. Não há classificação automática de desempenho.

## Permissões

- Gestor: histórico de todos os contatos da empresa, anotações e relatório da equipe.
- Consultor: histórico e notas dos próprios contatos. Não recebe o relatório do gestor.
- Recepção: leitura conforme a regra já existente para contatos; pode usar o atalho do WhatsApp e registrar seu acionamento, sem adicionar notas.
- RLS acompanha a permissão atual do contato. Reatribuir a carteira ou revogar o vínculo retira o acesso nas consultas seguintes.
- Autoria, título e horário de notas/cliques são definidos no servidor. Eventos automáticos não podem ser forjados pelo cliente.
- Views de relatórios usam `security_invoker=true`, filtros de gestor e as políticas das tabelas de origem. Funções de trigger ficam no schema privado sem execução pelo cliente.

## Navegação e Embaixadores

O menu da demo foi agrupado por frequência de uso: Dia a dia (Funil, Contatos, Tarefas, Dashboard), Crescimento (Estratégias, Embaixadores), Gestão (Relatórios, Equipe), Cadastros (Serviços e produtos, Etiquetas), Preferências (Configurações). Módulos são preservados.

Embaixadores ganhou seletor amplo de campanha, estado vazio com ação de criar campanha, contexto de período/regra e participantes separados da apuração. Sem campanha, a tabela não apresenta métricas zeradas que aparentem uma apuração existente.
