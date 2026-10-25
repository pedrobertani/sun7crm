# Plano mensal, gratuidade e carência — 24/10/2026

O plano padrão SUN7CRM Mensal custa R$ 189,90. Novos cadastros usam esse valor no servidor e aguardam pagamento confirmado ou cortesia administrativa. Não há cobrança, débito ou transferência automática nesta entrega. A avaliação de provedores de pagamento fica para outra etapa.

## Administração e página Plano

- A administração usa `/admin/planos`, escolhe uma empresa e consulta estado, vencimento e os 20 últimos lançamentos.
- O ADM pode confirmar um pagamento já recebido ou conceder 7, 15 ou 30 dias gratuitos, com observação opcional e confirmação explícita.
- A cortesia acrescenta dias ao período ainda disponível; se já expirou, começa na data da concessão. Não reduz um período pago existente.
- Pagamento/cortesia e habilitação cadastral são controles separados. A empresa continua precisando de gestor ativo e habilitação administrativa.
- O gestor consulta `/app/plano`. Vendedores e recepção não recebem dados financeiros, histórico do plano ou avisos de pagamento.
- A demo apresenta a página Plano com dados locais e deixa explícito que não representa cobrança.

## Dias e vencimentos

Datas seguem America/Sao_Paulo. O vencimento de um ciclo mensal ainda permite acesso naquele dia; D+1 a D+7 são carência. Sem confirmação do pagamento, D+8 bloqueia as operações.

O pagamento libera um mês civil e desconta os dias de carência efetivamente utilizados, no máximo sete. Se o pagamento antecipar o vencimento, o próximo mês começa no vencimento já existente. Se ocorrer após ele, o cálculo parte do dia do registro, descontando a carência consumida. Dias bloqueados não são descontados. Meses sem o mesmo dia usam o último dia válido.

Exemplo: vencimento em 10/10, pagamento em 17/10, sete dias utilizados → próximo vencimento em 10/11. Se pagar em 25/10, depois de ficar bloqueado, o vencimento fica em 18/11: descontam-se os sete dias de carência, e não os dias bloqueados.

Gratuidade concedida pelo ADM é diferente de carência por atraso: não gera dívida nem desconto no pagamento seguinte. O acesso gratuito é válido até a véspera do vencimento mostrado no registro; ao terminar, aguarda pagamento, sem somar outra carência gratuita. A data final aparece claramente nas telas de concessão e Plano.

## Avisos e bloqueio

O gestor recebe avisos nos sete dias anteriores ao vencimento, no dia, em cada dia de carência e após o bloqueio. Atualizar o mesmo aviso não apaga a leitura; a mudança de dia na carência cria um aviso correspondente. Renovar resolve os alertas antigos.

O bloqueio não depende de cron ou do navegador: as políticas do banco consultam o estado da assinatura em cada operação. Contatos, tarefas, oportunidades, importação, histórico e relatórios ficam indisponíveis. A gestão da equipe também exige acesso operacional. O gestor continua acessando Plano e avisos de cobrança; a equipe recebe uma orientação genérica para procurar o gestor. A interface revalida o acesso ao voltar à janela e a cada 60 segundos quando visível.

## Integridade e integração

A migração `20261024222702_crm_subscription_plan.sql` amplia `crm_company_billing`, cria `crm_subscription_events` com RLS e disponibiliza RPCs separadas de leitura, confirmação de pagamento e concessão de dias. As rotinas privadas validam usuário, papel administrativo e primeiro acesso/aceites. Usuários não alteram ou apagam lançamentos nem escrevem diretamente na cobrança.

Cada lançamento recebe autor e horário do servidor. Chave de idempotência e comparação do vencimento evitam duplicar renovação por repetição de rede ou duas janelas abertas. Se o resultado for incerto, a interface conserva a solicitação para conferir o mesmo lançamento. Alterar o cadastro da empresa não pode mudar a cobrança silenciosamente; isso exige os comandos da aba Planos.

Os valores anteriores de empresas existentes são preservados. Novas empresas usam o preço padrão de R$ 189,90. Nenhum pagamento, gratuidade, aceite ou dado fictício foi lançado em empresas remotas para testar a entrega.

Testes locais cobrem os limites D+7/D+8, cotas de gratuidade, períodos bloqueados, desconto parcial/integral da carência, repetição, janela desatualizada, proteção de lançamentos e segregação por papel/empresa. A validação autenticada no navegador com contas de ADM e gestor depende do acesso pessoal dos titulares.
