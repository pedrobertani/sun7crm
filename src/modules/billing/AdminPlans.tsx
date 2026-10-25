import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard, Gift } from 'lucide-react';
import { Empty, FormError, Heading, SearchInput } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { getSupabaseClient } from '../../lib/supabase';
import { currency, dateLabel, shiftDate, today, uid } from '../../lib/format';
import type { AdminCompany } from '../admin/repository';
import { AccessChangedError } from '../auth/access';
import { PlanPanel } from './Plan';
import {
  applyBillingCommand,
  BillingCommandError,
  loadSubscription,
  paymentPreview,
  stateLabels,
  subscriptionState,
  type BillingAttempt,
  type Subscription,
} from './subscription';

export function AdminPlans({
  companies,
  userId,
  onReload,
  onRecheck,
  onNotice,
}: {
  companies: AdminCompany[];
  userId: string;
  onReload: () => void;
  onRecheck: () => void;
  onNotice: (message: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('empresa') || companies[0]?.id || '';
  const company = companies.find((item) => item.id === selectedId);
  const [query, setQuery] = useState(''),
    [plan, setPlan] = useState<Subscription | null>(null),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0),
    [action, setAction] = useState<'payment' | 'complimentary' | null>(null);
  const [days, setDays] = useState(7),
    [note, setNote] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState<BillingAttempt | null>(null),
    [formError, setFormError] = useState('');
  useEffect(() => {
    let active = true;
    setPlan(null);
    setError('');
    if (company)
      void loadSubscription(getSupabaseClient(), company.id)
        .then((value) => {
          if (active) setPlan(value);
        })
        .catch((cause) => {
          if (active) setError((cause as Error).message);
        });
    return () => {
      active = false;
    };
  }, [company?.id, revision]);
  function open(kind: 'payment' | 'complimentary') {
    setAction(kind);
    setDays(7);
    setNote('');
    setConfirmed(false);
    setAttempt(null);
    setFormError('');
  }
  function close(opened: boolean) {
    if (!opened && !busy && !attempt) setAction(null);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !plan || !action || !confirmed) return;
    const request = attempt || {
      id: uid(),
      companyId: plan.company_id,
      dueDate: plan.due_date,
      amount: plan.monthly_amount_cents,
      kind: action,
      days,
      note: note.trim(),
    };
    setAttempt(request);
    setBusy(true);
    setFormError('');
    try {
      const result = await applyBillingCommand(getSupabaseClient(), userId, request);
      setAction(null);
      setAttempt(null);
      setRevision((n) => n + 1);
      onReload();
      onNotice(
        `${request.kind === 'payment' ? 'Pagamento registrado' : 'Gratuidade concedida'}. Próximo vencimento: ${dateLabel(result.next_due_date)}.`,
      );
    } catch (cause) {
      if (cause instanceof AccessChangedError) {
        setAction(null);
        setAttempt(null);
        onRecheck();
        return;
      }
      setFormError(
        cause instanceof Error ? cause.message : 'Não foi possível confirmar a operação.',
      );
      if (cause instanceof BillingCommandError && !cause.retrySame) {
        setAttempt(null);
        setConfirmed(false);
        setAction(null);
        setError(cause.message);
        onNotice(cause.message);
        setRevision((n) => n + 1);
      }
    } finally {
      setBusy(false);
    }
  }
  const locked = busy || !!attempt;
  return (
    <>
      <Heading
        eyebrow="ADMINISTRAÇÃO"
        title="Planos"
        description="Plano mensal SUN7CRM · R$ 189,90. Liberações e pagamentos são registrados por empresa."
      />
      {!companies.length ? (
        <div className="card panel">
          <Empty
            title="Cadastre uma empresa para gerenciar o plano"
            description="Depois de cadastrar o gestor, conceda um período gratuito ou registre o pagamento."
          />
          <Link to="/admin/empresas" className="home-text-link">
            Ir para empresas
          </Link>
        </div>
      ) : (
        <div className="billing-admin-layout">
          <aside className="card billing-companies" aria-label="Empresas e planos">
            <SearchInput value={query} onChange={setQuery} placeholder="Buscar empresa..." />
            {companies
              .filter((item) =>
                item.name
                  .toLocaleLowerCase('pt-BR')
                  .includes(query.trim().toLocaleLowerCase('pt-BR')),
              )
              .map((item) => {
                const state = subscriptionState(item.dueDate, item.cycleKind || 'monthly', today());
                return (
                  <button
                    key={item.id}
                    className="billing-company"
                    aria-pressed={item.id === selectedId}
                    onClick={() => setParams({ empresa: item.id })}
                  >
                    <strong>{item.name}</strong>
                    <small>{!item.enabled ? 'Empresa desativada' : stateLabels[state]}</small>
                  </button>
                );
              })}
          </aside>
          <div className="billing-admin-main">
            {company ? (
              <>
                <div className="billing-toolbar">
                  <h2>{company.name}</h2>
                  <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
                    Atualizar plano
                  </Button>
                </div>
                {!company.enabled && (
                  <p className="billing-alert">
                    A empresa está desativada. A liberação de dias ou o pagamento não substitui a
                    habilitação em Empresas.
                  </p>
                )}
                {error && (
                  <p role="alert" className="secure-access-error">
                    {error}
                  </p>
                )}
                {plan ? (
                  <>
                    <div className="billing-admin-actions">
                      <Button onClick={() => open('payment')}>
                        <CreditCard size={16} /> Registrar pagamento
                      </Button>
                      <Button variant="outline" onClick={() => open('complimentary')}>
                        <Gift size={16} /> Liberar dias gratuitos
                      </Button>
                    </div>
                    <PlanPanel plan={plan} />
                  </>
                ) : (
                  !error && <p role="status">Consultando o plano...</p>
                )}
              </>
            ) : (
              <Empty title="Empresa não encontrada" description="Selecione uma empresa da lista." />
            )}
          </div>
        </div>
      )}
      <Modal
        open={!!action}
        onOpenChange={close}
        title={action === 'payment' ? 'Registrar pagamento recebido' : 'Liberar dias gratuitos'}
        description={company?.name}
      >
        {plan && (
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={locked}>
              {action === 'payment' ? (
                <div className="billing-confirm">
                  <strong>{currency(plan.monthly_amount_cents)} · um mês</strong>
                  <p>
                    Desconto de {plan.grace_days_used} {plan.grace_days_used === 1 ? 'dia' : 'dias'}{' '}
                    de carência utilizados.
                  </p>
                  <p>
                    Próximo vencimento previsto: <strong>{dateLabel(paymentPreview(plan))}</strong>.
                  </p>
                  <p className="small-note">
                    O registro confirma um recebimento já conferido. Não realiza cobrança ou
                    transferência.
                  </p>
                </div>
              ) : (
                <>
                  <p>
                    Os dias serão adicionados ao período disponível, sem consumir o acesso já
                    liberado.
                  </p>
                  <div className="billing-days" role="group" aria-label="Dias gratuitos">
                    {[7, 15, 30].map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={days === value ? 'default' : 'outline'}
                        aria-pressed={days === value}
                        onClick={() => setDays(value)}
                      >
                        {value} dias
                      </Button>
                    ))}
                  </div>
                  <p className="billing-confirm">
                    Gratuito até{' '}
                    <strong>
                      {dateLabel(
                        shiftDate(
                          plan.due_date > plan.server_date ? plan.due_date : plan.server_date,
                          days - 1,
                        ),
                      )}
                    </strong>
                    . A gratuidade não gera dívida nem carência adicional ao terminar.
                  </p>
                </>
              )}
              <label className="form-row">
                Observação (opcional)
                <textarea
                  value={note}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ex.: liberação para conhecer a plataforma"
                />
              </label>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  {action === 'payment'
                    ? 'Conferi o recebimento e quero registrar este pagamento.'
                    : 'Confirmo a concessão deste período gratuito.'}
                </span>
              </label>
            </fieldset>
            <FormError message={formError} />
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={locked}
                onClick={() => close(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !confirmed}>
                {busy
                  ? 'Registrando...'
                  : attempt
                    ? 'Confirmar resultado'
                    : action === 'payment'
                      ? 'Confirmar pagamento'
                      : 'Conceder gratuidade'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
