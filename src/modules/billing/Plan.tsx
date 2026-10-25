import { useEffect, useState } from 'react';
import { CalendarDays, CreditCard, Gift, ShieldCheck } from 'lucide-react';
import { Heading } from '../../components/shared';
import { Button } from '../../components/ui/button';
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

export function PlanPanel({ plan, demo = false }: { plan: Subscription; demo?: boolean }) {
  return (
    <div className="billing-plan">
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
                  plan.cycle_kind === 'complimentary'
                    ? shiftDate(plan.due_date, -1)
                    : plan.due_date,
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
            Combine o pagamento com a administração para continuar.
          </p>
        )}
        <p className="small-note">
          O pagamento é confirmado pela administração. Os dias de carência utilizados são
          descontados do próximo período pago, até o limite de sete dias. Dias bloqueados não são
          descontados.
        </p>
        {plan.cycle_kind === 'complimentary' && (
          <p className="small-note">
            <Gift size={15} /> A gratuidade foi concedida pela administração. Ela não gera dívida
            nem desconto no próximo pagamento; ao terminar, o acesso aguarda renovação.
          </p>
        )}
        {demo && (
          <p className="small-note">
            Demonstração com dados fictícios. Este plano não representa uma cobrança.
          </p>
        )}
      </section>
      <section className="card billing-history">
        <h3>Histórico do plano</h3>
        <p className="muted">Últimos 20 registros de pagamentos e períodos gratuitos.</p>
        {!plan.events.length ? (
          <div className="billing-empty">Nenhum pagamento ou gratuidade registrado.</div>
        ) : (
          <ol>
            {plan.events.map((event) => (
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
      </section>
    </div>
  );
}

export function RealPlan({ companyId }: { companyId: string }) {
  const [plan, setPlan] = useState<Subscription | null>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPlan(null);
    setError('');
    void loadSubscription(getSupabaseClient(), companyId)
      .then((value) => {
        if (active) setPlan(value);
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      });
    return () => {
      active = false;
    };
  }, [companyId, revision]);
  return (
    <>
      <div className="billing-toolbar">
        <p className="muted">Acompanhe o período de acesso e os registros da sua empresa.</p>
        <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
          Atualizar plano
        </Button>
      </div>
      {error ? (
        <p role="alert" className="secure-access-error">
          {error}
        </p>
      ) : plan ? (
        <PlanPanel plan={plan} />
      ) : (
        <p role="status">Consultando seu plano...</p>
      )}
    </>
  );
}
export function DemoPlan() {
  const { data, session } = useCrm();
  if (session.role !== 'manager') return <p>O plano é exclusivo do gestor.</p>;
  const company = data.companies.find((item) => item.id === session.companyId)!;
  const date = today();
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
      <PlanPanel
        demo
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
