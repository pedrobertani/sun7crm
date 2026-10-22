# Validação da base — 22/10/2026

## Verificações locais

- TypeScript em modo estrito.
- Build estático de produção com Vite.
- Testes automatizados de persistência, corrupção do armazenamento, erro de quota, datas, valores, filtros de visualização, movimentos e personalização do Kanban.
- Auditoria das dependências de execução: nenhuma vulnerabilidade reportada na verificação inicial (`npm audit --omit=dev`).

## Conferência no navegador

- Dashboard da empresa com gráficos Recharts renderizados.
- Criação de contato, vínculo com o funil de leads e persistência após recarregar.
- Contato de teste ausente ao alternar para outra empresa.
- Adição de etapa no Kanban.
- Cadastro de empresa com gestor fictício e template genérico.
- Máscara monetária: entrada `123456` salva como R$ 1.234,56.
- Painel do Caio filtrado para vencimentos em até sete dias: cartões e tabela coerentes.
- Cadastro de integrante na nova empresa.
- Criação e conclusão de tarefa, com visualização na aba Concluídas.

A inspeção visual foi feita no navegador desktop da prévia. Media queries e alternativas por toque estão implementadas; não houve validação em aparelho físico. Autenticação, RLS e segurança de servidor não foram testadas porque ainda não existem nesta fase. Não interpretar os testes de filtros da prévia como validação de segurança de produção.
