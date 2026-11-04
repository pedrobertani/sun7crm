export interface GoalStep {
  label: string;
  /** Taxa de conversão para esta etapa. Em modo manual, é derivada das quantidades. */
  rate: number | null;
  /** Quantidade-meta definida pelo gestor. Ausente quando a etapa é projetada por taxas. */
  count?: number | null;
  /** Informado somente na etapa de contatos ao projetar de cima para baixo por taxas. */
  start_contacts?: number | null;
}
export type MedalReward =
  | { kind: 'money'; amount_cents: number; description?: string }
  | { kind: 'prize'; name: string; description?: string };
export interface GoalMedal {
  label: string;
  kind: 'sales' | 'percent';
  threshold: number;
  icon?: MedalIcon;
  /** Premiação opcional; conquistar a medalha não registra entrega nem pagamento. */
  reward?: MedalReward;
}
export const medalIcons = {bronze:'🥉',silver:'🥈',gold:'🥇',trophy:'🏆',diamond:'💎',crown:'👑',fire:'🔥',star:'⭐',rocket:'🚀'} as const;
export type MedalIcon = keyof typeof medalIcons;
export function medalSymbol(medal:GoalMedal){return medalIcons[medal.icon||'trophy']||medalIcons.trophy;}
export function medalRewardLabel(medal: GoalMedal): string | null {
  if (!medal.reward) return null;
  if (medal.reward.kind === 'prize') return 'Prêmio: ' + medal.reward.name.trim();
  return 'Prêmio: ' + new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(medal.reward.amount_cents / 100);
}
export function medalRewardDescription(medal: GoalMedal): string | null {
  return medal.reward?.description?.trim() || null;
}
export interface GoalPlan {
  company_id: string;
  goal_month: string;
  target_cents: number;
  ticket_cents: number;
  stages: GoalStep[];
  medals: GoalMedal[];
}
export interface GoalEmployeeProgress {
  company_id: string;
  goal_month: string;
  membership_id: string;
  goal_cents: number;
  sales_cents: number;
  sales_count: number;
  contacts_count: number;
}
/** Initial editable template: rates are intentionally unset until the manager provides them. */
export const starterStages: GoalStep[] = [
  {label:'Contatos',rate:null},
  {label:'Agendamentos',rate:null},
  {label:'Comparecimentos',rate:null},
  {label:'Vendas',rate:null},
];
export const starterMedals: GoalMedal[] = [
  {label:'Primeira venda',kind:'sales',threshold:1,icon:'bronze'},
  {label:'Metade da meta',kind:'percent',threshold:50,icon:'silver'},
  {label:'Meta alcançada',kind:'percent',threshold:100,icon:'gold'},
];
function positiveInteger(value: number) {
  return Number.isSafeInteger(value) && value > 0;
}
function validRewardDescription(description: string | undefined) {
  return description === undefined ||
    (typeof description === 'string' && description.length <= 200);
}
export function validMedalReward(reward: MedalReward | undefined): boolean {
  if (reward === undefined) return true; // Medalhas existentes continuam válidas.
  if (!validRewardDescription(reward.description)) return false;
  if (reward.kind === 'money')
    return Number.isSafeInteger(reward.amount_cents) &&
      reward.amount_cents > 0 && reward.amount_cents <= 100000000;
  if (reward.kind === 'prize')
    return typeof reward.name === 'string' &&
      reward.name.trim().length > 0 && reward.name.length <= 100;
  return false;
}

/** Quantidades são opcionalmente manuais, mas neste modo todas as etapas precisam ser definidas. */
export function isManualGoalFunnel(stages: GoalStep[]): boolean {
  return stages.some((stage) => stage.count !== undefined);
}
/** O gestor informa a entrada do funil e conserva as taxas de conversão editáveis. */
export function isContactsGoalFunnel(stages: GoalStep[]): boolean {
  return !isManualGoalFunnel(stages) && stages[0]?.start_contacts !== undefined;
}
export type GoalFunnelMode = 'calculated' | 'contacts' | 'manual';
export function goalFunnelMode(stages: GoalStep[]): GoalFunnelMode {
  return isManualGoalFunnel(stages) ? 'manual' : isContactsGoalFunnel(stages) ? 'contacts' : 'calculated';
}

function validGoalCount(count: number | null | undefined): count is number {
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 && count <= 1000000000;
}

/** Salva taxas derivadas das quantidades para preservar o contrato já utilizado pelo banco. */
export function prepareGoalStages(stages: GoalStep[]): GoalStep[] {
  if (!isManualGoalFunnel(stages)) return stages.map(({ count: _count, ...stage }) => stage);
  return stages.map((stage, index) => ({
    label: stage.label,
    count: stage.count,
    rate: index === 0 ? null :
      validGoalCount(stage.count) && validGoalCount(stages[index - 1].count)
        ? (stage.count / stages[index - 1].count!) * 100
        : null,
  }));
}

