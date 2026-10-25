# Backend operacional SUN7CRM — atualizado em 25/10/2026

## Escopo desta execução

As regras aprovadas na demo passam a existir no Supabase, com tabelas, políticas e comandos próprios. A aplicação demonstrativa continua usando somente `BrowserRepository`; não há importação automática de cadastros fictícios para o ambiente real.

As telas autenticadas usam `src/data/backend.ts` para funis/cards, contatos, tarefas, catálogo, etiquetas, estratégias, embaixadores/campanhas, equipe, identidade e indicadores. Administração, plano, notificações, importação e relatórios anteriores permanecem disponíveis. As rotas reais não redirecionam para a demonstração. Detalhes de integração e limites de verificação estão em `integracao-operacional.md`.

## Migrações desta execução

| Migração | Responsabilidade |
| --- | --- |
| `20261024225253_crm_operational_core.sql` | Funis, edição atômica de etapas, cards com versão, catálogo, etiquetas, estratégias e interesses vinculados. |
| `20261024225720_crm_ambassador_campaigns.sql` | Participantes, códigos, campanhas, indicações estruturadas, fechamento, pontos, quitações e revisões/estornos. |
| `20261024230444_crm_followups_and_workspace.sql` | Versão inicial da atividade e dos alertas por card; a configuração de prazos foi substituída pela política fixa abaixo. |
| `20261024230852_crm_workspace_management.sql` | CRUD de contatos/tarefas, equipe, redistribuição, identidade, logos privados e indicadores. |
| `20261025003727_crm_workspace_contact_task_index.sql` | Índice para consulta e redistribuição de tarefas por contato/responsável. |
| `20261025040331_crm_fixed_card_alerts.sql` | Prazos fixos de 24h/3/7 dias; remove configuração e desativação por funil/etapa, preservando cards e histórico. |

## Acesso e integridade

- Toda leitura operacional exige empresa habilitada, vínculo ativo, senha pessoal, aceites vigentes e período de acesso válido. O plano e seus avisos mantêm a exceção já implementada para o gestor bloqueado.
- Gestor administra sua empresa; consultor acessa sua carteira; recepção mantém a consulta de contatos e as próprias tarefas. Administrador da plataforma não recebe acesso implícito aos contatos e às campanhas das empresas.
- Catálogo, etiquetas e estratégias podem ser consultados pela equipe habilitada; sua edição é exclusiva do gestor. Campanhas, indicações e dados financeiros de embaixadores são exclusivos do gestor.
- As referências compostas incluem `company_id`. Um card não aceita etapa de outro quadro nem etiquetas, estratégia ou produto de outra empresa.
- Funções públicas de operação executam como o usuário. As rotinas privilegiadas ficam em `crm_private`, têm `search_path` vazio, autorização explícita e permissões de execução limitadas. Não usam metadata editável para decidir papéis.
- `row_version` protege os comandos de edição de card, contato, tarefa, funil, equipe e identidade. Conflito devolve `40001`; a interface deve atualizar os dados, sem sobrescrever silenciosamente outra edição.
- Os comandos financeiros recebem `request_id` persistido. Repetir a mesma solicitação devolve o resultado anterior; parâmetros divergentes são recusados. Não gerar outra chave automaticamente quando o resultado de rede for incerto.

## Contrato de integração

`OperationalBackend` recebe o cliente Supabase da sessão e um UUID de empresa. Não recebe segredo administrativo, não acessa `localStorage` e rejeita identificadores da demo. As consultas são paginadas, com limite de 200 registros por página. O adaptador não trata lista vazia como autorização nem inventa dados quando a consulta falha.

