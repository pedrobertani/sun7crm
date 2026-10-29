import { PAGE_SIZES, type PageSize } from '../../components/ui/pagination';

export type KanbanPageSize = PageSize | 'all';

/**
 * Pagination rules for the demo Kanban: "Todos" never slices a stage.
 * Keep the same last-page bounds used by the real workspace when changing sizes.
 */
export function visibleKanbanRows<T>(
  rows: readonly T[],
  size: KanbanPageSize,
  requestedPage = 0,
): { rows: T[]; page: number; total: number } {
  const total = rows.length;
  if (size === 'all') return { rows: [...rows], page: 0, total };
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const page = Math.min(Math.max(0, requestedPage), lastPage);
  return { rows: rows.slice(page * size, (page + 1) * size), page, total };
}

export function KanbanSizeControl({
  size,
  onChange,
}: {
  size: KanbanPageSize;
  onChange: (size: KanbanPageSize) => void;
}) {
  return (
    <label className="kanban-board-size">
      Exibir
      <select
        value={size}
        aria-label="Cards por etapa"
        onChange={(event) => {
          const value = event.target.value;
          onChange(value === 'all' ? 'all' : Number(value) as PageSize);
        }}
      >
        {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
        <option value="all">Todos</option>
      </select>
      por etapa
    </label>
  );
}
