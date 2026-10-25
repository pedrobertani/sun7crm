import { useThemeStyle } from '../theme-provider';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  const colors = useThemeStyle();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="dialog-overlay"
          data-color-scheme={colors.colorScheme === 'dark' ? 'dark' : undefined}
        />
        <Dialog.Content
          className="dialog-content"
          data-color-scheme={colors.colorScheme === 'dark' ? 'dark' : undefined}
          style={colors}
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
            <Dialog.Close className="icon-button" aria-label="Fechar">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="dialog-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
