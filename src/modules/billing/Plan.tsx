import { useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Gift, ShieldCheck } from 'lucide-react';
import { Heading } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Tabs } from '../../components/ui/tabs';
import { Pagination, paginatedRows, usePagination } from '../../components/ui/pagination';
import { currency, dateLabel, shiftDate, today } from '../../lib/format';
import { getSupabaseClient } from '../../lib/supabase';
import { useCrm } from '../../app/context';
import {
  loadSubscription,
  MONTHLY_PRICE_CENTS,
  stateLabels,
  subscriptionState,
  type Subscription,
} from './subscription';
import './billing.css';
import { BillingHistory } from './BillingHistory';
import { OnlineBilling } from './OnlineBilling';
import { demoChargeHistory } from './demo-history';
import type { ChargeHistory } from './charges';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { billingRefreshGroup, refreshBilling } from '../../lib/query-refresh';

export function PlanPanel({ plan, demo = false }: { plan: Subscription; demo?: boolean }) {
  return (
    <div className="billing-plan">
      <PlanSummary plan={plan} demo={demo} />
      <PlanAccessHistory plan={plan} />
    </div>
  );
}

function PlanSummary({ plan, demo = false }: { plan: Subscription; demo?: boolean }) {
  return (
    <section className="card billing-summary">
      <div className="billing-summary-top">
        <span className="billing-icon">
          <CreditCard size={24} />
        </span>
        <span
          className={`badge ${plan.status === 'active' || plan.status === 'complimentary' ? 'good' : 'warn'}`}
        >
          {stateLabels[plan.status]}
        </span>
      </div>
      <div>
        <span className="eyebrow">SEU PLANO</span>
        <h2>{plan.plan_name}</h2>
        <p className="billing-price">
          {currency(plan.monthly_amount_cents)} <small>/ mês</small>
        </p>
      </div>
      <div className="billing-facts">
        <div>
          <CalendarDays size={18} />
          <span>
            {plan.cycle_kind === 'complimentary' ? 'Gratuito até' : 'Vencimento'}
            <strong>
              {dateLabel(
                plan.cycle_kind === 'complimentary' ? shiftDate(plan.due_date, -1) : plan.due_date,
              )}
            </strong>
          </span>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>
            Carência após vencimento<strong>Até 7 dias no ciclo mensal</strong>
          </span>
        </div>
      </div>
      {plan.status === 'grace' && (
        <p className="billing-alert" role="status">
          Pagamento pendente. Você utilizou {plan.grace_days_used} de 7 dias de carência. O acesso
          será bloqueado após {dateLabel(plan.grace_ends_on!)}.
        </p>
      )}
      {(plan.status === 'blocked' || plan.status === 'awaiting_payment') && (
        <p className="billing-alert" role="status">
          {plan.status === 'blocked'
            ? 'O período de acesso terminou.'
            : 'Seu plano aguarda liberação.'}{' '}
          Consulte as opções de pagamento do plano ou combine a renovação com a administração.
        </p>
      )}
      <details className="billing-renewal-rules">
        <summary>Regras de renovação</summary>
        <p className="small-note">
          A renovação depende da confirmação do pagamento. Os dias de carência utilizados são
          descontados do próximo período pago, até o limite de sete dias. Dias bloqueados não são
          descontados.
        </p>
      </details>
      {plan.cycle_kind === 'complimentary' && (
        <p className="small-note">
          <Gift size={15} /> A gratuidade foi concedida pela administração. Ela não gera dívida nem
          desconto no próximo pagamento; ao terminar, o acesso aguarda renovação.
        </p>
      )}
      {demo && (
        <p className="small-note">
          Demonstração com dados fictícios. Este plano não representa uma cobrança.
        </p>
      )}
    </section>
  );
}

