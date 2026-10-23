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
- Testes de frontend (Vitest) adicionados em `src/modules/auth/flow.test.ts`, mas precisam ser executados em ambiente com dependências instaladas.
- Validar `npm ci && npm run typecheck && npm test && npm run build`, e os testes de banco e funções antes do merge.
- A integração da UI foi commitada na branch `feat/seguranca-primeiro-acesso-20261023`, **não** publicada no site ChatGPT Sites por esta operação.
