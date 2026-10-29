import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock3, TriangleAlert, ReceiptText } from 'lucide-react';
import { Empty, FormError, Kpi } from '../../components/shared';
import { RecordTitle } from '../../components/RecordTitle';
import { Button } from '../../components/ui/button';
import { Pagination, type PageSize } from '../../components/ui/pagination';
import { Modal } from '../../components/ui/modal';
import { currency, dateLabel } from '../../lib/format';
import { getSupabaseClient } from '../../lib/supabase';
import { BillingCommandError } from './subscription';
import {
  billingDateTime,
  chargeCanBeManaged,
  chargeLabels,
  defaultHistoryFilters,
  loadChargeHistory,
  manageCharge,
  methodLabels,
  validHistoryDates,
  type Charge,
  type ChargeFilter,
  type ChargeHistory,
  type PaymentMethod,
} from './charges';
import './billing.css';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { billingRefreshGroup } from '../../lib/query-refresh';

export function BillingHistory({
  companyId,
  admin = false,
  revision = 0,
  onChanged,
  demoData,
  active = true,
}: {
  companyId?: string;
  admin?: boolean;
  revision?: number;
  onChanged?: () => void;
  demoData?: ChargeHistory;
  active?: boolean;
}) {
  const [filters, setFilters] = useState(defaultHistoryFilters);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [draftQuery, setDraftQuery] = useState('');
  const [reload, setReload] = useState(0),
    [selected, setSelected] = useState<Charge | null>(null);
  const [action, setAction] = useState<'confirm' | 'cancel' | 'review' | null>(null),
    [note, setNote] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('unknown'),
    [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const [notice, setNotice] = useState('');
  const {
    data: history,
    error,
    refresh,
  } = useLiveQuery<ChargeHistory>(
    async () => {
      if (demoData) {
        const records = demoData.records.filter(
          (r) =>
            (!filters.from || r.due_date >= filters.from) &&
            (!filters.to || r.due_date <= filters.to) &&
            (!filters.query ||
              r.company_name
                .toLocaleLowerCase('pt-BR')
                .includes(filters.query.toLocaleLowerCase('pt-BR'))),
        );
        const visible = records.filter(
          (r) =>
            filters.status === 'all' ||
            r.display_status === filters.status ||
            (filters.status === 'pending' && r.status === 'pending') ||
            (filters.status === 'review' && r.needs_review),
        );
        const sum = (state: string) =>
          records.filter((r) => r.status === state).reduce((total, r) => total + r.amount_cents, 0);
        return {
          ...demoData,
          records: visible.slice(filters.offset, filters.offset + pageSize),
          total: visible.length,
          totals: {
            ...demoData.totals,
            paid_cents: sum('paid'),
            pending_cents: sum('pending'),
            overdue_cents: records
              .filter((r) => r.display_status === 'overdue')
              .reduce((n, r) => n + r.amount_cents, 0),
            paid_count: records.filter((r) => r.status === 'paid').length,
            pending_count: records.filter((r) => r.status === 'pending').length,
            overdue_count: records.filter((r) => r.display_status === 'overdue').length,
            review_count: records.filter((r) => r.needs_review).length,
          },
        };
      }
      // The existing RPC returns at most 20 records per request. Combine read-only
      // windows so 50/100 can be selected without changing payment functions.
      const client = getSupabaseClient();
      const first = await loadChargeHistory(client, companyId, filters);
      if (pageSize <= 20 || first.records.length < 20) {
        return { ...first, records: first.records.slice(0, pageSize) };
      }
      const remaining = await Promise.all(
        Array.from({ length: Math.ceil(pageSize / 20) - 1 }, (_, i) =>
          loadChargeHistory(client, companyId, { ...filters, offset: filters.offset + (i + 1) * 20 }),
        ),
      );
      return { ...first, records: [first, ...remaining].flatMap((part) => part.records).slice(0, pageSize) };
    },
    [companyId, filters, revision, reload, demoData, pageSize],
    {
      group: billingRefreshGroup(companyId),
      enabled: validHistoryDates(filters.from, filters.to),
      automatic: active && !demoData,
    },
  );
  useEffect(() => {
    if (history && filters.offset > 0 && filters.offset >= history.total)
      setFilters((current) => ({
        ...current,
        offset: history.total ? Math.floor((history.total - 1) / pageSize) * pageSize : 0,
      }));
  }, [history, filters.offset, pageSize]);
  const updateFilter = (values: Partial<typeof filters>) =>
    setFilters((current) => ({ ...current, ...values, offset: 0 }));
  function open(charge: Charge) {
    setSelected(charge);
    setAction(null);
    setNote('');
    setMethod(charge.payment_method);
    setConfirmed(false);
    setFormError('');
    setUncertain(false);
  }
  function close() {
    if (!busy && !uncertain) {
      setSelected(null);
      setAction(null);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !action || !confirmed || busy || demoData) return;
    setBusy(true);
    setFormError('');
    try {
      await manageCharge(getSupabaseClient(), selected.id, action, note, method);
      setSelected(null);
      setAction(null);
      setUncertain(false);
      setReload((n) => n + 1);
      setNotice(
        action === 'review'
          ? 'Conferência registrada. O período de acesso foi mantido.'
          : action === 'confirm'
            ? 'Pagamento registrado e período de acesso atualizado.'
            : 'Cobrança cancelada. O período de acesso foi mantido.',
      );
      onChanged?.();
    } catch (cause) {
      setFormError((cause as Error).message);
      setUncertain(cause instanceof BillingCommandError && cause.retrySame);
    } finally {
      setBusy(false);
    }
  }
  const invalidDates = !validHistoryDates(filters.from, filters.to);
  return (
    <section className="billing-ledger" aria-label="Histórico de cobranças">
      <div className="billing-toolbar">
        <div>
          <h2>Histórico de cobranças</h2>
          <p className="muted">
            Vencimentos, recebimentos e cancelamentos
            {companyId ? ' da empresa' : ' de todas as empresas'}.
          </p>
        </div>
      </div>
      <div className="card billing-filters">
        {!companyId && (
          <form
            className="billing-company-search"
            onSubmit={(e) => {
              e.preventDefault();
              updateFilter({ query: draftQuery.trim() });
            }}
          >
            <label>
              Empresa
              <input
                value={draftQuery}
                maxLength={160}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Buscar empresa"
              />
            </label>
            <Button variant="outline" type="submit">
              Buscar
            </Button>
          </form>
        )}
        <label>
          Vencimentos de
          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter({ from: e.target.value })}
          />
        </label>
        <label>
          Até
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter({ to: e.target.value })}
          />
        </label>
        <label>
          Situação
          <select
            value={filters.status}
            onChange={(e) => updateFilter({ status: e.target.value as ChargeFilter })}
          >
            {Object.entries(chargeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setDraftQuery('');
            setFilters(defaultHistoryFilters);
          }}
        >
          Limpar filtros
        </Button>
      </div>
      {invalidDates && (
        <FormError message="A data inicial deve ser anterior ou igual à data final." />
      )}
      {notice && (
        <p role="status" className="admin-feedback">
          {notice}
        </p>
      )}
      {error ? (
        <div role="alert">
          <FormError message={error} />
          <Button variant="outline" onClick={() => void refresh()}>
            Tentar consulta novamente
          </Button>
        </div>
      ) : (
        !invalidDates &&
        (!history ? (
          <p role="status">Consultando cobranças...</p>
        ) : (
          <>
            <div className="billing-kpis">
              <Kpi
                label="Recebido"
                value={currency(history.totals.paid_cents)}
                foot={`${history.totals.paid_count} cobranças pagas`}
                icon={<CircleCheck size={19} />}
              />
              <Kpi
                label="Em aberto"
                value={currency(history.totals.pending_cents)}
                foot={`${history.totals.pending_count} cobranças, incluindo vencidas`}
                icon={<Clock3 size={19} />}
              />
              <Kpi
                label="Vencido"
                value={currency(history.totals.overdue_cents)}
                foot={`${history.totals.overdue_count} cobranças vencidas`}
                icon={<TriangleAlert size={19} />}
              />
              <Kpi
                label="Para conferir"
                value={history.totals.review_count}
                foot="Recebimentos que exigem análise"
                icon={<ReceiptText size={19} />}
              />
            </div>
            <p className="small-note">
              Totais da empresa e do período selecionados, antes do filtro de situação. Cobranças de
              teste ficam fora dos totais. Datas em horário de Brasília.
            </p>
            <div className="card billing-table-card">
              {!history.records.length ? (
                <Empty
                  title="Nenhuma cobrança encontrada"
                  description="Cobranças registradas e pagamentos confirmados aparecerão aqui. Ajuste os filtros para consultar outro período."
                />
              ) : (
                <div className="table-wrap">
                  <table className="billing-charge-table">
                    <thead>
                      <tr>
                        <th>{companyId ? 'Cobrança' : 'Empresa / cobrança'}</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                        <th>Situação</th>
                        <th>Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.records.map((charge) => (
                        <tr key={charge.id}>
                          <td data-label="Cobrança">
                            <RecordTitle
                              title={
                                companyId
                                  ? `Mensalidade · ${dateLabel(charge.due_date)}`
                                  : charge.company_name
                              }
                              onOpen={() => open(charge)}
                            />
                            <small>
                              {charge.kind === 'subscription'
                                ? 'Assinatura recorrente'
                                : 'Pagamento avulso'}{' '}
                              ·{' '}
                              {charge.source === 'manual'
                                ? 'Registro administrativo'
                                : 'Mercado Pago'}
                              {charge.environment === 'test' ? ' · Teste' : ''}
                            </small>
                          </td>
                          <td data-label="Vencimento">{dateLabel(charge.due_date)}</td>
                          <td data-label="Valor">{currency(charge.amount_cents)}</td>
                          <td data-label="Situação">
                            <span
                              className={`badge ${charge.display_status === 'paid' ? 'good' : ['overdue', 'refunded'].includes(charge.display_status) ? 'warn' : 'gray'}`}
                            >
                              {chargeLabels[charge.display_status]}
                            </span>
                            {charge.needs_review && <small>Conferência necessária</small>}
                          </td>
                          <td data-label="Pagamento">
                            {charge.paid_at
                              ? billingDateTime(charge.paid_at)
                              : charge.status === 'cancelled'
                                ? '—'
                                : 'Aguardando pagamento'}
                            <small>
                              {charge.status === 'cancelled'
                                ? 'Cobrança encerrada'
                                : methodLabels[charge.payment_method]}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <Pagination
              page={Math.floor(filters.offset / pageSize)}
              size={pageSize}
              total={history.total}
              label="cobranças"
              onChange={(page) => setFilters((previous) => ({ ...previous, offset: page * pageSize }))}
              onSizeChange={(value) => {
                setPageSize(value);
                setFilters((previous) => ({ ...previous, offset: 0 }));
              }}
            />
          </>
        ))
      )}
      <Modal
        open={!!selected}
        onOpenChange={(value) => {
          if (!value) close();
        }}
        title={
          action === 'review'
            ? 'Registrar conferência'
            : action === 'confirm'
              ? 'Confirmar recebimento'
              : action === 'cancel'
                ? 'Cancelar cobrança'
                : 'Detalhes da cobrança'
        }
        description={selected?.company_name}
        size="wide"
      >
        {selected && (
          <>
            <dl className="billing-charge-details">
              <div>
                <dt>Valor</dt>
                <dd>{currency(selected.amount_cents)}</dd>
              </div>
              <div>
                <dt>Vencimento</dt>
                <dd>{dateLabel(selected.due_date)}</dd>
              </div>
              <div>
                <dt>Situação</dt>
                <dd>{chargeLabels[selected.display_status]}</dd>
              </div>
              <div>
                <dt>Modalidade</dt>
                <dd>
                  {selected.kind === 'subscription' ? 'Assinatura recorrente' : 'Pagamento avulso'}
                </dd>
              </div>
              <div>
                <dt>Origem</dt>
                <dd>{selected.source === 'manual' ? 'Registro administrativo' : 'Mercado Pago'}</dd>
              </div>
              <div>
                <dt>Ambiente</dt>
                <dd>
                  {selected.environment === 'test' ? 'Teste · sem renovação de acesso' : 'Produção'}
                </dd>
              </div>
              <div>
                <dt>Meio de pagamento</dt>
                <dd>{methodLabels[selected.payment_method]}</dd>
              </div>
              <div>
                <dt>Criada em</dt>
                <dd>{billingDateTime(selected.created_at)}</dd>
              </div>
              <div>
                <dt>{selected.source === 'manual' ? 'Registrada por' : 'Solicitada por'}</dt>
                <dd>{selected.recorded_by}</dd>
              </div>
              {selected.paid_at && (
                <div>
                  <dt>Pagamento confirmado</dt>
                  <dd>{billingDateTime(selected.paid_at)}</dd>
                </div>
              )}
              {selected.next_due_date && (
                <div>
                  <dt>Acesso renovado até</dt>
                  <dd>{dateLabel(selected.next_due_date)}</dd>
                </div>
              )}
              {selected.provider_payment_id && (
                <div>
                  <dt>Pagamento no Mercado Pago</dt>
                  <dd>{selected.provider_payment_id}</dd>
                </div>
              )}
              {selected.received_amount_cents !== null &&
                selected.received_amount_cents !== undefined && (
                  <div>
                    <dt>Valor recebido</dt>
                    <dd>{currency(selected.received_amount_cents)}</dd>
                  </div>
                )}
              {selected.last_verified_at && (
                <div>
                  <dt>Última conferência no provedor</dt>
                  <dd>{billingDateTime(selected.last_verified_at)}</dd>
                </div>
              )}
              {selected.cancelled_at && (
                <div>
                  <dt>Cancelada em</dt>
                  <dd>{billingDateTime(selected.cancelled_at)}</dd>
                </div>
              )}
            </dl>
            {selected.note && (
              <p className="billing-note">
                <strong>Observação</strong>
                {selected.note}
              </p>
            )}
            {selected.cancelled_reason && (
              <p className="billing-note">
                <strong>Motivo do cancelamento</strong>
                {selected.cancelled_reason}
              </p>
            )}
            {selected.needs_review && (
              <p role="status" className="billing-alert">
                {selected.review_reason ||
                  'Confira este recebimento antes de alterar o acesso da empresa.'}
              </p>
            )}
            {selected.environment === 'test' && (
              <p className="billing-alert">
                Cobrança de teste. Este registro não representa receita real nem renova o acesso.
              </p>
            )}
            {selected.reviewed_at && (
              <p className="billing-note">
                <strong>
                  Conferência administrativa · {billingDateTime(selected.reviewed_at)}
                </strong>
                {selected.review_note}
              </p>
            )}
            {action ? (
              <form onSubmit={(e) => void submit(e)}>
                <fieldset disabled={busy || uncertain}>
                  {action === 'confirm' ? (
                    <>
                      <p>
                        Confirme somente após conferir o recebimento de{' '}
                        <strong>{currency(selected.amount_cents)}</strong>. O plano será renovado
                        por um mês, aplicando a regra de carência.
                      </p>
                      <label className="form-row">
                        Meio de pagamento
                        <select
                          value={method}
                          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                        >
                          {Object.entries(methodLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    <p>
                      {action === 'review'
                        ? 'Registre o resultado da análise e as providências tomadas. A conferência mantém o histórico financeiro e o período de acesso; eventuais ajustes do plano devem ser realizados na gestão da empresa.'
                        : 'O cancelamento encerra esta cobrança e mantém o período de acesso atual.'}
                    </p>
                  )}
                  <label className="form-row">
                    {action === 'review'
                      ? 'Resultado da conferência'
                      : action === 'cancel'
                        ? 'Motivo do cancelamento'
                        : 'Observação (opcional)'}
                    <textarea
                      required={action !== 'confirm'}
                      maxLength={500}
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    <span>
                      {action === 'review'
                        ? 'Conferi esta ocorrência e registrei as providências.'
                        : action === 'confirm'
                          ? 'Conferi o recebimento deste valor.'
                          : 'Confirmo o cancelamento desta cobrança.'}
                    </span>
                  </label>
                </fieldset>
                <FormError message={formError} />
                <div className="form-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || uncertain}
                    onClick={() => setAction(null)}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" disabled={busy || !confirmed || !!demoData}>
                    {busy
                      ? 'Registrando...'
                      : uncertain
                        ? 'Conferir resultado'
                        : action === 'review'
                          ? 'Registrar conferência'
                          : action === 'confirm'
                            ? 'Confirmar recebimento'
                            : 'Cancelar cobrança'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="form-actions">
                {admin && (
                  <Button asChild variant="outline">
                    <Link
                      to={`/admin/planos?empresa=${selected.company_id}&visao=planos`}
                      onClick={close}
                    >
                      Ver plano da empresa
                    </Link>
                  </Button>
                )}
                {admin && !demoData && chargeCanBeManaged(selected) && (
                  <>
                    <Button variant="outline" onClick={() => setAction('cancel')}>
                      Cancelar cobrança
                    </Button>
                    <Button onClick={() => setAction('confirm')}>Registrar recebimento</Button>
                  </>
                )}
                {admin && !demoData && selected.needs_review && (
                  <Button onClick={() => setAction('review')}>Registrar conferência</Button>
                )}
                <Button variant="outline" onClick={close}>
                  Fechar
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>
    </section>
  );
}
