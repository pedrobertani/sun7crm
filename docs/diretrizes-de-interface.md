# Diretrizes de interface do SUN7CRM

Objetivo definido: a tela deve exigir menos esforço para entender o que está acontecendo e qual é o próximo passo. Os princípios indicados pelo usuário orientam decisões e testes de uso; não são promessas de resultado nem regras numéricas universais.

| Referência | Decisão para o produto |
| --- | --- |
| Lei de Fitts | Ações frequentes e principais com área de toque confortável. Buscar pelo menos 44 × 44 px CSS nos botões, sem depender do tamanho do desenho do ícone. |
| Lei de Hick | Uma ação principal por contexto; agrupar opções relacionadas e mostrar detalhes quando necessários. Usar filtros e abas com rótulos claros. |
| Efeito Zeigarnik | Mostrar o que está pendente e permitir retomar tarefas e cadastros. Passos e progresso devem refletir o que foi efetivamente concluído. |
| Lei de Jakob | Manter locais, nomes e comportamentos consistentes: navegação, formulários, salvar, cancelar, filtros e edição. Usar padrões familiares. |
| Gradiente de meta | Em fluxos com etapas definidas, informar etapa atual, o que falta e a próxima ação. Não inventar urgência ou progresso. |
| Efeito von Restorff | Reservar o destaque principal para a ação prioritária ou uma informação importante. Evitar muitos elementos competindo pela atenção. |
| Lei de Miller | Agrupar informações por assunto e deixar contexto e rótulos visíveis. Não transformar o número sete em limite obrigatório de campos ou itens de menu. |

## Progresso verificável

Percentuais exigem um denominador claro. Exemplo: três de cinco tarefas concluídas podem aparecer como 60%. Só atualizar após conclusão registrada; visitar uma tela não conclui a tarefa. Se não houver uma sequência ou um total definidos, mostrar estado e próximo passo.

Etapa de atendimento não equivale a percentual de venda. A posição no quadro não deve gerar uma barra arbitrária de chance de fechamento. Nos documentos de primeiro acesso, manter duas confirmações explícitas e independentes, sem marcar automaticamente ou sugerir que a leitura aconteceu.

## Padrão visual

- Títulos começam diretamente pelo texto ou pela identificação curta da seção.
- Ícones decorativos acima dos títulos, dentro de avisos e em listas de apresentação são dispensados.
- A marca da empresa tem função de identificação. Controles e sinais de estado precisam continuar compreensíveis por texto e acessíveis por teclado.
- Manter fontes, alinhamentos, espaçamento e ações consistentes entre telas. Priorizar o formulário nas telas pequenas.
- Explicar indisponibilidade, erros e próximos passos em linguagem da pessoa que usa o sistema.

## Revisão de cada fluxo

Verificar se a pessoa identifica a ação principal, entende os rótulos, reconhece pendências e consegue voltar ou corrigir sem perder trabalho. Conferir toque, foco por teclado, contraste e rolagem nas larguras disponíveis. Confirmar as decisões com uso real durante o piloto.

## Referências complementares

- [W3C — tamanho de alvo aprimorado, SC 2.5.5, nível AAA](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced): referência de 44 × 44 px, com exceções descritas no critério. Esse alvo não representa uma declaração de conformidade de toda a aplicação.
- [Nielsen Norman Group — heurísticas de usabilidade](https://www.nngroup.com/articles/ten-usability-heuristics/): consistência, reconhecimento, estado do sistema e foco no essencial.
- [Nielsen Norman Group — memória de curto prazo e usabilidade](https://www.nngroup.com/articles/short-term-memory-and-web-usability/): o uso de menus não depende de memorizar todos os seus itens.
