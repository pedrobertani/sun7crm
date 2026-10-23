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

A versão atual das Edge Functions já cria contas com senha inicial sem enviar e-mails. A obrigação de trocar a senha *antes dos aceites* ainda precisa ser aplicada **no backend/banco e no frontend**; esconder páginas na interface não é suficiente. A conclusão do primeiro acesso deve ser validada pelo backend para não permitir pular a troca via API. A alteração própria da senha precisa utilizar uma sessão autenticada, com controles de autorização adequados.

A branch `feat/seguranca-primeiro-acesso-20261023` mantém a configuração do gateway alinhada ao deploy atual, mas **ainda não implementa o bloqueio de primeiro acesso**. Não liberar usuários reais até completar e testar esse fluxo.

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
