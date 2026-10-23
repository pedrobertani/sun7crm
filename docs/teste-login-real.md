# SUN7CRM — Teste do login real e primeiro acesso
23/10/2026 — etapa de integração (sem dados reais de clínicas)

## Separação de ambientes

- `/#/demo`: demonstração local com dados fictícios; não conecta à conta autenticada e não registra aceite.
- `/#/acessar`: login real com Supabase Auth (`signInWithPassword`).
- `/#/conta`: fluxo autenticado e protegido, sem reutilizar as telas simuladas como painel real.
- A área administrativa operacional continua bloqueada até que as permissões, as telas de CRUD e os aceites sejam validados.

## Configuração do frontend

A aplicação usa por padrão a URL e a **chave publicável** de baixo privilégio do projeto SUN7CRM de São Paulo. O repositório **não contém chave secreta** ou `service_role` e as variáveis de build `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` prevalecem quando fornecidas. A publicação do código frontend deve ser feita separadamente pela plataforma que hospeda o site ChatGPT Sites; salvar no GitHub não publica automaticamente o site.

O CORS de `crm-first-access` atualmente reconhece a origem:
`https://sun7crm-base.dreamygull10.chatgpt.site`
Outros domínios devem ser explicitamente autorizados em `CRM_ALLOWED_ORIGINS` após revisão. CORS não substitui autenticação/autorizações.

## Primeiro acesso real — cenário feliz

1. Abrir `/#/acessar` e entrar com conta de teste real cadastrada no Auth (não usar perfis fictícios da demo).
2. Se `crm_profiles.password_change_required=true`, a aplicação mostra a troca obrigatória de senha em `/#/conta`.
3. A troca chama `crm-first-access`, que valida JWT e altera **apenas a senha da própria conta**.
4. Após troca bem-sucedida, encerrar a sessão e autenticar novamente com a nova senha.
5. Enquanto não houver Termos e Política definitivos publicados, exibir bloqueio `Documentos em preparação` e **não** liberar operações comerciais.
6. Após o responsável publicar no Supabase dois documentos vigentes e aprovados, apresentar a íntegra e pedir duas confirmações individuais.
7. Inserir apenas `kind` e `version` no `crm_legal_acceptances`. O servidor preenche o usuário e o horário, valida RLS e as versões vigentes.
8. Após confirmações, mostrar `Conta verificada` (painel operacional ainda será integrado).

## Cenários negativos obrigatórios

- Credenciais incorretas → mensagem genérica, sem revelar se e-mail existe.
- Rota `/#/conta` sem autenticação → redireciona ao login.
- Sessão expirada ou inválida → não consulta nem exibe informações do CRM.
- Troca com senha curta, maior que 72 bytes, divergente ou campos extras → recusada.
- Tentativa de ler/escrever dados comerciais antes da troca de senha → recusada no banco.
- Tentativa de inserir aceite antes da troca → recusada por RLS.
- Sem um dos documentos aprovados → nenhum aceite é liberado.
- Sem marcar ambos os checkboxes → nenhum aceite é registrado.
- Consultor/recepção tentando criar empresas, gestores ou alterar senha de outros → recusado.
- Usuário de empresa A tentando consultar empresa B → recusado.
- Redefinição pelo gestor → próximo login exige nova troca.
- Não enviar e-mail, OTP ou convite nesta fase.
- Conferir logs sem JWT, senha, conteúdo da requisição ou chaves.

## Segurança e pendências

- A aplicação **não envia e-mails**, não implementa recuperação automática e não usa MFA.
- `crm_legal_documents` e `crm_legal_requirements` estavam vazios na revisão. É necessário aprovar versões reais antes do teste de aceite.
- A senha temporária é conhecida por quem criou a conta. A troca obrigatória reduz o risco, mas não atesta a identidade do titular antes do primeiro acesso.
- Validação da publicação: 36 testes da aplicação, 50 testes de banco e 24 testes das funções passaram, junto dos typechecks da aplicação/funções e do build de produção. Os testes de banco usam PGlite e Auth simulado; não criam documentos jurídicos no projeto remoto.
- A revisão encontrou uma falta de permissão na consulta privada usada pela política de aceite. A migração `20261023231854_crm_legal_acceptance_status_policy.sql` reutiliza `crm_first_access_status()`, que já é autorizada e consulta somente a própria conta, mantendo a função privada fechada. A correção está preparada e testada; sua aplicação no Supabase remoto permanece pendente de autorização específica.
- O teste novo reproduz a falha original e verifica os aceites separados por usuário, senha obrigatória, nova versão, ausência de documentos, campos imutáveis e proteção do nonce. Nenhum privilégio adicional é concedido pela correção.
- No Supabase remoto foram conferidos a função de primeiro acesso publicada, a troca de senha pendente, os grants e a ausência de documentos oficiais. Uma chamada sem sessão retornou 401 com o CORS do site. Consultas sob o papel autenticado confirmaram que os comandos de conclusão e os campos de senha não são graváveis pelo navegador e que os dados operacionais permanecem bloqueados. Nenhuma senha real foi alterada e nenhum aceite real foi registrado nestas verificações.
- No navegador foram conferidos login habilitado, redirecionamento de `/conta` sem sessão, entrada direta na demo, dashboard com gráficos e retorno ao site. O fluxo completo com credencial válida e troca da senha pessoal depende de validação manual pelo titular.
- Fonte de publicação: branch `feat/seguranca-primeiro-acesso-20261023`, a partir do commit `c67f318d5129a59ad87bae0fc76026ab1ed8879a`, com a correção e os testes adicionados. A publicação usa o projeto existente, preserva a identidade visual e mantém o bloqueio até os documentos oficiais estarem disponíveis.
- O advisor ainda indica [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Essa configuração não foi alterada nesta entrega. Os avisos informativos de RLS sem políticas pertencem às tabelas privadas sem grants, que permanecem fechadas aos clientes.