| Operação | Entrada e comportamento |
| --- | --- |
| `createBoard` / `crm_create_board` | Nome; cria funil customizado com uma etapa inicial. |
| `configureBoard` / `crm_configure_board` | Nome, lista ordenada de `{id,name}` e versão do funil. Mantém de 1 a 10 etapas; excluir transfere para a anterior sobrevivente, ou a próxima quando for a primeira. Tudo ocorre na mesma transação. |
| `saveContact` / `crm_save_contact` | Campos do contato, responsável e itens opcionais. Normaliza telefone com DDD; a unicidade por empresa impede duplicidade, inclusive em outra carteira. Troca do responsável acompanha as tarefas pendentes daquele responsável vinculadas ao contato. |
| `saveCard` / `crm_save_card` | Contato, quadro, etapa, título, valor estimado, origem, estratégia, etiquetas, itens, retorno agendado e encerramento explícito. Contato aceita vários cards. No máximo três etiquetas; item desativado só é preservado onde já estava vinculado. |
| `saveTask` / `crm_save_task` | Prazo, status, responsável e contato/card opcionais. Card e contato precisam corresponder. Conclusão/reabertura recebem horário do servidor. |
| `create` / `patch` | Catálogo, etiquetas, estratégias, embaixadores, campanhas e métricas manuais; colunas são limitadas pelo adaptador, pelos grants e pelas políticas do banco. Desativação preserva vínculos anteriores. `patch('campaigns', id, values, expectedVersion)` exige a versão e compara no próprio UPDATE. |
| `saveReferral` / `crm_save_referral` | Campanha, embaixador, card, valor, data, confirmação manual de pagamento/presença, itens e chave de operação. O contato é derivado do card. Só há uma atribuição de indicação por card/campanha. |
| `closeCampaign` / `crm_close_campaign` | Versão e chave de operação. Exige conferência explícita se houver pagamento/presença pendentes; congela os participantes habilitados à comissão. |
| `recordCampaignPayment` / `crm_record_campaign_payment` | Campanha encerrada, embaixador, total esperado e chave da operação. Uma quitação por participante/campanha; valor é recalculado pelo servidor antes de gravar. |
| `adjustReferral` / `crm_adjust_referral` | Valor total estornado, cancelamento, motivo, versão e chave da operação. Mantém revisões e pagamentos anteriores. |
| `team` / `crm_team_members` | Nome, e-mail e vínculo somente da equipe da empresa, visíveis ao gestor. |
| `updateMember` / `crm_update_team_member` | Pode editar vendedor/recepção e desativar com destino de redistribuição quando há carteira ou tarefas pendentes. Não promove gestores, não altera administrador e não renomeia globalmente uma identidade compartilhada. |
| `updateBrand` / `crm_update_company_brand` | Nome exibido, tema e logo da empresa, com versão. Não altera segmento, cobrança, papéis ou habilitação. |
| `metrics` / `crm_workspace_metrics` | Intervalo de até 366 dias; contas, cards, estimativas, tarefas e distribuições respeitam o escopo do usuário. |

Valores monetários são centavos inteiros. Campanhas usam `rate_cents` para valor por ponto e `rate_bps` para percentual (100 pontos-base = 1%). Estratégias usam `month` como a primeira data do mês (`YYYY-MM-01`). Datas civis e alertas consideram o fuso de São Paulo; instantes ficam em `timestamptz`.

## Embaixadores e material do PDF

Cada participante é um contato existente da empresa, com código individual, função editável, benefícios/observações e habilitação explícita para comissão. A função não cria perfil de acesso ao CRM. Os limites e protocolos específicos da clínica não viram limites globais do SaaS.

São somados os valores de indicações pagas e com comparecimento, dentro do período da campanha, descontando devoluções e cancelamentos. Cada R$ 1.000 completos gera um ponto; R$ 1.500 gera um ponto. A data de uma indicação nova não pode estar no futuro. O encerramento é explícito e congela a regra e os participantes habilitados.

Quitação significa registro administrativo de pagamento conferido. Não há transferência bancária. Pontos quitados têm saldo restante zero; frações não passam automaticamente a outra campanha. Um estorno posterior preserva a quitação e apresenta diferença negativa para revisão. Outra campanha não é debitada automaticamente.

`crm_ambassador_campaign_totals` fornece apuração por pessoa/campanha. `crm_campaign_category_metrics` agrupa os indicadores declarados por função. `crm_ambassador_metrics` permite registrar métricas manuais nomeadas; não importa dados de redes sociais nem define regras comerciais que ainda não foram aprovadas.

## Cards sem acompanhamento

