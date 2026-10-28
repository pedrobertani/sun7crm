import { useRef, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  actionLabels,
  allPermissionKeys,
  permissionModules,
  resourceKeys,
  togglePermissions,
  type EmployeePermissions,
} from './model';
import './permissions.css';
const groups = [
 {label:'Dia a dia',id:'daily',resources:['dashboard','cards','boards','stages','contacts','history','tasks']},
 {label:'Crescimento',id:'growth',resources:['strategies','ambassadors','campaigns','referrals','goals']},
 {label:'Cadastros',id:'records',resources:['catalog','labels']},
 {label:'Gestão',id:'management',resources:['reports','team','settings']},
];
const resources = new Map(permissionModules.flatMap(m=>m.resources).map(r=>[r.id,r]));

function Check({
  label,
  selected,
  total,
  onChange,
  disabled,
}: {
  label: string;
  selected: number;
  total: number;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = selected > 0 && selected < total;
  }, [selected, total]);
  return (
    <label className="permission-check">
      <input
        ref={ref}
        type="checkbox"
        checked={selected === total}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      {label}
    </label>
  );
}
export function PermissionTree({
  value,
  onChange,
  disabled = false,
  availableKeys = allPermissionKeys,
  allowCompanyScope = true,
}: {
  value: EmployeePermissions;
  onChange: (value: EmployeePermissions) => void;
  disabled?: boolean;
  availableKeys?: string[];
  allowCompanyScope?: boolean;
}) {
  const [open, setOpen] = useState<string[]>(['daily']);
  const expand = (id: string) =>
    setOpen((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  const change = (keys: string[], enabled: boolean) =>
    onChange({
      ...value,
      keys: togglePermissions(
        value.keys,
        enabled ? keys.filter((k) => availableKeys.includes(k)) : keys,
        enabled,
      ),
    });
  const count = (keys: string[]) => keys.filter((k) => value.keys.includes(k)).length;
  return (
    <section className="permission-editor" aria-label="Permissões do funcionário">
      <div className="permission-summary">
        <strong>Permissões de acesso</strong>
        <span>
          {value.keys.length} de {allPermissionKeys.length} ações
        </span>
      </div>
      <Check
        label="Selecionar tudo"
        selected={count(availableKeys)}
        total={availableKeys.length || 1}
        onChange={(v) => change(allPermissionKeys, v)}
        disabled={disabled}
      />
      <p className="small-note">
        Organizadas como o menu do CRM. Expanda apenas o que precisar configurar. As consultas necessárias são ativadas automaticamente.
        Administrar funcionários permite criar contas e definir acessos apenas nesta empresa.
      </p>
      <label className="form-row">
        Carteira que poderá acessar
        <select
          value={value.scope}
          onChange={(e) =>
            onChange({ ...value, scope: e.target.value as EmployeePermissions['scope'] })
          }
          disabled={disabled}
        >
          <option value="own">Somente os próprios contatos, cards e tarefas</option>
          <option value="company" disabled={!allowCompanyScope}>
            Contatos, cards e tarefas de toda a empresa
          </option>
        </select>
      </label>
      {groups.map(g => {
        const items=g.resources.map(id=>resources.get(id)).filter((r):r is NonNullable<typeof r>=>Boolean(r));
        const groupKeys=items.flatMap(resourceKeys);
        const expanded=open.includes(g.id);
        return <div className="permission-module" key={g.id}>
          <div className="permission-row permission-group-row">
            <button type="button" className="permission-expand" onClick={()=>expand(g.id)}
              aria-expanded={expanded} aria-controls={'permission-'+g.id}>
              {expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}
              <strong>{g.label}</strong><small>{count(groupKeys)}/{groupKeys.length}</small>
            </button>
            <Check label="Selecionar grupo" selected={count(groupKeys)} total={groupKeys.length}
              onChange={v=>change(groupKeys,v)} disabled={disabled}/>
          </div>
          {expanded&&<div className="permission-resources" id={'permission-'+g.id}>
            {items.map(r=>{
              const rk=resourceKeys(r),isSingle=rk.length===1,id='resource-'+r.id,re=open.includes(id);
              return <div key={r.id} className="permission-resource">
                <div className="permission-row">
                  {isSingle?<span className="permission-resource-title">{r.label}</span>:
                    <button type="button" className="permission-expand" onClick={()=>expand(id)}
                      aria-expanded={re} aria-controls={'permission-'+id}>
                      {re?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
                      {r.label}<small>{count(rk)}/{rk.length}</small>
                    </button>}
                  <Check label={isSingle?'Visualizar':'Todos'} selected={count(rk)} total={rk.length}
                    onChange={v=>change(rk,v)} disabled={disabled}/>
                </div>
                {!isSingle&&re&&<div className="permission-actions" id={'permission-'+id}>
                  {r.actions.map(a=><Check key={a} label={actionLabels[a]}
                    selected={Number(value.keys.includes(r.id+'.'+a))} total={1}
                    onChange={v=>change([r.id+'.'+a],v)}
                    disabled={disabled||!availableKeys.includes(r.id+'.'+a)}/>)}
                </div>}
              </div>;
            })}
          </div>}
        </div>;
      })}
    </section>
  );
}
