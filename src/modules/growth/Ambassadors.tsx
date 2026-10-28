import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { RecordTitle } from '../../components/RecordTitle';
import { useCrm } from '../../app/context';
import type { Ambassador, AmbassadorCampaign } from '../../domain/types';
import {
  campaignTotals,
  closeCampaign,
  payCampaign,
  saveReferral,
  refundReferral,
} from '../../domain/campaigns';
import { currency, dateLabel, today, uid } from '../../lib/format';
import { Heading, FormActions, FormError } from '../../components/shared';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { ContactPicker } from '../contacts/ContactPicker';
import './growth.css';

export function Ambassadors() {
  const { data, session, update, notice } = useCrm();
  const manager = session.role === 'manager';
  const campaigns = (data.ambassadorCampaigns || []).filter(
    (c) => c.companyId === session.companyId,
  );
  const [selected, setSelected] = useState('');
  const campaign = campaigns.find((c) => c.id === selected) || campaigns[0];
  const [campaignForm, setCampaignForm] = useState<AmbassadorCampaign | null>(null);
  const [person, setPerson] = useState<Ambassador | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [sale, setSale] = useState({
    ambassadorId: '',
    customer: '',
    value: '',
    date: today(),
    paid: false,
    attended: false,
  });
  const [confirm, setConfirm] = useState<{ kind: 'close' | 'pay' | 'cancel'; id: string } | null>(
    null,
  );
  const [refund, setRefund] = useState<{ id: string; value: string } | null>(null);
  const [error, setError] = useState('');
  // Referral amounts and campaign payouts are management-only; consultants cannot inspect colleagues' customers.
  const people = manager ? data.ambassadors.filter((a) => a.companyId === session.companyId) : [];
  const sales = manager
    ? data.ambassadorSales.filter(
        (s) =>
          s.companyId === session.companyId && (campaign ? s.campaignId === campaign.id : false),
      )
    : [];
  const legacy = manager
    ? data.ambassadorSales.filter((s) => s.companyId === session.companyId && !s.campaignId)
    : [];
  function savePerson(e: FormEvent) {
    e.preventDefault();
    if (!manager || !person) return;
    const contact = data.contacts.find(
      (c) => c.id === person.contactId && c.companyId === session.companyId,
    );
    if (!contact) {
      setError('Selecione um contato.');
      return;
    }
    if (people.some((a) => a.id !== person.id && a.contactId === contact.id)) {
      setError('Este contato já é embaixador.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        ambassadors: [
          ...d.ambassadors.filter((a) => a.id !== person.id),
          { ...person, name: contact.name },
        ],
      }))
    )
      setPerson(null);
  }
  function saveCampaign(e: FormEvent) {
    e.preventDefault();
    if (!manager || !campaignForm) return;
    if (
      !campaignForm.name.trim() ||
      campaignForm.end < campaignForm.start ||
      !Number.isFinite(campaignForm.rate) ||
      campaignForm.rate < 0 ||
      (campaignForm.paymentMode === 'percentage' && campaignForm.rate > 100)
    ) {
      setError('Confira nome, período e regra de pagamento.');
      return;
    }
    if (
      update((d) => ({
        ...d,
        ambassadorCampaigns: [
          ...(d.ambassadorCampaigns || []),
          { ...campaignForm, name: campaignForm.name.trim() },
        ],
      }))
    ) {
      setSelected(campaignForm.id);
      setCampaignForm(null);
    }
  }
  function register(e: FormEvent) {
    e.preventDefault();
    if (!manager || !campaign) return;
    if (
      update((d) =>
        saveReferral(d, session, {
          ...sale,
          id: uid(),
          companyId: session.companyId,
          campaignId: campaign.id,
          value: Math.round(Number(sale.value) * 100),
          cancelled: false,
        }),
      )
    )
      setSaleOpen(false);
  }
  function execute() {
    if (!confirm || !campaign) return;
    const ok = update((d) =>
      confirm.kind === 'close'
        ? closeCampaign(d, session, campaign.id)
        : confirm.kind === 'pay'
          ? payCampaign(d, session, campaign.id, confirm.id, uid())
          : refundReferral(d, session, confirm.id, 0, true),
    );
    if (ok) {
      setConfirm(null);
      notice('Registro salvo na demo. Nenhuma transferência bancária foi realizada.');
    }
  }
  if (!manager)
    return (
      <>
        <Heading
          eyebrow="RELACIONAMENTO"
          title="Embaixadores"
          description="Campanhas, indicações e pagamentos são gerenciados pelo gestor."
        />
        <p className="card">Consulte o gestor sobre o programa de embaixadores da empresa.</p>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="RELACIONAMENTO E INDICAÇÕES"
        title="Embaixadores"
        description="Campanhas com pontuação por vendas pagas e comparecimento confirmado."
      >
        <Button
          variant="outline"
          onClick={() => {
            setError('');
            setPerson({
              id: uid(),
              companyId: session.companyId,
              name: '',
              commissionRate: 0,
              active: true,
              reward: '',
              contactId: '',
              category: '',
              commissionEnabled: false,
            });
          }}
        >
          Novo embaixador
        </Button>
        <Button
          onClick={() => {
            setError('');
            setCampaignForm({
              id: uid(),
              companyId: session.companyId,
              name: '',
              start: today(),
              end: today(),
              status: 'active',
              paymentMode: 'per_point',
              rate: 0,
            });
          }}
        >
          Nova campanha
        </Button>
      </Heading>
      <div className="card growth-rule">
        Cada <strong>R$ 1.000 completos = 1 ponto</strong>, somando indicações pagas e com
        comparecimento confirmado. R$ 1.500 = 1 ponto. O encerramento apura a comissão; a
        confirmação de pagamento quita os pontos. Valores e pagamentos desta demo são simulados.
      </div>
      <section className="card campaign-panel">
        <div className="campaign-panel-toolbar">
          <label className="form-row campaign-selector">
            Campanha
            <select value={campaign?.id || ''} onChange={(e) => setSelected(e.target.value)}>
              <option value="" disabled>
                Selecione uma campanha
              </option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.status === 'active' ? 'Em andamento' : 'Encerrada'}
                </option>
              ))}
            </select>
          </label>
          {campaign?.status === 'active' && (
            <>
              <Button
                variant="outline"
                onClick={() => setConfirm({ kind: 'close', id: campaign.id })}
              >
                Encerrar campanha
              </Button>
              <Button
                onClick={() => {
                  setSale({
                    ambassadorId: people.find((a) => a.active)?.id || '',
                    customer: '',
                    value: '',
                    date: today(),
                    paid: false,
                    attended: false,
                  });
                  setSaleOpen(true);
                }}
              >
                Registrar indicação
              </Button>
            </>
          )}
        </div>
        {campaign ? (
          <div className="campaign-meta">
            <span className={'badge ' + (campaign.status === 'active' ? 'good' : 'gray')}>
              {campaign.status === 'active' ? 'Em andamento' : 'Encerrada'}
            </span>
            <p>
              {dateLabel(campaign.start)} a {dateLabel(campaign.end)} ·{' '}
              {campaign.paymentMode === 'per_point'
                ? currency(campaign.rate) + ' por ponto'
                : campaign.rate + '% sobre vendas elegíveis'}{' '}
            </p>
          </div>
        ) : (
          <div className="campaign-empty-state">
            <h2>Organize sua primeira campanha</h2>
            <p>
              Defina o período e a regra de pagamento para acompanhar indicações, pontos e
              comissões. Os participantes e o histórico anterior continuam preservados.
            </p>
            <Button
              onClick={() => {
                setError('');
                setCampaignForm({
                  id: uid(),
                  companyId: session.companyId,
                  name: '',
                  start: today(),
                  end: today(),
                  status: 'active',
                  paymentMode: 'per_point',
                  rate: 0,
                });
              }}
            >
              Criar campanha
            </Button>
          </div>
        )}
        <div className="campaign-participant-title">
          <h2>{campaign ? 'Apuração por participante' : 'Participantes cadastrados'}</h2>
          <span>{people.length} participantes</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Embaixador</th>
                {campaign && (
                  <>
                    <th>Vendas elegíveis</th>
                    <th>Pontos apurados</th>
                    <th>Saldo de pontos</th>
                    <th>Comissão simulada</th>
                  </>
                )}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {people.map((a) => {
                const t = campaign ? campaignTotals(data, campaign, a.id) : null;
                return (
                  <tr key={a.id}>
                    <td>
                      <RecordTitle
                        title={data.contacts.find((c) => c.id === a.contactId)?.name || a.name}
                        onOpen={() => {
                          setError('');
                          setPerson({ ...a });
                        }}
                      />
                      {!a.active ? ' · Inativo' : ''}
                      <small className="growth-note">
                        {a.category || 'Função não informada'}
                        {a.commissionEnabled === false ? ' · Sem comissão' : ''}
                      </small>
                    </td>
                    {campaign && (
                      <>
                        <td>{currency(t?.value || 0)}</td>
                        <td>{t?.points || 0}</td>
                        <td>{t?.remainingPoints || 0}</td>
                        <td>
                          {currency(t?.amount || 0)}
                          {t?.settled && (
                            <small className="growth-note">
                              Pago: {currency(t.paid)}
                              {t.balance < 0
                                ? ' · Ajuste pendente: ' + currency(-t.balance)
                                : ' · Quitado'}
                            </small>
                          )}
                        </td>
                      </>
                    )}
                    <td>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setError('');
                          setPerson({ ...a });
                        }}
                        aria-label="Editar"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                      {campaign?.status === 'closed' && t && !t.settled && t.amount > 0 && (
                        <Button size="sm" onClick={() => setConfirm({ kind: 'pay', id: a.id })}>
                          Confirmar pagamento
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!people.length && (
                <tr>
                  <td colSpan={campaign ? 6 : 2} className="growth-empty">
                    Nenhum embaixador cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {campaign && (
        <section className="card growth-section">
          <div className="toolbar">
            <h2>Indicações da campanha</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente indicado</th>
                  <th>Embaixador</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.customer}
                      <small className="growth-note">{dateLabel(s.date)}</small>
                    </td>
                    <td>{people.find((a) => a.id === s.ambassadorId)?.name}</td>
                    <td>
                      {currency(s.value)}
                      {s.refunded ? ` · Estorno: ${currency(s.refunded)}` : ''}
                    </td>
                    <td>
                      {s.cancelled ? 'Cancelada' : s.paid && s.attended ? 'Elegível' : 'Pendente'}
                      <small className="growth-note">
                        {s.paid ? 'Pago' : 'Pagamento pendente'} ·{' '}
                        {s.attended ? 'Compareceu' : 'Comparecimento pendente'}
                      </small>
                    </td>
                    <td>
                      {!s.cancelled && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirm({ kind: 'cancel', id: s.id })}
                          >
                            Cancelar indicação
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setError('');
                              setRefund({ id: s.id, value: String((s.refunded || 0) / 100) });
                            }}
                          >
                            Devolução / estorno
                          </Button>
                          {campaign?.status === 'active' && (!s.paid || !s.attended) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                update((d) => ({
                                  ...d,
                                  ambassadorSales: d.ambassadorSales.map((x) =>
                                    x.id === s.id ? { ...x, paid: true, attended: true } : x,
                                  ),
                                }));
                              }}
                            >
                              Confirmar pagamento e presença
                            </Button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!sales.length && (
                  <tr>
                    <td colSpan={5}>Nenhuma indicação nesta campanha.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!!legacy.length && (
        <section className="card growth-section">
          <h2>Histórico anterior às campanhas</h2>
          <p className="small-note">
            {legacy.length} indicações preservadas. Não entram nas campanhas novas sem conferência.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente indicado</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {legacy.map((s) => (
                  <tr key={s.id}>
                    <td>{s.customer}</td>
                    <td>{currency(s.value)}</td>
                    <td>
                      <span className={'badge ' + (s.cancelled ? 'gray' : 'good')}>
                        {s.cancelled ? 'Cancelada' : 'Registro anterior'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="card growth-section">
        <h2>Histórico de pagamentos</h2>
        {(() => {
          const payments = (data.ambassadorPayments || []).filter(
            (p) => p.companyId === session.companyId,
          );
          return payments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Embaixador</th>
                    <th>Campanha</th>
                    <th>Pontos</th>
                    <th>Valor pago</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {people.find((a) => a.id === p.ambassadorId)?.name ||
                          'Embaixador não encontrado'}
                      </td>
                      <td>
                        {campaigns.find((c) => c.id === p.campaignId)?.name || 'Campanha anterior'}
                      </td>
                      <td>{p.points}</td>
                      <td>{currency(p.amount)}</td>
                      <td>{dateLabel(p.paidAt.slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small-note">Nenhum pagamento registrado até o momento.</p>
          );
        })()}
      </section>
      <Modal
        open={!!person}
        onOpenChange={(v) => !v && setPerson(null)}
        title={people.some((a) => a.id === person?.id) ? 'Editar embaixador' : 'Novo embaixador'}
      >
        {person && (
          <form onSubmit={savePerson}>
            <ContactPicker
              value={person.contactId || ''}
              onChange={(id) => setPerson({ ...person, contactId: id })}
            />
            <label className="form-row">
              Função no programa
              <Input
                list="ambassador-categories"
                maxLength={80}
                value={person.category || ''}
                onChange={(e) => setPerson({ ...person, category: e.target.value })}
              />
              <datalist id="ambassador-categories">
                <option value="Consultora" />
                <option value="Consolidadora" />
                <option value="Imã" />
              </datalist>
            </label>
            <label className="form-row">
              Benefícios e observações
              <Input
                maxLength={500}
                value={person.reward}
                onChange={(e) => setPerson({ ...person, reward: e.target.value })}
              />
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={person.commissionEnabled !== false}
                onChange={(e) => setPerson({ ...person, commissionEnabled: e.target.checked })}
              />
              Participa da comissão das campanhas
            </label>
            <p>
              Benefícios de acolhimento ou divulgação podem ser diferentes da comissão de vendas. A
              função não altera permissões de acesso ao sistema.
            </p>
            <label className="form-row">
              Situação
              <select
                value={String(person.active)}
                onChange={(e) => setPerson({ ...person, active: e.target.value === 'true' })}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <p>A regra de comissão é definida pelo gestor em cada campanha.</p>
            <FormError message={error} />
            <FormActions onCancel={() => setPerson(null)} />
          </form>
        )}
      </Modal>
      <Modal
        open={!!campaignForm}
        onOpenChange={(v) => !v && setCampaignForm(null)}
        title="Nova campanha"
      >
        {campaignForm && (
          <form onSubmit={saveCampaign}>
            <label className="form-row">
              Nome
              <Input
                required
                maxLength={120}
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
              />
            </label>
            <label className="form-row">
              Início
              <Input
                required
                type="date"
                value={campaignForm.start}
                onChange={(e) => setCampaignForm({ ...campaignForm, start: e.target.value })}
              />
            </label>
            <label className="form-row">
              Encerramento
              <Input
                required
                type="date"
                min={campaignForm.start}
                value={campaignForm.end}
                onChange={(e) => setCampaignForm({ ...campaignForm, end: e.target.value })}
              />
            </label>
            <label className="form-row">
              Regra de pagamento
              <select
                value={campaignForm.paymentMode}
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    paymentMode: e.target.value as AmbassadorCampaign['paymentMode'],
                    rate: 0,
                  })
                }
              >
                <option value="per_point">Valor fixo por ponto</option>
                <option value="percentage">Percentual das vendas elegíveis</option>
              </select>
            </label>
            <label className="form-row">
              {campaignForm.paymentMode === 'per_point' ? 'Valor por ponto (R$)' : 'Comissão (%)'}
              <Input
                type="number"
                required
                min="0"
                max={campaignForm.paymentMode === 'percentage' ? 100 : 1000000}
                step="0.01"
                value={
                  campaignForm.paymentMode === 'per_point'
                    ? campaignForm.rate / 100
                    : campaignForm.rate
                }
                onChange={(e) =>
                  setCampaignForm({
                    ...campaignForm,
                    rate:
                      campaignForm.paymentMode === 'per_point'
                        ? Math.round(Number(e.target.value) * 100)
                        : Number(e.target.value),
                  })
                }
              />
            </label>
            <FormError message={error} />
            <FormActions onCancel={() => setCampaignForm(null)} />
          </form>
        )}
      </Modal>
      <Modal open={saleOpen} onOpenChange={setSaleOpen} title="Registrar indicação">
        <form onSubmit={register}>
          <label className="form-row">
            Embaixador
            <select
              required
              value={sale.ambassadorId}
              onChange={(e) => setSale({ ...sale, ambassadorId: e.target.value })}
            >
              <option value="">Selecione</option>
              {people
                .filter((a) => a.active)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="form-row">
            Cliente indicado
            <Input
              required
              maxLength={120}
              value={sale.customer}
              onChange={(e) => setSale({ ...sale, customer: e.target.value })}
            />
          </label>
          <label className="form-row">
            Valor (R$)
            <Input
              required
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              value={sale.value}
              onChange={(e) => setSale({ ...sale, value: e.target.value })}
            />
          </label>
          <label className="form-row">
            Data
            <Input
              required
              type="date"
              min={campaign?.start}
              max={campaign?.end}
              value={sale.date}
              onChange={(e) => setSale({ ...sale, date: e.target.value })}
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={sale.paid}
              onChange={(e) => setSale({ ...sale, paid: e.target.checked })}
            />
            Pagamento recebido
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={sale.attended}
              onChange={(e) => setSale({ ...sale, attended: e.target.checked })}
            />
            Comparecimento confirmado
          </label>
          <FormActions onCancel={() => setSaleOpen(false)} label="Registrar indicação" />
        </form>
      </Modal>
      <Modal
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={
          confirm?.kind === 'close'
            ? 'Encerrar campanha?'
            : confirm?.kind === 'pay'
              ? 'Confirmar pagamento?'
              : 'Cancelar indicação?'
        }
      >
        <p>
          {confirm?.kind === 'close'
            ? 'O encerramento bloqueia novas indicações e permite quitar as comissões. Confira pagamentos e presenças antes de continuar.'
            : confirm?.kind === 'pay'
              ? 'Confirme somente após realizar o pagamento. Os pontos serão quitados e o histórico preservado. Esta demo não transfere dinheiro.'
              : 'A indicação deixará de pontuar. Um pagamento anterior será mantido no histórico e eventual diferença aparecerá como ajuste pendente.'}
        </p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setConfirm(null)}>
            Voltar
          </Button>
          <Button onClick={execute}>Confirmar</Button>
        </div>
      </Modal>
      <Modal
        open={!!refund}
        onOpenChange={(v) => !v && setRefund(null)}
        title="Devolução / estorno"
      >
        {refund && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (
                update((d) =>
                  refundReferral(d, session, refund.id, Math.round(Number(refund.value) * 100)),
                )
              )
                setRefund(null);
            }}
          >
            <label className="form-row">
              Total devolvido desta venda (R$)
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                max={(data.ambassadorSales.find((s) => s.id === refund.id)?.value || 0) / 100}
                value={refund.value}
                onChange={(e) => setRefund({ ...refund, value: e.target.value })}
              />
            </label>
            <p>
              O total elegível e os pontos serão recalculados. Pagamentos anteriores permanecem
              registrados.
            </p>
            <FormActions onCancel={() => setRefund(null)} />
          </form>
        )}
      </Modal>
    </>
  );
}
