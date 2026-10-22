# Arquitetura inicial

## Etapa atual

Aplicação cliente estática em React + Vite + TypeScript. Tailwind CSS e componentes shadcn/Radix compõem a interface; Recharts produz gráficos a partir dos registros fictícios. A aparência segue a demo SUN7CRM: menu claro, verde discreto, cartões e área de trabalho com rolagem independente. O template genérico usa azul.

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

A troca do adaptador local por Supabase exigirá chamadas assíncronas, carregamento, tratamento de falhas, concorrência, autenticação e testes de RLS. Não criar tabelas ou contas de produção nesta etapa.

## Segurança nesta fase

Não há tokens, senhas, login, e-mails de autenticação, banco, APIs ou serviço de envio de mensagens. Os botões de senha apresentam o fluxo previsto e não coletam credenciais. Os exemplos usam e-mails reservados `.example`/`example.com` e nomes fictícios.

Antes do piloto real, implementar e testar autorização no servidor, isolamento entre empresas, limites de requisição, revogação de sessões, política de senhas, recuperação excepcional de Caio, auditoria sem segredos e backup/restauração.
