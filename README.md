# SUN7CRM

Base inicial do CRM comercial, construída a partir do visual da demo aprovada. React + Vite + TypeScript, Tailwind CSS, componentes shadcn/Radix e Recharts.

## Estado atual

**Protótipo de desenvolvimento sem banco de dados, backend ou autenticação real.** Os dados são fictícios e ficam no `localStorage` do navegador. Não inserir dados pessoais reais ou senhas. Os seletores do topo permitem validar diferentes visões; não representam autorização de produção.

- Dashboard da empresa com gráficos, indicadores e período selecionável. Cards abrem as telas de detalhe com os filtros correspondentes.
- Painel do Caio com filtros, empresas, mensalidade individual e vencimento.
- Cadastro de empresas e gestor fictício, sem sistema de planos.
- Contatos com responsável, interesse, observações e temperatura manual.
- Dois quadros Kanban, com edição, ordem e transferência de cartões ao remover etapas.
- Movimentação por arraste no desktop ou seletor de etapa, inclusive por teclado/toque.
- Tarefas manuais, prazos e conclusão.
- Equipe, perfis de visualização, identidade e templates estética/genérico.
- Sete paletas de cores por empresa, incluindo as cinco opções do StudioPro, aplicadas também a gráficos e modais.
- Configurações em abas: Minha conta, Empresa, Aparência e Sobre a prévia, conforme o perfil.
- Rotas via HashRouter para funcionar em hospedagem estática sem regras de servidor.

## Executar

Requer Node.js 22.12+ (Node 24 recomendado).

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm test
npm run build
```

O resultado estático é gerado em `dist/`. Nenhuma chave ou configuração Supabase é necessária nesta etapa.

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

A demo comercial anterior permanece separada. Integrações WhatsApp/Meta/IA, cobrança automática, financeiro, cadências e comissões não estão implementadas nesta base.
