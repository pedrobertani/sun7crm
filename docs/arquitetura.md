# Arquitetura atual do SUN7CRM

Atualizada em 25/10/2026. Detalhes e contratos: `backend-operacional.md`. Acompanhamento: `tarefas-backend.md`.

## Aplicação e ambientes

O frontend usa React, Vite e TypeScript, com Tailwind, componentes shadcn/Radix e Recharts. O site atual é estático, com rotas internas por hash. A publicação na conta própria do Cloudflare está pausada enquanto a conexão do plugin é reautorizada; o site existente no Sites permanece separado dessa implantação.

`/demo` inicializa `BrowserRepository`, dados fictícios e papéis simulados. Não abre sessão Supabase, não cadastra empresas e não registra aceites. Contatos representam pessoas; oportunidades representam cards independentes, podendo existir várias por pessoa.

`/acessar` usa Supabase Auth. `/conta` verifica senha pessoal e aceites individuais. `/admin` usa o perfil administrativo mantido no banco. `/app` usa os vínculos ativos da conta. A demonstração não serve de autorização ou de persistência para esses ambientes.

## Backend e integrações

Supabase/PostgreSQL é a fonte do ambiente autenticado. As tabelas operacionais incluem `company_id`, referências compostas e RLS. O acesso consulta vínculo, habilitação, primeiro acesso, documentos vigentes e situação do plano no servidor. Alterações de papel ou carteira não dependem da atualização de metadata editável do token.

As funções administrativas de criar empresa, criar usuário, redefinir senha, concluir primeiro acesso e editar empresa continuam em endpoints próprios. Segredos administrativos ficam exclusivamente no backend. O navegador usa chave publicável e JWT da sessão. Senhas não são duplicadas em tabelas do CRM, fingerprints ou logs.

`OperationalBackend`, em `src/data/backend.ts`, oferece o contrato assíncrono dos novos módulos: paginação, CRUD de cadastros, comandos de funis/cards/tarefas/equipe e operações de campanhas. A interface deve aguardar os resultados e tratar conflitos/resultado incerto. Ele não implementa a interface síncrona da demo nem grava snapshots reais no navegador.

## Regras transacionais

Funis usam IDs estáveis, etapas ordenadas e versão. Uma configuração mantém de uma a dez etapas; remoção transfere cards antes de excluir. A posição ou o nome de uma etapa não cria venda, recebimento ou comparecimento.

Cards, contatos e tarefas têm versão de edição. Cards vinculam estratégia, catálogo e no máximo três etiquetas. Deixar um item inativo preserva vínculos anteriores. Responsabilidade pertence ao contato; trocar carteira preserva a autoria do histórico e acompanha tarefas pendentes daquele responsável.

As campanhas têm regras explícitas de comissão. A apuração soma somente valores elegíveis e gera pontos inteiros a cada R$ 1.000. Fechar campanha congela elegibilidade; registrar quitação é outra operação. Chaves de idempotência, bloqueio da campanha e conferência do total impedem repetição ou pagamento sobre cálculo desatualizado. Estornos mantêm quitações anteriores e apresentam ajustes pendentes.

Os indicadores usam consultas reais com RLS. Valor de oportunidade é estimativa. Recebimentos das indicações são declarações administrativas, sem conciliação bancária ou API de pagamento nesta fase.

## Histórico e notificações

Eventos de cadastro/movimentação são gerados dentro da transação da alteração. Notas e cliques recebem autor e horário do servidor. Histórico do contato é compartilhado por seus cards, mas notas gerais não reiniciam a inatividade de todas as oportunidades. Uma atividade precisa indicar um card válido para afetar os avisos daquele card.

Os prazos de alerta são fixos: 24 horas sem primeiro acompanhamento, três dias para o responsável e sete dias para o gestor. Não há configuração ou desativação por funil/etapa. Encerramento explícito e retorno futuro são respeitados. O gestor consulta o histórico dos clientes da própria empresa, com autoria e horário; consultores continuam limitados à própria carteira. Acionar WhatsApp significa somente clique no atalho.

O sininho atualiza avisos ao entrar, voltar à janela, abrir o painel e a cada 60 segundos enquanto visível. Não existe envio com o aplicativo fechado, push ou importação de mensagens. O bloqueio do plano é consultado em cada operação do banco e independe dessa atualização visual.

## Plano e arquivos

O plano padrão é SUN7CRM Mensal, R$ 189,90. O ADM confirma recebimentos e concede 7, 15 ou 30 dias gratuitos. Há sete dias de carência no ciclo mensal; D+8 bloqueia. A renovação desconta somente os dias de carência usados, até sete, sem consumir os dias bloqueados. Detalhes: `plano-cobranca-e-carencia.md`.

Logos usam bucket privado e prefixo pelo UUID da empresa. A equipe autorizada lê; somente o gestor grava. O cadastro da identidade não altera segmento, papéis, cobrança ou habilitação.

## Estado de integração visual

Já conectados: login/primeiro acesso, administração e plano, contatos/importação, tarefas, funis/cards, catálogo, etiquetas, estratégias, embaixadores/campanhas, equipe, identidade da empresa, notificações, histórico, WhatsApp, dashboard e relatórios. O painel autenticado usa `OperationalBackend` com a sessão Supabase e não inicializa dados da demo. A área operacional carrega em um chunk próprio após o acesso.

As buscas e listagens são paginadas. Cards vinculam seletores de contatos e interesses, com cadastro inline permitido pelo perfil. As operações aguardam confirmação do servidor; falhas de rede ou conflitos preservam o formulário. Operações financeiras mantêm a mesma chave e o mesmo conteúdo em novas tentativas. Editar campanha compara a versão para evitar sobrescrever outra edição.

Detalhes de rotas e QA: `integracao-operacional.md`. A integração com a API de pagamentos permanece como última etapa, conforme a decisão de Pedro.

O ambiente continua em homologação. Os testes automatizados usam PostgreSQL/PGlite e Auth simulado. Migrações remotas não inserem pessoas, vendas, pagamentos fictícios ou aceites pelos usuários. A conferência de ponta a ponta com contas reais e documentos definitivos continua necessária antes do uso comercial.
