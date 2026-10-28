import {describe,it,expect} from 'vitest';
import {buildGoalFunnel,validateGoalConfig,medalUnlocked,starterMedals,starterStages,numberInputToCents} from './model';

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
  it('conquista apenas com resultado individual informado, não com valor planejado',()=>{
    const r={goal_cents:1000000,sales_cents:0,sales_count:0};
    expect(medalUnlocked({label:'Primeira venda',kind:'sales',threshold:1},r)).toBe(false);
    expect(medalUnlocked({label:'50%',kind:'percent',threshold:50},r)).toBe(false);
    expect(medalUnlocked({label:'50%',kind:'percent',threshold:50},{...r,sales_cents:500000})).toBe(true);
    expect(medalUnlocked({label:'1',kind:'sales',threshold:1},{...r,sales_count:1})).toBe(true);
  });
  it('valida valores monetários em centavos sem notação exponencial',()=>{
    expect(numberInputToCents('3000.00')).toBe(300000);
    expect(numberInputToCents('1e5')).toBeNull();
    expect(numberInputToCents('-10')).toBeNull();
    expect(numberInputToCents('0')).toBeNull();
  });
});
