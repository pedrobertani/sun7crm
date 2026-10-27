# Cobranças do SUN7CRM e ativação do Mercado Pago

O painel **Planos e cobranças** reúne o histórico da plataforma. Nos detalhes de uma empresa, a aba **Cobranças** abre o mesmo histórico filtrado. O gestor consulta exclusivamente a própria empresa na tela **Plano**; funcionários não têm acesso a cobranças ou assinaturas.

## O que está implementado

- Histórico paginado com vencimento, valor, origem, situação, meio de pagamento e datas de confirmação.
- Totais de recebimentos, valores em aberto, vencidos e ocorrências para conferência. Os filtros usam o vencimento da cobrança; os totais consideram empresa e período e ficam independentes do filtro de situação.
- Criação de cobrança administrativa, confirmação de recebimento conferido e cancelamento com motivo. Os comandos são idempotentes e não sobrescrevem o histórico anterior.
- Registro de conferência administrativa com autoria, data e providências. Conferir uma ocorrência não altera automaticamente o período de acesso.
- Checkout hospedado pelo Mercado Pago para pagamento avulso e assinatura mensal individual por empresa, sem armazenar cartão no CRM.
- Webhook autenticado por HMAC, seguido de consulta à API para conferir pagamento, recebedor, moeda, ambiente e referência da empresa.
- Renovação apenas após pagamento aprovado. Autorização da assinatura, geração de Pix e retorno do checkout não liberam acesso.
- Cancelamento da assinatura pelo gestor, com confirmação no Mercado Pago e manutenção do período já pago.

**A integração online nasce desativada.** Credenciais e homologação no Mercado Pago ainda são necessárias. Os testes locais não substituem a homologação com a conta recebedora.

## O que o responsável pela conta precisa fazer

1. Entrar no [Mercado Pago Developers](https://www.mercadopago.com.br/developers) com a conta que receberá as mensalidades e criar uma aplicação **SUN7CRM** em **Suas integrações**. A aplicação é o cadastro da integração.
2. Selecionar a integração online via API/Checkout Pro. A aplicação também usará a API de Assinaturas. O CRM cria a assinatura individual com o valor cadastrado no servidor; não exige cadastrar manualmente um link de plano compartilhado.
3. Preparar as credenciais e contas de teste conforme o painel da aplicação. Para Pix, cadastrar uma chave Pix na conta recebedora.
4. Nas configurações de Webhooks, cadastrar a URL abaixo para o ambiente correspondente e habilitar **Pagamentos** e **Planos e assinaturas**. Eventos tratados: `payment`, `subscription_preapproval` e `subscription_authorized_payment`.
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

| Variável              | Conteúdo                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `MP_ACCESS_TOKEN`     | Access Token da aplicação e do ambiente correspondente.                                         |
| `MP_WEBHOOK_SECRET`   | Assinatura secreta das notificações do mesmo ambiente.                                          |
| `MP_COLLECTOR_ID`     | ID do usuário vendedor/recebedor correspondente às credenciais. Não é o ID da aplicação.        |
| `MP_ENVIRONMENT`      | `test` durante homologação; `production` para receber pagamentos reais.                         |
| `MP_PAYMENTS_ENABLED` | `true` para habilitar o ambiente configurado; ausente ou diferente mantém o serviço desativado. |
| `CRM_PUBLIC_URL`      | `https://sun7crm.pages.dev` neste ambiente.                                                     |

As funções também usam as variáveis já existentes do Supabase e `CRM_ALLOWED_ORIGINS`. Para o frontend deste projeto, a lista de origens deve incluir `https://sun7crm.pages.dev`. Tokens, assinatura e Collector ID devem pertencer à mesma conta/ambiente.

Para este checkout hospedado, o frontend não precisa de Access Token, Client Secret ou dados de cartão. As funções usam a credencial do servidor e validam o JWT do usuário no checkout. O webhook exige a assinatura do Mercado Pago e não utiliza JWT de usuário.

Funções:

- `crm-billing-checkout`: consulta de configuração, início/recuperação de checkout e cancelamento da assinatura.
- `crm-billing-webhook`: confirmação de eventos do provedor.

**Ambientes separados:** contratos e cobranças de teste ficam identificados e separados dos de produção. Um pagamento de teste pode ser validado e exibido no histórico, mas não renova o acesso nem entra nos totais financeiros reais. A regra de renovação é coberta pelos testes locais do banco; a confirmação completa em produção continua exigindo homologação com pagamento real autorizado.

## Regras e conferência

- O preço é consultado no banco. O navegador não escolhe valor, empresa beneficiada ou vencimento a renovar.
- A renovação mantém a regra atual de um mês civil, com desconto dos dias de carência utilizados, limitado a sete dias.
- Duas notificações do mesmo pagamento não geram duas renovações. Recebimentos adicionais para uma cobrança já quitada ou um ciclo já renovado ficam para conferência.
- Valor divergente e alteração do plano entre criação e pagamento ficam registrados para análise, sem renovação automática.
- Estornos e contestações preservam o registro e geram conferência administrativa. Não há cancelamento automático retroativo de outros períodos pagos: o administrador deve analisar o saldo e o acesso da empresa e registrar as providências.
- Cancelar uma cobrança administrativa exige motivo. Cobranças do provedor não podem ser marcadas manualmente como pagas ou canceladas por esse comando.
- Após uma falha de comunicação na criação de checkout, a recuperação pesquisa pela referência original. Se a criação não puder ser confirmada, ela não é repetida às cegas. O responsável técnico deve conferir a referência no Mercado Pago antes de liberar uma nova tentativa de criação; a data `checkout_attempted_at` é preservada para essa análise.
- A API pode demorar para confirmar o primeiro pagamento de uma assinatura. O gestor deve atualizar o plano/histórico; a autorização inicial permanece separada do recebimento.

## Homologação antes de receber pagamentos reais

Utilizar uma empresa de QA e as contas/meios de pagamento de teste do Mercado Pago, com vendedor e comprador de teste distintos conforme a documentação. Cobrir:

1. Sessão ausente, funcionário e gestor de outra empresa: consulta e comandos negados.
2. Checkout avulso: cartão aprovado, recusado e pendente; Pix criado e pagamento confirmado conforme as limitações de teste do produto.
3. Assinatura: autorização sem recebimento, primeiro pagamento confirmado, atualização da assinatura e cancelamento.
4. Webhook: assinatura inválida, ID divergente, recebedor/moeda/ambiente incorretos e repetição do evento.
5. Falha transitória de comunicação: reenvio do webhook e recuperação do checkout sem criar nova contratação.
6. Recebimento de valor divergente, cobrança antiga e estorno: ocorrência visível para conferência.
7. Registro de teste fora dos totais reais e sem renovação do acesso.
8. Produção: confirmar que o pagamento aprovado entra no histórico e renova uma única vez. Validar também o prazo de disponibilização do saldo na conta do Mercado Pago; aprovação e saldo disponível são estados distintos.

## Documentação oficial consultada

- [Criar aplicação](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-application)
- [Criar preferência do Checkout Pro](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/create-preference/post)
- [Assinatura sem plano associado, com pagamento pendente](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- [Compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases)
- [Segredos das Edge Functions](https://supabase.com/docs/guides/functions/secrets)
