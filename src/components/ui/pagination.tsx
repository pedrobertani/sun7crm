import { useState } from 'react';
import { Button } from './button';
import './pagination.css';

export type PageSize = 10 | 50 | 100;
export const PAGE_SIZES: PageSize[] = [10, 50, 100];
export const CAMPAIGN_PAGE_SIZE = 10;

/** Shared state: reset the page when the user changes the page size or a filter. */
export function usePagination(initialSize: PageSize = 10) {
  const [page, setPage] = useState(0);
  const [size, setSizeState] = useState<PageSize>(initialSize);
  const setSize = (next: PageSize) => {
    setSizeState(next);
    setPage(0);
  };
  return { page, size, setPage, setSize };
}

export function paginatedRows<T>(rows: T[], page: number, size: number): T[] {
  const safePage = Math.min(Math.max(0, page), Math.max(0, Math.ceil(rows.length / size) - 1));
  return rows.slice(safePage * size, (safePage + 1) * size);
}

/** Repeatable lists always show the page-size selector, even for a single page. */
export function Pagination({
  page,
  total,
  size = 10,
  onChange,
  onSizeChange,
  label = 'Registros',
  loading = false,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
  onSizeChange?: (size: PageSize) => void;
  label?: string;
  loading?: boolean;
}) {
  if (size <= 0 || (total <= size && !onSizeChange)) return null;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const visiblePage = Math.min(Math.max(0, page), lastPage);
  return (
    <nav className="ui-pagination" aria-label={'Paginação de ' + label.toLowerCase()}>
      {onSizeChange && (
        <label className="ui-pagination-size">
          Exibir
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value) as PageSize)}
            aria-label="Registros por página"
            disabled={loading}
          >
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          por página
        </label>
      )}
      <span aria-live="polite">
        {total ? `${visiblePage * size + 1}–${Math.min((visiblePage + 1) * size, total)} de ${total}` : 'Nenhum registro'}
      </span>
      <Button type="button" variant="outline" size="sm"
        disabled={visiblePage === 0 || loading}
        onClick={() => onChange(visiblePage - 1)}>Anterior</Button>
      <span className="ui-pagination-page">Página {visiblePage + 1} de {lastPage + 1}</span>
      <Button type="button" variant="outline" size="sm"
        disabled={visiblePage === lastPage || loading}
        onClick={() => onChange(visiblePage + 1)}>Próxima</Button>
    </nav>
  );
}
