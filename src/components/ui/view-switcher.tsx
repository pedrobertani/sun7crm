import { Button } from './button';
import './tabs.css';

/** View filters have pressed buttons; Tabs owns tab/panel relationships for persistent panels. */
export function ViewSwitcher<T extends string>({
  label,
  value,
  onValueChange,
  items,
  className = '',
}: {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={'ui-tabs-list ' + className} role="group" aria-label={label}>
      {items.map((item) => (
        <Button
          type="button"
          key={item.value}
          variant="ghost"
          aria-pressed={value === item.value}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
