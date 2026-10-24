# Estratégias e Embaixadores na demonstração

As rotas `/demo/estrategias` e `/demo/embaixadores` ficam na navegação da empresa. `/demo/campanhas` redireciona para Estratégias. As telas só usam o repositório local da demo; não criam usuários, pagamentos, anúncios ou registros no Supabase.

- Estratégias: planejamento mensal, canal, responsável, orçamento em centavos, observações/premiação e situação. Gestor cadastra e edita; os demais perfis consultam.
- Embaixadores: cadastro, ativação/desativação, percentual de comissão de exemplo e premiação/observação; indicações confirmadas e canceladas; classificação por mês, trimestre ou semestre do calendário.
- A cada R$ 1.000 acumulados em indicações confirmadas do período, um ponto. Cancelamentos são confirmados em modal, preservam o histórico e deixam de pontuar. A comissão é uma estimativa calculada com o percentual atual do embaixador, inclusive sobre seu histórico; não há fechamento ou pagamento. Regras definitivas de competência, estornos, comissões e premiações ainda precisam ser validadas com Caio.
- A mudança de empresa consulta somente os registros da empresa selecionada na demo. Perfis da demonstração não são autenticação ou permissão real.
- O formato local anterior recebe os novos exemplos de forma aditiva. Contatos, quadros, tarefas e alterações existentes são preservados. Arrays já presentes, inclusive vazios, não são substituídos pelos exemplos. Restaurar a demo volta aos exemplos completos.

O catálogo público passa a indicar as duas seções como disponíveis na demonstração. A implementação operacional permanece independente.
