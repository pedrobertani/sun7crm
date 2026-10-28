import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../lib/whatsapp';
import { Tooltip } from './ui/tooltip';
export function WhatsAppButton({
  phone,
  name,
  compact = false,
  onOpen,
  disabled = false,
}: {
  phone: string;
  name: string;
  compact?: boolean;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const href = whatsappLink(phone),
    label = 'Abrir WhatsApp de ' + name;
  const reason = disabled
    ? 'Sem permissão para abrir o WhatsApp'
    : 'Cadastre um telefone válido com DDD';
  const control =
    href && !disabled ? (
      <a
        className={'whatsapp-button ' + (compact ? 'whatsapp-compact' : '')}
        href={href}
        onClick={onOpen}
        onAuxClick={(event) => {
          if (event.button === 1) onOpen?.();
        }}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
      >
        <MessageCircle size={compact ? 17 : 18} aria-hidden="true" />
        {!compact && <span>WhatsApp</span>}
      </a>
    ) : (
      <button
        className={'whatsapp-button ' + (compact ? 'whatsapp-compact' : '')}
        type="button"
        disabled
        aria-label={reason}
      >
        <MessageCircle size={17} aria-hidden="true" />
        {!compact && <span>WhatsApp</span>}
      </button>
    );
  return <Tooltip label={href && !disabled ? label : reason}>{control}</Tooltip>;
}
