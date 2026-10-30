import { Button } from './button';
import { useThemeStyle } from '../theme-provider';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  size = 'default',
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
  size?: 'default' | 'wide';
}) {
  const colors = useThemeStyle();
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" data-color-scheme={colors.colorScheme} />
        <Dialog.Content
          ref={contentRef}
          className={'dialog-content' + (size === 'wide' ? ' dialog-content-wide' : '')}
          data-color-scheme={colors.colorScheme}
          style={colors}
          onOpenAutoFocus={(event) => {
            // Radix otherwise focuses the close icon, showing its tooltip immediately.
            const firstField = contentRef.current?.querySelector<HTMLElement>(
              '.dialog-body input:not([type="hidden"]):not(:disabled), .dialog-body select:not(:disabled), .dialog-body textarea:not(:disabled), .dialog-body button:not(:disabled)',
            );
            if (firstField) {
              event.preventDefault();
              firstField.focus();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (event.target instanceof Element && event.target.closest('.contact-picker-popup'))
              event.preventDefault();
          }}
        >
          <div className="dialog-head">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description className={description ? 'muted' : 'sr-only'}>
                {description || title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="outline" aria-label="Fechar">
                <X size={16} />
              </Button>
            </Dialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