Prazos fixos: 24 horas sem primeiro acompanhamento para o responsável; três dias sem atividade para o responsável; sete dias para o gestor. Aplicam-se a todos os funis e etapas, sem ajuste ou desativação pelo gestor. Os limites usam períodos completos de 24 horas, sem calendário comercial presumido.

A migração de 25/10 remove os comandos público/privado de configuração e os campos editáveis dos funis/etapas. A view preserva os campos de leitura `first_response_hours=24`, `idle_days_threshold=3`, `escalation_days_threshold=7` e `alerts_enabled=true` como constantes. O adaptador não oferece mais `configureAlerts`.

A atividade considerada é anotação, acionamento do WhatsApp ou movimentação **vinculada ao card**. Alterar apenas título/valor/etiquetas não simula atendimento. Uma anotação geral do contato não reinicia todos os seus cards. O acionamento do WhatsApp continua significando apenas clique, sem prova de mensagem enviada ou resposta.

Cards encerrados explicitamente e retornos futuros não geram avisos. Quando o retorno agendado chega, ele passa a ser o marco da contagem. Uma atividade válida resolve os avisos daquele card. A mesma fase é deduplicada enquanto o card continua parado; trocar o responsável retira a leitura dos avisos antigos de quem perdeu a carteira.

Os avisos são materializados pela atualização do sininho já existente: entrada, foco da janela e a cada 60 segundos enquanto visível. Não há push, e-mail ou execução em segundo plano com o aplicativo fechado. O aviso abre diretamente o card em `/app/funil?card=...`; a consulta confirma o escopo e seleciona o funil correspondente.

O gestor já consulta o histórico dos contatos da própria empresa: movimentações, anotações e acionamentos do WhatsApp, com autor e horário do servidor. O relatório de atividades permite acompanhar a atuação da equipe. O consultor acessa somente o histórico permitido pela sua carteira; nenhuma empresa acessa os registros de outra.

## Logos e tratamento de erros

O bucket `crm-company-logos` é privado, com arquivos de até 2 MiB em JPEG/PNG/WebP. O nome começa pelo UUID da empresa. O gestor grava; a equipe autorizada lê; outras empresas não acessam. O upload e a atualização do cadastro são etapas separadas: uma falha de rede não provoca exclusão automática de um arquivo que possa ter sido vinculado.

`BackendError` distingue acesso, validação, conflito, registro ausente e transporte. `resultUncertain=true` orienta a conferir o resultado de uma mutação, preservando a chave quando houver idempotência. Mensagens SQL internas, detalhes de outros contatos e credenciais não são devolvidos como mensagens de interface.

## Verificação

As suítes locais aplicam as migrações em PostgreSQL/PGlite com papéis reais de banco e Auth simulado. Cobrem empresas distintas, carteiras, grants de coluna, rollback, versões desatualizadas, quitações duplicadas, estornos, avisos por card, reatribuição, bloqueio do plano e políticas de logos. Os testes do adaptador cobrem mistura com IDs da demo, resultado de rede incerto e valores monetários sem perda de precisão.

As migrações foram aplicadas no projeto SUN7CRM de São Paulo. A conferência remota verificou tabelas com RLS, views com `security_invoker`, comandos sem execução anônima, ausência de gravação direta nos registros financeiros e bucket privado. A revisão de 25/10 confirmou os prazos fixos de 24h/3/7 dias e a remoção dos comandos/campos de configuração. Nenhuma empresa, contato, campanha ou quitação fictícia foi inserida. Os advisors não apresentaram novos alertas de segurança.

Na revisão de 25/10 passaram 110 testes da aplicação e 117 do banco, além da verificação de tipos. A execução anterior validou 28 testes das funções, que não foram alteradas nesta revisão. O teste de ponta a ponta com contas reais de gestor/consultor depende do acesso pessoal dos titulares e da integração das novas telas autenticadas.

As aplicações via MCP recebem versões remotas próprias no histórico do Supabase. Os arquivos locais preservam a ordem de criação e os nomes lógicos. Antes de adotar `supabase db push` nesta base existente, reconciliar o histórico local/remoto por nome e conteúdo; não reaplicar comandos já executados.
