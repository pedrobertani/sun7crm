import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { CheckCircle2, Copy, CreditCard, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormError } from '../../components/shared';
import { useThemeStyle } from '../../components/theme-provider';
import { currency, uid } from '../../lib/format';
import { invokeBilling } from './billing-client';
import { mountCardBrick, type CardBrickController } from './card-brick';
import { useAutoRefresh } from '../../hooks/useLiveQuery';

export interface OrderResult {
  id: string;
  status:
    'creating' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back';
  method: 'pix' | 'credit_card';
  amount_cents: number;
  review?: boolean;
  qr_code?: string;
  qr_image?: string;
  expires_at?: string;
  authentication_url?: string;
}
type PaymentData =
  | { method: 'pix'; email: string }
  | {
      method: 'credit_card';
      email: string;
      token: string;
      payment_method_id: string;
      identification: { type: string; number: string };
    };
interface CardFormData {
  token: string;
  payment_method_id: string;
  payer: { email: string; identification: { type: string; number: string } };
}
interface MpSdk {
  bricks(): {
    create(
      name: 'cardPayment',
      container: string,
      settings: Record<string, unknown>,
    ): Promise<CardBrickController | null>;
  };
}

function CardForm({
  publicKey,
  amount,
  email,
  onPay,
}: {
  publicKey: string;
  amount: number;
  email: string;
  onPay: (payment: PaymentData) => Promise<void>;
}) {
  const [attempt, setAttempt] = useState(0);
  const containerId = `mp-card-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-${attempt}`;
  const theme = useThemeStyle();
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const submit = useRef(onPay);
  useEffect(() => {
    submit.current = onPay;
  }, [onPay]);
  const palette = theme as CSSProperties & Record<string, string>;
  const dark = theme.colorScheme === 'dark';
  const primary = palette['--primary'],
    foreground = palette['--primary-foreground'];
  const ink = palette['--text'],
    muted = palette['--muted'],
    surface = palette['--surface'],
    line = palette['--line'];
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const dispose = mountCardBrick(
      async ({ ready, error: unavailable }) => {
        const { loadMercadoPago } = await import('@mercadopago/sdk-js');
        await loadMercadoPago();
        if (!active) return null;
        const Constructor = (
          window as unknown as {
            MercadoPago: new (key: string, options: { locale: string }) => MpSdk;
          }
        ).MercadoPago;
        const mp = new Constructor(publicKey, { locale: 'pt-BR' });
        return mp.bricks().create('cardPayment', containerId, {
          initialization: { amount: amount / 100, ...(email ? { payer: { email } } : {}) },
          customization: {
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 1,
              types: { included: ['credit_card'] },
            },
            visual: {
              texts: { formSubmit: `Pagar ${currency(amount)}` },
              style: {
                theme: dark ? 'dark' : 'default',
                customVariables: {
                  formBackgroundColor: surface,
                  inputBackgroundColor: surface,
                  baseColor: primary,
                  textPrimaryColor: ink,
                  textSecondaryColor: muted,
                  outlinePrimaryColor: line,
                  buttonTextColor: foreground,
                },
              },
            },
          },
          callbacks: {
            onReady: ready,
            onSubmit: (form: CardFormData, additional: { paymentTypeId?: string }) => {
              if (!active) return Promise.reject(new Error('Formulário encerrado.'));
              if (additional?.paymentTypeId && additional.paymentTypeId !== 'credit_card')
                return Promise.reject(new Error('Selecione um cartão de crédito.'));
              return submit.current({
                method: 'credit_card',
                token: form.token,
                payment_method_id: form.payment_method_id,
                email: form.payer.email,
                identification: form.payer.identification,
              });
            },
            onError: unavailable,
          },
        });
      },
      {
        ready: () => {
          setLoading(false);
          setError('');
        },
        unavailable: () => {
          setLoading(false);
          setError(
            'Não foi possível carregar o formulário do cartão. Tente novamente ou escolha Pix.',
          );
        },
      },
    );
    return () => {
      active = false;
      dispose();
    };
  }, [publicKey, amount, email, containerId, dark, primary, foreground, ink, muted, surface, line]);
  return (
    <div className="billing-card-form">
      {loading && <p role="status">Carregando formulário seguro...</p>}
      <FormError message={error} />
      {error && (
        <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          Tentar carregar o cartão novamente
        </Button>
      )}
      <div id={containerId} hidden={!!error} />
    </div>
  );
}

