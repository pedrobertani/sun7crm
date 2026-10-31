# SUN7CRM — Responsáveis individuais e CRUD por permissão

## Regra funcional aprovada em 31/10/2026

O cadastro de usuários mantém **gestor + funcionários**. As identificações técnicas legadas não definem o acesso de funcionários: cada um recebe as permissões indicadas pelo gestor.

### Cards

- Cada card possui um `owner_membership_id` próprio, **independente** de `crm_contacts.owner_membership_id`.
- Gestor da empresa, desde que autenticado e habilitado, pode consultar cards de todos os funcionários; cada funcionário, **mesmo com alcance company nos contatos**, consulta somente os cards atribuídos a ele.
- `cards.view`: permite leitura de card atribuído, sem concessão implícita de edição.
- `cards.create`: permite criar um card sobre contato visível e escolher qualquer responsável **ativo e autorizado a visualizar cards** na empresa. Após atribuir a outro funcionário, o criador deixa de visualizar esse card (a menos que seja gestor).
- `cards.edit`: permite editar ou alterar o responsável **de um card que o usuário já pode acessar**, mesmo sem `cards.create`. Depois de encaminhado, deixa de visualizar o card.
- `cards.delete`: é permissão independente para arquivar **somente card atribuído** (gestor pode todos).
- Permissões de card não liberam `team.view` nem `team.manage`.
- O responsável pelo card pode ler o contato vinculado para atender, **sem ganhar direito automático de editar o contato ou a carteira do colega**.
- Etiquetas, interesses, histórico e alertas de outros cards permanecem isolados por proprietário.

### Responsáveis em outros recursos

- Contatos: `contacts.create` controla atribuição na criação; `contacts.edit` controla alteração de responsável em contatos editáveis.
- Tarefas: `tasks.create` ou `tasks.edit`, respeitando acesso à carteira, controlam o responsável; trocar contato relacionado não muda implicitamente quem executará a tarefa.
- Estratégias: `strategies.create`/`strategies.edit` controlam o campo de responsável.
- Para contatos e tarefas, a política `own` continua restringindo a própria carteira; `company` libera seleção de outros responsáveis elegíveis.
- A RPC `crm_assignable_members` devolve somente identificador/nome de usuários ativos elegíveis e exige a permissão de criação/edição do **recurso específico**. Não devolve e-mails, outros dados pessoais nem papéis administrativos.

### Segurança e preservação de dados

- A migração `20261031083000_crm_card_ownership_crud.sql` preenche os cards já existentes com o responsável que constava no contato naquele momento. Depois disso, os responsáveis evoluem separadamente.
- A desativação de funcionário exige redistribuição de seus cards ativos, contatos e tarefas elegíveis; não se perdem registros nem histórico.
- A confirmação de venda e as metas creditam o **responsável pelo card**. Vendas já confirmadas preservam seu lançamento histórico.
- Uma relação de contato-card nunca deve permitir acesso a outro card do mesmo contato.
- A validação verdadeira está no Postgres (RLS e funções), não apenas na ocultação de botões.

## Homologação

- [x] Código da migração, frontend e testes PGlite preparados no PR #37.
- [ ] CI completo do PR #37 aprovado no commit final.
- [ ] Confirmar o acesso ao **projeto Supabase SUN7CRM** e aplicar a migração de modo controlado antes de publicar o frontend que utiliza `owner_membership_id`. A integração apenas no GitHub/Cloudflare **antes da migração** quebraria o formulário de cards.
- [ ] Testar com usuários fictícios no banco publicado: gestor visualiza todos, funcionário só seus cards, CRUD independente, encaminhamento e revogação.
- [ ] Conferir relatórios e sinos após reatribuição de card; validar ausência de registros visíveis de terceiros.

**Não executar migrations no Supabase de outro produto nem declarar publicado antes da implantação confirmada.**
