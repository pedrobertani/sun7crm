# Cobranças do SUN7CRM e ativação do Mercado Pago

O painel **Planos e cobranças** reúne o histórico da plataforma. Nos detalhes de uma empresa, a aba **Cobranças** abre o mesmo histórico filtrado. O gestor consulta exclusivamente a própria empresa na tela **Plano**; funcionários não têm acesso a cobranças ou assinaturas.

## O que está implementado

- Histórico paginado com vencimento, valor, origem, situação, meio de pagamento e datas de confirmação.
- Totais de recebimentos, valores em aberto, vencidos e ocorrências para conferência. Os filtros usam o vencimento da cobrança; os totais consideram empresa e período e ficam independentes do filtro de situação.
- Criação de cobrança administrativa, confirmação de recebimento conferido e cancelamento com motivo. Os comandos são idempotentes e não sobrescrevem o histórico anterior.
- Registro de conferência administrativa com autoria, data e providências. Conferir uma ocorrência não altera automaticamente o período de acesso.
- Checkout Transparente por Orders: cartão tokenizado no componente oficial e Pix com QR Code/copia e cola dentro da tela Plano. Assinatura mensal individual mantém a autorização recorrente no Mercado Pago, em um fluxo separado. O CRM não armazena cartão, token de cartão nem documento do pagador.
- Webhook autenticado por HMAC, seguido de consulta à API para conferir pagamento, recebedor, moeda, ambiente e referência da empresa.
- Renovação apenas após pagamento aprovado. Autorização da assinatura, geração de Pix e retorno do checkout não liberam acesso.
- Cancelamento da assinatura pelo gestor, com confirmação no Mercado Pago e manutenção do período já pago.

**O backend está configurado para homologação em teste; produção permanece bloqueada.** As configurações de teste foram salvas no gerenciador de segredos do Supabase e seus digests conferidos. O webhook publicado aceitou uma notificação de verificação sem efeito financeiro com HMAC válido (`200`), recusou corpo com ID divergente (`400`) e assinatura inválida (`401`). O checkout continua exigindo sessão (`401`). A interface online foi habilitada no Cloudflare.

A validação no navegador com o gestor da Empresa B recuperou o Pix original, exibiu QR Code e copia e cola e confirmou seu encerramento no provedor. Um novo Pix com `payer.first_name=APRO`, enviado exclusivamente em teste conforme a documentação de Orders, foi aprovado pelo Mercado Pago e exibido como **Pagamento aprovado**. O histórico registrou R$ 189,90 em teste, sem conferência pendente; o vencimento real permaneceu em 10/11/2026. Não houve pagamento bancário real nem atualização manual do status no banco.

Os identificadores de sandbox usam `ORDTST`/`PAYTST`; eles são aceitos somente no ambiente de teste, sem relaxar a conferência de recebedor, aplicação, referência ou valor. O cartão encerra o carregamento com uma orientação quando o SDK devolve `null` ou não fica pronto em 30 segundos. O frontend diferencia falhas de credenciais, permissão e conferência e preserva a solicitação durante erros de recuperação. Aprovação/recusa dos cartões APRO/OTHE/FUND e assinatura ainda precisam da homologação correspondente. Neste navegador, o Brick não conseguiu inicializar; a consulta pública de meios de pagamento retornou HTTP 403, sem causa identificada.

## Branch hom e configurações permanentes de teste

`main` é a branch de produção do Cloudflare Pages; `hom` usa o endereço estável de Preview. As chaves ficam no Supabase, nunca no Git. O mesmo código de cobrança atende ambos os perfis, com pontos de entrada distintos:

