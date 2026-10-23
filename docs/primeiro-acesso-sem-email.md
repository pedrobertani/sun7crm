# SUN7CRM — Primeiro acesso sem envio de e-mail

## Decisão de produto (23/10/2026)

Até que o SUN7CRM tenha domínio próprio e provedor SMTP configurado, não haverá convites por e-mail, links de recuperação ou notificações automáticas por e-mail.

- O administrador da plataforma cadastra somente o gestor de cada empresa.
- O gestor cadastra consultores e recepção na própria empresa.
- Quem cadastra a conta define uma **senha inicial temporária** e a transmite ao novo usuário por canal confiável, sem gravá-la em histórico, observações ou logs.
- No primeiro login autenticado, o usuário **deve trocar a senha inicial** por senha própria.
- **Depois da troca**, o próprio usuário confirma individualmente os Termos de Uso e a ciência da Política de Privacidade vigentes.
- Sem a troca obrigatória e os aceites individuais, as funcionalidades operacionais permanecerão bloqueadas.
- Na redefinição administrativa de senha, o sistema deverá exigir nova troca no próximo acesso; os aceites vigentes não são automaticamente apagados.
- A demo com dados fictícios permanece independente do login real.
- MFA fica no radar, mas não é requisito da primeira entrega.

## Limitação de segurança a informar

Enquanto quem cadastra a conta conhecer a senha inicial, **não é possível provar tecnicamente que a primeira pessoa a entrar é o titular**. A troca obrigatória reduz a exposição posterior, mas não elimina a possibilidade de acesso antes do titular. Não anunciar a confirmação dos documentos como prova independente da identidade antes de avaliar essa limitação e os controles adotados.

## Implementação pendente

**Backend implementado e publicado no Supabase (23/10/2026):** migração `crm_first_access` e reforço `crm_first_access_status_invoker`; função `crm-first-access` publicada em v1. O registro `crm_profiles.password_change_required` começa em `true`; o usuário autenticado chama `crm-first-access` para alterar a senha e permitir a posterior confirmação individual dos documentos. O banco exige a troca antes dos aceites e dos dados comerciais. Um reset administrativo remarca a exigência. Não há envio de e-mail.

**Ainda pendente:** implementar a interface de login, o formulário de troca e a tela de aceite no site real; publicar versões finais de Termos e Política. A demonstração continua separada. **Não foi realizado um teste ponta a ponta com login real**, pois o frontend não está integrado.

A branch `feat/seguranca-primeiro-acesso-20261023` contém o endpoint, migrações e configuração. O bloqueio do banco já foi publicado. Não liberar usuários reais até finalizar as telas, os documentos e os testes integrados.

## Critérios mínimos de validação

1. Cadastro com senha inicial não envia nenhum e-mail.
2. Usuário com senha inicial consegue entrar apenas no fluxo de troca de senha.
3. Não é possível confirmar documentos nem usar RPCs operacionais antes da troca obrigatória.
4. Depois da troca, exigir confirmação individual dos documentos vigentes.
5. Logout/login seguinte não repete a troca, salvo redefinição administrativa.
6. Gestor não consegue criar gestor nem usuário fora de sua empresa.
7. Consultor e recepção não podem executar comandos administrativos.
8. Tentativas com JWT ausente, inválido, expirado, outra empresa ou sem aceite são recusadas.
9. Não guardar senha inicial/nova em tabelas de negócio ou logs.
10. Senhas redefinidas por administrador/gestor acionam novamente a obrigação de troca.

## Evolução futura

Ao registrar domínio e SMTP do SUN7CRM, avaliar convites e recuperação por e-mail com links de uso único e prazo curto, preservando o registro de aceite individual.

## Validação feita nesta etapa

- Testes locais de 10 cenários do handler, com Auth e banco simulados: passaram.
- Banco real: migrações aplicadas e consulta de permissões confirmou que os comandos de conclusão são exclusivos do backend.
- A política de inserção dos aceites exige `crm_private.has_completed_first_access()`.
- O Advisor de segurança não aponta mais a função de status como SECURITY DEFINER executável por usuários autenticados.
- Testes completos com sessão real, login, recuperação administrativa e isolamento entre empresas ainda pendentes.
