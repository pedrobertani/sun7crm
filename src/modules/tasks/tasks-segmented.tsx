import type { ReactNode } from 'react';

export function TasksSegmented<T extends string>({
  label, value, items, onValueChange,
}: {
  label: string;
  value: T;
  items: { value: T; label: string; icon?: ReactNode }[];
  onValueChange: (value: T) => void;
}) {
  return (
    <div className="tasks-segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? 'active' : ''}
          aria-pressed={value === item.value}
          onClick={() => onValueChange(item.value)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