| Configuração               | main                                       | hom                                         |
| -------------------------- | ------------------------------------------ | ------------------------------------------- |
| Frontend                   | `https://sun7crm.pages.dev`                | `https://hom.sun7crm.pages.dev`             |
| `VITE_BILLING_ENVIRONMENT` | ausente ou `main`                          | `hom` no Preview                            |
| Checkout                   | `crm-billing-checkout`                     | `crm-billing-checkout-hom`                  |
| Webhook                    | `crm-billing-webhook`                      | `crm-billing-webhook-hom`                   |
| Credenciais no Supabase    | `MP_*`                                     | `MP_HOM_*`                                  |
| Retorno ao CRM             | `CRM_PUBLIC_URL`                           | `CRM_HOM_PUBLIC_URL`                        |
| Ambiente de pagamento      | `MP_ENVIRONMENT`; produção exige liberação | sempre `test`, produção bloqueada no código |

O perfil hom exige `MP_HOM_ACCESS_TOKEN`, `MP_HOM_WEBHOOK_SECRET`, `MP_HOM_COLLECTOR_ID`, `MP_HOM_PUBLIC_KEY`, `MP_HOM_APPLICATION_ID` e `MP_HOM_PAYMENTS_ENABLED=true`. Não usa as credenciais de main como fallback. Seu webhook de teste deve ser cadastrado no Mercado Pago em `https://oduhbimlxnuyqliayvpl.supabase.co/functions/v1/crm-billing-webhook-hom`; a assinatura secreta precisa corresponder a esse cadastro. Não é necessário trocar ou apagar essas variáveis ao configurar main para a conta do Caio.

**O banco, os usuários e as regras do CRM continuam compartilhados.** Somente as configurações e o ambiente dos pagamentos foram separados. Uma branch Git não isola o banco. A criação de uma branch Supabase foi recusada pelo plano atual, pois exige Pro; nenhum recurso pago foi criado. A separação completa de dados exige um projeto ou branch Supabase próprio, com URL/chave pública no Preview, migrações, funções, segredos e contas QA próprias. Até lá, usar somente as empresas QA e respeitar o aviso de homologação. As demais Edge Functions mantêm sua lista de origens autorizadas; o checkout hom aceita apenas sua origem configurada.

Todos os Previews do projeto usam as configurações de Preview do Cloudflare; não há variáveis por branch individual nesse projeto Pages. Mudar o backend de main para produção só deve ocorrer depois de cadastrar as credenciais definitivas do Caio e homologar o fluxo autorizado. As funções hom permanecem obrigatoriamente em teste.

## O que o responsável pela conta precisa fazer

1. Entrar no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) com a conta que receberá as mensalidades e criar uma aplicação **SUN7CRM** em **Suas integrações**. A aplicação é o cadastro da integração.
2. Selecionar **Checkout Transparente → API de Orders**. A aplicação também usará a API de Assinaturas. O CRM cria a assinatura individual com o valor cadastrado no servidor; não exige cadastrar manualmente um link de plano compartilhado.
3. Preparar as credenciais e contas de teste conforme o painel da aplicação. Para Pix, cadastrar uma chave Pix na conta recebedora.
4. Nas configurações de Webhooks, cadastrar a URL abaixo para o ambiente correspondente e habilitar **Order (Mercado Pago)** e, para recorrência, **Planos e assinaturas**. O pagamento avulso usa `order`; a assinatura usa `payment`, `subscription_preapproval` e `subscription_authorized_payment`. Não habilitar todos os eventos nem depender de Pagamentos (legacy) para Orders.
5. Guardar a assinatura secreta gerada e configurar os segredos no servidor. Não colocar Access Token em código frontend, variáveis `VITE_*`, repositório, prints ou mensagens comuns.
6. Homologar os cenários abaixo. Depois, habilitar as credenciais de produção conforme as exigências apresentadas pelo Mercado Pago para a conta e validar o fluxo de produção com participação do responsável pelo pagamento.

URL de notificações deste projeto:

```text
https://oduhbimlxnuyqliayvpl.supabase.co/functions/v1/crm-billing-webhook
```

Retorno ao CRM:

```text
https://sun7crm.pages.dev/app/plano
```

