# Limites de contas — 30/10/2026

- Até 1 gestor ativo e 5 funcionários ativos (consultores e recepção somados) por empresa.
- Trigger no banco protege criação, reativação e troca de papel/empresa; desativação libera vaga, mantendo histórico.
- Criação: 6 reservas por hora por solicitante. Limite operacional independente das vagas.
- Redefinição: 5 solicitações por destino/hora e 30 por solicitante/hora.
- Testes PostgreSQL locais cobrem limites, expiração, reativação e transferência entre empresas. Funções de autorização permanecem preservadas.
- Login: regra de 5 falhas em janela de 15 minutos, com bloqueio de 15 minutos, **PREPARADA EM SQL E TESTADA LOCALMENTE, MAS DESATIVADA**. A função está em `supabase/security/password-verification-hook.sql` **fora de migrations**; `supabase/config.toml` fixa `[auth.hook.password_verification_attempt] enabled = false`. Não há evidência de instalação ou ativação no Supabase remoto. Aviso antecipado na UI ainda não foi implementado.
- Exclusão definitiva de integrante não adicionada; desativação e redistribuição já existem.

## Ativação futura do bloqueio de login (não executar no Free)

**Estado em 31/10/2026:** somente código e testes locais. **Não instalar no banco remoto, não associar em Authentication > Hooks e não alterar a configuração para `enabled = true` agora.**

Conforme a [documentação de Auth Hooks do Supabase](https://supabase.com/docs/guides/auth/auth-hooks), o recurso **Password Verification Attempt** está disponível em **Team e Enterprise**, e **não em Pro**, na data desta revisão. Verificar a elegibilidade real do projeto antes de contratar ou habilitar; não pressupor que um upgrade para Pro permitirá a ativação.

1. Confirmar suporte do recurso no plano contratado e criar ambiente **separado de homologação**.
2. Inspecionar os privilégios, criar uma cópia de segurança adequada e revisar os riscos de **bloqueio intencional de contas por terceiros** (o hook recebe requisições não autenticadas). Um atacante que saiba o e-mail de alguém pode provocar bloqueios; revisar proteção nativa contra abuso, alertas e recuperação.
3. Aplicar **manualmente e somente após revisão** o script `supabase/security/password-verification-hook.sql` em homologação. O SQL deve continuar fora do fluxo automático de migrations enquanto estiver desativado. Confirmar que somente `supabase_auth_admin` possui `EXECUTE` e acesso aos contadores e que `anon`, `authenticated` e `service_role` não possuem acesso.
4. Em **Authentication > Hooks**, selecionar **Password Verification Attempt** e a função `public.crm_password_verification_hook`, ou configurar o mesmo hook por ferramenta suportada. Só então alterar a configuração de homologação para `enabled = true`, apontando para `pg-functions://postgres/public/crm_password_verification_hook`.
5. Testar com **conta fictícia**: quatro falhas não bloqueiam; a quinta fixa `locked_until` por 15 minutos; uma tentativa correta durante o bloqueio é negada sem encerrar sessões existentes; depois do prazo o login correto funciona; uma tentativa válida antes da quinta falha zera a contagem; outras contas continuam independentes. Verificar logs sem dados pessoais e possíveis erros de infraestrutura.
6. Implementar e homologar a **mensagem de aviso no frontend** antes do bloqueio, sem expor a existência da conta nem detalhes do contador que facilitem enumeração.
7. Somente depois de aprovação formal, planejar a implantação no SUN7CRM remoto, com rollback documentado: **desabilitar/desvincular o hook em Authentication > Hooks** e voltar `enabled = false`. A reversão do hook preserva as demais medidas nativas do Auth.

**Não confundir:** os limites de criação de usuários (6/hora), redefinição por destino (5/hora) e por solicitante (30/hora) são controles separados no PostgreSQL; não ativam o bloqueio de cinco senhas erradas. Rate limiting nativo do Supabase também não substitui esse fluxo personalizado.
