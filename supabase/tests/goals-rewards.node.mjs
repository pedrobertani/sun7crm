import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, id } from './helpers/db.mjs';

const stages = [
  { label: 'Contatos', rate: null },
  { label: 'Agendamentos', rate: 50 },
  { label: 'Comparecimentos', rate: 80 },
  { label: 'Vendas', rate: 10 },
];
const base = { label: 'Primeira venda', icon: 'bronze', kind: 'sales', threshold: 1 };
const prize = { label: 'Meta completa', icon: 'gold', kind: 'percent', threshold: 100,
  reward: { kind: 'prize', name: 'Dia de folga', description: 'Agendar com a gestão' } };
const money = { ...base, reward: { kind: 'money', amount_cents: 15000, description: 'Bônus de vendas' } };
const manualStages = [
  { label: 'Contatos', rate: null, count: 200 },
  { label: 'Agendamentos', rate: 50, count: 100 },
  { label: 'Comparecimentos', rate: 80, count: 80 },
  { label: 'Vendas', rate: 25, count: 20 },
];

test('medalhas: gerente define premiação por dinheiro ou descrição, sem pagamento automático', async (t) => {
  const { q, user } = await fixture(t);
  const save = (actor, medals, funnel = stages) => user(actor, () => q(`
    insert into public.crm_goal_plans(company_id,goal_month,target_cents,ticket_cents,stages,medals)
    values($1,'2026-11-01',10000000,300000,$2::jsonb,$3::jsonb)
    on conflict(company_id,goal_month) do update set
      medals=excluded.medals, stages=excluded.stages
  `, [id(100), JSON.stringify(funnel), JSON.stringify(medals)]));

  await t.test('compatibilidade de medalha antiga sem prêmio', async () => {
    await save(1, [base]);
    const result = (await user(1, () => q('select medals from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(result.medals, [base]);
  });
  await t.test('valor em centavos e prêmio descritivo são persistidos', async () => {
    await save(1, [money, prize]);
    const result = (await user(1, () => q('select medals from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(result.medals, [money, prize]);
    const reads = await user(2, () => q('select medals from public.crm_goal_plans where company_id=$1', [id(100)]));
    assert.deepEqual(reads.rows[0].medals, [money, prize]);
  });
  await t.test('valor inválido, prêmio vazio e campos extras são recusados', async () => {
    const bad = [
      { kind: 'money', amount_cents: 0 },
      { kind: 'money', amount_cents: 1.5 },
      { kind: 'money', amount_cents: 100000001 },
      { kind: 'money', amount_cents: '15000' },
      { kind: 'money', amount_cents: 5000, delivered: true },
      { kind: 'money', amount_cents: 5000, description: 'x'.repeat(201) },
      { kind: 'prize', name: '  ' },
      { kind: 'prize', name: 'x'.repeat(101) },
      { kind: 'prize', name: 'Folga', description: 'x'.repeat(201) },
      { kind: 'prize', name: 'Folga', delivered: true },
      { kind: 'unknown', name: 'Brinde' },
      null,
    ];
    for (const reward of bad) {
      await assert.rejects(save(1, [{ ...base, reward }]), /CRM_INVALID_GOAL_REWARD/);
    }
    const after = (await user(1, () => q('select medals from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(after.medals, [money, prize]);
  });
  await t.test('gestor configura quantidade de contatos e cada estágio, sem alterar vendas reais', async () => {
    await save(1, [base], manualStages);
    const result = (await user(1, () =>
      q('select stages, medals from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(result.stages, manualStages);
    assert.deepEqual(result.medals, [base]);
    const confirmed = await user(1, () => q('select count(*)::int as n from public.crm_confirmed_sales'));
    assert.equal(confirmed.rows[0].n, 0);
  });
  await t.test('banco rejeita quantidades parciais, crescentes ou inválidas', async () => {
    const invalid = [
      manualStages.map((s,i) => i===1 ? {label:s.label,rate:s.rate} : s),
      manualStages.map((s,i) => i===0 ? {...s,count:0} : s),
      manualStages.map((s,i) => i===0 ? {...s,count:1.5} : s),
      manualStages.map((s,i) => i===0 ? {...s,count:1000000001} : s),
      manualStages.map((s,i) => i===1 ? {...s,count:300} : s),
    ];
    for (const funnel of invalid) {
      await assert.rejects(save(1, [base], funnel), /CRM_INVALID_GOAL_STAGE_COUNT|CRM_INVALID_GOAL_STAGE_ORDER/);
    }
    const result = (await user(1, () =>
      q('select stages from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(result.stages, manualStages);
  });
  await t.test('continua aceitando modo calculado legado', async () => {
    await save(1, [base], stages);
    const result = (await user(1, () =>
      q('select stages from public.crm_goal_plans where company_id=$1', [id(100)]))).rows[0];
    assert.deepEqual(result.stages, stages);
  });
  await t.test('funcionário não altera premiações definidas pelo gestor', async () => {
    await assert.rejects(save(2, [base]), /permission denied|row-level security|policy/i);
  });
});
