import { Button } from './button';
import './pagination.css';

/** Shared pagination for repeatable records in the demo and authenticated workspace. */
export function Pagination({
  page,
  total,
  size = 10,
  onChange,
  label = 'Registros',
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  if (total <= size || size <= 0) return null;
  const lastPage = Math.max(0, Math.ceil(total / size) - 1);
  const visiblePage = Math.min(Math.max(0, page), lastPage);
  return (
    <nav className="ui-pagination" aria-label={'Paginação de ' + label.toLowerCase()}>
      <span aria-live="polite">
        {visiblePage * size + 1}–{Math.min((visiblePage + 1) * size, total)} de {total}
      </span>
      <Button type="button" variant="outline" size="sm"
        disabled={visiblePage === 0}
        onClick={() => onChange(visiblePage - 1)}>Anterior</Button>
      <Button type="button" variant="outline" size="sm"
        disabled={visiblePage === lastPage}
        onClick={() => onChange(visiblePage + 1)}>Próxima</Button>
    </nav>
  );
}

export const CAMPAIGN_PAGE_SIZE = 10;
