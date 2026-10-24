# Banco inicial do SUN7CRM

Migrações preparadas para o projeto Supabase informado (`oduhbimlxnuyqliayvpl`). A aplicação continua em React + Vite + TypeScript; Supabase fornece Postgres, Auth e o backend em Edge Functions. O usuário informou a execução da fundação e do bootstrap do administrador; não houve verificação remota. A migração adicional e as funções desta entrega ainda precisam de publicação. O SQL não depende de Next.js.

## Aplicação

1. No projeto Supabase de desenvolvimento, abrir **SQL Editor → New query**.
2. Colar todo o conteúdo de `migrations/20261023190000_crm_foundation.sql` e executar uma vez. O arquivo possui transação própria, cria objetos `crm_*` e o schema `crm_private`, sem alterar tabelas anteriores. Se algum desses objetos já existir, interrompe a aplicação; não há DROP, TRUNCATE ou importação dos dados da demo.
3. Criar o usuário do Caio em **Authentication → Users**, pelo painel ou futuramente pela Admin API no backend. Copiar seu UUID, substituir o marcador de `bootstrap/01_platform_admin.sql` e executar esse segundo arquivo. Ele só vincula um usuário que já exista; não cria senha nem altera `auth.users`.
4. Manter `crm_private` fora dos schemas expostos na Data API. Desabilitar o cadastro público nas configurações do Auth, conforme o modelo de contas criadas por Caio/gestor. Essas configurações do serviço não são alteradas por SQL.

A migração cria a estrutura vazia. Empresas começam desabilitadas; habilitação é uma decisão administrativa explícita. Nenhum documento preliminar é publicado automaticamente. O acesso às tabelas operacionais exige usuário autenticado, vínculo ativo, empresa habilitada e confirmação das versões vigentes dos dois documentos. Enquanto não houver as duas versões exigidas, o acesso operacional fica fechado. Esse controle pertence à futura conta real; a demo continua independente e sem aceite.

## Estrutura

| Objetos | Finalidade |
| --- | --- |
| `crm_profiles`, `crm_memberships` | Nome do usuário e vínculos por empresa, com gestor, vendedor e recepção |
| `crm_private.platform_admins` | Administração da plataforma atribuída por operador confiável; não depende de metadata editável pelo usuário |
| `crm_companies` | Identidade da empresa, segmento/template administrativo e habilitação |
| `crm_company_billing` | Valor em centavos e vencimento individuais, visíveis somente à administração |
| `crm_contacts` | Responsável, temperatura, interesse inicial em texto e observações |
| `crm_boards`, `crm_stages`, `crm_opportunities` | Quadros e etapas com IDs estáveis e valores estimados |
| `crm_tasks` | Prazo, responsável e etapas A fazer, Em andamento e Concluídas |
| `crm_legal_documents`, `crm_legal_requirements`, `crm_legal_acceptances` | Documentos imutáveis com hash calculado, versões exigidas e confirmações por usuário real |
| `crm_audit_events` | Identificadores de alterações e ator autenticado, sem cópia do conteúdo dos contatos |

As chaves estrangeiras incluem a empresa: um cartão não pode referenciar contato de outra empresa nem etapa de outro quadro. Valores usam centavos inteiros; prazos usam `date`, instantes usam `timestamptz`. IDs, empresa, autoria e data de criação permanecem imutáveis. A conclusão de tarefas recebe horário do banco e a reabertura remove esse horário.

E-mail de login e senha pertencem ao Supabase Auth. A migração não duplica senhas em tabelas do CRM. A consulta de e-mails da equipe será feita pelo backend autorizado ao integrar o gerenciamento de acessos.

## Acesso inicial proposto

| Perfil | Permissão no banco |
| --- | --- |
| Anônimo ou autenticado sem vínculo | Sem acesso ao CRM |
| Gestor | Dados operacionais da empresa; nomes, logo e cores; tarefas da empresa |
| Vendedor/consultora | Contatos e oportunidades sob sua responsabilidade; próprias tarefas |
| Recepção | Consulta contatos e oportunidades da empresa; próprias tarefas |
| Caio | Cadastro das empresas, cobrança e metadados de gestão; sem acesso implícito aos contatos e tarefas das empresas |

Essas permissões de vendedor/recepção continuam provisórias até validação comercial. Escrita de vínculos, perfis administrativos, cobrança, segmento/template e estrutura dos quadros fica reservada ao backend confiável. O navegador não pode promover perfis, alterar habilitação/cobrança ou fornecer a identidade e o horário de um aceite. Os registros de aceite são individuais da conta da plataforma; não representam consentimento de leads ou clientes.

Não há exclusão direta de dados operacionais pela Data API nesta primeira migração. Contas e vínculos são desativados; referências históricas impedem remoção acidental de perfis utilizados. Retenção, anonimização e exclusão definitiva precisam do fluxo próprio. A auditoria registra o `auth.uid()` nas operações autenticadas; comandos de serviço sem JWT de usuário podem ter ator nulo e exigirão auditoria do backend ao implementar esses comandos.

## Próxima integração

- O cliente sob demanda está preparado em `src/lib/supabase.ts`, com armazenamento de sessão separado da demo e chave publicável. Conectar a sessão real, os módulos e o adapter assíncrono permanece uma próxima entrega. A existência das variáveis de ambiente não habilita o login por si só.
- Três Edge Functions já preparadas, cada uma com responsabilidade própria, para criar empresa, criar usuário e redefinir senha de outra pessoa. Aplicar a migração adicional `20261023203000_crm_edge_commands.sql`, publicar os endpoints e validar no ambiente real. A Admin API e as chaves elevadas pertencem ao backend. Guia: `../docs/edge-functions.md`.
- Comandos transacionais para criação da empresa/gestor/quadros, edição/ordem de etapas, transferência antes de exclusão e limites de quadros/etapas ainda provisórios. A migração permite leitura dos quadros e movimento de cartões, mas não libera sua edição estrutural pelo navegador.
- Publicação dos documentos finais e definição das versões exigidas, seguida de interface de aceite do usuário real. A migração não liga os rascunhos atuais automaticamente.
- Upload de logos com bucket e políticas de Storage; `logo_path` armazena o caminho, sem criar bucket público nesta etapa.

Não foram adicionadas cadências, disparos, comissões, recebimentos, bloqueio automático por vencimento, IA, Meta ou WhatsApp. Interesse permanece texto até a definição do catálogo; quantidade de gestores e limites definitivos serão validados. Vencimento não altera sozinho a habilitação nesta migração.

Para preparar o SQL, nenhuma credencial é necessária. Para o futuro frontend, URL e chave publicável bastam junto da sessão do usuário. A chave `sb_secret` fica somente nos segredos do backend; o endereço JWKS será útil para validar tokens no servidor. A URL e o JWKS informados não alteram a escolha do frontend. O exemplo de configuração está em `../.env.example`.

## Validação local

```sh
npm ci
npm run test:db
```

O teste usa PostgreSQL em memória com PGlite e um stub local de Supabase Auth. Aplica a migração e testa isolamento entre duas empresas, perfis, vínculos inativos, empresa desabilitada, cobrança, referências cruzadas, alterações de etapa, conclusão de tarefa, documentos/aceites e auditoria. Também verifica reaplicação sem perda dos dados existentes. Não usa chaves, conexão remota ou dados reais. Não substitui validação no Supabase, na Data API, no Auth e nas Edge Functions.

Referências técnicas consultadas em 23/10/2026:

- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/getting-started/quickstarts/reactjs
- https://supabase.com/docs/guides/auth/general-configuration
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://pglite.dev/docs/api
