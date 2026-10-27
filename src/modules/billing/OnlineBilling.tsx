import { useEffect, useRef, useState } from 'react';
import { CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { FormError } from '../../components/shared';
import { invokeBilling } from './billing-client';
import { TransparentPayment } from './TransparentPayment';
import { DEFAULT_SUPABASE_URL, supabaseOrigin } from '../../lib/public-config';
import { currency, uid } from '../../lib/format';
interface ProviderStatus {
  configured: boolean;
  public_key?: string;
  amount_cents?: number;
  payer_email?: string;
  order?: { id: string } | null;
  environment: 'test' | 'production';
  webhook_url?: string;
  agreement: {
    id: string;
    provider_id: string | null;
    status: 'creating' | 'pending' | 'authorized' | 'paused' | 'cancelled';
    amount_cents: number;
  } | null;
}

function checkoutUrl(value: unknown) {
  if (typeof value !== 'string') throw Error('O endereço de pagamento precisa ser conferido.');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    !['mercadopago.com.br', 'www.mercadopago.com.br'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw Error('O endereço de pagamento precisa ser conferido.');
  return url.href;
}
const agreementLabels = {
  creating: 'Em preparação',
  pending: 'Aguardando autorização',
  authorized: 'Autorizada',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};
export function OnlineBilling({
  companyId,
  amount,
  admin = false,
  onPaymentUpdated,
}: {
  companyId: string;
  amount?: number;
  admin?: boolean;
  onPaymentUpdated?: () => void;
}) {
  const [status, setStatus] = useState<ProviderStatus | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  const [choice, setChoice] = useState<'one_time' | 'subscription' | 'cancel_subscription' | null>(
    null,
  );
  const [operation, setOperation] = useState(''),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState(''),
    [notice, setNotice] = useState('');
  const companyScope = useRef(companyId);
  useEffect(() => {
    let active = true;
    if (companyScope.current !== companyId) {
      companyScope.current = companyId;
      setStatus(null);
    }
    setError('');
    // A liberação visual não substitui a autorização e a configuração do servidor.
    if (import.meta.env.VITE_ONLINE_BILLING_ENABLED !== 'true') {
      const origin = supabaseOrigin(
        import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL,
      );
      setStatus({
        configured: false,
        environment: 'test',
        agreement: null,
        ...(origin ? { webhook_url: `${origin}/functions/v1/crm-billing-webhook` } : {}),
      });
      return;
    }
    void invokeBilling(companyId, 'status', uid())
      .then((value) => {
        if (active) setStatus(value as ProviderStatus);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [companyId, revision]);
  function open(value: typeof choice) {
    setChoice(value);
    setOperation(uid());
    setConsent(false);
    setFormError('');
    setAttempted(false);
  }
  async function proceed() {
    if (!choice || !consent || busy) return;
    setBusy(true);
    setAttempted(true);
    setFormError('');
    try {
      const result = await invokeBilling(
        companyId,
        choice === 'cancel_subscription' ? choice : 'checkout',
        operation,
        choice === 'cancel_subscription' ? undefined : choice,
      );
      if (choice === 'cancel_subscription') {
        setChoice(null);
        setNotice('Assinatura cancelada. O período já pago continua disponível.');
        setRevision((n) => n + 1);
      } else window.location.assign(checkoutUrl(result.url));
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="card billing-online"
      aria-label={admin ? 'Integração com Mercado Pago' : 'Pagamento online'}
    >
      <div className="billing-toolbar">
        <div>
          <h3>
            <CreditCard size={19} /> {admin ? 'Mercado Pago' : 'Pagamento online'}
          </h3>
          <p className="muted">
            {status
              ? status.configured
                ? `Integração ativa · ${status.environment === 'production' ? 'produção' : 'ambiente de testes'}`
                : 'Configuração pendente'
              : error
                ? 'Consulta indisponível'
                : 'Consultando integração...'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRevision((n) => n + 1)}>
          <RefreshCw size={15} /> Atualizar
        </Button>
      </div>
      <FormError message={error} />
      {notice && <p role="status">{notice}</p>}
      {status &&
        (admin ? (
          <>
            <p>
              {status.configured
                ? 'Pagamentos online são confirmados pelo provedor e entram no histórico da empresa.'
                : 'Configure as credenciais e valide os pagamentos de teste antes de habilitar o recebimento online.'}
            </p>
            {status.webhook_url && (
              <label className="form-row">
                URL de notificações
                <input readOnly value={status.webhook_url} onFocus={(e) => e.target.select()} />
              </label>
            )}
            <p className="small-note">
              As credenciais são configuradas nos segredos do servidor. A contratação e o
              cancelamento da assinatura ficam na tela Plano do gestor.
            </p>
            <Button asChild variant="outline">
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noreferrer"
              >
                Abrir Mercado Pago Developers <ExternalLink size={15} />
              </a>
            </Button>
          </>
        ) : status.configured ? (
          <>
            {status.environment === 'test' && (
              <p className="billing-alert">
                Ambiente de testes. Utilize somente contas e meios de pagamento de teste. Pagamentos
                de teste não renovam o acesso nem entram nos totais financeiros.
              </p>
            )}
            {status.agreement ? (
              <>
                <p>
                  <strong>Assinatura: {agreementLabels[status.agreement.status]}</strong> ·{' '}
                  {currency(status.agreement.amount_cents)} por mês.
                </p>
                <p className="small-note">
                  O acesso é renovado após a confirmação de cada pagamento. Cancelar a assinatura
                  interrompe as próximas cobranças e mantém o período já pago.
                </p>
                <div className="billing-admin-actions">
                  {['creating', 'pending'].includes(status.agreement.status) && (
                    <Button onClick={() => open('subscription')}>Continuar assinatura</Button>
                  )}
                  {status.agreement.provider_id && (
                    <Button variant="outline" onClick={() => open('cancel_subscription')}>
                      Cancelar assinatura
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <p>
                  Escolha como pagar a mensalidade
                  {amount !== undefined ? ` de ${currency(amount)}` : ''}.
                </p>
                <div className="billing-admin-actions">
                  <Button onClick={() => open('one_time')}>Pagar mensalidade</Button>
                  <Button variant="outline" onClick={() => open('subscription')}>
                    Assinar mensalmente
                  </Button>
                </div>
                <p className="small-note">
                  Pagamento avulso por Pix ou cartão. A assinatura autoriza cobranças mensais
                  recorrentes no Mercado Pago.
                </p>
              </>
            )}
          </>
        ) : (
          <p>
            O pagamento online ainda não está disponível. Combine o pagamento com a administração; a
            confirmação aparecerá no histórico.
          </p>
        ))}
      <Modal
        size={choice === 'one_time' ? 'wide' : 'default'}
        open={!!choice}
        onOpenChange={(opened) => {
          if (!opened && !busy) setChoice(null);
        }}
        title={
          choice === 'cancel_subscription'
            ? 'Cancelar assinatura'
            : choice === 'subscription'
              ? 'Assinar mensalmente'
              : 'Pagar mensalidade'
        }
        description="Plano SUN7CRM"
      >
        {choice === 'one_time' && status?.public_key && status.amount_cents ? (
          <TransparentPayment
            companyId={companyId}
            publicKey={status.public_key}
            amount={status.amount_cents}
            environment={status.environment}
            email={status.payer_email || ''}
            pendingId={status.order?.id}
            onBusy={setBusy}
            onUpdated={() => {
              setRevision((n) => n + 1);
              onPaymentUpdated?.();
            }}
          />
        ) : (
          <>
            {choice === 'cancel_subscription' ? (
              <p>
                As próximas cobranças automáticas serão interrompidas. O cancelamento mantém o
                período de acesso já pago.
              </p>
            ) : (
              <>
                {amount !== undefined && (
                  <p className="billing-price">
                    {currency(status?.agreement?.amount_cents ?? amount)}
                    {choice === 'subscription' && <small> / mês</small>}
                  </p>
                )}
                <p>
                  {choice === 'subscription'
                    ? 'Você será encaminhado ao Mercado Pago para autorizar a assinatura mensal. O acesso será renovado após cada cobrança aprovada.'
                    : 'Você será encaminhado ao Mercado Pago para escolher Pix ou cartão e pagar uma mensalidade.'}
                </p>
              </>
            )}
            <label className="check-row">
              <input
                type="checkbox"
                disabled={busy || attempted}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                {choice === 'cancel_subscription'
                  ? 'Quero cancelar as próximas cobranças automáticas.'
                  : choice === 'subscription'
                    ? 'Concordo com a cobrança mensal recorrente informada.'
                    : 'Quero pagar esta mensalidade.'}
              </span>
            </label>
            <FormError message={formError} />
            <div className="form-actions">
              <Button variant="outline" disabled={busy} onClick={() => setChoice(null)}>
                Fechar
              </Button>
              <Button disabled={busy || !consent} onClick={() => void proceed()}>
                {busy
                  ? 'Consultando...'
                  : attempted
                    ? 'Recuperar solicitação'
                    : choice === 'cancel_subscription'
                      ? 'Confirmar cancelamento'
                      : 'Continuar no Mercado Pago'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </section>
  );
}
