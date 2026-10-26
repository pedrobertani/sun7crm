import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../lib/whatsapp';
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
  return href && !disabled ? (
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
      title={label}
    >
      <MessageCircle size={compact ? 17 : 18} aria-hidden="true" />
      {!compact && <span>WhatsApp</span>}
    </a>
  ) : (
    <button
      className={'whatsapp-button ' + (compact ? 'whatsapp-compact' : '')}
      type="button"
      disabled
      aria-label={label + ' — telefone com DDD não informado'}
      title={
        disabled
          ? 'Você não tem permissão para abrir o WhatsApp pelo CRM'
          : 'Cadastre um telefone válido com DDD'
      }
    >
      <MessageCircle size={17} aria-hidden="true" />
      {!compact && <span>WhatsApp</span>}
    </button>
  );
}
