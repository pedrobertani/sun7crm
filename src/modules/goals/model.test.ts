import {describe,it,expect} from 'vitest';
import {buildGoalFunnel,validateGoalConfig,medalUnlocked,starterMedals,starterStages,numberInputToCents,medalSymbol,medalIcons,medalRewardLabel,medalRewardDescription,manualGoalStages,prepareGoalStages,isManualGoalFunnel} from './model';

describe('Metas e medalhas configuráveis',()=>{
  const stages=[{label:'Contatos',rate:null},{label:'Agendamentos',rate:50},{label:'Comparecimentos',rate:80},{label:'Vendas',rate:10}];
  it('projeta vendas e contatos sem arredondar metas para baixo',()=>{
    const result=buildGoalFunnel({target_cents:10000000,ticket_cents:300000,stages});
    expect(result.map(x=>x.count)).toEqual([850,425,340,34]);
    expect(result.at(-1)?.count).toBe(34);
  });
  it('não presume conversões enquanto o gestor não configurou',()=>{
    const result=buildGoalFunnel({target_cents:10000000,ticket_cents:300000,stages:starterStages});
    expect(result.map(x=>x.count)).toEqual([null,null,null,34]);
    expect(validateGoalConfig(10000000,300000,starterStages,starterMedals)).toContain('taxas');
  });
  it('recusa metas inválidas, taxas fora do intervalo e medalhas incorretas',()=>{
    expect(validateGoalConfig(0,300000,stages,starterMedals)).toContain('meta');
    expect(validateGoalConfig(10000000,0,stages,starterMedals)).toContain('meta');
    expect(validateGoalConfig(10000000,300000,[stages[0],{label:'Vendas',rate:101}],starterMedals)).toContain('taxas');
    expect(validateGoalConfig(10000000,300000,stages,[{label:'',kind:'sales',threshold:1}])).toContain('medalhas');
    expect(validateGoalConfig(10000000,300000,stages,starterMedals)).toBeNull();
  });
  it('permite o gestor definir cada quantidade do funil, inclusive contatos, sem chumbá-la',()=>{
    const manual=[
      {label:'Contatos qualificados',rate:null,count:200},
      {label:'Agendamentos',rate:50,count:100},
      {label:'Comparecimentos',rate:80,count:80},
      {label:'Vendas',rate:10,count:20},
    ];
    expect(isManualGoalFunnel(manual)).toBe(true);
    expect(validateGoalConfig(10000000,300000,manual,starterMedals)).toBeNull();
    const result=buildGoalFunnel({target_cents:10000000,ticket_cents:300000,stages:manual});
    expect(result.map(s=>s.count)).toEqual([200,100,80,20]);
    expect(result.map(s=>s.rate)).toEqual([null,50,80,25]);
    expect(prepareGoalStages(manual).map(s=>s.rate)).toEqual([null,50,80,25]);
    // O faturamento demandaria 34 vendas, mas a meta manual de 20 permanece visível.
    expect(result.at(-1)?.count).toBe(20);
  });
  it('ao trocar modo permite preencher metas que não tinham taxa; valida lacunas e ordem',()=>{
    const draft=manualGoalStages(starterStages,10000000,300000);
    expect(draft.map(s=>s.count)).toEqual([null,null,null,34]);
    expect(validateGoalConfig(10000000,300000,draft,starterMedals)).toContain('quantidade');
    const partial=[{label:'Contatos',rate:null,count:100},
      {label:'Agendamentos',rate:null,count:null},
      {label:'Vendas',rate:null,count:10}];
    expect(validateGoalConfig(10000000,300000,partial,starterMedals)).toContain('quantidade');
    expect(validateGoalConfig(10000000,300000,
      [{label:'Contatos',rate:null,count:10},{label:'Vendas',rate:100,count:11}],
      starterMedals)).toContain('anterior');
    expect(validateGoalConfig(10000000,300000,
      [{label:'Contatos',rate:null,count:10},{label:'Vendas',rate:100,count:1.2}],
      starterMedals)).toContain('quantidade');
    const back=prepareGoalStages(stages);
    expect(back[0]).not.toHaveProperty('count');
    expect(buildGoalFunnel({target_cents:10000000,ticket_cents:300000,stages:back}).map(s=>s.count))
      .toEqual([850,425,340,34]);
  });
  it('conquista apenas com resultado individual informado, não com valor planejado',()=>{
    const r={goal_cents:1000000,sales_cents:0,sales_count:0};
    expect(medalUnlocked({label:'Primeira venda',kind:'sales',threshold:1},r)).toBe(false);
    expect(medalUnlocked({label:'50%',kind:'percent',threshold:50},r)).toBe(false);
    expect(medalUnlocked({label:'50%',kind:'percent',threshold:50},{...r,sales_cents:500000})).toBe(true);
    expect(medalUnlocked({label:'1',kind:'sales',threshold:1},{...r,sales_count:1})).toBe(true);
  });
  it('mantém os ícones personalizáveis e compatibilidade das medalhas antigas',()=>{
    expect(medalSymbol({label:'Diamante',kind:'sales',threshold:1,icon:'diamond'})).toBe('💎');
    expect(medalSymbol({label:'Legada',kind:'percent',threshold:100})).toBe('🏆');
    expect(validateGoalConfig(10000000,300000,stages,[{label:'Ouro',kind:'sales',threshold:1,icon:'gold'}])).toBeNull();
    expect(Object.keys(medalIcons)).toHaveLength(9);
  });
  it('premiação opcional: valor em centavos ou descrição, sem alterar a conquista',()=>{
    const money={label:'Primeira venda',kind:'sales' as const,threshold:1,reward:{kind:'money' as const,amount_cents:15000,description:'Bônus por desempenho'}};
    const prize={label:'Meta',kind:'percent' as const,threshold:100,reward:{kind:'prize' as const,name:'Dia de folga',description:'A combinar com o gestor'}};
    expect(validateGoalConfig(10000000,300000,stages,[money,prize])).toBeNull();
    expect(medalRewardLabel(money)).toBe('Prêmio: R$ 150,00');
    expect(medalRewardLabel(prize)).toBe('Prêmio: Dia de folga');
    expect(medalRewardDescription(money)).toBe('Bônus por desempenho');
    expect(medalRewardDescription(prize)).toBe('A combinar com o gestor');
    expect(medalRewardLabel(starterMedals[0])).toBeNull();
    expect(medalUnlocked(money,{goal_cents:10000,sales_cents:0,sales_count:1})).toBe(true);
    for(const reward of [
      {kind:'money',amount_cents:0},
      {kind:'money',amount_cents:1.5},
      {kind:'money',amount_cents:100000001},
      {kind:'prize',name:''},
      {kind:'prize',name:' '.repeat(8)},
      {kind:'prize',name:'a'.repeat(101)},
      {kind:'prize',name:'Vale',description:'a'.repeat(201)},
      {kind:'money',amount_cents:100,description:'b'.repeat(201)},
    ]) {
      const result=validateGoalConfig(10000000,300000,stages,[{...money,reward} as typeof money]);
      expect(result).toContain('premiação');
    }
  });
  it('valida valores monetários em centavos sem notação exponencial',()=>{
    expect(numberInputToCents('3000.00')).toBe(300000);
    expect(numberInputToCents('1e5')).toBeNull();
    expect(numberInputToCents('-10')).toBeNull();
    expect(numberInputToCents('0')).toBeNull();
  });
});
