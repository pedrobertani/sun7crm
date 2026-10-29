import { ViewSwitcher } from '../../components/ui/view-switcher';
import { campaignViews, type CampaignView } from '../growth/campaign-views';
import { Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { RecordTitle } from '../../components/RecordTitle';
import { Link } from 'react-router-dom';
import { Plus, Handshake, Wallet, CircleDollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { CurrencyInput } from '../../components/currency-input';
import { Empty, Kpi, Panel } from '../../components/shared';
import type {
  AmbassadorRow,
  CampaignRow,
  CampaignTotals,
  ContactRow,
  MetricRow,
  ReferralRow,
} from '../../data/backend';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { RecordPicker } from './RecordPicker';
import { ContactDialog } from './RecordForms';
import {
  cents,
  Pager,
  QueryState,
  SaveActions,
  useOperational,
  useQuery,
  useSave,
} from './operational';

/** Captures one immutable intent. Retries never change its key or payload. */
export function financialIntent<T>(payload: T) {
  return { requestId: uid(), payload: structuredClone(payload) };
}
function useIntent<T>() {
  const ref = useRef<ReturnType<typeof financialIntent<T>> | null>(null),
    [locked, setLocked] = useState(false);
  return {
    locked,
    capture: (payload: T) => {
      if (!ref.current) ref.current = financialIntent(payload);
      setLocked(true);
      return ref.current;
    },
  };
}
export function RealAmbassadors() {
  const { api, can, refresh, notice } = useOperational(),
    [tab, setTab] = useState<'campaigns' | 'people' | 'metrics'>('campaigns'),
    [campaignTab, setCampaignTab] = useState<CampaignView>('overview'),
    [selected, setSelected] = useState(''),
    [ambassador, setAmbassador] = useState<AmbassadorRow | 'new' | null>(null),
    [campaign, setCampaign] = useState<CampaignRow | 'new' | null>(null),
    [closing, setClosing] = useState(false),
    [payout, setPayout] = useState<CampaignTotals | null>(null),
    [referral, setReferral] = useState<ReferralRow | 'new' | null>(null),
    [adjust, setAdjust] = useState<ReferralRow | null>(null),
    [metric, setMetric] = useState<MetricRow | 'new' | null>(null),
    [page, setPage] = useState(0);
  const refs = useQuery(async () => {
    const [campaigns, ambassadors] = await Promise.all([
      api.all('campaigns'),
      api.all('ambassadors'),
    ]);
    return {
      campaigns: campaigns.sort((a, b) => b.starts_on.localeCompare(a.starts_on)),
      ambassadors,
      contacts: await api.contactsByIds(ambassadors.map((a) => a.contact_id)),
    };
  }, [api]);
  const current = refs.data?.campaigns.find((c) => c.id === selected) || refs.data?.campaigns[0];
  const totals = useQuery(
    async () =>
      current
        ? {
            totals: await api.campaignTotals(current.id),
            payments: await api.campaignPayments(current.id),
          }
        : null,
    [api, current?.id],
  );
  const referrals = useQuery(
    async () =>
      current ? { ...(await api.list('referrals', page, 50, { campaign_id: current.id })) } : null,
    [api, current?.id, page],
  );
  const metrics = useQuery(
    () => (tab === 'metrics' ? api.list('metrics', page, 50) : Promise.resolve(null)),
    [api, tab, page],
  );
  function saved(message: string) {
    setAmbassador(null);
    setCampaign(null);
    setClosing(false);
    setPayout(null);
    setReferral(null);
    setAdjust(null);
    setMetric(null);
    refresh();
    notice(message);
  }
  return (
    <>
      <div className="operational-toolbar">
        <ViewSwitcher
          label="Embaixadores"
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setPage(0);
          }}
          items={[
            { value: 'campaigns', label: 'Campanhas' },
            { value: 'people', label: 'Embaixadores' },
            { value: 'metrics', label: 'Métricas' },
          ]}
        />
        <div className="actions">
          <Button
            variant="outline"
            disabled={!can('ambassadors.create')}
            onClick={() => setAmbassador('new')}
          >
            <Plus size={16} />
            Novo embaixador
          </Button>
          <Button disabled={!can('campaigns.create')} onClick={() => setCampaign('new')}>
            <Plus size={16} />
            Nova campanha
          </Button>
        </div>
      </div>
      <QueryState query={refs} />
      {refs.data && (
        <>
          {tab === 'people' ? (
            <div className="card panel operational-table">
              <table>
                <thead>
                  <tr>
                    <th>Embaixador</th>
                    <th>Função</th>
                    <th>Código</th>
                    <th>Comissão</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {refs.data.ambassadors.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <RecordTitle
                          title={
                            refs.data!.contacts.find((c) => c.id === a.contact_id)?.name ||
                            'Contato'
                          }
                          onOpen={can('ambassadors.edit') ? () => setAmbassador(a) : undefined}
                        />
                        <small className="operational-cell-note">
                          {a.active ? 'Ativo' : 'Inativo'}
                        </small>
                      </td>
                      <td>{a.category || 'Não informada'}</td>
                      <td>{a.referral_code}</td>
                      <td>{a.commission_enabled ? 'Habilitada' : 'Não habilitada'}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={!can('ambassadors.edit')}
                          onClick={() => setAmbassador(a)}
                          aria-label="Editar"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!refs.data.ambassadors.length && (
                <Empty
                  title="Cadastre o primeiro embaixador"
                  description="Escolha uma pessoa da lista de contatos ou cadastre uma nova."
                />
              )}
            </div>
          ) : tab === 'metrics' ? (
            <>
              <div className="operational-toolbar">
                <p className="small-note">
                  Registros declarados pelo gestor, sem importação de redes sociais.
                </p>
                <Button
                  variant="outline"
                  disabled={!can('ambassadors.create')}
                  onClick={() => setMetric('new')}
                >
                  Registrar métrica
                </Button>
              </div>
              <QueryState query={metrics} />
              {metrics.data && (
                <>
                  <div className="card panel operational-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Embaixador</th>
                          <th>Métrica</th>
                          <th>Valor</th>
                          <th>Data</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.data.rows.map((m) => (
                          <tr key={m.id}>
                            <td>
                              {refs.data!.contacts.find(
                                (c) =>
                                  c.id ===
                                  refs.data!.ambassadors.find((a) => a.id === m.ambassador_id)
                                    ?.contact_id,
                              )?.name || 'Embaixador'}
                            </td>
                            <td>
                              <RecordTitle
                                title={m.name}
                                onOpen={can('ambassadors.edit') ? () => setMetric(m) : undefined}
                              />
                            </td>
                            <td>
                              {m.value} {m.unit}
                            </td>
                            <td>{dateLabel(m.measured_on)}</td>
                            <td>
                              <Button
                                size="icon"
                                variant="outline"
                                disabled={!can('ambassadors.edit')}
                                onClick={() => setMetric(m)}
                                aria-label="Editar"
                              >
                                <Pencil size={16} aria-hidden="true" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!metrics.data.rows.length && (
                      <Empty
                        title="Nenhuma métrica registrada"
                        description="Registre os indicadores combinados para cada embaixador."
                      />
                    )}
                  </div>
                  <Pager page={page} total={metrics.data.total} onChange={setPage} />
                </>
              )}
            </>
          ) : !current ? (
            <div className="card panel">
              <Empty
                title="Crie sua primeira campanha"
                description="Defina o período e a comissão. Cada R$ 1.000 completos em indicações elegíveis vale 1 ponto."
                action={
                  <Button disabled={!can('campaigns.create')} onClick={() => setCampaign('new')}>
                    Criar campanha
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="operational-campaign-header card panel">
                <label className="form-row">
                  Campanha
                  <select
                    value={current.id}
                    onChange={(e) => {
                      setSelected(e.target.value);
                      setPage(0);
                      setCampaignTab('overview');
                    }}
                  >
                    {refs.data.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.status === 'closed' ? 'Encerrada' : 'Em andamento'}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <RecordTitle
                    title={current.name}
                    onOpen={
                      current.status === 'active' && can('campaigns.edit')
                        ? () => setCampaign(current)
                        : undefined
                    }
                  />
                  <p>
                    <strong>
                      {dateLabel(current.starts_on)} a {dateLabel(current.ends_on)}
                    </strong>
                  </p>
                  <p className="small-note">
                    {current.payment_mode === 'per_point'
                      ? currency(current.rate_cents) + ' por ponto'
                      : (current.rate_bps / 100).toLocaleString('pt-BR') +
                        '% sobre as vendas elegíveis'}{' '}
                    · 1 ponto a cada R$ 1.000 completos.
                  </p>
                </div>
                <div className="actions">
                  {current.status === 'active' && (
                    <>
                      <Button
                        variant="outline"
                        disabled={!can('campaigns.edit')}
                        onClick={() => setCampaign(current)}
                      >
                        Editar campanha
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!can('campaigns.close')}
                        onClick={() => setClosing(true)}
                      >
                        Encerrar campanha
                      </Button>
                      <Button
                        disabled={!can('referrals.create')}
                        onClick={() => setReferral('new')}
                      >
                        Nova indicação
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <ViewSwitcher
                label="Seções da campanha"
                value={campaignTab}
                onValueChange={(value) => {
                  setCampaignTab(value);
                  setPage(0);
                }}
                items={campaignViews}
              />
              {campaignTab === 'overview' && (
                <>
              <QueryState query={totals} />
              {totals.data && (
                <>
                  <div className="kpis">
                    <Kpi
                      label="Vendas elegíveis"
                      value={currency(totals.data.totals.reduce((n, r) => n + r.eligible_cents, 0))}
                      foot="Pagas, com comparecimento e sem cancelamento"
                      icon={<CircleDollarSign size={19} />}
                    />
                    <Kpi
                      label="Pontos apurados"
                      value={totals.data.totals.reduce((n, r) => n + r.points, 0)}
                      foot="Soma dos pontos inteiros de cada embaixador"
                      icon={<Handshake size={19} />}
                    />
                    <Kpi
                      label="Comissões apuradas"
                      value={currency(totals.data.totals.reduce((n, r) => n + r.amount_cents, 0))}
                      foot="Conforme a regra desta campanha"
                      icon={<Wallet size={19} />}
                    />
                    <Kpi
                      label="Quitações registradas"
                      value={currency(totals.data.totals.reduce((n, r) => n + r.paid_cents, 0))}
                      foot="Confirmações administrativas de pagamento"
                      icon={<CheckCircle2 size={19} />}
                    />
                  </div>
                  <Panel
                    title="Apuração por embaixador"
                    description={
                      current.status === 'active'
                        ? 'Valores sujeitos a alteração até o encerramento.'
                        : 'Campanha encerrada. Confira a apuração antes de registrar cada quitação.'
                    }
                  >
                    <div className="operational-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Embaixador</th>
                            <th>Elegível</th>
                            <th>Pontos / saldo</th>
                            <th>Comissão</th>
                            <th>Situação</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {totals.data.totals.map((r) => (
                            <tr key={r.ambassador_id}>
                              <td>
                                <strong>{r.ambassador_name}</strong>
                                <small className="operational-cell-note">
                                  {r.category || 'Função não informada'}
                                  {!r.commission_enabled ? ' · Comissão não habilitada' : ''}
                                </small>
                              </td>
                              <td>{currency(r.eligible_cents)}</td>
                              <td>
                                {r.points} / {r.remaining_points}
                              </td>
                              <td>
                                {currency(r.amount_cents)}
                                {r.balance_cents < 0 && (
                                  <small className="operational-cell-note danger-text">
                                    Ajuste para revisão: {currency(r.balance_cents)}
                                  </small>
                                )}
                              </td>
                              <td>
                                {r.settled
                                  ? 'Quitada'
                                  : current.status === 'active'
                                    ? 'Em apuração'
                                    : r.amount_cents > 0
                                      ? 'Aguardando quitação'
                                      : 'Sem valor a quitar'}
                              </td>
                              <td>
                                {current.status === 'closed' &&
                                  !r.settled &&
                                  r.amount_cents > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!can('campaigns.pay')}
                                      onClick={() => setPayout(r)}
                                    >
                                      Registrar quitação
                                    </Button>
                                  )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!totals.data.totals.length && (
                        <Empty
                          title="Nenhum embaixador cadastrado"
                          description="Cadastre os participantes para registrar indicações."
                        />
                      )}
                    </div>
                  </Panel>
                </>
              )}
                </>
              )}
              {campaignTab === 'history' && (
                <>
                  <QueryState query={totals} />
                  {totals.data && (
                    totals.data.payments.length > 0 ? (
                    <Panel title="Histórico de quitações">
                      <div className="operational-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Embaixador</th>
                              <th>Valor registrado</th>
                              <th>Pontos</th>
                              <th>Data</th>
                              <th>Observação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {totals.data.payments.map((p) => (
                              <tr key={p.id}>
                                <td>{p.ambassador_name}</td>
                                <td>{currency(p.amount_cents)}</td>
                                <td>{p.points}</td>
                                <td>
                                  {new Intl.DateTimeFormat('pt-BR', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                    timeZone: 'America/Sao_Paulo',
                                  }).format(new Date(p.paid_at))}
                                </td>
                                <td>{p.note || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Panel>
                    ) : (
                      <div className="card panel">
                        <Empty title="Nenhuma quitação registrada" description="Os pagamentos confirmados das campanhas serão exibidos aqui." />
                      </div>
                    )
                  )}
                </>
              )}
              {campaignTab === 'referrals' && (
              <Panel
                title="Indicações da campanha"
                description="A confirmação de pagamento e comparecimento é registrada manualmente pelo gestor."
              >
                <QueryState query={referrals} />
                {referrals.data && (
                  <>
                    <div className="operational-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Indicação</th>
                            <th>Valor / estorno</th>
                            <th>Data</th>
                            <th>Pagamento / presença</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {referrals.data.rows.map((r) => (
                            <tr key={r.id}>
                              <td>
                                {refs.data!.contacts.find(
                                  (c) =>
                                    c.id ===
                                    refs.data!.ambassadors.find((a) => a.id === r.ambassador_id)
                                      ?.contact_id,
                                )?.name || 'Embaixador'}
                                <small className="operational-cell-note">
                                  {r.cancelled ? 'Indicação cancelada' : 'Card vinculado'} ·{' '}
                                  <Link
                                    className="operational-text-link"
                                    to={'/app/funil?card=' + encodeURIComponent(r.opportunity_id)}
                                  >
                                    Abrir card
                                  </Link>
                                </small>
                              </td>
                              <td>
                                {currency(r.value_cents)}
                                {r.refunded_cents > 0 && (
                                  <small className="operational-cell-note">
                                    Estornado: {currency(r.refunded_cents)}
                                  </small>
                                )}
                              </td>
                              <td>{dateLabel(r.sold_on)}</td>
                              <td>
                                {r.paid ? 'Pago' : 'Pendente'} ·{' '}
                                {r.attended ? 'Compareceu' : 'Sem comparecimento'}
                              </td>
                              <td>
                                <div className="actions">
                                  {current.status === 'active' && (
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      disabled={!can('referrals.edit')}
                                      onClick={() => setReferral(r)}
                                      aria-label="Editar"
                                    >
                                      <Pencil size={16} aria-hidden="true" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!can('referrals.adjust')}
                                    onClick={() => setAdjust(r)}
                                  >
                                    Estorno / cancelamento
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!referrals.data.rows.length && (
                        <Empty
                          title="Nenhuma indicação registrada"
                          description="Registre o card indicado, o valor e a situação de pagamento e presença."
                        />
                      )}
                    </div>
                    <Pager page={page} total={referrals.data.total} onChange={setPage} />
                  </>
                )}
              </Panel>
              )}

            </>
          )}
          {ambassador && (
            <AmbassadorDialog
              row={ambassador === 'new' ? undefined : ambassador}
              contact={
                ambassador === 'new'
                  ? undefined
                  : refs.data.contacts.find((c) => c.id === ambassador.contact_id)
              }
              onClose={() => setAmbassador(null)}
              onSaved={() => saved('Embaixador salvo.')}
            />
          )}
          {campaign && (
            <CampaignDialog
              row={campaign === 'new' ? undefined : campaign}
              onClose={() => setCampaign(null)}
              onSaved={(row) => {
                setSelected(row.id);
                setCampaignTab('overview');
                saved('Campanha salva.');
              }}
            />
          )}
          {closing && current && (
            <CloseCampaign
              row={current}
              onClose={() => setClosing(false)}
              onSaved={() =>
                saved('Campanha encerrada. As quitações podem ser registradas após a conferência.')
              }
            />
          )}
          {payout && current && (
            <PayoutDialog
              campaign={current}
              total={payout}
              onClose={() => setPayout(null)}
              onSaved={() => saved('Quitação registrada. O saldo de pontos foi zerado.')}
            />
          )}
          {referral && current && (
            <ReferralDialog
              row={referral === 'new' ? undefined : referral}
              campaign={current}
              ambassadors={refs.data.ambassadors}
              contacts={refs.data.contacts}
              onClose={() => setReferral(null)}
              onSaved={() => saved('Indicação salva.')}
            />
          )}
          {adjust && (
            <AdjustDialog
              row={adjust}
              onClose={() => setAdjust(null)}
              onSaved={() => saved('Ajuste registrado com histórico preservado.')}
            />
          )}
          {metric && (
            <MetricDialog
              row={metric === 'new' ? undefined : metric}
              ambassadors={refs.data.ambassadors}
              contacts={refs.data.contacts}
              onClose={() => setMetric(null)}
              onSaved={() => saved('Métrica salva.')}
            />
          )}
        </>
      )}
    </>
  );
}
function AmbassadorDialog({
  row,
  contact,
  onClose,
  onSaved,
}: {
  row?: AmbassadorRow;
  contact?: ContactRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    [form, setForm] = useState({
      contact_id: row?.contact_id || '',
      category: row?.category || '',
      benefits: row?.benefits || '',
      commission_enabled: row?.commission_enabled || false,
      active: row?.active ?? true,
      referral_code: row?.referral_code || '',
    }),
    [contacts, setContacts] = useState(contact ? [contact] : []),
    [adding, setAdding] = useState<string | null>(null);
  return (
    <Modal
      open
      title={row ? 'Editar embaixador' : 'Novo embaixador'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            if (!form.contact_id) throw Error('Selecione um contato.');
            const { contact_id, referral_code, ...values } = form,
              code = referral_code.trim().toUpperCase();
            if (code && !/^[A-Z0-9_-]{3,32}$/.test(code))
              throw Error('O código deve ter de 3 a 32 letras, números, hífen ou sublinhado.');
            if (row)
              await api.patch('ambassadors', row.id, {
                ...values,
                ...(code ? { referral_code: code } : {}),
              });
            else
              await api.create('ambassadors', {
                ...values,
                contact_id,
                ...(code ? { referral_code: code } : {}),
              });
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <RecordPicker
            label="Contato"
            disabled={!!row}
            items={contacts.map((c) => ({ id: c.id, label: c.name, detail: c.phone }))}
            value={form.contact_id ? [form.contact_id] : []}
            onChange={(ids) => setForm({ ...form, contact_id: ids[0] || '' })}
            load={async (search, page) => {
              const r = await api.list('contacts', page, 25, {}, search);
              return {
                ...r,
                rows: r.rows.map((c) => ({ id: c.id, label: c.name, detail: c.phone })),
              };
            }}
            onCreate={row ? undefined : setAdding}
            createLabel="Cadastrar novo contato"
          />
          <label className="form-row">
            Função / categoria
            <Input
              maxLength={80}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </label>
          <label className="form-row">
            Código individual (opcional)
            <Input
              maxLength={32}
              placeholder="Gerado automaticamente"
              value={form.referral_code}
              onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
            />
          </label>
          <label className="form-row">
            Benefícios e observações
            <textarea
              maxLength={5000}
              value={form.benefits}
              onChange={(e) => setForm({ ...form, benefits: e.target.value })}
            />
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              checked={form.commission_enabled}
              onChange={(e) => setForm({ ...form, commission_enabled: e.target.checked })}
            />
            Habilitar comissão nas campanhas
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Embaixador ativo
          </label>
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
      {adding !== null && (
        <ContactDialog
          name={adding}
          onClose={() => setAdding(null)}
          onSaved={(c) => {
            setContacts((old) => [...old, c]);
            setForm({ ...form, contact_id: c.id });
            setAdding(null);
          }}
        />
      )}
    </Modal>
  );
}
function CampaignDialog({
  row,
  onClose,
  onSaved,
}: {
  row?: CampaignRow;
  onClose: () => void;
  onSaved: (row: CampaignRow) => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    [form, setForm] = useState({
      name: row?.name || '',
      starts_on: row?.starts_on || today(),
      ends_on: row?.ends_on || today(),
      payment_mode: row?.payment_mode || 'per_point',
      rate: (
        (row?.payment_mode === 'percentage' ? row.rate_bps : row?.rate_cents || 0) / 100
      ).toFixed(2),
    });
  return (
    <Modal
      open
      title={row ? 'Editar campanha' : 'Nova campanha'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            if (form.ends_on < form.starts_on)
              throw Error('O encerramento precisa ser na data inicial ou depois.');
            const { rate, ...rest } = form,
              n = cents(rate),
              values = {
                ...rest,
                rate_cents: form.payment_mode === 'per_point' ? n : 0,
                rate_bps: form.payment_mode === 'percentage' ? n : 0,
              };
            if (values.rate_bps > 10000) throw Error('O percentual máximo é 100%.');
            onSaved(
              row
                ? await api.patch('campaigns', row.id, values, row.row_version)
                : await api.create('campaigns', values),
            );
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Nome
            <Input
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="form-row">
              Início
              <Input
                type="date"
                required
                value={form.starts_on}
                onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
              />
            </label>
            <label className="form-row">
              Fim
              <Input
                type="date"
                required
                min={form.starts_on}
                value={form.ends_on}
                onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
              />
            </label>
          </div>
          <label className="form-row">
            Regra de comissão
            <select
              value={form.payment_mode}
              onChange={(e) =>
                setForm({ ...form, payment_mode: e.target.value as CampaignRow['payment_mode'] })
              }
            >
              <option value="per_point">Valor por ponto</option>
              <option value="percentage">Percentual das vendas elegíveis</option>
            </select>
          </label>
          <label className="form-row">
            {form.payment_mode === 'per_point' ? 'Valor por ponto (R$)' : 'Percentual (%)'}
            <CurrencyInput
              required
              value={form.rate}
              onValueChange={(rate) => setForm({ ...form, rate })}
            />
          </label>
          <p className="small-note">
            Cada R$ 1.000 completos gera 1 ponto. Os valores elegíveis de cada embaixador são
            somados na campanha. A regra fica congelada no encerramento.
          </p>
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
function CloseCampaign({
  row,
  onClose,
  onSaved,
}: {
  row: CampaignRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    intent = useIntent<{ version: number }>(),
    [confirmed, setConfirmed] = useState(false);
  return (
    <Modal
      open
      title="Encerrar campanha?"
      description={row.name}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            if (!confirmed) throw Error('Confirme a conferência antes de encerrar.');
            const i = intent.capture({ version: row.row_version });
            await api.closeCampaign(row.id, i.payload.version, i.requestId, true);
            onSaved();
          }, true);
        }}
      >
        <p>
          O encerramento congela a regra e os participantes habilitados. Indicações sem pagamento ou
          comparecimento ficam fora da apuração.
        </p>
        <label className="operational-check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            disabled={save.busy || intent.locked}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          Conferi os registros e quero encerrar esta campanha, incluindo eventuais pendências não
          elegíveis.
        </label>
        <SaveActions
          save={save}
          onClose={onClose}
          label={intent.locked ? 'Conferir esta solicitação' : 'Encerrar campanha'}
        />
      </form>
    </Modal>
  );
}
function PayoutDialog({
  campaign,
  total,
  onClose,
  onSaved,
}: {
  campaign: CampaignRow;
  total: CampaignTotals;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    intent = useIntent<{ amount: number; note: string }>(),
    [note, setNote] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  return (
    <Modal
      open
      title="Registrar quitação"
      description={total.ambassador_name + ' · ' + campaign.name}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            if (!confirmed) throw Error('Confirme que o pagamento foi realizado.');
            const i = intent.capture({ amount: total.amount_cents, note });
            await api.recordCampaignPayment(
              campaign.id,
              total.ambassador_id,
              i.payload.amount,
              i.requestId,
              i.payload.note,
            );
            onSaved();
          }, true);
        }}
      >
        <div className="operational-payment-review">
          <strong>{currency(total.amount_cents)}</strong>
          <p>
            {total.points} {total.points === 1 ? 'ponto apurado' : 'pontos apurados'} · Saldo após
            quitação: 0
          </p>
        </div>
        <p>
          Este registro confirma um pagamento realizado fora do CRM. Nenhuma transferência bancária
          será iniciada.
        </p>
        <fieldset className="operational-fields" disabled={save.busy || intent.locked}>
          <label className="form-row">
            Observação / referência
            <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Confirmo que o valor acima foi pago ao embaixador.
          </label>
        </fieldset>
        <SaveActions
          save={save}
          onClose={onClose}
          label={intent.locked ? 'Conferir esta solicitação' : 'Confirmar quitação'}
        />
      </form>
    </Modal>
  );
}
function ReferralDialog({
  row,
  campaign,
  ambassadors,
  contacts,
  onClose,
  onSaved,
}: {
  row?: ReferralRow;
  campaign: CampaignRow;
  ambassadors: AmbassadorRow[];
  contacts: ContactRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    query = useQuery(async () => {
      const full = row ? await api.referralDetails(row.id) : null;
      return {
        full,
        catalog: await api.all('catalog'),
        card: full ? await api.get('cards', full.opportunity_id) : null,
      };
    }, [api, row?.id]);
  return (
    <Modal
      open
      title={row ? 'Editar indicação' : 'Nova indicação'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <QueryState query={query} />
      {query.data && (
        <ReferralFields
          data={query.data}
          campaign={campaign}
          ambassadors={ambassadors}
          contacts={contacts}
          onClose={onClose}
          onSaved={onSaved}
          save={save}
        />
      )}
    </Modal>
  );
}
function ReferralFields({
  data,
  campaign,
  ambassadors,
  contacts,
  onClose,
  onSaved,
  save,
}: {
  data: {
    full: ReferralRow | null;
    catalog: import('../../data/backend').CatalogRow[];
    card: import('../../data/backend').CardRow | null;
  };
  campaign: CampaignRow;
  ambassadors: AmbassadorRow[];
  contacts: ContactRow[];
  onClose: () => void;
  onSaved: () => void;
  save: ReturnType<typeof useSave>;
}) {
  const { api } = useOperational(),
    r = data.full,
    intent = useIntent<Parameters<typeof api.saveReferral>[0]>(),
    [form, setForm] = useState({
      ambassadorId: r?.ambassador_id || '',
      cardId: r?.opportunity_id || '',
      price: ((r?.value_cents || 0) / 100).toFixed(2),
      soldOn: r?.sold_on || today(),
      paid: r?.paid || false,
      attended: r?.attended || false,
      catalogIds: r?.catalog_ids || [],
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run(async () => {
          if (!form.ambassadorId || !form.cardId) throw Error('Selecione o embaixador e o card.');
          const valueCents = cents(form.price);
          if (valueCents <= 0) throw Error('Informe um valor de venda maior que zero.');
          const i = intent.capture({
            campaignId: campaign.id,
            ambassadorId: form.ambassadorId,
            cardId: form.cardId,
            valueCents,
            soldOn: form.soldOn,
            paid: form.paid,
            attended: form.attended,
            catalogIds: [...form.catalogIds],
            requestId: uid(),
            id: r?.id,
            expectedVersion: r?.row_version,
          });
          await api.saveReferral({ ...i.payload, requestId: i.requestId });
          onSaved();
        }, true);
      }}
    >
      <fieldset className="operational-fields" disabled={save.busy || intent.locked}>
        <label className="form-row">
          Embaixador
          <select
            required
            disabled={!!r}
            value={form.ambassadorId}
            onChange={(e) => setForm({ ...form, ambassadorId: e.target.value })}
          >
            <option value="">Selecione</option>
            {ambassadors
              .filter((a) => a.active || a.id === form.ambassadorId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {contacts.find((c) => c.id === a.contact_id)?.name || 'Embaixador'}
                </option>
              ))}
          </select>
        </label>
        <RecordPicker
          label="Card indicado"
          disabled={!!r}
          items={
            data.card
              ? [
                  {
                    id: data.card.id,
                    label: data.card.title || 'Card sem título',
                    detail: currency(data.card.value_cents),
                  },
                ]
              : []
          }
          value={form.cardId ? [form.cardId] : []}
          onChange={(ids) => setForm({ ...form, cardId: ids[0] || '' })}
          load={async (search, page) => {
            const p = await api.list('cards', page, 25, {}, search);
            const people = await api.contactsByIds(p.rows.map((c) => c.contact_id));
            return {
              ...p,
              rows: p.rows.map((c) => ({
                id: c.id,
                label:
                  (people.find((p) => p.id === c.contact_id)?.name || 'Contato') +
                  ' · ' +
                  (c.title || 'Card sem título'),
                detail: currency(c.value_cents),
              })),
            };
          }}
        />
        <div className="form-grid">
          <label className="form-row">
            Valor da venda (R$)
            <CurrencyInput
              required
              value={form.price}
              onValueChange={(price) => setForm({ ...form, price })}
            />
          </label>
          <label className="form-row">
            Data da venda
            <Input
              type="date"
              required
              min={campaign.starts_on}
              max={campaign.ends_on < today() ? campaign.ends_on : today()}
              value={form.soldOn}
              onChange={(e) => setForm({ ...form, soldOn: e.target.value })}
            />
          </label>
        </div>
        <RecordPicker
          label="Serviços e produtos da indicação"
          multiple
          items={data.catalog.map((c) => ({ id: c.id, label: c.name, disabled: !c.active }))}
          value={form.catalogIds}
          onChange={(catalogIds) => setForm({ ...form, catalogIds })}
        />
        <label className="operational-check">
          <input
            type="checkbox"
            checked={form.paid}
            onChange={(e) => setForm({ ...form, paid: e.target.checked })}
          />
          Pagamento recebido e conferido
        </label>
        <label className="operational-check">
          <input
            type="checkbox"
            checked={form.attended}
            onChange={(e) => setForm({ ...form, attended: e.target.checked })}
          />
          Comparecimento confirmado
        </label>
        <p className="small-note">
          Somente vendas pagas e com comparecimento entram nos pontos e na comissão.
        </p>
      </fieldset>
      <SaveActions
        save={save}
        onClose={onClose}
        label={intent.locked ? 'Conferir esta solicitação' : 'Salvar indicação'}
      />
    </form>
  );
}
function AdjustDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ReferralRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    intent = useIntent<{ value: number; cancelled: boolean; reason: string }>(),
    [price, setPrice] = useState((row.refunded_cents / 100).toFixed(2)),
    [cancelled, setCancelled] = useState(row.cancelled),
    [reason, setReason] = useState('');
  return (
    <Modal
      open
      title="Estorno / cancelamento"
      description="O ajuste preserva os registros e as quitações anteriores."
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const value = cents(price);
            if (value > row.value_cents)
              throw Error('O estorno não pode superar o valor da indicação.');
            if (!reason.trim()) throw Error('Informe o motivo do ajuste.');
            const i = intent.capture({ value, cancelled, reason: reason.trim() });
            await api.adjustReferral(
              row.id,
              row.row_version,
              i.payload.value,
              i.payload.cancelled,
              i.payload.reason,
              i.requestId,
            );
            onSaved();
          }, true);
        }}
      >
        <p>
          Valor original: <strong>{currency(row.value_cents)}</strong>. Informe o total acumulado
          estornado nesta indicação.
        </p>
        <fieldset className="operational-fields" disabled={save.busy || intent.locked}>
          <label className="form-row">
            Total estornado (R$)
            <CurrencyInput required value={price} onValueChange={setPrice} />
          </label>
          <label className="operational-check">
            <input
              type="checkbox"
              checked={cancelled}
              onChange={(e) => setCancelled(e.target.checked)}
            />
            Indicação cancelada
          </label>
          <label className="form-row">
            Motivo
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        </fieldset>
        <SaveActions
          save={save}
          onClose={onClose}
          label={intent.locked ? 'Conferir esta solicitação' : 'Registrar ajuste'}
        />
      </form>
    </Modal>
  );
}
function MetricDialog({
  row,
  ambassadors,
  contacts,
  onClose,
  onSaved,
}: {
  row?: MetricRow;
  ambassadors: AmbassadorRow[];
  contacts: ContactRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useOperational(),
    save = useSave(),
    [form, setForm] = useState({
      ambassador_id: row?.ambassador_id || '',
      name: row?.name || '',
      value: String(row?.value || 0),
      unit: row?.unit || '',
      measured_on: row?.measured_on || today(),
    });
  return (
    <Modal
      open
      title={row ? 'Editar métrica manual' : 'Registrar métrica manual'}
      onOpenChange={(v) => !v && !save.busy && onClose()}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save.run(async () => {
            const value = Number(form.value);
            if (!Number.isFinite(value) || value < 0) throw Error('Informe um valor válido.');
            const input = { ...form, value };
            if (row) await api.patch('metrics', row.id, input);
            else await api.create('metrics', input);
            onSaved();
          });
        }}
      >
        <fieldset className="operational-fields" disabled={save.busy || save.uncertain}>
          <label className="form-row">
            Embaixador
            <select
              required
              value={form.ambassador_id}
              onChange={(e) => setForm({ ...form, ambassador_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {ambassadors.map((a) => (
                <option key={a.id} value={a.id}>
                  {contacts.find((c) => c.id === a.contact_id)?.name || 'Embaixador'}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            Nome da métrica
            <Input
              required
              maxLength={80}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <div className="form-grid">
            <label className="form-row">
              Valor
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label className="form-row">
              Unidade
              <Input
                maxLength={30}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>
          </div>
          <label className="form-row">
            Data da medição
            <Input
              required
              type="date"
              max={today()}
              value={form.measured_on}
              onChange={(e) => setForm({ ...form, measured_on: e.target.value })}
            />
          </label>
        </fieldset>
        <SaveActions save={save} onClose={onClose} />
      </form>
    </Modal>
  );
}