function PlanAccessHistory({ plan }: { plan: Subscription }) {
  const pages = usePagination();
  return (
    <section className="card billing-history">
      <h3>Movimentações de acesso</h3>
      <p className="muted">Últimas 20 renovações e concessões de dias gratuitos.</p>
      {!plan.events.length ? (
        <div className="billing-empty">Nenhum pagamento ou gratuidade registrado.</div>
      ) : (
        <ol>
          {paginatedRows(plan.events, pages.page, pages.size).map((event) => (
            <li key={event.id}>
              <div className="billing-event-icon">
                {event.kind === 'payment' ? <CreditCard size={18} /> : <Gift size={18} />}
              </div>
              <div>
                <strong>
                  {event.kind === 'payment'
                    ? `Pagamento registrado · ${currency(event.amount_cents)}`
                    : `${event.free_days} dias gratuitos concedidos`}
                </strong>
                <small>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'America/Sao_Paulo',
                  }).format(new Date(event.created_at))}
                </small>
                <p>
                  Próximo vencimento: {dateLabel(event.next_due_date)}
                  {event.grace_days > 0
                    ? ` · ${event.grace_days} dias de carência descontados`
                    : ''}
                </p>
                {event.note && <p>{event.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      <Pagination page={pages.page} size={pages.size} total={plan.events.length} onChange={pages.setPage} onSizeChange={pages.setSize} label="movimentações de acesso" />
    </section>
  );
}

function PlanSections({ plan, demoData }: { plan: Subscription; demoData?: ChargeHistory }) {
  const [tab, setTab] = useState('plan');
  return (
    <div className="billing-plan-page">
      <Tabs
        label="Seções do plano"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'plan',
            label: 'Meu plano',
            content: <PlanSummary plan={plan} demo={!!demoData} />,
          },
          {
            value: 'payment',
            label: 'Pagamento',
            content: demoData ? (
              <section className="card billing-online">
                <h2>Pagar mensalidade</h2>
                <p>Pagamento por Pix ou cartão, uma mensalidade por vez.</p>
                <p className="small-note">Na demonstração, os pagamentos são fictícios.</p>
              </section>
            ) : (
              <OnlineBilling
                active={tab === 'payment'}
                companyId={plan.company_id}
                amount={plan.monthly_amount_cents}
                onPaymentUpdated={() => void refreshBilling(plan.company_id)}
              />
            ),
          },
          {
            value: 'history',
            label: 'Histórico',
            content: (
              <>
                <BillingHistory
                  companyId={plan.company_id}
                  demoData={demoData}
                  active={tab === 'history'}
                />
                <details className="billing-access-details">
                  <summary>Movimentações de acesso</summary>
                  <PlanAccessHistory plan={plan} />
                </details>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

export function RealPlan({ companyId }: { companyId: string }) {
  const {
    data: plan,
    error,
    refresh,
  } = useLiveQuery(() => loadSubscription(getSupabaseClient(), companyId), [companyId], {
    group: billingRefreshGroup(companyId),
  });
  return (
    <>
      {error && (
        <div role="alert" className="secure-access-error">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Tentar consulta novamente
          </Button>
        </div>
      )}
      {plan ? (
        <PlanSections key={companyId} plan={plan} />
      ) : !error ? (
        <p role="status">Consultando seu plano...</p>
      ) : null}
    </>
  );
}
export function DemoPlan() {
  const { data, session } = useCrm();
  const company = data.companies.find((item) => item.id === session.companyId)!;
  const date = today();
  const history = useMemo(
    () =>
      company ? demoChargeHistory(company.id, company.name, company.dueDate, date) : undefined,
    [company?.id, company?.name, company?.dueDate, date],
  );
  if (session.role !== 'manager' || !company || !history)
    return <p>O plano é exclusivo do gestor.</p>;
  const status = subscriptionState(company.dueDate, 'monthly', date);
  const used = Math.min(
    7,
    Math.max(0, Math.round((Date.parse(date) - Date.parse(company.dueDate)) / 86400000)),
  );
  return (
    <>
      <Heading
        eyebrow="GESTÃO"
        title="Plano"
        description="Mensalidade e período de acesso ao SUN7CRM."
      />
      <PlanSections
        key={company.id}
        demoData={history}
        plan={{
          company_id: company.id,
          plan_name: 'SUN7CRM Mensal',
          monthly_amount_cents: MONTHLY_PRICE_CENTS,
          due_date: company.dueDate,
          cycle_kind: 'monthly',
          status,
          server_date: date,
          access_allowed: status !== 'blocked',
          grace_days_used: used,
          grace_ends_on: shiftDate(company.dueDate, 7),
          events: [],
        }}
      />
    </>
  );
}
