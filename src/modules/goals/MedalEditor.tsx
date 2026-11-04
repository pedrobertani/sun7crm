import { Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { CurrencyInput } from '../../components/currency-input';
import type { GoalMedal } from './model';
import { medalIcons, numberInputToCents } from './model';

export function MedalEditor({
  medal,
  onChange,
  onRemove,
}: {
  medal: GoalMedal;
  onChange: (part: Partial<GoalMedal>) => void;
  onRemove: () => void;
}) {
  const reward = medal.reward;
  return (
    <div className="goal-medal-editor">
      <div className="goal-medal-fields">
        <label className="form-row">
          Medalha
          <Input value={medal.label} maxLength={60} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        <label className="form-row">
          Ícone
          <select
            aria-label={'Ícone de ' + medal.label}
            value={medal.icon || 'trophy'}
            onChange={(e) => onChange({ icon: e.target.value as keyof typeof medalIcons })}
          >
            {Object.entries(medalIcons).map(([key, emoji]) => (
              <option key={key} value={key}>{emoji} {key}</option>
            ))}
          </select>
        </label>
        <label className="form-row">
          Critério
          <select
            value={medal.kind}
            onChange={(e) => onChange({ kind: e.target.value as GoalMedal['kind'] })}
          >
            <option value="sales">Quantidade de vendas</option>
            <option value="percent">% da meta individual</option>
          </select>
        </label>
        <label className="form-row">
          Limite
          <Input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={medal.threshold}
            onChange={(e) => onChange({ threshold: Number(e.target.value) })}
          />
        </label>
        <label className="form-row">
          Premiação
          <select
            value={reward?.kind || 'none'}
            onChange={(e) => {
              const kind = e.target.value;
              onChange({
                reward:
                  kind === 'money'
                    ? { kind: 'money', amount_cents: 0 }
                    : kind === 'prize'
                      ? { kind: 'prize', name: '' }
                      : undefined,
              });
            }}
          >
            <option value="none">Sem premiação</option>
            <option value="money">Valor em dinheiro</option>
            <option value="prize">Outro prêmio</option>
          </select>
        </label>
        {reward?.kind === 'money' && (
          <label className="form-row">
            Valor do prêmio (R$)
            <CurrencyInput
              value={reward.amount_cents > 0 ? (reward.amount_cents / 100).toFixed(2) : ''}
              onValueChange={(value) =>
                onChange({ reward: { ...reward, amount_cents: numberInputToCents(value) ?? 0 } })
              }
              aria-label={'Valor do prêmio de ' + medal.label}
            />
          </label>
        )}
        {reward?.kind === 'prize' && (
          <label className="form-row">
            Nome do prêmio
            <Input
              value={reward.name}
              maxLength={100}
              placeholder="Ex.: vale-presente ou dia de folga"
              onChange={(e) =>
                onChange({ reward: { ...reward, name: e.target.value } })
              }
            />
          </label>
        )}
        {reward && (
          <label className="form-row">
            Descrição (opcional)
            <Input
              value={reward.description || ''}
              maxLength={200}
              placeholder="Ex.: válido até o fim do mês"
              onChange={(e) =>
                onChange({ reward: { ...reward, description: e.target.value || undefined } })
              }
            />
          </label>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={'Remover medalha ' + medal.label}
        title="Remover medalha"
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </Button>
    </div>
  );
}
