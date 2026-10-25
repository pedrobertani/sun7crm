# Decisões da reunião com Caio — 24/10/2026

## Implementação nesta entrega

As funcionalidades abaixo estão implementadas na **demo**, com dados fictícios persistidos no navegador. Login real, primeiro acesso, aceite individual e painel administrativo autenticado são preservados. Não foram criadas tabelas nem alteradas permissões do Supabase nesta entrega. A integração dos novos módulos ao ambiente operacional autenticado continua pendente; não apresentar os cálculos locais como pagamentos financeiros reais.

## Funis e cards — prioridade máxima

- Uma entrada “Funil” na área de trabalho, com abas iniciais Leads e Clientes e botão + para criar funis.
- Gestor cria e renomeia funis; personaliza até 10 etapas, por setas ou arraste com mouse/toque pela alça.
- Excluir etapa exige confirmação e transfere os cards para a anterior; na primeira etapa, transfere para a próxima. A única etapa não pode ser excluída.
- Nenhum campo obrigatório depende de nomes como Agendado, Fechado ou Compareceu.
- Contato representa uma pessoa. Card representa uma oportunidade; uma pessoa pode ter vários cards.
- Novo card seleciona um contato existente ou permite cadastrá-lo inline, com validação de DDD e duplicidade por telefone.
- Card possui título, valor, etapa, estratégia de origem, serviços/produtos de interesse e até três etiquetas.
- Gestor vê todos os contatos e cards da empresa; consultor somente os próprios. A responsabilidade continua vinculada ao contato nesta demo.
- Cadastro e importação de contatos não geram automaticamente novas oportunidades. Cards já existentes foram preservados.

## Catálogo e etiquetas

- Aba “Serviços e produtos”: gestor cadastra e edita nome, descrição, valor e situação, com tipos serviço/produto.
- Desativar item não remove vínculos anteriores; ele não aparece em novas seleções.
- Aba “Etiquetas”: gestor cria e edita nomes e cores. Até três etiquetas por card, aplicadas manualmente.
- Frio, Morno e Quente são exemplos iniciais editáveis. A classificação antiga dos contatos é preservada por compatibilidade e convertida em etiquetas nos cards antigos na migração inicial.
- Etiquetas podem ser aplicadas pelo gestor em qualquer card e pelo consultor nos próprios.

## Estratégia de origem

O card seleciona uma estratégia cadastrada na própria empresa. O mesmo cliente pode retornar por outra estratégia em uma oportunidade diferente. A origem textual antiga é preservada nos cards sem estratégia vinculada.

## Embaixadores — prioridade máxima

- Cadastro vincula um contato existente ou permite adicionar e selecionar novo contato, sem duplicar pessoa.
- Gestor cria campanha/evento com nome, início, fim e regra de comissão.
- Formas oferecidas: valor em reais por ponto inteiro ou percentual sobre o total de vendas elegíveis. A escolha fica explícita no cadastro; não se presume uma comissão fixa para todas as campanhas.
- Valores são somados por embaixador e campanha. Cada R$ 1.000 completos equivale a um ponto; R$ 1.500 = 1 ponto, sem fração.
- Somente venda paga, com comparecimento confirmado e data dentro da campanha pontua. Pagamento ou presença pendentes não pontuam.
- Encerramento é uma ação explícita, distinta da data final prevista, e bloqueia novas indicações. O gestor confere pendências antes de encerrar.
- Encerrar campanha e confirmar pagamento são ações separadas. Não há transferência bancária pela demo.
- Após pagamento, pontos quitados ficam com saldo zero. Valores inferiores a R$ 1.000 não transitam automaticamente para outra campanha.
- Histórico de pagamentos preserva data, campanha, embaixador, pontos e valor. Repetir pagamento é bloqueado.
- Cancelamento, devolução parcial ou estorno recalcula valores e pontos. Se houver pagamento anterior, ele permanece no histórico e a diferença negativa aparece como ajuste pendente; não há desconto automático em outra campanha.
- Indicações anteriores sem campanha são mantidas em histórico, sem presumir confirmação de pagamento/presença nem incluí-las silenciosamente em campanhas novas.
- Gestão de indicações, valores e pagamentos reservada ao gestor, evitando expor clientes de outros consultores.

## Próxima etapa operacional

Criar schema e migrações próprios para catálogo, etiquetas, relação contato/card, campanhas, indicações e livro de pagamentos; impor RLS por empresa e responsável; validar concorrência e idempotência dos pagamentos no servidor e integrar as telas autenticadas. As proteções locais da demo não substituem essas regras no backend.

## Complemento — material “Estratégia Embaixadoras” enviado por Caio

O material descreve funções comerciais (Consultoras), de acolhimento (Consolidadoras) e de visibilidade (Imãs). O cadastro agora oferece essas sugestões em um campo de função editável e um campo de benefícios/observações. Essas funções não são perfis de acesso ao CRM.

O gestor marca explicitamente se um novo participante recebe comissão de campanhas; não se atribui comissão automaticamente pelo nome da função. Cadastros antigos preservam a participação anterior. O encerramento registra os participantes habilitados à comissão para que mudanças posteriores no cadastro não alterem uma apuração encerrada.

O limite VIP de 8 participantes, os três protocolos específicos e a agenda de treinamento descritos no PDF são exemplos da clínica, não restrições globais do SaaS. Links/códigos individuais de indicação e métricas de redes sociais não foram implementados nesta entrega. Comissões disputadas entre várias pessoas, atribuição a clientes antigos e benefícios não financeiros continuam exigindo regras comerciais específicas; o documento não fixa esses valores.


## Complemento — plano mensal e liberações administrativas

Em 24/10 foi definido o plano SUN7CRM Mensal de R$ 189,90, substituindo a orientação anterior de não apresentar plano. O ADM concede 7, 15 ou 30 dias gratuitos e registra pagamentos recebidos. A carência por atraso é de sete dias; os avisos financeiros são exclusivos do gestor, e D+8 bloqueia as operações no servidor. A renovação desconta os dias de carência utilizados, no máximo sete, sem consumir dias em que houve bloqueio. Gratuidade administrativa não gera dívida. O comportamento, as telas e a integração Supabase desta entrega estão detalhados em `plano-cobranca-e-carencia.md`. Provedores e APIs de pagamento continuam para avaliação posterior.
