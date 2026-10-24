# Arquitetura inicial

## Etapa atual

Aplicação cliente estática em React + Vite + TypeScript. Tailwind CSS e componentes shadcn/Radix compõem a interface; Recharts produz gráficos a partir dos registros fictícios. A aparência segue a demo SUN7CRM: menu claro, verde discreto, cartões e área de trabalho com rolagem independente. O template genérico inicia em azul; o gestor pode escolher outra paleta sem alterar o segmento ou o template. A seleção é compartilhada pela equipe da empresa nesta prévia local.

`CrmRepository` delimita a persistência; `BrowserRepository` guarda um snapshot versionado no navegador. Contato, oportunidade, quadro, etapa e tarefa têm identidades próprias. As movimentações usam IDs estáveis, nunca o nome de uma coluna como evento de negócio.

`src/domain/operations.ts` concentra as operações de Kanban e os filtros de visualização. Os formulários ainda fazem validação local e a atualização do snapshot. Não se trata de uma camada de autorização segura: o usuário pode alterar qualquer dado local pelos instrumentos do navegador.

Valores monetários do domínio são inteiros em centavos. O campo de moeda trabalha com representação decimal em reais e converte na fronteira do formulário. Datas de vencimento são datas civis; `today()` usa America/Sao_Paulo. Horários e fusos por empresa serão tratados ao implementar agenda/cadências.

## Integração futura

- Supabase Auth para sessão e senhas; cadastro público desabilitado.
- Postgres com `company_id`, RLS e vínculos ativos validados no servidor.
- Edge Functions para criação de acessos, redefinição administrativa e comandos críticos.
- Funções SQL/transações para movimentações ou substituições que precisam ser atômicas.
- Migrações versionadas, ambientes separados, segredos fora do frontend.
- Hospedagem estática na Cloudflare. Região do banco e eventual migração/reivindicação do Bolt Database precisam ser verificadas antes do provisionamento.

A troca do adaptador local por Supabase exigirá chamadas assíncronas, carregamento, tratamento de falhas, concorrência, autenticação e testes de RLS. A preparação das migrações foi autorizada; o frontend continua local até a conexão explícita com o projeto Supabase escolhido.

## Segurança nesta fase

A interface da demo não usa tokens, senhas, login real ou serviço de envio de mensagens. Os botões de senha apresentam o fluxo previsto e não coletam credenciais. Os exemplos usam e-mails reservados `.example`/`example.com` e nomes fictícios. Migrações e endpoints administrativos estão preparados separadamente para a futura integração.

Antes do piloto real, implementar e testar autorização no servidor, isolamento entre empresas, limites de requisição, revogação de sessões, política de senhas, recuperação excepcional de Caio, auditoria sem segredos e backup/restauração.

## Saída da prévia

O rodapé mostra o usuário e um botão Sair; Configurações aparece apenas na navegação da área de trabalho. Sair encerra a visualização simulada, limpa o perfil em memória e abre `/demo`. Um marcador em sessionStorage mantém essa tela após recarregar a mesma aba. Entrar na prévia retorna ao perfil inicial sem apagar cadastros locais. Isso é apenas navegação da demonstração: a versão com Supabase deverá encerrar e revogar a sessão real pelo provedor.

## Acesso às contas separado da demonstração

O cabeçalho público direciona Acessar para `/acessar`. A página de login não usa o seletor de perfis para autenticar: apresenta e-mail e senha indisponíveis até a conexão com o provedor de identidade. O envio é prevenido mesmo nesta fase de interface. Não há criação pública de contas nem autenticação local por senha. `/login` é um alias de `/acessar`.

Explorar a demo direciona para `/demo`; `/entrar` continua compatível com os links anteriores. O seletor de empresa e perfil, os dados fictícios e a área de trabalho são exclusivos do fluxo de demonstração. A demo abre direto no painel, sem verificar ou registrar aceite de documentos. Uma futura sessão autenticada não poderá usar a sessão simulada como autorização, reaproveitar registros antigos da demo como evidência de aceite ou liberar dados reais a partir dela.

A próxima etapa da autenticação deverá conectar cadastro administrativo, sessão real, autorização por vínculo ativo e registro dos aceites no servidor. A tela inicial não implementa esses controles por conta própria.

## Fundação de banco preparada

`supabase/migrations/20261023190000_crm_foundation.sql` cria a estrutura inicial e as políticas RLS, sem provisionamento de usuários ou dados fictícios. O roteiro e os limites estão em `supabase/README.md`. O usuário informou aplicação da fundação e do bootstrap administrativo no Supabase; não houve verificação remota. Os testes de banco usam PostgreSQL em memória com um stub local de Auth. Nenhuma chave secreta faz parte dos arquivos do projeto.

## Edge Functions por responsabilidade

Três endpoints independentes em `supabase/functions`: criar empresa, criar usuário e redefinir senha de outra pessoa. Cada diretório mantém seu caso de uso; `_shared` reúne apenas infraestrutura. Login e troca da própria senha usam Supabase Auth diretamente na integração futura.

A migração `20261023203000_crm_edge_commands.sql` oferece transações SQL exclusivas do backend, com autorização própria e grants limitados a `service_role`. Usuários da plataforma não invocam esses comandos diretamente. Auth e banco são serviços separados: a provisão de conta tem reserva, confirmação e cancelamento serializados para tratar falhas parciais. Não há roteador único com `action`.

O runtime usa os dicionários de chaves padrão injetados pelo Supabase, sem credenciais no código. Mantém verificação de JWT na plataforma e valida o usuário pelo Auth antes da autorização. A publicação dessas funções e sua ligação aos formulários ainda estão pendentes. Contratos e restrições estão em `edge-functions.md`.

## Administração fora da demo pública

A demonstração permite somente gestor, vendedor/consultora e recepção. O provider rejeita seleção do perfil administrativo, e as rotas públicas da demonstração não montam AdminDashboard nem Companies. `/admin/*` e `/empresas` direcionam à página de acesso, que permanece indisponível até a integração de autenticação. As telas de gerenciamento do Caio são preservadas no código para o ambiente real. Essa separação de navegação não substitui autorização no backend; não há dados reais na demo.
