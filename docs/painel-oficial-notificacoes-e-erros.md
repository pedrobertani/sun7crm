# Páginas oficiais, notificações e rastreamento de erros

## Rotas e dados

| Área            | Rota                                          | Dados e autorização                                                                         |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Demonstração    | `/#/demo` e subrotas                          | Dados fictícios do navegador; apresentação do produto; nenhum cadastro no Supabase          |
| Login           | `/#/acessar`                                  | Supabase Auth, e-mail e senha                                                               |
| Primeiro acesso | `/#/conta`                                    | Senha pessoal, documentos vigentes e aceite individual                                      |
| Administração   | `/#/admin` e `/#/admin/empresas`              | Perfil administrativo consultado no banco, carteira real e comandos autorizados no servidor |
| Empresa         | `/#/app`, `/#/app/contatos`, `/#/app/tarefas` | Empresa habilitada, vínculo ativo e RLS por gestor, vendedor ou recepção                    |

O repositório local da demonstração é inicializado somente em `/demo`. As antigas rotas sem prefixo não abrem mais telas fictícias. A página administrativa não permite selecionar um papel simulado. O perfil não vem de metadados editáveis pelo usuário.

O painel administrativo contém indicadores e gráficos filtráveis, lista paginada na origem, busca, detalhes, cadastro de empresa e gestor, edição de valor/vencimento e habilitação. A empresa começa desativada, recebe o gestor e depois pode ser habilitada pelo administrador. Habilitar exige um gestor ativo. Não existem planos comerciais. Alterações de modelo não recriam quadros nem apagam etapas.

As páginas iniciais da empresa consultam contatos e tarefas reais, com paginação e restrições do banco. Nesta entrega, essas páginas são de consulta; os demais módulos operacionais do CRM terão integrações próprias. Nenhum módulo ainda não integrado é substituído silenciosamente pela demonstração.

## Bloqueio obrigatório

A autenticação, a troca da senha inicial e a confirmação das duas versões jurídicas precedem a consulta operacional. Sem os documentos oficiais, o sistema mostra **Documentos em preparação**. Textos preliminares do site não são inseridos como documentos oficiais, e nenhum aceite é criado pela implantação.

O frontend confere o acesso novamente antes de leituras administrativas e comandos. O banco e as Edge Functions mantêm verificações independentes. Mudança de papel, vínculo, empresa ou exigência jurídica não é contornada pelo endereço da página.

## Sininho e notificações

Tabela `public.crm_notifications`, com destinatário individual, empresa, tipo, referência do registro, prioridade, horário e `read_at`. Não contém valores financeiros ou cópias de dados pessoais dos contatos.

| Perfil   | Avisos iniciais                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestor   | Vencimento do SUN7CRM nos sete dias anteriores, no dia e após vencer; novos contatos dos últimos sete dias; tarefas próprias e prazos da equipe |
| Vendedor | Contatos atribuídos recentemente; tarefas próprias, inclusive prazos para hoje e vencidos                                                       |
| Recepção | Contatos atribuídos recentemente; tarefas próprias, inclusive prazos para hoje e vencidos                                                       |

O vencimento tem prioridade visual e aparece somente para gestores ativos daquela empresa. A consulta privilegiada projeta apenas o aviso da própria identidade; não recebe destinatário ou mensagem do navegador e não concede leitura da cobrança aos vendedores ou à recepção.

Os avisos são conferidos ao entrar, abrir o sininho, voltar à janela e a cada 60 segundos enquanto a página está visível. Não há envio em segundo plano com o aplicativo fechado nesta entrega. Estados de vencimento são deduplicados por data e fase; atualizar a página não recria avisos lidos. Renovação, conclusão de tarefa e mudanças de atribuição resolvem ou ocultam avisos que não se aplicam mais.

`crm_refresh_notifications()` atualiza os avisos do próprio usuário. `crm_mark_notifications_read(uuid[])` marca somente notificações visíveis do próprio usuário, com horário do servidor e até 100 identificadores por chamada. RLS e grants impedem fabricar notificações, trocar o destinatário ou consultar outra empresa.

## Tabela técnica de erros

