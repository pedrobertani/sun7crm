import { useEffect, useState } from 'react';
import { Award, ChartNoAxesCombined, Settings2, Plus, Trash2, Trophy } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { CurrencyInput } from '../../components/currency-input';
import { Panel } from '../../components/shared';
import { currency, today } from '../../lib/format';
import { CHART_COLORS } from '../../lib/themes';
import type { GoalEmployeeProgress, GoalMedal, GoalPlan, GoalStep } from './model';
import { starterStages, starterMedals, validateGoalConfig, buildGoalFunnel, medalUnlocked, numberInputToCents } from './model';
import { useOperational, useQuery, useSave, QueryState, FormError } from '../workspace/operational';
import type { TeamRow } from '../../data/backend';
import './goals.css';

type Section='plan'|'medals'|'results';
const numberFormat = (value:number|null)=>value===null?'A definir':value.toLocaleString('pt-BR');
function moneyInput(cents:number){return cents>0?(cents/100).toFixed(2):'';}
function percent(value:number,goal:number){return goal>0?Math.round(value/goal*100):0;}

export function GoalFunnel() {
  const {api,company,can,refresh,revision}=useOperational();
  const manager=company.role==='manager' && can('settings.edit');
  const [month,setMonth]=useState(today().slice(0,7));
  const [configOpen,setConfigOpen]=useState(false);
  const data=useQuery(async()=>{
    const [plan,results]=await Promise.all([api.goalPlan(month+'-01'),api.goalEmployeeProgress(month+'-01')]);
    return {plan,results};
  },[api,month,revision]);
  const team=useQuery(()=>manager?api.team():Promise.resolve([] as TeamRow[]),[api,manager],{live:false});
  const plan=data.data?.plan;
  const funnel=plan?buildGoalFunnel(plan):[];
  const results=data.data?.results||[];
  const mine=results.find(r=>r.membership_id===company.membershipId);
  const recorded=results.reduce((sum,r)=>sum+r.sales_cents,0);
  const plannedSales=plan?Math.ceil(plan.target_cents/plan.ticket_cents):null;
  return (
    <div className="goal-area">
      <Panel title="Funil de metas" description="Planejamento mensal configurado pelo gestor — separado dos resultados realizados.">
        <div className="goal-head">
          <label className="form-row">Competência
            <Input type="month" value={month} onChange={e=>setMonth(e.target.value)} aria-label="Mês das metas" />
          </label>
          {manager && <Button type="button" variant="outline" onClick={()=>setConfigOpen(true)}>
            <Settings2 size={16}/> Configurar metas
          </Button>}
        </div>
        <QueryState query={data}/>
        {plan ? (
          <>
            <div className="goal-indicators">
              <div><small>Meta mensal</small><strong>{currency(plan.target_cents)}</strong></div>
              <div><small>Ticket médio planejado</small><strong>{currency(plan.ticket_cents)}</strong></div>
              <div><small>Vendas necessárias</small><strong>{numberFormat(plannedSales)}</strong></div>
              <div><small>Vendas registradas pelo gestor</small><strong>{manager?results.reduce((n,r)=>n+r.sales_count,0):mine?.sales_count??'—'}</strong></div>
            </div>
            <div className="goal-funnel" role="img" aria-label={funnel.map(x=>x.label+': '+numberFormat(x.count)).join('; ')}>
              {funnel.map((step,i)=>(
                <div className="goal-step" key={i} style={{
                  width:`${100 - (i/funnel.length)*39}%`,
                  background:`color-mix(in srgb, ${CHART_COLORS[i%CHART_COLORS.length]} 38%, var(--surface))`,
                  borderLeft:`5px solid ${CHART_COLORS[i%CHART_COLORS.length]}`,
                }}>
                  <span><strong>{step.label}</strong><small>{i===0?'Entrada':step.rate+'% da etapa anterior'}</small></span>
                  <b>{numberFormat(step.count)}</b>
                </div>
              ))}
            </div>
            {funnel.some(x=>x.count===null)&&<p className="small-note">Complete as taxas de conversão na configuração para estimar todas as etapas.</p>}
            {manager && results.length>0 && (
              <div className="goal-total">
                <span>Resultado informado pelo gestor (equipe)</span>
                <strong>{currency(recorded)} de {currency(plan.target_cents)}</strong>
                <div className="goal-progress"><i style={{width:Math.min(100,percent(recorded,plan.target_cents))+'%'}}/></div>
                <small>Dados informados manualmente; não representam pagamentos confirmados.</small>
              </div>
            )}
            {!manager && mine && (
              <div className="goal-total">
                <span>Seu desempenho informado pelo gestor</span>
                <strong>{currency(mine.sales_cents)} de {currency(mine.goal_cents)}</strong>
                <div className="goal-progress"><i style={{width:Math.min(100,percent(mine.sales_cents,mine.goal_cents))+'%'}}/></div>
              </div>
            )}
            <div className="goal-medals">
              <h3><Trophy size={17}/> Medalhas</h3>
              {!plan.medals.length && <p className="small-note">O gestor ainda não definiu as conquistas.</p>}
              {!manager && !mine && <p className="small-note">Seu resultado individual ainda não foi configurado.</p>}
              {manager && !results.length && <p className="small-note">Registre resultados individuais no botão Configurar metas para acompanhar as conquistas.</p>}
              {manager ? (
                results.map(r=><div className="goal-medal-person" key={r.membership_id}>
                  <strong>{team.data?.find(x=>x.id===r.membership_id)?.display_name||'Colaborador'}</strong>
                  <div className="goal-medal-grid">
                    {plan.medals.map((m,i)=><Medal key={i} medal={m} earned={medalUnlocked(m,r)}/>)}
                  </div>
                </div>)
              ):mine && <div className="goal-medal-grid">
                {plan.medals.map((m,i)=><Medal key={i} medal={m} earned={medalUnlocked(m,mine)}/>)}
              </div>}
            </div>
          </>
        ): !data.loading && !data.error && (
          <div className="goal-empty">
            <ChartNoAxesCombined size={26}/>
            <strong>Metas ainda não configuradas para este mês</strong>
            <p>{manager?'Abra Configurar metas para definir as etapas, as taxas e as medalhas.':'O gestor definirá as metas e os critérios de conquista.'}</p>
          </div>
        )}
      </Panel>
      {configOpen && manager && <GoalSettings
        key={month+'-'+(plan?.target_cents??0)}
        month={month} plan={plan||null} team={team.data||[]}
        results={results} onClose={()=>setConfigOpen(false)}
        onSaved={()=>{refresh();setConfigOpen(false);}}
      />}
    </div>
  );
}
function Medal({medal,earned}:{medal:GoalMedal;earned:boolean}){
  return <div className={'goal-medal'+(earned?' earned':'')} title={earned?'Conquista liberada':'Conquista bloqueada'}>
    <Award size={22}/>
    <strong>{medal.label}</strong>
    <small>{earned?'Conquistada':medal.kind==='sales'?medal.threshold+' venda(s)':medal.threshold+'% da meta'}</small>
  </div>;
}
function GoalSettings({month,plan,results,team,onClose,onSaved}:{
  month:string;plan:GoalPlan|null;results:GoalEmployeeProgress[];team:TeamRow[];
  onClose:()=>void;onSaved:()=>void;
}){
  const {api,notice,refresh}=useOperational();
  const save=useSave(),[section,setSection]=useState<Section>('plan');
  const [target,setTarget]=useState(moneyInput(plan?.target_cents||0));
  const [ticket,setTicket]=useState(moneyInput(plan?.ticket_cents||0));
  const [stages,setStages]=useState<GoalStep[]>(plan?.stages.map(x=>({...x}))||starterStages.map(x=>({...x})));
  const [medals,setMedals]=useState<GoalMedal[]>(plan?.medals.map(x=>({...x}))||starterMedals.map(x=>({...x})));
  const [employee,setEmployee]=useState(team.find(x=>x.active&&x.role==='seller')?.id||team[0]?.id||'');
  const entry=results.find(x=>x.membership_id===employee);
  const [empGoal,setEmpGoal]=useState(moneyInput(entry?.goal_cents||0));
  const [empSales,setEmpSales]=useState((entry?.sales_count||0).toString());
  const [empAmount,setEmpAmount]=useState(moneyInput(entry?.sales_cents||0));
  const [empContacts,setEmpContacts]=useState((entry?.contacts_count||0).toString());
  useEffect(()=>{
    const current=results.find(x=>x.membership_id===employee);
    setEmpGoal(moneyInput(current?.goal_cents||0));
    setEmpSales((current?.sales_count||0).toString());
    setEmpAmount(moneyInput(current?.sales_cents||0));
    setEmpContacts((current?.contacts_count||0).toString());
  },[employee,results]);
  function updateStage(index:number,part:Partial<GoalStep>){
    setStages(current=>current.map((s,i)=>i===index?{...s,...part}:s));
  }
  function updateMedal(index:number,part:Partial<GoalMedal>){
    setMedals(current=>current.map((m,i)=>i===index?{...m,...part}:m));
  }
  function saveConfiguration() {
    const t=numberInputToCents(target),tk=numberInputToCents(ticket);
    const error=validateGoalConfig(t??0,tk??0,stages,medals);
    if(error){notice(error);return;}
    void save.run(async()=>{
      await api.saveGoalPlan({
        goal_month:month+'-01',target_cents:t!,ticket_cents:tk!,
        stages:stages.map(x=>({...x})),medals:medals.map(x=>({...x})),
      });
      notice('Planejamento e medalhas atualizados para '+month+'.');
      refresh();onSaved();
    });
  }
  function saveResult() {
    if(!plan){notice('Salve primeiro o planejamento do mês.');return;}
    const goal=numberInputToCents(empGoal),sales=empAmount.trim()?numberInputToCents(empAmount):0;
    const n=Number(empSales),ct=Number(empContacts);
    if(!employee||!goal||sales===null||![n,ct].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1e6)){
      notice('Confira meta, valores, vendas e contatos do colaborador.');return;
    }
    void save.run(async()=>{
      await api.saveGoalEmployeeProgress({
        goal_month:month+'-01',membership_id:employee,goal_cents:goal,
        sales_count:n,sales_cents:sales,contacts_count:ct,
      });
      notice('Resultados individuais registrados pelo gestor.');
      refresh();onSaved();
    });
  }
  return <Modal open title={'Configurar metas · '+month} description="Somente o gestor pode definir planejamento, critérios de medalhas e resultados individuais." size="wide"
    onOpenChange={v=>!v&&!save.busy&&onClose()}>
    <div className="goal-dialog-tabs" role="tablist" aria-label="Configuração de metas">
      {([['plan','Funil e metas'],['medals','Medalhas'],['results','Resultados']] as const)
        .map(([id,label])=><button key={id} type="button" role="tab" aria-selected={section===id} className={section===id?'active':''} onClick={()=>setSection(id)}>{label}</button>)}
    </div>
    {section==='plan' && <div className="goal-edit-list">
      <p className="small-note">Os cálculos são projeções, não dados de venda. As taxas representam a passagem da etapa anterior para a atual.</p>
      <div className="goal-edit-grid">
        <label className="form-row">Meta mensal (R$)<CurrencyInput value={target} onValueChange={setTarget}/></label>
        <label className="form-row">Ticket médio (R$)<CurrencyInput value={ticket} onValueChange={setTicket}/></label>
      </div>
      {stages.map((s,i)=><div className="goal-edit-step" key={i}>
        <label className="form-row">Etapa {i+1}<Input value={s.label} maxLength={50} disabled={i===stages.length-1} onChange={e=>updateStage(i,{label:e.target.value})}/></label>
        {i!==0&&<label className="form-row">Conversão da anterior (%)<Input type="number" min="0.01" max="100" step="0.01" value={s.rate??''} placeholder="Definir" onChange={e=>updateStage(i,{rate:e.target.value===''?null:Number(e.target.value)})}/></label>}
        {i>0 && i<stages.length-1 && <Button type="button" variant="ghost" aria-label={'Remover etapa '+s.label} onClick={()=>setStages(x=>x.filter((_,j)=>j!==i))}><Trash2 size={15}/></Button>}
      </div>)}
      {stages.length<8&&<Button type="button" variant="outline" onClick={()=>setStages(a=>[...a.slice(0,-1),{label:'Nova etapa',rate:null},a[a.length-1]])}><Plus size={15}/> Adicionar etapa</Button>}
      {numberInputToCents(target)&&numberInputToCents(ticket)&&<p className="small-note">Necessidade projetada: {Math.ceil(numberInputToCents(target)!/numberInputToCents(ticket)!)} vendas. Preencha as taxas para projetar os contatos.</p>}
    </div>}
    {section==='medals'&&<div className="goal-edit-list">
      <p className="small-note">O gestor escolhe os nomes e as condições. As conquistas só são liberadas quando há resultados individuais registrados, nunca pelo valor estimado do funil.</p>
      {medals.map((m,i)=><div className="goal-edit-step" key={i}>
        <label className="form-row">Medalha<Input value={m.label} maxLength={60} onChange={e=>updateMedal(i,{label:e.target.value})}/></label>
        <label className="form-row">Critério<select value={m.kind} onChange={e=>updateMedal(i,{kind:e.target.value as GoalMedal['kind']})}>
          <option value="sales">Quantidade de vendas</option><option value="percent">% da meta individual</option>
        </select></label>
        <label className="form-row">Limite<Input type="number" min="1" max="1000" step="1" value={m.threshold} onChange={e=>updateMedal(i,{threshold:Number(e.target.value)})}/></label>
        <Button type="button" variant="ghost" aria-label={'Remover medalha '+m.label} onClick={()=>setMedals(a=>a.filter((_,j)=>j!==i))}><Trash2 size={15}/></Button>
      </div>)}
      {medals.length<8&&<Button type="button" variant="outline" onClick={()=>setMedals(a=>[...a,{label:'Nova medalha',kind:'percent',threshold:100}])}><Plus size={15}/> Nova medalha</Button>}
    </div>}
    {section==='results'&&<div className="goal-edit-list">
      <p className="small-note">Lançamento manual de resultados pelo gestor. Não são pagamentos conciliados nem vendas inferidas de um card. A integração automática será definida após validação das regras de negócio.</p>
      {!plan&&<p className="small-note">Salve o planejamento primeiro. Volte à configuração depois para informar os resultados por colaborador.</p>}
      <label className="form-row">Colaborador
        <select value={employee} onChange={e=>setEmployee(e.target.value)}>
          {team.filter(x=>x.active&&(x.role==='seller'||x.role==='manager')).map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}
        </select>
      </label>
      <div className="goal-edit-grid">
        <label className="form-row">Meta individual (R$)<CurrencyInput value={empGoal} onValueChange={setEmpGoal}/></label>
        <label className="form-row">Valor de vendas informado (R$)<CurrencyInput value={empAmount} onValueChange={setEmpAmount}/></label>
        <label className="form-row">Vendas informadas<Input type="number" min="0" step="1" value={empSales} onChange={e=>setEmpSales(e.target.value)}/></label>
        <label className="form-row">Contatos informados<Input type="number" min="0" step="1" value={empContacts} onChange={e=>setEmpContacts(e.target.value)}/></label>
      </div>
    </div>}
    <FormError message={save.error}/>
    <div className="goal-edit-actions">
      <Button type="button" variant="outline" disabled={save.busy} onClick={onClose}>Cancelar</Button>
      <Button type="button" disabled={save.busy||save.uncertain|| (section==='results'&&!plan)} onClick={section==='results'?saveResult:saveConfiguration}>
        {save.busy?'Salvando...':section==='results'?'Salvar resultado':'Salvar configurações'}
      </Button>
    </div>
  </Modal>;
}