/** Sugere quantidades já projetadas ao trocar de modo, sem impor valores não estimados. */
export function manualGoalStages(
  stages: GoalStep[],
  targetCents: number,
  ticketCents: number,
): GoalStep[] {
  const projected = buildGoalFunnel({
    stages: stages.map(({ count: _count, ...stage }) => stage),
    target_cents: targetCents,
    ticket_cents: ticketCents,
  });
  return stages.map(({ start_contacts: _start, ...stage }, index) => ({
    ...stage,
    count: projected[index]?.count ?? null,
  }));
}
/** Trocar modos preserva taxas, e converte a configuração manual em taxas atualizadas. */
export function changeGoalFunnelMode(
  stages: GoalStep[],
  mode: GoalFunnelMode,
  targetCents: number,
  ticketCents: number,
): GoalStep[] {
  if (mode === goalFunnelMode(stages)) return stages;
  if (mode === 'manual') return manualGoalStages(stages, targetCents, ticketCents);

  const rates = prepareGoalStages(stages).map(({ count: _count, start_contacts: _start, ...stage }) => stage);
  if (mode === 'calculated') return rates;
  const firstCount = isManualGoalFunnel(stages)
    ? stages[0]?.count
    : buildGoalFunnel({ stages: rates, target_cents: targetCents, ticket_cents: ticketCents })[0]?.count;
  return rates.map((stage, index) =>
    index === 0 ? { ...stage, start_contacts: firstCount ?? null } : stage);

}
export function validateGoalConfig(targetCents:number,ticketCents:number,stages:GoalStep[],medals:GoalMedal[]):string|null {
  if(!positiveInteger(targetCents)||!positiveInteger(ticketCents)||targetCents>1e12||ticketCents>1e12)
    return 'Informe meta e ticket médio válidos, maiores que zero.';
  if(stages.length<2||stages.length>8||stages.at(-1)?.label.trim().toLocaleLowerCase('pt-BR')!=='vendas')
    return 'Mantenha entre 2 e 8 etapas, terminando em Vendas.';
  if (stages.some((s) => !s.label.trim() || s.label.length > 50))
    return 'Informe nomes válidos para todas as etapas do funil.';
  if (isManualGoalFunnel(stages)) {
    if (stages.some((s) => s.start_contacts !== undefined))
      return 'Escolha apenas um modo: contatos iniciais ou quantidades por etapa.';
    if (stages.some((s) => !validGoalCount(s.count)))
      return 'Defina uma quantidade inteira maior que zero para todas as etapas, inclusive contatos.';
    if (stages.some((s, index) => index > 0 && s.count! > stages[index - 1].count!))
      return 'No funil manual, a quantidade de cada etapa não pode superar a etapa anterior.';
  } else {
    if (stages.some((s, i) => i > 0 && s.start_contacts !== undefined))
      return 'Informe os contatos iniciais somente na primeira etapa.';
    if (isContactsGoalFunnel(stages) && !validGoalCount(stages[0].start_contacts))
      return 'Informe uma quantidade inicial de contatos válida (de 1 a 1 bilhão).';
    if (stages.some((s,i) => i===0
      ? s.rate!==null
      : s.rate===null || !Number.isFinite(s.rate) || s.rate<=0 || s.rate>100))
      return 'Informe todas as taxas de passagem (acima de 0% até 100%).';
  }
  if(medals.length>8||medals.some(m=>!m.label.trim()||m.label.length>60||
    !['sales','percent'].includes(m.kind)||(m.icon!==undefined&&!(m.icon in medalIcons))||!positiveInteger(m.threshold)||m.threshold>1000))
    return 'Revise os critérios de medalhas (de 1 a 1000).';
  if (medals.some((m) => !validMedalReward(m.reward)))
    return 'Revise a premiação das medalhas: informe valor maior que zero ou descrição do prêmio.';
  return null;
}
export function buildGoalFunnel(plan:Pick<GoalPlan,'target_cents'|'ticket_cents'|'stages'>) {
  if (isManualGoalFunnel(plan.stages)) {
    return prepareGoalStages(plan.stages).map((step) => ({
      ...step,
      count: validGoalCount(step.count) ? step.count : null,
    }));
  }
  if (isContactsGoalFunnel(plan.stages)) {
    let previous: number | null = validGoalCount(plan.stages[0].start_contacts)
      ? plan.stages[0].start_contacts : null;
    return plan.stages.map((step, index) => {
      if (index > 0) {
        const rate = step.rate;
        previous = previous === null || rate === null || !Number.isFinite(rate) || rate <= 0 || rate > 100
          ? null
          : Math.floor(previous * rate / 100);
      }
      return { ...step, count: previous };
    });
  }
  if (!positiveInteger(plan.target_cents) || !positiveInteger(plan.ticket_cents))
    return [];
  const n = Math.ceil(plan.target_cents / plan.ticket_cents);
  if (!Number.isSafeInteger(n) || n > 1e9) return [];
  const counts: (number | null)[] = plan.stages.map(() => null);
  counts[counts.length - 1] = n;
  for (let i = counts.length - 1; i > 0; i--) {
    const rate = plan.stages[i].rate, next = counts[i];
    if (rate === null || !Number.isFinite(rate) || rate <= 0 || rate > 100 || next === null)
      continue;
    const result = Math.ceil(next * 100 / rate);
    counts[i - 1] = Number.isSafeInteger(result) && result <= 1e9 ? result : null;
  }
  return plan.stages.map((step, index) => ({ ...step, count: counts[index] }));
}
/** Só projeção, nunca contabilização de venda ou recebimento real. */
export function projectedRevenueCents(plan: Pick<GoalPlan, 'stages' | 'target_cents' | 'ticket_cents'>): number | null {
  const sales = buildGoalFunnel(plan).at(-1)?.count;
  if (sales === undefined || sales === null) return null;
  const total = sales * plan.ticket_cents;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}
export function medalUnlocked(medal:GoalMedal, result:Pick<GoalEmployeeProgress,'sales_count'|'sales_cents'|'goal_cents'>) {
  if(medal.kind==='sales') return result.sales_count>=medal.threshold;
  return result.goal_cents>0 && result.sales_cents/result.goal_cents*100>=medal.threshold;
}
export function numberInputToCents(value:string) {
  if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return null;
  const cents=Math.round(Number(value)*100);
  return Number.isSafeInteger(cents)&&cents>0&&cents<=1e12?cents:null;
}
