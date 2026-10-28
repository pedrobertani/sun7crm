# Rodada final de homologação — 28/10/2026

Resultado: **em andamento, com bloqueios de ambiente**. Não considerar a homologação encerrada.

Base conferida: branch `hom`, commit `eae4ca8e8634f2c7056105015ad0f570a899f003`. Os 427 testes automatizados já haviam passado na publicação dessa base; não foram executados novamente nesta rodada sem mudança de código.

## Conferências concluídas

- Login e saída reais no painel administrativo. As duas entradas desta rodada resultaram no perfil de administrador; não comprovam navegação de gestor ou funcionário.
- Detalhes da empresa QA A: resumo com duas contas, um gestor e um funcionário, separados em grupos na tabela. A empresa QA B apresenta um gestor e nenhum funcionário.
- Alternância entre Dados e usuários e Cobranças; o filtro Paga permaneceu selecionado ao retornar. Estado vazio do histórico legível, sem botão permanente Atualizar.
- Rascunho de segmento da QA B preservado durante a conferência, sem envio desse rascunho. Cancelamento sem gravação.
- Conferência no PostgreSQL remoto, em transações somente de leitura sob o papel `authenticated` e identidades QA: funcionário A com acesso à própria empresa, um contato permitido, zero contatos da B, `plan.view=false` nas duas empresas e zero linhas de cobrança. Gestor B com seis contatos da B, zero da A e `plan.view=true` somente para B. Essa prova das regras no banco não substitui o teste de interface com login desses perfis.
- Um único job de alertas ativo: `sun7crm-notifications`, a cada 15 minutos.

## Falha reproduzida: comandos operacionais na origem hom

O salvamento de um segmento fictício da QA B foi interrompido no preflight. O log hospedado registrou `OPTIONS /functions/v1/crm-update-company`, HTTP 403, às 15h52m41s de São Paulo. Não houve POST desse salvamento; a consulta remota confirmou segmento original e `row_version=10` preservados.

A conferência HTTP sem credenciais reproduziu o mesmo resultado:

| Função | Origem principal | Origem hom |
| --- | --- | --- |
| crm-update-company | 204, origem permitida | 403, origem recusada |
| crm-create-company | 204, origem permitida | 403, origem recusada |
| crm-create-user | 204, origem permitida | 403, origem recusada |
| crm-reset-password | 204, origem permitida | 403, origem recusada |
| crm-first-access | 204, origem permitida | 403, origem recusada |

Origens conferidas: `https://sun7crm.pages.dev` e `https://hom.sun7crm.pages.dev`. A configuração `CRM_ALLOWED_ORIGINS` precisa incluir a segunda origem, preservando as origens existentes. Não usar curingas nem alterar a autenticação das funções.

A revisão automática bloqueou a abertura da página de segredos do Supabase por poder expor outras credenciais. Nenhuma variável foi alterada e nenhum segredo foi lido. A janela da tentativa foi recarregada somente após confirmar que o servidor não recebeu o POST e que o cadastro permaneceu intacto.

## Pendências para encerrar

- Ajustar a origem hom e repetir o salvamento QA, a recuperação da mesma solicitação e a atualização entre sessões; restaurar o segmento após o teste.
- Aplicar e conferir a migração de eventos aprovada em código no PR #21, após autorização explícita para o banco compartilhado. A função de eventos continua ausente e o parâmetro do frontend permanece desativado.
- Com eventos ativos, validar entrega real, reconexão, agrupamento de alterações e preservação de formulários entre duas sessões. A consulta automática de segurança não comprova o transporte Realtime.
- Navegar com login de gestor e funcionário: Plano ausente para funcionário e bloqueado por URL direta; carteira e permissões corretas.
- Conferir no dashboard real os seletores Barras/Pizza/Linha com os mesmos valores, as novas abas do Plano e o carregamento do formulário de cartão. Nenhum pagamento novo foi enviado nesta rodada.
- Conferir layout em largura de celular e todos os temas; não houve teste em aparelho físico nesta rodada.

Observação de conteúdo: o rodapé da visão administrativa ainda afirma que recebimentos não fazem parte da etapa, embora o histórico já exista. Ajustar essa descrição antes do encerramento.
