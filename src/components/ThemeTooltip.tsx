import type { ComponentProps } from 'react';
import { Tooltip } from 'recharts';

/** Charts use the same surface and content tokens as every other component. */
export function ThemeTooltip(props: ComponentProps<typeof Tooltip>) {
  return (
    <Tooltip
      {...props}
      contentStyle={{
        background: 'var(--surface)',
        color: 'var(--ink)',
        border: '1px solid var(--line)',
        borderRadius: 10,
      }}
      itemStyle={{ color: 'var(--ink)' }}
      labelStyle={{ color: 'var(--ink)' }}
      cursor={{ fill: 'var(--raised)', stroke: 'var(--line)' }}
    />
  );
}
