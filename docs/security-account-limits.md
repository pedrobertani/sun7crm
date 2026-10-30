# Limites de contas — 30/10/2026

- Até 1 gestor ativo e 5 funcionários ativos (consultores e recepção somados) por empresa.
- Trigger no banco protege criação, reativação e troca de papel/empresa; desativação libera vaga, mantendo histórico.
- Criação: 6 reservas por hora por solicitante. Limite operacional independente das vagas.
- Redefinição: 5 solicitações por destino/hora e 30 por solicitante/hora.
- Testes PostgreSQL locais cobrem limites, expiração, reativação e transferência entre empresas. Funções de autorização permanecem preservadas.
- Login: solicitado bloqueio por 15 minutos após 5 erros, com aviso prévio. Ainda NÃO implementado/ativado. Exige controle no Auth, não apenas na tela; verificar disponibilidade do Password Verification Hook e proteger contra bloqueio malicioso de terceiros.
- Exclusão definitiva de integrante não adicionada; desativação e redistribuição já existem.
