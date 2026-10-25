import { normalizeContactPhone } from '../domain/contact-transfer';
/** Use WhatsApp's official HTTPS universal link, without sending a message. */
export function whatsappLink(phone: string): string | null {
  const national = normalizeContactPhone(phone);
  return national ? 'https://wa.me/55' + national : null;
}
