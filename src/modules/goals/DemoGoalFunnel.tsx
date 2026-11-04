import { ViewSwitcher } from '../../components/ui/view-switcher';
import { useState } from 'react';
import { LockKeyhole, Settings2, Trophy, Trash2 } from 'lucide-react';
import { useCrm } from '../../app/context';
import { today, currency } from '../../lib/format';
import { CHART_COLORS } from '../../lib/themes';
import { Panel } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CurrencyInput } from '../../components/currency-input';
import { Modal } from '../../components/ui/modal';
import type { DemoGoalPlan, DemoEmployeeGoal } from '../../domain/types';
import {
  buildGoalFunnel,
  medalUnlocked,
  medalSymbol,
  medalRewardLabel,
  medalRewardDescription,
  isManualGoalFunnel,
  manualGoalStages,
  prepareGoalStages,
  validateGoalConfig,
  numberInputToCents,
  starterStages,
  starterMedals,
} from './model';
import type { GoalStep, GoalMedal } from './model';
import { MedalEditor } from './MedalEditor';
import './goals.css';

const fmt = (v: number | null) => (v === null ? 'A definir' : v.toLocaleString('pt-BR'));
export function DemoGoalFunnel({ view = 'commercial' }: { view?: 'commercial' | 'medals' }) {
  const { data, session, update, notice } = useCrm();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [open, setOpen] = useState(false);
  const manager = session.role === 'manager';
  const plan = data.goalPlans?.find((p) => p.companyId === session.companyId && p.month === month);
  const team = data.members.filter(
    (m) => m.companyId === session.companyId && ['seller', 'manager'].includes(m.role),
  );
  const confirmed = data.opportunities.filter(
    (o) => o.companyId === session.companyId && o.confirmedSaleAt?.slice(0, 7) === month,
  );
  const employeeGoal = (memberId: string) =>
    data.employeeGoals?.find(
      (g) => g.companyId === session.companyId && g.memberId === memberId && g.month === month,
    )?.goalCents || 0;
  const progress = (memberId: string) => {
    const sales = confirmed.filter((o) => o.confirmedSaleOwnerId === memberId);
    return {
      sales_count: sales.length,
      sales_cents: sales.reduce((v, o) => v + (o.confirmedSaleCents || 0), 0),
      goal_cents: employeeGoal(memberId),
    };
  };
  const mine = progress(session.memberId);
  const recorded = confirmed.reduce((v, o) => v + (o.confirmedSaleCents || 0), 0);
  const manual = !!plan && isManualGoalFunnel(plan.stages);
  const funnel = plan
    ? buildGoalFunnel({
        target_cents: plan.targetCents,
        ticket_cents: plan.ticketCents,
        stages: plan.stages,
      })
    : [];
  return (
    <div className="goal-area" data-demo="true" data-view={view}>
      <Panel
        title={view === 'medals' ? 'Conquistas e medalhas' : 'Funil de metas'}
        description="Dados fictícios da demonstração — configure metas e conquistas como um gestor."
      >
        <div className="goal-head">
          <label className="form-row">
            Competência{' '}
            <Input
              type="month"
              aria-label="Competência das metas"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          {manager && (
            <Button variant="outline" type="button" onClick={() => setOpen(true)}>
              <Settings2 size={16} /> {view === 'medals' ? 'Configurar medalhas' : 'Configurar metas'}
            </Button>
          )}
        </div>
        {plan ? (
          <>
            {manager && (
              <div className="goal-indicators">
                <div>
                  <small>Meta mensal</small>
                  <strong>{currency(plan.targetCents)}</strong>
                </div>
                <div>
                  <small>Ticket médio</small>
                  <strong>{currency(plan.ticketCents)}</strong>
                </div>
                <div>
                  <small>Vendas necessárias</small>
                  <strong>{fmt(Math.ceil(plan.targetCents / plan.ticketCents))}</strong>
                </div>
                <div>
                  <small>Vendas confirmadas · demo</small>
                  <strong>{manager ? confirmed.length : mine.sales_count}</strong>
                </div>
              </div>
            )}
            {manager && (
              <div
                className="goal-funnel"
                role="img"
                aria-label={funnel.map((s) => s.label + ': ' + fmt(s.count)).join('; ')}
              >
                {funnel.map((s, i) => (
                  <div
                    key={i}
                    className="goal-step"
                    style={{
                      width: `${100 - (i / funnel.length) * 39}%`,
                      background: `color-mix(in srgb, ${CHART_COLORS[i % CHART_COLORS.length]} 38%,var(--surface))`,
                      borderLeft: `5px solid ${CHART_COLORS[i % CHART_COLORS.length]}`,
                    }}
                  >
                    <span>
                      <strong>{s.label}</strong>
                      <small>{i ? (s.rate === null ? 'Taxa a definir' : Number(s.rate.toFixed(2)).toLocaleString('pt-BR') + '%') + (manual ? ' · meta definida' : ' · projetado') : (manual ? 'Meta definida · entrada' : 'Entrada projetada')}</small>
                    </span>
                    <b>{fmt(s.count)}</b>
                  </div>
                ))}
              </div>
            )}
            {manager && manual && funnel.at(-1)?.count !== Math.ceil(plan.targetCents / plan.ticketCents) && (
              <p className="small-note">
                Meta manual de vendas ({fmt(funnel.at(-1)?.count ?? null)}) diferente da projeção
                financeira ({fmt(Math.ceil(plan.targetCents / plan.ticketCents))}).
              </p>
            )}
            <div className="goal-total">
              <span>
                {manager
                  ? 'Faturamento comercial confirmado · exemplo'
                  : 'Seu desempenho confirmado · exemplo'}
              </span>
              <strong>
                {currency(manager ? recorded : mine.sales_cents)} de{' '}
                {currency(manager ? plan.targetCents : mine.goal_cents)}
              </strong>
              <div className="goal-progress">
                <i
                  style={{
                    width:
                      Math.min(
                        100,
                        Math.round(
                          (manager
                            ? recorded / plan.targetCents
                            : mine.goal_cents
                              ? mine.sales_cents / mine.goal_cents
                              : 0) * 100,
                        ),
                      ) + '%',
                  }}
                />
              </div>
              <small>
                Exemplo de vendas confirmadas manualmente no Kanban; não representa dinheiro
                recebido.
              </small>
            </div>
            <div className="goal-medals">
              <h3>
                <Trophy size={17} /> Conquistas e medalhas
              </h3>
              {(manager ? team : team.filter((m) => m.id === session.memberId)).map((m) => (
                <div key={m.id} className="goal-medal-person">
                  <strong>
                    {m.name}
                    {!m.active ? ' · Inativo' : ''}
                  </strong>
                  <div className="goal-medal-grid">
                    {plan.medals.map((medal, i) => {
                      const earned = medalUnlocked(medal, progress(m.id));
                      return (
                        <div className={'goal-medal' + (earned ? ' earned' : '')} key={i}>
                          <span className="goal-medal-icon" aria-hidden="true">
                            {medalSymbol(medal)}
                          </span>
                          {!earned && <LockKeyhole size={15} aria-label="Bloqueada" />}
                          <strong>{medal.label}</strong>
                          <small>
                            {earned
                              ? 'Desbloqueada'
                              : medal.kind === 'sales'
                                ? medal.threshold + ' venda(s)'
                                : medal.threshold + '% da meta'}
                          </small>
                          {medalRewardLabel(medal) && (
                            <small className="goal-medal-reward">{medalRewardLabel(medal)}</small>
                          )}
                          {medalRewardDescription(medal) && (
                            <small className="goal-medal-reward-description">{medalRewardDescription(medal)}</small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="goal-empty">
            <strong>Sem meta configurada neste mês</strong>
            <p>O gestor poderá definir as taxas, metas e medalhas para esta competência.</p>
          </div>
        )}
      </Panel>
      {open && manager && (
        <DemoGoalSettings
          initialSection={view === 'medals' ? 'medals' : 'plan'}
          key={session.companyId + month}
          month={month}
          plan={plan}
          members={team}
          individual={
            data.employeeGoals?.filter(
              (g) => g.companyId === session.companyId && g.month === month,
            ) || []
          }
          onClose={() => setOpen(false)}
          onSave={(config, goals) => {
            const done = update((d) => ({
              ...d,
              goalPlans: [
                ...(d.goalPlans || []).filter(
                  (p) => p.companyId !== session.companyId || p.month !== month,
                ),
                config,
              ],
              employeeGoals: [
                ...(d.employeeGoals || []).filter(
                  (g) => g.companyId !== session.companyId || g.month !== month,
                ),
                ...goals,
              ],
            }));
            if (done) {
              setOpen(false);
              notice('Metas e medalhas fictícias atualizadas.');
            }
          }}
        />
      )}
    </div>
  );
}
function DemoGoalSettings({
  initialSection,
  month,
  plan,
  members,
  individual,
  onClose,
  onSave,
}: {
  initialSection: 'plan' | 'medals';
  month: string;
  plan?: DemoGoalPlan;
  members: { id: string; name: string; role: string }[];
  individual: DemoEmployeeGoal[];
  onClose: () => void;
  onSave: (plan: DemoGoalPlan, goals: DemoEmployeeGoal[]) => void;
}) {
  const { session, notice } = useCrm();
  const [tab, setTab] = useState<'plan' | 'medals' | 'employees'>(initialSection);
  const [target, setTarget] = useState(((plan?.targetCents || 0) / 100).toFixed(2));
  const [ticket, setTicket] = useState(((plan?.ticketCents || 0) / 100).toFixed(2));
  const [stages, setStages] = useState<GoalStep[]>(
    plan?.stages.map((x) => ({ ...x })) || starterStages.map((x) => ({ ...x })),
  );
  const [medals, setMedals] = useState<GoalMedal[]>(
    plan?.medals.map((x) => ({ ...x })) || starterMedals.map((x) => ({ ...x })),
  );
  const [goals, setGoals] = useState<Record<string, string>>(
    Object.fromEntries(
      members.map((m) => [
        m.id,
        ((individual.find((g) => g.memberId === m.id)?.goalCents || 0) / 100).toFixed(2),
      ]),
    ),
  );
  const changeStage = (index: number, part: Partial<GoalStep>) =>
    setStages((s) => s.map((x, i) => (i === index ? { ...x, ...part } : x)));
  const changeMedal = (index: number, part: Partial<GoalMedal>) =>
    setMedals((s) => s.map((x, i) => (i === index ? { ...x, ...part } : x)));
  const save = () => {
    const targetCents = numberInputToCents(target),
      ticketCents = numberInputToCents(ticket);
    const err = validateGoalConfig(targetCents || 0, ticketCents || 0, stages, medals);
    if (err) {
      notice(err);
      return;
    }
    const parsed = members.map((m) => ({
      memberId: m.id,
      goalCents: goals[m.id] ? numberInputToCents(goals[m.id]) : null,
    }));
    if (parsed.some((x) => goals[x.memberId] && x.goalCents === null)) {
      notice('Confira os valores das metas individuais.');
      return;
    }
    onSave(
      {
        companyId: session.companyId,
        month,
        targetCents: targetCents!,
        ticketCents: ticketCents!,
        stages: prepareGoalStages(stages),
        medals,
      },
      parsed
        .filter((x) => x.goalCents !== null && x.goalCents > 0)
        .map((x) => ({
          companyId: session.companyId,
          month,
          memberId: x.memberId,
          goalCents: x.goalCents!,
        })),
    );
  };
  return (
    <Modal
      open
      title={'Configurar metas · ' + month}
      size="wide"
      description="Prévia fictícia: as alterações ficam neste navegador."
      onOpenChange={(v) => !v && onClose()}
    >
      <ViewSwitcher
        label="Configuração de metas"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'plan', label: 'Funil e metas' },
          { value: 'medals', label: 'Medalhas' },
          { value: 'employees', label: 'Colaboradores' },
        ]}
      />
      {tab === 'plan' && (
        <div className="goal-edit-list">
          <div className="goal-edit-grid">
            <label className="form-row">
              Meta mensal (R$)
              <CurrencyInput value={target} onValueChange={setTarget} />
            </label>
            <label className="form-row">
              Ticket médio (R$)
              <CurrencyInput value={ticket} onValueChange={setTicket} />
            </label>
          </div>
          <p className="small-note">
            Projete por taxas ou defina a quantidade-meta de todas as etapas, inclusive contatos.
            O gestor escolhe; os números não representam resultados realizados.
          </p>
          <label className="form-row goal-mode-control">
            Como definir as quantidades?
            <select
              value={isManualGoalFunnel(stages) ? 'manual' : 'calculated'}
              onChange={(event) => {
                if (event.target.value === 'manual') {
                  setStages((current) => manualGoalStages(
                    current,
                    numberInputToCents(target) ?? 0,
                    numberInputToCents(ticket) ?? 0,
                  ));
                } else {
                  setStages((current) => current.map(({ count: _count, ...step }) => step));
                }
              }}
            >
              <option value="calculated">Projetar pelas taxas</option>
              <option value="manual">Definir metas por quantidade</option>
            </select>
          </label>
          {stages.map((s, i) => (
            <div className="goal-edit-step" key={i}>
              <label className="form-row">
                Etapa {i + 1}
                <Input
                  value={s.label}
                  maxLength={50}
                  disabled={i === stages.length - 1}
                  onChange={(e) => changeStage(i, { label: e.target.value })}
                />
              </label>
              {isManualGoalFunnel(stages) ? (
                <label className="form-row">
                  {i === 0 ? 'Meta de contatos' : 'Quantidade-meta'}
                  <Input
                    type="number"
                    min="1"
                    max="1000000000"
                    step="1"
                    value={s.count ?? ''}
                    placeholder="Definir"
                    onChange={(event) => changeStage(i, {
                      count: event.target.value === '' ? null : Number(event.target.value),
                    })}
                  />
                </label>
              ) : i > 0 && (
                <label className="form-row">
                  Conversão (%)
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={s.rate ?? ''}
                    onChange={(e) =>
                      changeStage(i, { rate: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </label>
              )}
              {i > 0 && i < stages.length - 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={'Remover etapa ' + s.label}
                  onClick={() => setStages((x) => x.filter((_, j) => j !== i))}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          ))}
          {stages.length < 8 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setStages((a) => [
                  ...a.slice(0, -1),
                  { label: 'Nova etapa', rate: null, ...(isManualGoalFunnel(a) ? { count: null } : {}) },
                  a[a.length - 1],
                ])
              }
            >
              Adicionar etapa
            </Button>
          )}
        </div>
      )}
      {tab === 'medals' && (
        <div className="goal-edit-list">
          <p className="small-note">
            Configure a premiação de cada medalha. O desbloqueio considera vendas confirmadas no Kanban; não representa prêmio entregue.
          </p>
          {medals.map((m, i) => (
            <MedalEditor
              key={i}
              medal={m}
              onChange={(part) => changeMedal(i, part)}
              onRemove={() => setMedals((x) => x.filter((_, j) => j !== i))}
            />
          ))}
          {medals.length < 8 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setMedals((x) => [
                  ...x,
                  { label: 'Nova medalha', kind: 'percent', threshold: 100, icon: 'trophy' },
                ])
              }
            >
              Adicionar medalha
            </Button>
          )}
        </div>
      )}
      {tab === 'employees' && (
        <div className="goal-edit-list">
          <p className="small-note">
            O gestor configura somente as metas; as vendas são confirmadas nos cards.
          </p>
          {members.map((m) => (
            <label className="form-row" key={m.id}>
              {m.name} · Meta individual (R$)
              <CurrencyInput
                value={goals[m.id] || ''}
                onValueChange={(v) => setGoals((g) => ({ ...g, [m.id]: v }))}
              />
            </label>
          ))}
        </div>
      )}
      <div className="goal-edit-actions">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={save}>
          Salvar configurações
        </Button>
      </div>
    </Modal>
  );
}
