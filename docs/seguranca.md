# Segurança do SUN7CRM

Revisão de 25/10/2026, solicitada por Pedro. Projeto: `oduhbimlxnuyqliayvpl`. Esta revisão não altera senhas, sessões, aceites pessoais ou o plano contratado.

## Ativo nesta entrega

- Consultas do aplicativo usam o SDK/PostgREST com valores separados dos comandos; RPCs usam SQL estático e parâmetros. Nenhum filtro `or` é montado por concatenação de busca. Identificadores, campos permitidos e vínculos são validados no banco; a validação do navegador não é considerada autorização.
- RLS por empresa e responsável continua aplicada. Testes executam tentativas de injeção em nomes, observações, títulos, catálogo e identificadores, além de tentativas de enviar empresa/papel/autoria dentro do JSON. Não são executados ataques contra contas ou dados reais.
- A política CSP é inserida no início do HTML de produção: scripts somente da mesma origem, sem scripts inline, eventos HTML inline ou `eval`; conexões somente para a origem do aplicativo e o projeto Supabase configurado. Objetos, frames filhos e workers são bloqueados. Imagens locais, `data:` e `blob:` atendem os logos; estilos inline continuam permitidos por causa dos componentes e temas.
- A mesma função valida a origem do Supabase no build e no navegador. Recusa HTTP remoto, credenciais, caminho, consulta e fragmento na configuração. HTTP é permitido apenas em loopback para desenvolvimento.
- Política de referrer `strict-origin-when-cross-origin`. O login mantém erros genéricos para credenciais inválidas e trata o retorno 429 do provedor. Não existe contador de bloqueio em localStorage.
- Permanecem os controles anteriores das funções administrativas: autenticação do JWT no Auth, autorização no banco, CORS por origem, JSON limitado a 16 KiB, campos permitidos, senha de 12 caracteres a 72 bytes, limites por operação e respostas/logs sem senhas ou tokens.

## Cinco falhas de senha: preparado, ainda não ativo

A organização está no plano Free. Na documentação oficial consultada nesta data, o Password Verification Attempt Hook está disponível somente nos planos Teams e Enterprise. O bloqueio exato por conta não foi ativado nem simulado no frontend. Um proxy de login isolado também não resolveria, pois o endpoint público de autenticação continuaria acessível diretamente.

O arquivo `supabase/security/password-verification-hook.sql` fica deliberadamente fora de `supabase/migrations`: é uma implementação preparada para um ambiente compatível, testada somente no Postgres local. Não foi aplicado no Supabase e não integra a publicação do frontend como proteção ativa.

Regra preparada:

1. Cinco falhas dentro de uma janela de 15 minutos iniciam bloqueio temporário de 15 minutos para aquele usuário.
2. Durante o bloqueio, senha correta também é recusada. Senha errada mantém a resposta padrão de credenciais inválidas. A aplicação não informa quantas tentativas restam.
3. Novas falhas não estendem o bloqueio. Após expirar, o acesso pode ser tentado novamente. Sucesso antes do limite zera a contagem.
4. O bloqueio não encerra sessões existentes. Outros usuários não são bloqueados junto.
5. Contadores guardam somente UUID, quantidade e horários, em tabela privada com RLS. Apenas `supabase_auth_admin` pode executar o hook e ler/gravar a tabela. Não há acesso por `anon`, `authenticated` ou `service_role`.
6. Um upsert serializa a linha do usuário. A contagem depende do resultado de verificação produzido pelo próprio Auth; a aplicação não fornece `valid` nem pode zerar contadores.

Antes da ativação: escolher um ambiente/provedor compatível sem assumir contratação; instalar o SQL; vincular o hook nativo; homologar com conta exclusiva de teste o endpoint direto de senha, persistência entre solicitações, concorrência, bloqueio e expiração. O teste local do SQL não substitui essa homologação do Auth. Falhas de execução do hook não devem liberar autenticação.

Bloqueio por conta sozinho não limita o custo de conferir senhas e permite que terceiros provoquem bloqueios temporários. A proteção completa deve combinar limites nativos por origem/IP e CAPTCHA validado pelo próprio Auth. No plano atual, a próxima configuração recomendada é CAPTCHA nativo; sua ativação e os limites de Auth ainda dependem de acesso às configurações do provedor. Não foram habilitados nesta entrega. A conexão Supabase disponível não expõe edição dessas configurações. O alerta preexistente de proteção contra senhas vazadas continua pendente; esse recurso exige Pro ou superior.

## Limites da publicação estática

A CSP é entregue por elemento `meta`. Ela não fornece `frame-ancestors`, HSTS, `X-Frame-Options`, `nosniff` ou relatórios de violações por HTTP. Não se presume que um arquivo `_headers` funcione no hosting atual. Essas configurações devem ser avaliadas no servidor/hosting antes de declarar proteção contra clickjacking ou cobertura por WAF.

Os testes cobrem os fluxos exercitados e não constituem auditoria externa ou garantia de ausência de vulnerabilidades. A homologação com contas pessoais de gestor/consultor continua separada.

A conferência de dependências de produção (`npm audit --omit=dev`) não apontou vulnerabilidades conhecidas nesta execução. Esse resultado representa a base de avisos consultada e não garante ausência de falhas desconhecidas.

## Referências

- https://supabase.com/docs/guides/auth/auth-hooks
- https://supabase.com/docs/guides/auth/auth-hooks/password-verification-hook
- https://supabase.com/docs/guides/auth/rate-limits
- https://supabase.com/docs/guides/auth/password-security
- https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
- https://developer.chrome.com/docs/lighthouse/best-practices/csp-xss