## Configuração técnica

No Supabase, em **Edge Functions → Secrets**, configurar:

| Variável                | Conteúdo                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `MP_PUBLIC_KEY`         | Public Key da mesma aplicação e do ambiente de teste, devolvida ao frontend pelo status autenticado. |
| `MP_APPLICATION_ID`     | Número da aplicação, conferido em cada consulta à API de Orders.                                     |
| `MP_PRODUCTION_ENABLED` | Manter ausente ou `false` durante toda a homologação. Produção exige liberação explícita adicional.  |
| `MP_ACCESS_TOKEN`       | Access Token da aplicação e do ambiente correspondente.                                              |
| `MP_WEBHOOK_SECRET`     | Assinatura secreta das notificações do mesmo ambiente.                                               |
| `MP_COLLECTOR_ID`       | ID do usuário vendedor/recebedor correspondente às credenciais. Não é o ID da aplicação.             |
| `MP_ENVIRONMENT`        | `test` durante homologação; `production` para receber pagamentos reais.                              |
| `MP_PAYMENTS_ENABLED`   | `true` para habilitar o ambiente configurado; ausente ou diferente mantém o serviço desativado.      |
| `CRM_PUBLIC_URL`        | `https://sun7crm.pages.dev` neste ambiente.                                                          |

As funções também usam as variáveis já existentes do Supabase e `CRM_ALLOWED_ORIGINS`. Para o frontend deste projeto, a lista de origens deve incluir `https://sun7crm.pages.dev`. Tokens, assinatura e Collector ID devem pertencer à mesma conta/ambiente.

A Public Key é enviada pelo status autenticado e inicializa `MercadoPago.js` via `@mercadopago/sdk-js`, carregado sob demanda. O Card Payment Brick captura e tokeniza o cartão; o backend recebe somente o token temporário, a identificação e o e-mail necessários à transação, sem persistir esses dados. Nunca colocar Access Token ou Client Secret em `VITE_*`. As funções validam JWT e papel no banco; o webhook valida HMAC e consulta a order na API para conferir recebedor, aplicação, país/moeda e referência. Quando a API informa `live_mode`, ele precisa corresponder ao ambiente configurado.

Funções:

- `crm-billing-checkout`: status com Public Key/valor do servidor, criação/recuperação/consulta de Orders, assinatura e cancelamento. O valor, uma parcela e a referência são definidos no servidor; o navegador não escolhe preço nem envia PAN/CVV.
- `crm-billing-webhook`: confirmação de eventos do provedor.

No frontend/Cloudflare Pages, a variável pública `VITE_ONLINE_BILLING_ENABLED=true` libera a consulta e os botões online depois da implantação autorizada do backend. Enquanto ausente, o painel apresenta **Configuração pendente** e continua funcionando com o histórico e os recebimentos administrativos. Essa variável controla somente a interface; a autorização e a ativação real continuam no servidor. Não habilitar antes da implantação e da configuração do ambiente de testes.

**Ambientes separados:** contratos e cobranças de teste ficam identificados e separados dos de produção. Um pagamento de teste pode ser validado e exibido no histórico, mas não renova o acesso nem entra nos totais financeiros reais. A regra de renovação é coberta pelos testes locais do banco; a confirmação completa em produção continua exigindo homologação com pagamento real autorizado.

## Regras e conferência

