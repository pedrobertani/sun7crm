# Tarefas do backend SUN7CRM

Criadas em 24/10/2026 a partir das decisões da reunião e dos ajustes posteriores. Projeto Supabase: SUN7CRM, região São Paulo. Dados fictícios da demo permanecem separados.

| ID | Tarefa | Situação | Critério de conclusão |
| --- | --- | --- | --- |
| BK-01 | Funis e etapas personalizados | Concluída no backend e aplicada no Supabase | Gestor cria/renomeia; até 10 etapas; reordenação atômica; exclusão transfere cards para etapa anterior (primeira → próxima), preservando histórico. |
| BK-02 | Cards, contatos e interesses | Concluída no backend e aplicada no Supabase | Vários cards por contato; título, estratégia, itens e etiquetas; atualização com proteção contra conflito; permissões por empresa e responsável. |
| BK-03 | Serviços/produtos e etiquetas | Concluída no backend e aplicada no Supabase | CRUD com desativação; vínculos preservados; até três etiquetas por card também no banco; apenas gestor administra cadastros. |
| BK-04 | Estratégias | Concluída no backend e aplicada no Supabase | Cadastro persistente por empresa, orçamento e período; origem vinculada ao card; nenhuma etapa é interpretada como venda pelo nome. |
| BK-05 | Embaixadores e campanhas | Concluída no backend e aplicada no Supabase | Contato vinculado, função/benefícios editáveis, código individual, indicações ligadas a card/itens e fechamento com regra de comissão congelada. |
| BK-06 | Pontos, quitações e estornos | Concluída no backend e aplicada no Supabase | Soma elegível paga e com presença; cada R$ 1.000 completos gera um ponto; quitação única após fechar campanha; ajustes preservam histórico e não debitam outra campanha. |
| BK-07 | Alertas de cards parados | Concluída no backend e aplicada no Supabase | Prazos fixos: 24h sem primeiro acompanhamento, 3 dias para responsável e 7 dias para gestor; retornos futuros e cards encerrados respeitados; avisos deduplicados. Sem configuração pelo gestor. |
| BK-08 | Equipe, tarefas e configurações | Concluída no backend e aplicada no Supabase | Gestão da equipe sem promoção indevida, redistribuição segura, tarefas vinculáveis ao card, identidade da empresa e logos com acesso controlado. |
| BK-09 | Indicadores operacionais | Concluída no backend e aplicada no Supabase | Consultas reais de funis, tarefas, origens, inatividade e campanhas; RLS preservada e valor estimado separado de recebimento declarado. |
| BK-10 | Contratos de integração | Concluída e testada | Adaptador assíncrono tipado para o frontend, erros de autorização/conflito e paginação sem mistura com a demo. A troca das telas demonstrativas pelas telas autenticadas deve ser acompanhada separadamente. |
| BK-11 | Validação e implantação | Concluída | Testes de banco/RLS, versões, idempotência, regressão, advisors e consultas no Supabase; migrações e documentação versionadas. |
| BK-12 | Plano mensal e cobrança | Concluída anteriormente | R$ 189,90, gratuidade 7/15/30, carência 7 dias, bloqueio D+8 e registro administrativo de pagamentos. |

## Fora desta execução

- Integração com API de pagamento: avaliação posterior solicitada por Pedro.
- Publicação na conta Cloudflare: pausada até reautorizar o plugin.
- Disparo/importação de mensagens do WhatsApp e métricas automáticas de redes sociais: sem APIs contratadas nesta fase.
- Regras comerciais ainda não aprovadas no PDF (comissão disputada, benefícios específicos e critérios de métricas sociais): não serão presumidas.

## Registro de execução

- 24/10: conferidas a versão publicada V32, a estrutura atual, as políticas de isolamento e as decisões funcionais. Iniciada a ampliação da base operacional.
- 24/10: implementadas as migrações, o adaptador assíncrono e a compatibilidade do sininho com avisos de cards. Prazos 24h/3/7 dias confirmados por Pedro.
- Conferência remota: tabelas novas com RLS; views com `security_invoker`; comandos autenticados sem execução anônima; gravação direta em registros financeiros negada; bucket privado com limite de 2 MiB. Nenhuma empresa, cliente, campanha ou quitação fictícia foi cadastrada.
- Validação: 110 testes da aplicação, 115 do banco e 28 das funções (253 no total), além das verificações de tipos. Sem novos alertas de segurança nos advisors.
- 25/10: Pedro definiu prazos fixos de 24h/3/7 dias. Retirada a configuração por funil/etapa do contrato e do banco. O gestor continua acessando o histórico dos clientes da própria empresa, com autoria e horário dos registros.
- 25/10: revisão aplicada e conferida no Supabase; RPCs e campos de configuração removidos, views preservadas com `security_invoker`, sem novos alertas de segurança. Passaram novamente 110 testes da aplicação e 117 do banco, incluindo limites de 24h/72h/168h e histórico de consultores visível ao gestor. As funções não foram alteradas nesta revisão.

## Integração com o ambiente autenticado

Estas tarefas usam os contratos já preparados e não são confundidas com a conclusão do backend:

Execução de 25/10, autorizada por Pedro. A API de pagamentos será a última etapa. A integração e os testes locais/isolados de UI-01 a UI-05 foram concluídos. A homologação com contas pessoais de gestor/consultor permanece pendente.

- UI-01 — Integrada: funis/cards autenticados, personalização de até dez etapas por alças/setas, revisão das transferências e avisos fixos de acompanhamento. Notificação abre o card.
- UI-02 — Integrada: catálogo, etiquetas e estratégias, com buscas, seletores múltiplos, limite de três etiquetas e cadastro inline conforme o perfil.
- UI-03 — Integrada: embaixadores/campanhas/indicações/quitações/estornos, métricas manuais e histórico de quitações. Operações financeiras congelam a solicitação em novas tentativas.
- UI-04 — Integrada: contatos/tarefas/equipe/identidade, atribuição de responsáveis, redistribuição, criação de integrantes, redefinição de senha inicial e logos privados.
- UI-05 — Integrada: dashboard e relatório por card usando os indicadores do banco. Valores de pipeline são apresentados como estimativas.

Validação desta integração: 118 testes da aplicação, 117 do banco e 28 das funções (263 no total); verificações de tipos; prévia visual isolada em desktop/celular. O QA visual usa exclusivamente dados fictícios em memória e não insere contas, clientes, quitações ou aceites no Supabase. Detalhes: `integracao-operacional.md`.

## Segurança — revisão de 25/10

- SEG-01 — Implementada: CSP de produção, origem do Supabase validada e política de referrer.
- SEG-02 — Testada: consultas parametrizadas, tentativas de SQL injection tratadas como dados, JSON extra recusado, isolamento por empresa/responsável, RLS e `search_path` de funções privilegiadas.
- SEG-03 — Preparada, não ativa: regra de cinco falhas em 15 minutos com bloqueio por 15 minutos. SQL e testes locais em `supabase/security/` e `supabase/tests/security.node.mjs`. O hook nativo necessário exige Teams/Enterprise; projeto atual Free. Não há bloqueio fictício no navegador nem alteração de plano.
- SEG-04 — Pendente de configuração: CAPTCHA nativo e revisão dos limites do Auth no provedor. Não expostos pela conexão atual; não declarados ativos.
- SEG-05 — Pendente de hosting: cabeçalhos HTTP e proteção contra clickjacking; CSP via meta não os substitui.

Decisões, critérios de ativação e limites: `seguranca.md`. A API de pagamentos permanece por último.

