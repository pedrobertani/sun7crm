import '../growth/growth.css';
import { RecordTitle } from '../../components/RecordTitle';
import { dateLabel } from '../../lib/format';
import { useState } from 'react';
import { History } from 'lucide-react';
import { useCrm } from '../../app/context';
import { DemoContactHistory } from '../contacts/ContactHistory';
import { recordWhatsappOpen } from '../../domain/contact-history';
import { WhatsAppButton } from '../../components/WhatsAppButton';
import { Button } from '../../components/ui/button';
import { Heading, SearchInput } from '../../components/shared';
import { demoActivityReport, idleDays, type ActivityRow, type ActorActivity } from './activity';
export function activityDate(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateLabel(value);
  return value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(value))
    : 'Sem registro';
}
export function ActivityReportView({
  rows,
  actors,
  onHistory,
  onWhatsapp,
  canWhatsapp = true,
}: {
  rows: ActivityRow[];
  actors: ActorActivity[];
  onHistory: (row: ActivityRow) => void;
  onWhatsapp: (row: ActivityRow) => void;
  canWhatsapp?: boolean;
}) {
  const [query, setQuery] = useState(''),
    [owner, setOwner] = useState(''),
    [days, setDays] = useState('7');
  const owners = Array.from(new Map(rows.map((r) => [r.ownerId, r.ownerName])).entries());
  const shown = rows
    .filter(
      (r) =>
        (!owner || r.ownerId === owner) &&
        (!days || idleDays(r) >= Number(days)) &&
        (r.name + ' ' + r.phone).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => idleDays(b) - idleDays(a) || a.name.localeCompare(b.name));
  return (
    <>
      <div className="growth-summary activity-kpis">
        <div className="card">
          <span>Clientes na carteira</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="card">
          <span>Sem atividade há 7 dias ou mais</span>
          <strong>{rows.filter((r) => idleDays(r) >= 7).length}</strong>
        </div>
        <div className="card">
          <span>WhatsApp acionado · últimos 30 dias</span>
          <strong>{actors.reduce((n, a) => n + a.whatsappCount, 0)}</strong>
        </div>
      </div>
      <section className="card">
        <div className="toolbar activity-toolbar">
          <SearchInput value={query} onChange={setQuery} placeholder="Buscar cliente ou telefone" />
          <label>
            Responsável
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Toda a equipe</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sem atividade há
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">Todos os clientes</option>
              {[3, 7, 15, 30].map((d) => (
                <option key={d} value={d}>
                  {d} dias ou mais
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="activity-description">
          <strong>{shown.length} clientes encontrados</strong>
          <p>
            Tempo desde o último registro no CRM ou, se não houver registros, desde o cadastro. Os
            contadores por cliente mostram todo o histórico disponível.
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente / responsável atual</th>
                <th>Última atividade</th>
                <th>Tempo sem atividade</th>
                <th>Último WhatsApp acionado</th>
                <th>Registros</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.contactId}>
                  <td>
                    <RecordTitle
                      title={r.name}
                      label={'Abrir histórico de ' + r.name}
                      onOpen={() => onHistory(r)}
                    />
                    <small className="growth-note">{r.ownerName}</small>
                  </td>
                  <td>
                    {activityDate(r.lastActivityAt)}
                    {!r.lastActivityAt && (
                      <small className="growth-note">Cadastro em {activityDate(r.createdAt)}</small>
                    )}
                  </td>
                  <td>
                    <span className={'badge ' + (idleDays(r) >= 7 ? 'warning' : 'gray')}>
                      {idleDays(r) === 0
                        ? 'Hoje'
                        : idleDays(r) + (idleDays(r) === 1 ? ' dia' : ' dias')}
                    </span>
                  </td>
                  <td>{activityDate(r.lastWhatsappAt)}</td>
                  <td>
                    <small className="growth-note">
                      {r.whatsappCount} WhatsApp · {r.movementCount} movimentos · {r.noteCount}{' '}
                      anotações
                    </small>
                  </td>
                  <td>
                    <div className="actions">
                      <WhatsAppButton
                        disabled={!canWhatsapp}
                        phone={r.phone}
                        name={r.name}
                        compact
                        onOpen={() => onWhatsapp(r)}
                      />
                      <Button size="sm" variant="outline" onClick={() => onHistory(r)}>
                        <History size={15} />
                        Histórico
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={6} className="growth-empty">
                    Nenhum cliente neste filtro. Ajuste o responsável ou o tempo sem atividade.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card growth-section">
        <div className="toolbar">
          <div>
            <h2>Atuação registrada por colaborador</h2>
            <p className="muted">Últimos 30 dias · atribuição a quem realizou cada ação</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Clientes com atividade</th>
                <th>WhatsApp acionado</th>
                <th>Movimentações</th>
                <th>Anotações</th>
                <th>Total de registros</th>
                <th>Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {actors.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.contactsCount}</td>
                  <td>{a.whatsappCount}</td>
                  <td>{a.movementCount}</td>
                  <td>{a.noteCount}</td>
                  <td>{a.total}</td>
                  <td>{activityDate(a.lastActivityAt)}</td>
                </tr>
              ))}
              {!actors.length && (
                <tr>
                  <td colSpan={7} className="growth-empty">
                    As novas atividades da equipe aparecerão aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small-note">
        O relatório mede registros no CRM. Acionar o WhatsApp não confirma envio, resposta ou
        atendimento. Atividades anteriores sem registro não são estimadas.
      </p>
    </>
  );
}
export function DemoActivityReport() {
  const { data, session, update } = useCrm();
  const [historyId, setHistoryId] = useState('');
  if (session.role !== 'manager')
    return (
      <Heading
        eyebrow="ACOMPANHAMENTO"
        title="Relatórios"
        description="Esta visão é exclusiva do gestor."
      />
    );
  const report = demoActivityReport(data, session);
  return (
    <>
      <Heading
        eyebrow="ACOMPANHAMENTO DA EQUIPE"
        title="Relatórios de atividade"
        description="Veja a carteira sem movimentação, o uso do WhatsApp e quem está registrando atividades."
      />
      <ActivityReportView
        {...report}
        onHistory={(r) => setHistoryId(r.contactId)}
        onWhatsapp={(r) => {
          update((d) => recordWhatsappOpen(d, session, r.contactId));
        }}
      />
      {historyId && <DemoContactHistory contactId={historyId} onClose={() => setHistoryId('')} />}
    </>
  );
}
