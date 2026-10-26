import { useRef, useEffect, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  actionLabels,
  allPermissionKeys,
  permissionModules,
  resourceKeys,
  togglePermissions,
  type EmployeePermissions,
} from './model';
import './permissions.css';
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
  const [open, setOpen] = useState<string[]>([]);
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
        label="Ativar todas as funcionalidades"
        selected={count(availableKeys)}
        total={availableKeys.length || 1}
        onChange={(v) => change(allPermissionKeys, v)}
        disabled={disabled}
      />
      <p className="small-note">
        Escolha as ações em cada grupo. As consultas necessárias são ativadas junto com as ações.
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
      {permissionModules.map((m) => {
        const keys = m.resources.flatMap(resourceKeys),
          expanded = open.includes(m.id);
        return (
          <div className="permission-module" key={m.id}>
            <div className="permission-row">
              <button
                type="button"
                className="permission-expand"
                onClick={() => expand(m.id)}
                aria-expanded={expanded}
                aria-controls={`permission-${m.id}`}
              >
                <strong>{m.label}</strong>
                {expanded ? <Minus size={16} /> : <Plus size={16} />}
              </button>
              <Check
                label={`Todos de ${m.label}`}
                selected={count(keys)}
                total={keys.length}
                onChange={(v) => change(keys, v)}
                disabled={disabled}
              />
            </div>
            {expanded && (
              <div id={`permission-${m.id}`} className="permission-resources">
                {m.resources.map((r) => {
                  const rk = resourceKeys(r),
                    id = `${m.id}-${r.id}`,
                    re = open.includes(id);
                  return (
                    <div key={r.id} className="permission-resource">
                      <div className="permission-row">
                        <button
                          type="button"
                          className="permission-expand"
                          onClick={() => expand(id)}
                          aria-expanded={re}
                          aria-controls={`permission-${id}`}
                        >
                          {r.label}
                          {re ? <Minus size={15} /> : <Plus size={15} />}
                        </button>
                        <Check
                          label={`Todos de ${r.label}`}
                          selected={count(rk)}
                          total={rk.length}
                          onChange={(v) => change(rk, v)}
                          disabled={disabled}
                        />
                      </div>
                      {re && (
                        <div id={`permission-${id}`} className="permission-actions">
                          {r.actions.map((a) => (
                            <Check
                              key={a}
                              label={actionLabels[a]}
                              selected={Number(value.keys.includes(`${r.id}.${a}`))}
                              total={1}
                              onChange={(v) => change([`${r.id}.${a}`], v)}
                              disabled={disabled || !availableKeys.includes(`${r.id}.${a}`)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
