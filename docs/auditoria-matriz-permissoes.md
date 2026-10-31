# SUN7CRM — Matriz de permissões por perfil (31/10/2026)

## Escopo do teste

Nova suíte `supabase/tests/role-matrix.node.mjs`, executada no `npm run test:db` via GitHub Actions. Utiliza as migrações reais do repositório em **PostgreSQL simulado PGlite**, contas e empresas fictícias e `auth.uid()` simulado. Não acessa o banco Supabase publicado.

**Evidência:** CI [#313](https://github.com/pedrobertani/sun7crm/actions/runs/41167942924) — aprovado (banco, frontend, typecheck, funções e build).

## Verificações

| Perfil de teste | Leitura de contatos esperada | Resultado |
| --- | --- | --- |
| Gestor da empresa A | Todas as duas carteiras da empresa A; não vê empresa B | Aprovado |
| Consultor A | Somente contato da própria carteira | Aprovado |
| Consultor B | Somente contato da própria carteira | Aprovado |
| Recepção da empresa A | Contatos da empresa A; não vê empresa B | Aprovado |
| Gestor da empresa B | Somente contato da empresa B | Aprovado |
| Gestor inativo | Não recebe contatos | Aprovado |
| Usuário com primeiro acesso pendente | Não recebe contatos | Aprovado |
| Anônimo | Não tem leitura autorizada | Aprovado |

A suíte também verifica: gestor de outra empresa não edita clientes; consultor não transfere proprietário por payload, não edita carteira ou cards alheios e não força vínculo de outra empresa; recepção não cria nem edita contatos ou cards **conforme o comportamento atual do backend**; funcionários não criam funis nem leem o cadastro da equipe de outra empresa. Os testes conferem que operações negadas não alteram os registros.

## Atenção funcional — recepção

O backend atual **não permite que a recepção crie contatos**, confirmado pela suíte existente `workspace-backend.node.mjs` e por esta auditoria. Isso precisa ser conciliado com a definição funcional original de **recepção cadastra e encaminha**. Não foi modificada nenhuma permissão nesta rodada para evitar mudança silenciosa de política de acesso. Definir se a recepção deve receber `contacts.create` (mas não `contacts.edit` irrestrito) e quais regras de atribuição/encaminhamento se aplicam; depois implementar e testar separadamente.

## Pendências e limites

- [x] Testar matriz multiempresa, carteira própria, recepção, gestor e perfis inativos em PGlite.
- [x] Testar tentativas indevidas de edição, atribuição e administração em RPCs.
- [x] Integrar casos à suíte padrão de CI.
- [ ] Homologar com sessões reais **fictícias** de gestor, consultor e recepção no **projeto Supabase SUN7CRM**, cujo conector não está disponível nesta sessão (somente StudioPro está conectado).
- [ ] Decidir a regra de cadastro/encaminhamento da recepção antes de corrigir a política de produção.
- [ ] Revalidar as permissões delegadas específicas que podem substituir padrões de cada perfil, além da cobertura já existente em `employee-permissions.node.mjs`.

**Nenhuma migração, usuário real ou ambiente de produção foi alterado.**
