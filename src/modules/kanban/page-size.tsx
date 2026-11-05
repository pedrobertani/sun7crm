import { PAGE_SIZES, type PageSize } from '../../components/ui/pagination';

export type KanbanPageSize = PageSize;

/** Paginação finita por etapa; nenhuma opção dispara carga ilimitada. */
export function visibleKanbanRows<T>(
  rows: readonly T[],
  size: KanbanPageSize,
  requestedPage = 0,
): { rows: T[]; page: number; total: number } {
  const total = rows.length;
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
          const value = Number(event.target.value);
          if (PAGE_SIZES.includes(value as PageSize)) onChange(value as PageSize);
        }}
      >
        {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
      por etapa
    </label>
  );
}
