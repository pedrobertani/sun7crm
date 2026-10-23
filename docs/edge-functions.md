# Edge Functions iniciais — SUN7CRM

## Responsabilidades

Cada operação tem diretório, endpoint e caso de uso próprios. Não existe rota genérica com `action` para executar todas as operações. Novos comandos administrativos devem seguir a mesma divisão.

| Endpoint             | Responsabilidade                                                    | Quem pode chamar                                                                      |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `crm-create-company` | Criar empresa, cobrança e os dois quadros iniciais em uma transação | Administrador ativo da plataforma                                                     |
| `crm-create-user`    | Criar uma conta no Auth e seu perfil/vínculo na empresa             | Caio cria gestor; gestor ativo cria vendedor/recepção na própria empresa habilitada   |
| `crm-reset-password` | Redefinir a senha de outro usuário                                  | Caio redefine gestor; gestor redefine vendedor/recepção da própria empresa habilitada |

Login e troca da própria senha pertencem ao Supabase Auth e terão integração direta pela aplicação. Não há cadastro público, recuperação automática por e-mail nem mudança obrigatória de senha no primeiro login. Nenhuma função cria outro administrador da plataforma.

`_shared` contém somente infraestrutura: autenticação, cliente Supabase, CORS, contratos técnicos, validações primitivas e respostas de erro. Regras e sequência de cada caso de uso ficam em seu diretório. As funções SQL internas existem para transações, conferência de permissões e conciliação; não são endpoints abertos ao navegador.

## Estado da entrega

Código e migração adicional preparados e testados localmente. A aplicação da fundação e o bootstrap do administrador no Supabase foram informados pelo usuário; não houve inspeção remota dessa execução. A nova migração e as funções desta entrega ainda precisam ser publicadas no Supabase.

O frontend publicado continua como demo local; o login real permanece indisponível. Os formulários ainda não chamam estas funções. O próximo passo de interface é integrar sessão real, leitura/publicação dos documentos, confirmação individual e os formulários administrativos.

Todos os comandos exigem os dois documentos vigentes e o aceite do solicitante. Nenhum rascunho jurídico ou aceite é criado por estas funções. Enquanto Termos e Política não tiverem versões exigidas publicadas e aceitas pela conta real, os comandos retornam `LEGAL_REQUIRED`. A demo continua sem essa exigência.

## Segredos e identidade

As funções leem os valores já injetados no ambiente hospedado:

- `SUPABASE_URL`;
- `SUPABASE_PUBLISHABLE_KEYS`, usando a entrada `default` para consultar a identidade no Auth;
- `SUPABASE_SECRET_KEYS`, usando a entrada `default` exclusivamente no cliente administrativo do servidor.

Não é necessário cadastrar um segredo personalizado nesta etapa. Não se usa `SUPABASE_DB_URL`, a chave antiga `service_role` ou um segredo no frontend. O cliente público da aplicação continua com URL e chave publicável próprias do Vite; o ambiente das funções é separado.

`CRM_ALLOWED_ORIGINS` é opcional: lista de origens separadas por vírgula. O padrão já permite `https://sun7crm-base.dreamygull10.chatgpt.site`. Para desenvolvimento local, configurar explicitamente a origem local junto da origem desejada. CORS restringe o navegador; autenticação e autorização também são obrigatórias em chamadas sem `Origin`.

`verify_jwt = true` permanece ativado para os três endpoints. O código ainda exige `Authorization: Bearer <JWT da sessão>`, consulta `auth.getUser(token)` no servidor e rejeita chaves de API no lugar da sessão. O ator é derivado dessa resposta, nunca do corpo enviado. Dados do perfil e metadata editável não concedem privilégios.

Os comandos SQL expostos têm `EXECUTE` somente para `service_role`, `search_path` vazio e autorização própria. As tabelas privadas de controle têm RLS e não possuem grants de leitura/escrita para `anon`, `authenticated` ou `service_role`; as rotinas controladas fazem o acesso. Manter `crm_private` fora dos schemas expostos na Data API.

## Contratos HTTP

Somente `POST` e preflight `OPTIONS`. Enviar `Content-Type: application/json`, a sessão em `Authorization`, a chave publicável em `apikey` e um UUID novo em `Idempotency-Key` para cada operação. Manter o mesmo UUID ao repetir uma operação após falha de rede. O corpo tem limite de 16 KiB; campos desconhecidos são recusados.

Respostas de sucesso têm `{ "data": { ... }, "request_id": "..." }`; falhas têm `{ "error": { "code": "...", "message": "..." }, "request_id": "..." }`. O identificador HTTP também vem em `X-Request-Id`. O UUID de idempotência identifica a operação de negócio e os registros de conciliação; o identificador HTTP identifica cada chamada. Não registrar os cabeçalhos de autenticação ou corpos nas ferramentas de observabilidade.

### Criar empresa

```json
{
  "name": "Empresa exemplo",
  "segment": "Estética",
  "template": "aesthetic",
  "theme": "sun7",
  "monthly_amount_cents": 19000,
  "due_date": "2026-12-01"
}
```

Retorna `company_id` e `enabled: false`. Valor em centavos inteiros; vencimento é data civil. Modelo aceita `aesthetic`/`generic`, com temas já existentes no projeto. Cria os quadros Novos contatos e Clientes com etapas iniciais. O cadastro permanece desabilitado para permitir a preparação da empresa e do gestor; ativação é uma ação administrativa posterior. Não há planos, bloqueio automático por vencimento ou cadastro de usuário implícito nesta operação.