Tabela **`crm_private.function_errors`**. A aplicação cliente não lê nem grava esses registros. O servidor usa `crm_log_function_error(jsonb)`, permitido somente à credencial administrativa do backend; a conexão de operador pode inspecionar os registros pelo banco.

| Campo                       | Conteúdo                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `id`, `created_at`          | Identificador e horário do registro no servidor                                            |
| `function_name`             | Endpoint que falhou                                                                        |
| `request_id`                | Trace da requisição; corresponde ao envelope e ao cabeçalho `X-Request-Id`                 |
| `operation_id`              | Chave de idempotência para correlacionar tentativas da mesma operação                      |
| `actor_user_id`             | Identidade validada, quando disponível; ausente em chamadas não autenticadas               |
| `execution_id`              | Identificador de execução da infraestrutura                                                |
| `http_status`, `error_code` | Status e código controlados                                                                |
| `safe_message`              | Mensagem segura, sem reproduzir a mensagem de exceções inesperadas                         |
| `exception_type`            | Tipo da exceção                                                                            |
| `trace`                     | Até 12 frames de arquivo, linha e coluna; sem primeira linha, URLs completas ou parâmetros |

| Função               | Tratamentos relevantes                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `crm-create-company` | Sessão, perfil administrativo, documentos, validação, transação e idempotência                                   |
| `crm-update-company` | Sessão, administrador, documentos, gestor obrigatório para habilitar, cobrança e idempotência                    |
| `crm-create-user`    | Autorização antes do Auth, conta duplicada, reserva, confirmação, cancelamento e resultado que exige conciliação |
| `crm-reset-password` | Hierarquia, alvo, concorrência e resultado não confirmado                                                        |
| `crm-first-access`   | Identidade autenticada, senha pessoal, nonce e falha após alteração no Auth                                      |

Todos passam pela mesma camada HTTP, com `try/catch`, mensagem segura e identificação da requisição. Respostas controladas 4xx e falhas 5xx são registradas. Senha, JWT, chave de API, corpo de formulário, dados de contato e mensagem bruta de uma exceção inesperada não são persistidos pelo logger.

O armazenamento do erro tem timeout de 1,5 segundo e seu próprio tratamento. Uma falha de logging gera um código controlado no console e preserva a resposta da operação original. Os comandos mantêm seus casos de uso e endpoints separados; a infraestrutura comum não vira uma função genérica de negócio.

## Verificação e limites

Testes de frontend, handlers e PostgreSQL local com Auth simulado cobrem bloqueio jurídico, hierarquia, RLS, troca de papel, outra empresa, atribuição, leitura individual, renovação, prazos, idempotência e sanitização de traces. Typechecks e build são obrigatórios antes da publicação.

QA de navegador usa dados fictícios isolados e não grava empresas, gestores, aceites ou documentos no projeto real. O harness temporário é removido antes do pacote. O teste integral com uma conta real, documentos oficiais e criação de empresas deverá ser feito pelo titular depois da liberação jurídica. As verificações remotas desta entrega devem registrar o estado de migrações e a recusa de chamadas sem sessão, incluindo a persistência do erro técnico.


## Conferência desta publicação

- 149 testes locais aprovados: 59 de frontend, 62 de banco e 28 de handlers.
- Typecheck do frontend, typecheck das funções e build de produção aprovados.
- As três migrações desta entrega foram aplicadas no Supabase e os cinco endpoints foram publicados.
- Chamadas sem sessão aos cinco endpoints retornaram `401 / UNAUTHENTICATED` e produziram registros técnicos com correlação e trace.
- Conferência com o papel autenticado da conta de teste: ADM ativo, senha pessoal definida e bloqueio por `CRM_LEGAL_REQUIRED`. Nenhum documento oficial ou aceite foi criado.
- Aviso anterior do projeto: proteção de senha vazada permanece desativada; ver https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. A configuração não foi alterada nesta entrega. Tabelas privadas de controle permanecem intencionalmente sem políticas e sem grants para clientes.

A execução integral de cadastro real com a conta do titular permanece condicionada aos documentos oficiais. As verificações locais não substituem esse teste.
