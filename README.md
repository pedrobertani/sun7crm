# SUN7CRM

Base inicial do CRM comercial, construída a partir do visual da demo aprovada. React + Vite + TypeScript, Tailwind CSS, componentes shadcn/Radix e Recharts.

## Estado atual

**A interface publicada continua como demo local, com login real ainda indisponível.** Os dados da demo são fictícios e ficam no `localStorage` do navegador. O repositório também contém migrações e as primeiras Edge Functions para integração ao Supabase. Não inserir dados pessoais reais ou senhas na demo. Os seletores do topo permitem validar diferentes visões; não representam autorização de produção.

- Dashboard da empresa com gráficos, indicadores e período selecionável. Cards abrem as telas de detalhe com os filtros correspondentes.
- Demo pública com perfis de gestor, vendedor/consultora e recepção; entrada direta, sem aceite de documentos.
- Painel do Caio e cadastro administrativo preservados no código para integração ao acesso real, fora das rotas da demo pública.
- Contatos com responsável, interesse, observações e temperatura manual.
- Dois quadros Kanban, com edição, ordem e transferência de cartões ao remover etapas.
- Movimentação por arraste no desktop ou seletor de etapa, inclusive por teclado/toque.
- Tarefas manuais em Lista ou Kanban (A fazer, Em andamento, Concluídas), com prazo, responsável e movimentação por arraste ou seletor.
- Equipe, perfis de visualização, identidade e templates estética/genérico.
- Sete paletas de cores por empresa, incluindo as cinco opções do StudioPro, aplicadas também a gráficos e modais.
- Configurações em abas: Minha conta, Empresa, Aparência e Sobre a prévia, conforme o perfil.
- Rotas com endereços limpos via BrowserRouter. Cloudflare Pages utiliza o fallback de SPA; manter o build sem `404.html` na raiz. Links antigos com `/#/` são convertidos no navegador preservando a tela e seus parâmetros. Detalhes em [docs/roteamento.md](docs/roteamento.md).
- Acesso às contas em `/acessar`, separado da demonstração pública em `/demo`. O login utiliza Supabase Auth; `/entrar` redireciona para `/acessar`.

## Executar

Requer Node.js 22.12+ (Node 24 recomendado).

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run test:db
npm run typecheck:functions
npm run test:functions
npm run build
```

O resultado estático é gerado em `dist/`. Nenhuma chave ou configuração Supabase é necessária nesta etapa.

## Fundação Supabase preparada

A migração inicial, o bootstrap do administrador e o roteiro de aplicação estão em [supabase/README.md](supabase/README.md). O usuário informou a execução desses dois scripts no Supabase; não houve verificação remota pelo desenvolvimento. A migração adicional e três Edge Functions têm código e testes locais, com publicação remota ainda pendente. A demo continua usando seu adaptador local. Dados reais e login dependem da integração com a sessão, os aceites e os formulários.

Os endpoints `crm-create-company`, `crm-create-user` e `crm-reset-password` têm responsabilidades separadas. Contratos, autorização, segredos padrão, publicação e limites estão em [docs/edge-functions.md](docs/edge-functions.md). Os testes de handlers requerem Node 24.

## Organização

```text
src/app/          Layout, rotas e estado da prévia
src/components/   Componentes compartilhados e UI
src/data/         Contrato de repositório, adaptador local e dados fictícios
src/domain/       Entidades, regras iniciais e configuração provisória
src/modules/      Dashboard, contatos, Kanban, tarefas, empresas, equipe e configurações
src/lib/          Datas, valores, classes CSS e utilitários
```

As telas não acessam `localStorage` diretamente. O adaptador `BrowserRepository` é a implementação desta fase. Na integração com o backend, as leituras e gravações serão migradas para operações assíncronas por módulo; não é apenas trocar uma URL. Autenticação, autorização e isolamento real exigirão Supabase Auth, RLS e comandos protegidos em Edge Functions.

## Decisões e próximos passos

- [Regras iniciais e pendências](docs/regras-de-negocio.md)
- [Arquitetura e limites](docs/arquitetura.md)
- [Reuso do StudioPro](docs/reuso-studiopro.md)
- [Validação realizada](docs/validacao.md)
- [Diretrizes de interface](docs/diretrizes-de-interface.md)

A demo comercial anterior permanece separada. Integrações WhatsApp/Meta/IA, cobrança automática, financeiro, cadências e comissões não estão implementadas nesta base.
