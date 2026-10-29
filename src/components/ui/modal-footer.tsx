import type { ReactNode } from 'react';

/** Shared footer layout for modal actions, including financial and administrative variants. */
export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="form-actions">{children}</div>;
}
