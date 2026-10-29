import { ViewSwitcher } from '../../components/ui/view-switcher';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard, Gift } from 'lucide-react';
import { Empty, FormError, Heading, SearchInput } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { getSupabaseClient } from '../../lib/supabase';
import { currency, dateLabel, shiftDate, uid } from '../../lib/format';
import type { AdminCompany } from '../admin/repository';
import { AccessChangedError } from '../auth/access';
import { BillingHistory } from './BillingHistory';
import { createCharge } from './charges';
import { OnlineBilling } from './OnlineBilling';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { billingRefreshGroup } from '../../lib/query-refresh';
import {
  applyBillingCommand,
  BillingCommandError,
  loadSubscription,
  paymentPreview,
  stateLabels,
  type BillingAttempt,
} from './subscription';

type AdminBillingAttempt = BillingAttempt | (Omit<BillingAttempt, 'kind'> & { kind: 'charge' });

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
  const [companyTab, setCompanyTab] = useState<'overview' | 'history' | 'integration'>('overview');
  const [params, setParams] = useSearchParams();
  const showPlans =
    params.get('visao') === 'planos' || (!params.has('visao') && params.has('empresa'));
  const selectedId = params.get('empresa') || companies[0]?.id || '';
  const company = companies.find((item) => item.id === selectedId);
  const [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const [revision, setRevision] = useState(0),
    [action, setAction] = useState<'payment' | 'complimentary' | 'charge' | null>(null);
  const [days, setDays] = useState(7),
    [note, setNote] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState<AdminBillingAttempt | null>(null),
    [formError, setFormError] = useState('');
  const {
    data: plan,
    error: planError,
    refresh: retryPlan,
  } = useLiveQuery(
    () => (company ? loadSubscription(getSupabaseClient(), company.id) : Promise.resolve(null)),
    [company?.id, revision],
    {
      group: billingRefreshGroup(company?.id),
      enabled: !!company && showPlans,
      automatic: () => !action,
    },
  );
  const planCompanies = companies.filter((item) =>
    item.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
  );
  function open(kind: 'payment' | 'complimentary' | 'charge') {
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
    const request: AdminBillingAttempt = attempt || {
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
      const result =
        request.kind === 'charge'
          ? await createCharge(
              getSupabaseClient(),
              request.companyId,
              request.id,
              request.dueDate,
              request.note,
            )
          : await applyBillingCommand(getSupabaseClient(), userId, request);
      setAction(null);
      setAttempt(null);
      setRevision((n) => n + 1);
      onReload();
      onNotice(
        request.kind === 'charge'
          ? 'Cobrança criada. O gestor pode acompanhá-la na tela Plano.'
          : `${request.kind === 'payment' ? 'Pagamento registrado' : 'Gratuidade concedida'}. Próximo vencimento: ${dateLabel(result.next_due_date)}.`,
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
        title="Planos e cobranças"
        description="Acompanhe os recebimentos da plataforma e gerencie o acesso de cada empresa."
      />
      <ViewSwitcher
        label="Visão financeira"
        value={showPlans ? 'planos' : 'cobrancas'}
        onValueChange={(visao) =>
          setParams({ visao, ...(visao === 'planos' && selectedId ? { empresa: selectedId } : {}) })
        }
        items={[
          { value: 'cobrancas', label: 'Cobranças' },
          { value: 'planos', label: 'Planos por empresa' },
        ]}
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
      ) : !showPlans ? (
        <BillingHistory
          admin
          revision={revision}
          onChanged={() => {
            setRevision((n) => n + 1);
            onReload();
          }}
        />
      ) : (
        <div className="billing-admin-compact">
          <div className="billing-company-toolbar">
            <label className="form-row">
              Empresa
              <select
                aria-label="Empresa para gerenciar"
                value={selectedId}
                onChange={(event) => {
                  setCompanyTab('overview');
                  setParams({ empresa: event.target.value, visao: 'planos' });
                }}
              >
                {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="form-row">
              Buscar empresa
              <SearchInput value={query} onChange={setQuery} placeholder="Filtrar empresas..." />
            </label>
            {query.trim() && (
              <div className="billing-company-matches" aria-label="Resultados da busca">
                {planCompanies.length ? planCompanies.map((item) => (
                  <Button key={item.id} variant="outline" size="sm" onClick={() => {
                    setCompanyTab('overview');
                    setParams({ empresa: item.id, visao: 'planos' });
                    setQuery('');
                  }}>{item.name}</Button>
                )) : <span className="muted">Nenhuma empresa encontrada.</span>}
              </div>
            )}
          </div>
          <div className="billing-admin-main">
            {company ? (
              <>
                {!company.enabled && (
                  <p className="billing-alert">
                    A empresa está desativada. A liberação de dias ou o pagamento não substitui a
                    habilitação em Empresas.
                  </p>
                )}
                {(error || planError) && (
                  <div role="alert" className="secure-access-error">
                    <p>{error || planError}</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setError('');
                        void retryPlan();
                      }}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {plan ? (
                  <>
                    <ViewSwitcher
                      label="Gestão financeira da empresa"
                      value={companyTab}
                      onValueChange={setCompanyTab}
                      items={[
                        { value: 'overview', label: 'Plano e acesso' },
                        { value: 'history', label: 'Cobranças' },
                        { value: 'integration', label: 'Integração' },
                      ]}
                    />
                    {companyTab === 'overview' && (
                      <>
                        <div className="billing-admin-actions">
                          <Button variant="outline" onClick={() => open('charge')}>
                            <CreditCard size={16} /> Criar cobrança
                          </Button>
                          <Button onClick={() => open('payment')}>
                            <CreditCard size={16} /> Registrar pagamento
                          </Button>
                          <Button variant="outline" onClick={() => open('complimentary')}>
                            <Gift size={16} /> Liberar dias gratuitos
                          </Button>
                        </div>
                        <section className="card billing-admin-overview" aria-label="Resumo do plano">
                          <div className="billing-overview-heading">
                            <div>
                              <h3>{plan.plan_name}</h3>
                              <strong>{currency(plan.monthly_amount_cents)} <small>/ mês</small></strong>
                            </div>
                            <span className="badge">{stateLabels[plan.status]}</span>
                          </div>
                          <dl className="billing-overview-facts">
                            <div><dt>{plan.cycle_kind === 'complimentary' ? 'Gratuito até' : 'Vencimento'}</dt><dd>{dateLabel(plan.cycle_kind === 'complimentary' ? shiftDate(plan.due_date, -1) : plan.due_date)}</dd></div>
                            <div><dt>Carência</dt><dd>Até 7 dias</dd></div>
                          </dl>
                          <details className="billing-renewal-rules">
                            <summary>Regras e movimentações de acesso ({plan.events.length})</summary>
                            <p className="small-note">A renovação depende do pagamento confirmado. Até 7 dias de carência utilizados são descontados do próximo ciclo pago.</p>
                            {plan.events.length ? (
                              <ul className="billing-overview-events">
                                {plan.events.map((event) => (
                                  <li key={event.id}>
                                    <strong>{event.kind === 'payment' ? 'Pagamento' : 'Gratuidade'}</strong>
                                    {' · '}{event.kind === 'payment' ? currency(event.amount_cents) : `${event.free_days} dias`}
                                    {' · '}Vencimento: {dateLabel(event.next_due_date)}
                                    {event.note && <p>{event.note}</p>}
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="small-note">Sem movimentações registradas.</p>}
                          </details>
                        </section>
                      </>
                    )}
                    {companyTab === 'history' && (
                      <BillingHistory
                        key={company.id}
                        companyId={company.id}
                        admin
                        revision={revision}
                        onChanged={() => {
                          setRevision((n) => n + 1);
                          onReload();
                        }}
                      />
                    )}
                    {companyTab === 'integration' && (
                      <OnlineBilling key={company.id} companyId={company.id} admin />
                    )}
                  </>
                ) : (
                  !error && !planError && <p role="status">Consultando o plano...</p>
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
        title={
          action === 'payment'
            ? 'Registrar pagamento recebido'
            : action === 'charge'
              ? 'Criar cobrança da mensalidade'
              : 'Liberar dias gratuitos'
        }
        description={company?.name}
      >
        {plan && (
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={locked}>
              {action === 'charge' ? (
                <div className="billing-confirm">
                  <strong>
                    {currency(plan.monthly_amount_cents)} · vencimento {dateLabel(plan.due_date)}
                  </strong>
                  <p>
                    A cobrança ficará em aberto no histórico desta empresa. A criação não confirma
                    pagamento nem altera o período de acesso.
                  </p>
                </div>
              ) : action === 'payment' ? (
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
                  {action === 'charge'
                    ? 'Confirmo a criação desta cobrança.'
                    : action === 'payment'
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
                    : action === 'charge'
                      ? 'Criar cobrança'
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
