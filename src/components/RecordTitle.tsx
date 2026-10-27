import { Link } from 'react-router-dom';
import { Button } from './ui/button';

/** Shared entry point to an existing record. Omit the action for read-only text. */
export function RecordTitle({
  title,
  onOpen,
  to,
  label = 'Abrir ' + title,
}: {
  title: string;
  onOpen?: () => void;
  to?: string;
  label?: string;
}) {
  if (to) {
    return (
      <Button asChild variant="link" className="record-title">
        <Link to={to} aria-label={label}>
          {title}
        </Link>
      </Button>
    );
  }
  if (onOpen) {
    return (
      <Button
        type="button"
        variant="link"
        className="record-title"
        aria-label={label}
        onClick={onOpen}
      >
        {title}
      </Button>
    );
  }
  return <strong className="record-title">{title}</strong>;
}