- O preço é consultado no banco. O navegador não escolhe valor, empresa beneficiada ou vencimento a renovar.
- A renovação mantém a regra atual de um mês civil, com desconto dos dias de carência utilizados, limitado a sete dias.
- Duas notificações do mesmo pagamento não geram duas renovações. Recebimentos adicionais para uma cobrança já quitada ou um ciclo já renovado ficam para conferência.
- Valor divergente e alteração do plano entre criação e pagamento ficam registrados para análise, sem renovação automática.
- Estornos e contestações preservam o registro e geram conferência administrativa. Não há cancelamento automático retroativo de outros períodos pagos: o administrador deve analisar o saldo e o acesso da empresa e registrar as providências.
- Cancelar uma cobrança administrativa exige motivo. Cobranças do provedor não podem ser marcadas manualmente como pagas ou canceladas por esse comando.
- Após uma falha de comunicação na criação de checkout, a recuperação pesquisa pela referência original. Se a criação não puder ser confirmada, ela não é repetida às cegas. Orders reserva uma tentativa por cobrança no esquema privado, usa sua chave idempotente e recupera por ID ou referência com intervalo de datas. Falha definitiva de entrada permite nova tentativa; timeout permanece reservado até a conferência. Metadados de tentativas ficam em `crm_private.payment_attempts`, sem acesso direto por papéis de API. Assinaturas conservam a recuperação pela referência e `checkout_attempted_at`.
- A API pode demorar para confirmar o primeiro pagamento de uma assinatura. O gestor deve atualizar o plano/histórico; a autorização inicial permanece separada do recebimento.

## Homologação antes de receber pagamentos reais

Utilizar uma empresa de QA, as credenciais e os dados de teste do produto integrado. No Checkout Transparente com Orders, não é necessário criar uma conta compradora adicional: o teste de cartão aceita um e-mail válido e os cartões fornecidos pelo Mercado Pago. Cenários que exigem entrar em outra conta, como a autorização de assinatura, seguem as regras de contas de teste do produto. Cobrir:

1. Sessão ausente, funcionário e gestor de outra empresa: consulta e comandos negados.
2. Checkout Transparente: cartão aprovado (APRO), erro geral (OTHE), saldo insuficiente (FUND), pendente, rejeição de dados e nova tentativa; Pix gerado, recuperação após fechar/reabrir e confirmação conforme as limitações de teste do produto.
3. Assinatura: autorização sem recebimento, primeiro pagamento confirmado, atualização da assinatura e cancelamento.
4. Webhook: assinatura inválida, ID divergente, recebedor/moeda/ambiente incorretos e repetição do evento.
5. Falha transitória de comunicação: reenvio do webhook e recuperação do checkout sem criar nova contratação.
6. Recebimento de valor divergente, cobrança antiga e estorno: ocorrência visível para conferência.
7. Registro de teste fora dos totais reais e sem renovação do acesso.
8. Produção: confirmar que o pagamento aprovado entra no histórico e renova uma única vez. Validar também o prazo de disponibilização do saldo na conta do Mercado Pago; aprovação e saldo disponível são estados distintos.

## Documentação oficial consultada

- [Criar aplicação](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/create-application)
- [Cartão com Card Payment Brick e Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/cards)
- [Pix com Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/websites/pix)
- [Compra de teste com cartões](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/cards)
- [Compra de teste com Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix)
- [Contas de teste de Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/test-accounts)
- [Notificações de Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications)
- [Assinatura sem plano associado, com pagamento pendente](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- [Status de Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/order-status)
- [Segredos das Edge Functions](https://supabase.com/docs/guides/functions/secrets)

## Troca da conta recebedora

A conta de desenvolvimento é usada apenas em Teste e fica preservada nas variáveis `MP_HOM_*`. Antes de produção, criar/configurar a aplicação da conta definitiva do Caio, configurar o conjunto `MP_*` com Public Key, Access Token, assinatura do webhook, Application ID e Collector ID e repetir a homologação. Somente depois definir `MP_ENVIRONMENT=production` e liberar `MP_PRODUCTION_ENABLED`. Contratos recorrentes de clientes reais devem começar na conta definitiva; a troca de credenciais não migra contratos ou recebimentos antigos.

A política de conteúdo do build libera somente os hosts específicos do SDK quando `VITE_ONLINE_BILLING_ENABLED=true`; a configuração padrão permanece restrita ao aplicativo. As proteções de scripts inline/eventos, objetos e base URI permanecem ativas.
