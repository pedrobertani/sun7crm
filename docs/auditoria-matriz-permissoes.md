# SUN7CRM — Matriz de permissões individuais dos funcionários (31/10/2026)

## Escopo do teste

Nova suíte `supabase/tests/role-matrix.node.mjs`, executada no `npm run test:db` via GitHub Actions. Utiliza as migrações reais do repositório em **PostgreSQL simulado PGlite**, contas e empresas fictícias e `auth.uid()` simulado. Não acessa o banco Supabase publicado.

**Evidência inicial:** CI [#313](https://github.com/pedrobertani/sun7crm/actions/runs/41167942924) — aprovado (banco, frontend, typecheck, funções e build). A prova adicional de permissões individuais deve ser aprovada por novo CI antes do merge.

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

## Modelo atual — funcionários com permissões individuais

**Não existem classes operacionais fixas para o gestor configurar.** O gestor cria a conta do funcionário e seleciona diretamente as ações (`contacts.view`, `contacts.create`, `contacts.edit`, etc.) e o alcance da carteira (`own` ou `company`). Os valores técnicos legados `seller`/`reception` permanecem no banco por compatibilidade; **não devem definir a experiência ou as permissões de um funcionário recém-criado**.

A função atual `crm_edge_finish_user` já grava uma linha em `crm_private.employee_access` com `keys={}` e `scope=own` na criação. Portanto, o funcionário começa **sem acesso operacional** até o gestor concluir a configuração das permissões.

A nova regressão prova que duas identidades com valores legados diferentes, mas que recebem as mesmas concessões `contacts.view` + `contacts.create` e alcance `company`, conseguem **cadastrar e atribuir um novo contato a outro funcionário da mesma empresa**, mas não editar contatos sem `contacts.edit`. Também prova que concessões de cadastro não liberam gestão de funis ou cards e que a **revogação vale imediatamente**.

**Atenção à interface:** o seletor de responsável do formulário real depende de `useTeam()`, que apresenta apenas o próprio usuário quando o funcionário não tem `team.view`. Portanto, o backend permite a atribuição com alcance `company`, mas a UI pode não listar os colegas nesse caso. Revisar o carregamento de responsáveis elegíveis com dados mínimos, sem exigir acesso amplo à gestão da equipe; essa melhoria deve ter teste de frontend específico.

Os testes anteriores que citam gestor, consultor e recepção representam **identidades de fixtures legadas**, não categorias de acesso impostas ao produto.

## Pendências e limites

- [x] Testar matriz multiempresa, carteira própria, recepção, gestor e perfis inativos em PGlite.
- [x] Testar tentativas indevidas de edição, atribuição e administração em RPCs.
- [x] Integrar casos à suíte padrão de CI.
- [ ] Homologar com sessões reais **fictícias** de gestor, consultor e recepção no **projeto Supabase SUN7CRM**, cujo conector não está disponível nesta sessão (somente StudioPro está conectado).
- [x] Confirmado o modelo: o gestor define cadastro/edição e alcance individualmente; não implementar regra fixa de recepção.
- [ ] Ajustar o seletor de responsáveis no frontend para que quem recebeu `contacts.create` e alcance `company` possa atribuir novo contato sem também precisar de `team.view`, mantendo visibilidade mínima.
- [ ] Revalidar as permissões delegadas específicas que podem substituir padrões de cada perfil, além da cobertura já existente em `employee-permissions.node.mjs`.

**Nenhuma migração, usuário real ou ambiente de produção foi alterado.**