const statusLabels: Record<OrderResult['status'], string> = {
  creating: 'Conferindo solicitação',
  pending: 'Aguardando pagamento',
  approved: 'Pagamento aprovado',
  rejected: 'Pagamento não aprovado',
  cancelled: 'Pagamento encerrado',
  refunded: 'Pagamento estornado',
  charged_back: 'Pagamento em contestação',
};
export function TransparentPayment({
  companyId,
  publicKey,
  amount,
  environment,
  email,
  pendingId,
  onBusy,
  onUpdated,
}: {
  companyId: string;
  publicKey: string;
  amount: number;
  environment: 'test' | 'production';
  email: string;
  pendingId?: string;
  onBusy: (busy: boolean) => void;
  onUpdated: () => void;
}) {
  const [method, setMethod] = useState<'pix' | 'credit_card'>('pix');
  const [payerEmail, setPayerEmail] = useState(environment === 'test' ? '' : email);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null),
    [error, setError] = useState('');
  const [notice, setNotice] = useState(''),
    [recover, setRecover] = useState(pendingId || '');
  const lock = useRef(false),
    operation = useRef(uid()),
    updated = useRef('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function run(
    action: 'create_order' | 'order_status',
    payment?: PaymentData,
    attemptId?: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await invokeBilling(
        companyId,
        action,
        operation.current,
        undefined,
        action === 'create_order' ? { payment } : { attempt_id: attemptId || order?.id || recover },
      );
      const value = result.order as OrderResult;
      if (!value?.id || !(value.status in statusLabels))
        throw new Error('O resultado do pagamento precisa ser conferido.');
      if (!mounted.current) return;
      setOrder(value);
      setRecover(value.id);
      if (
        ['approved', 'refunded', 'charged_back'].includes(value.status) &&
        updated.current !== `${value.id}:${value.status}`
      ) {
        updated.current = `${value.id}:${value.status}`;
        onUpdated();
      }
    } catch (cause) {
      if (mounted.current) {
        setError((cause as Error).message);
        const code = (cause as { code?: string }).code;
        if (
          code === 'NOT_FOUND' ||
          (action === 'create_order' &&
            [
              'PAYMENT_INPUT_REJECTED',
              'INVALID_INPUT',
              'UNAUTHENTICATED',
              'FORBIDDEN',
              'PAYMENTS_NOT_CONFIGURED',
            ].includes(code || ''))
        ) {
          setRecover('');
          operation.current = uid();
        } else if (action === 'create_order') setRecover(operation.current);
      }
      throw cause;
    } finally {
      lock.current = false;
      onBusy(false);
      if (mounted.current) setBusy(false);
    }
  }
  // Abertura e recarregamento recuperam a solicitação reservada no servidor, sem recriar a cobrança.
  useEffect(() => {
    if (pendingId) void run('order_status', undefined, pendingId).catch(() => {});
    // A recuperação ocorre uma vez por instância; não acompanha callbacks do componente pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId]);
  useAutoRefresh(() => run('order_status'), {
    enabled: !!(order ? ['creating', 'pending'].includes(order.status) : recover),
    interval: error ? 15_000 : 5000,
  });
  async function copyPix() {
    try {
      await navigator.clipboard.writeText(order?.qr_code || '');
      setNotice('Código Pix copiado.');
    } catch {
      setNotice('Selecione o código abaixo para copiar.');
    }
  }
  function retry() {
    operation.current = uid();
    setOrder(null);
    setRecover('');
    setError('');
    setNotice('');
  }
  const terminal = order && ['rejected', 'cancelled'].includes(order.status);
  return (
    <div className="billing-transparent" aria-busy={busy}>
      <div className="billing-checkout-summary">
        <div>
          <span className="muted">Uma mensalidade</span>
          <strong>{currency(order?.amount_cents ?? amount)}</strong>
        </div>
        <span>
          <ShieldCheck size={17} /> Processado pelo Mercado Pago
        </span>
      </div>
      {environment === 'test' && (
        <p className="billing-alert">
          Ambiente de teste. Use os cartões e os dados de teste do Mercado Pago. Esta operação não
          renova o acesso nem conta como receita.
        </p>
      )}
      <FormError message={error} />
      {notice && <p role="status">{notice}</p>}
      {order ? (
        <div className="billing-payment-result">
          <div className="billing-result-heading">
            {order.status === 'approved' ? <CheckCircle2 size={24} /> : <RefreshCw size={22} />}
            <h3>{order.review ? 'Recebimento em conferência' : statusLabels[order.status]}</h3>
          </div>
          {order.status === 'approved' && (
            <p>
              {order.review
                ? 'A administração precisa conferir a aplicação deste recebimento.'
                : environment === 'test'
                  ? 'Pagamento de teste confirmado. O período de acesso permanece igual.'
                  : 'Recebimento confirmado. Consulte o novo período de acesso e o histórico do plano.'}
            </p>
          )}
          {order.status === 'creating' && (
            <p>
              A solicitação está sendo conferida automaticamente no Mercado Pago. Aguarde antes de
              tentar pagar novamente.
            </p>
          )}
          {order.status === 'pending' && (
            <p role="status">
              A confirmação é consultada automaticamente. O acesso é renovado após o recebimento.
            </p>
          )}
          {order.qr_code && order.status === 'pending' && (
            <div className="billing-pix">
              {order.qr_image && (
                <img
                  src={`data:image/png;base64,${order.qr_image}`}
                  alt="QR Code do pagamento Pix"
                  width={232}
                  height={232}
                />
              )}
              <label>
                Pix copia e cola
                <textarea
                  readOnly
                  value={order.qr_code}
                  onFocus={(e) => e.target.select()}
                  rows={3}
                />
              </label>
              <Button onClick={() => void copyPix()}>
                <Copy size={16} /> Copiar código Pix
              </Button>
              {order.expires_at && Number.isFinite(Date.parse(order.expires_at)) && (
                <p className="small-note">
                  Válido até {new Date(order.expires_at).toLocaleString('pt-BR')}.
                </p>
              )}
            </div>
          )}
          {order.authentication_url && order.status === 'pending' && (
            <p>
              <a
                className="record-title"
                href={order.authentication_url}
                target="_blank"
                rel="noreferrer"
              >
                Concluir verificação do cartão
              </a>
            </p>
          )}
          {terminal && (
            <p>
              O pagamento não foi concluído. Você pode conferir os dados ou escolher outro meio de
              pagamento.
            </p>
          )}
          <div className="billing-admin-actions">
            {error && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run('order_status').catch(() => {})}
              >
                <RefreshCw size={15} /> {busy ? 'Consultando...' : 'Consultar novamente'}
              </Button>
            )}
            {terminal && (
              <Button disabled={busy} onClick={retry}>
                Tentar outro pagamento
              </Button>
            )}
          </div>
        </div>
      ) : recover ? (
        <div className="billing-payment-result">
          <p role="status">
            Conferindo a solicitação anterior automaticamente antes de iniciar outro pagamento.
          </p>
          {error && (
            <Button disabled={busy} onClick={() => void run('order_status').catch(() => {})}>
              {busy ? 'Conferindo...' : 'Recuperar solicitação'}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="billing-methods" aria-label="Forma de pagamento">
            <Button
              variant="outline"
              aria-pressed={method === 'pix'}
              disabled={busy}
              onClick={() => setMethod('pix')}
            >
              <QrCode size={19} /> Pix
            </Button>
            <Button
              variant="outline"
              aria-pressed={method === 'credit_card'}
              disabled={busy}
              onClick={() => setMethod('credit_card')}
            >
              <CreditCard size={19} /> Cartão de crédito
            </Button>
          </div>
          {method === 'pix' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run('create_order', { method: 'pix', email: payerEmail }).catch(() => {});
              }}
            >
              <label className="form-row">
                E-mail do pagador
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={payerEmail}
                  disabled={busy}
                  onChange={(e) => setPayerEmail(e.target.value)}
                />
              </label>
              <p className="small-note">O QR Code e o código copia e cola serão exibidos aqui.</p>
              <Button type="submit" disabled={busy}>
                {busy ? 'Gerando Pix...' : 'Gerar Pix'}
              </Button>
            </form>
          ) : (
            <CardForm
              publicKey={publicKey}
              amount={amount}
              email={environment === 'test' ? '' : email}
              onPay={(payment) => run('create_order', payment)}
            />
          )}
        </>
      )}
    </div>
  );
}
