import { PAGE_SIZES, type PageSize } from '../../components/ui/pagination';

export type KanbanPageSize = PageSize | 'all';

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