A mesma chave de idempotência e os mesmos dados devolvem a empresa existente. Dados diferentes com a mesma chave retornam conflito. Falha de cobrança ou quadro desfaz o cadastro completo da empresa.

### Criar usuário

```json
{
  "company_id": "UUID da empresa",
  "role": "seller",
  "display_name": "Nome da pessoa",
  "email": "pessoa@example.invalid",
  "password": "SENHA_DEFINIDA_NO_FORMULARIO"
}
```

Perfis aceitos: `manager`, `seller`, `reception`. A autorização define quais deles o solicitante pode criar. Não se reutiliza uma conta existente pelo e-mail nem se altera sua senha para anexá-la a uma clínica. Convite/vínculo de uma mesma conta em empresas diferentes exigirá fluxo próprio, se aprovado.

O responsável confere o e-mail ao cadastrar. A Admin API cria a conta confirmada, com senha definida no formulário autorizado, sem envio automático de mensagem. A senha deve ter ao menos 12 caracteres e até 72 bytes UTF-8; o limite evita truncamento em instalações com bcrypt. A função não devolve a senha nem a grava no banco do CRM, no fingerprint ou em logs.

A função reserva a operação, cria a conta no Auth e confirma perfil/vínculo em transação. A permissão é conferida novamente antes do commit. O marcador administrativo `app_metadata.crm_provisioning_id` identifica a operação; não representa papel de acesso.

Se a confirmação falhar, o cancelamento serializado confere se o commit ocorreu. Conta recém-criada só é removida depois de cancelamento confirmado. Se o commit já ocorreu, retorna o resultado existente. Se o banco estiver indisponível, preserva a conta para revisão. Uma falha de transporte no Auth pode deixar conta sem vínculo: ela não terá acesso ao CRM e precisará de conciliação pelo marcador da operação. Não repetir criando outro UUID até conferir o resultado. Operações canceladas não são reabertas automaticamente.

Limite operacional inicial: 30 reservas de cadastro por solicitante por hora, incluindo tentativas canceladas. Não é limite comercial por empresa e pode ser ajustado no backend.

### Redefinir senha de outra pessoa

```json
{
  "company_id": "UUID da empresa",
  "user_id": "UUID da pessoa",
  "password": "NOVA_SENHA_DEFINIDA_NO_FORMULARIO"
}
```

Não solicita a senha antiga. Rejeita redefinição da própria conta por esse endpoint, de administrador da plataforma, de outro gestor pelo gestor e de integrantes de outra empresa. Exige vínculo ativo do alvo. Como a senha pertence à identidade global do Auth, um alvo com qualquer vínculo em outra empresa exige procedimento técnico separado, inclusive quando o outro vínculo estiver inativo.

A tentativa é persistida antes da alteração no Auth, com ator, empresa, alvo e horário. O resultado fica como `succeeded`, `unconfirmed` ou `pending`, sem senha. Uma falha de rede não é tratada como prova de que a senha permaneceu igual; a função orienta conferir o acesso. Repetir o mesmo UUID não executa novamente a redefinição.

Limites iniciais: cinco tentativas por alvo e 30 por solicitante a cada 15 minutos. O reset não altera vínculos, perfis ou habilitação da empresa. Não se presume revogação imediata de todos os access tokens existentes; a política de duração e revogação de sessões deverá ser validada no Auth do projeto antes do piloto.

## Publicação no projeto informado

1. No SQL Editor, executar o arquivo inteiro `supabase/migrations/20261023203000_crm_edge_commands.sql`, do `begin` ao `commit`, uma vez. A fundação e o administrador já devem existir. Esta aplicação manual acompanha o procedimento usado na primeira migração; alinhar o histórico da CLI será uma etapa posterior.
2. No terminal da cópia do repositório, autenticar a CLI do Supabase e publicar os endpoints. Não inserir tokens ou senhas em arquivos versionados.

```sh
npx supabase login
npx supabase functions deploy crm-create-company --project-ref oduhbimlxnuyqliayvpl
npx supabase functions deploy crm-create-user --project-ref oduhbimlxnuyqliayvpl
npx supabase functions deploy crm-reset-password --project-ref oduhbimlxnuyqliayvpl
```

O comando usa `supabase/config.toml`, os `index.ts` e os módulos compartilhados. Não desativar a verificação de JWT para testar cadastros. O endpoint deve recusar chamadas sem sessão, perfis inferiores e empresas incorretas. No ambiente integrado, validar o fluxo completo com contas próprias de teste, versões jurídicas publicadas e aceite real antes de liberar usuários.

## Validação

```sh
npm run typecheck:functions
npm run test:functions
npm run test:db
```

Os handlers são executados com Node 24 e portas simuladas do Auth/DB. Os testes SQL usam PGlite com Auth simulado, aplicam as duas migrações e exercitam grants reais, hierarquia, isolamento, idempotência, rollback, rechecagem de permissão, conciliação, auditoria e limites. A checagem TypeScript usa a superfície de Deno declarada no projeto e os tipos do SDK fixado em 2.118.0. Os três pontos de entrada também passaram por `deno check` no Deno 2.9.6. Isso não substitui execução no runtime hospedado, gateway, GoTrue, JWT real ou PostgREST.

Documentação oficial consultada em 23/10/2026:

- https://supabase.com/docs/guides/functions/secrets
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/deploy
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
