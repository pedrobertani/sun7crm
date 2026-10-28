import { useId, useRef, type ReactNode } from 'react';
import { Button } from './button';
import './tabs.css';

export function Tabs({
  label,
  value,
  onValueChange,
  items,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  items: { value: string; label: string; content: ReactNode }[];
}) {
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className="ui-tabs">
      <div className="ui-tabs-list" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <Button
            key={item.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            variant="ghost"
            role="tab"
            id={`${id}-tab-${item.value}`}
            aria-controls={`${id}-panel-${item.value}`}
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            onKeyDown={(event) => {
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : event.key === 'ArrowRight'
                      ? (index + 1) % items.length
                      : event.key === 'ArrowLeft'
                        ? (index - 1 + items.length) % items.length
                        : null;
              if (next === null) return;
              event.preventDefault();
              onValueChange(items[next].value);
              buttons.current[next]?.focus();
            }}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {items.map((item) => (
        <section
          key={item.value}
          role="tabpanel"
          id={`${id}-panel-${item.value}`}
          aria-labelledby={`${id}-tab-${item.value}`}
          hidden={value !== item.value}
          tabIndex={0}
        >
          {item.content}
        </section>
      ))}
    </div>
  );
}
