# Atualização das telas por eventos

## Estado de implantação

O código e os testes estão preparados para homologação. A migração de eventos `crm_data_change_events` aguarda autorização para aplicação no banco compartilhado; até sua aplicação, o frontend usa a consulta de segurança, a cada 60 segundos somente com a página visível e online. Não considerar o fluxo Realtime validado no ambiente antes de conferir uma alteração real entre duas sessões.

A conexão é ativada somente com `VITE_DATA_EVENTS_ENABLED=true` no frontend. Esse parâmetro permanece desativado até a aplicação e conferência da migração; a ativação exige um novo build. Nenhuma credencial privada é enviada nessa configuração.

O cron `sun7crm-notifications` já foi alterado para `*/15 * * * *`; sua execução automática de 28/10/2026 às 14h30 de São Paulo terminou com sucesso. A confirmação de pagamentos continua independente desse cron.

## Fluxo

1. Uma transação confirma a alteração no banco.
2. Gatilhos diferidos projetam os avisos dos destinatários afetados e emitem uma invalidação privada. Uma importação agrupa os eventos por empresa e recurso dentro da transação.
3. Uma conexão WebSocket do cliente acompanha os canais privados da empresa ativa e do próprio usuário. A administração acompanha também o contexto administrativo.
4. O controlador agrupa avisos próximos por 200 ms e atualiza somente os grupos de consultas afetados. Não recarrega a página nem remonta formulários.
5. Se uma consulta já estiver em andamento, uma única leitura final garante que a alteração não se perca. Consultas de edição aguardam o formulário fechar.

Os eventos carregam apenas `resource` e um identificador de revisão transacional. Não carregam nomes, contatos, documentos, valores de pagamento, senhas ou credenciais. Os dados completos continuam sendo lidos pelas APIs existentes, com as permissões atuais.

## Acesso e recuperação

- Canais privados exigem sessão, primeiro acesso concluído e documentos vigentes. A empresa precisa corresponder ao vínculo elegível do usuário; a administração exige o cadastro administrativo vigente.
- A política permite somente receber eventos do tópico autorizado. Os clientes não recebem permissão de publicação nem de execução dos emissores privados.
- Alterações de vínculo, permissões e perfil avisam o próprio usuário para conferir novamente o acesso. Documentos legais alterados também invalidam o acesso das sessões existentes.
- Os canais são encerrados ao ocultar a página, ficar offline, trocar empresa ou sair. Ao retornar, a inscrição dispara uma conferência para recuperar eventos perdidos.
- Enquanto o canal estiver indisponível, o agendador compartilhado consulta o contexto a cada 60 segundos. Ele pausa sem visibilidade ou rede e não cria timers separados por tela.
- Pagamento pendente mantém sua conferência específica e o webhook autenticado continua sendo a autoridade financeira. Nenhum evento do navegador aprova cobrança ou renova acesso.
- Uma falha na entrega de evento não deve rejeitar uma gravação de negócio válida. O banco registra um aviso técnico sem dados pessoais; a reconexão ou conferência de segurança recupera a leitura.

## Interface

- Plano: abas Meu plano, Pagamento e Histórico; regras e movimentações de acesso recolhidas. Abas permanecem montadas, preservando filtros e estado.
- Entrada de contatos: seletor de barras, pizza e linha, com os mesmos valores por dia e somente cores da paleta do tema.
- Botões permanentes Atualizar foram removidos dos painéis. Tentativas explícitas continuam disponíveis após falhas de consulta.

## Validação

Os testes cobrem o isolamento dos tópicos, a proibição de publicação por clientes, agrupamento de importação, payload sem dados de negócio, rollback sem emissão, exclusões, revogação de vínculo, eventos durante consultas, preservação de edições e seleção dos recursos afetados. O transporte WebSocket e a entrega real devem ser conferidos após a aplicação autorizada da migração no ambiente.
