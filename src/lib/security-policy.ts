import { DEFAULT_SUPABASE_URL, supabaseOrigin } from './public-config';

/** CSP entregue por meta no HTML estático; não substitui os controles de acesso do servidor. */
export function contentSecurityPolicy(
  supabaseUrl = DEFAULT_SUPABASE_URL,
  payments = false,
): string {
  const origin = supabaseOrigin(supabaseUrl);
  const realtimeOrigin = origin.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    payments
      ? "script-src 'self' https://sdk.mercadopago.com https://http2.mlstatic.com"
      : "script-src 'self'",
    "script-src-attr 'none'",
    // Radix, Recharts e os temas utilizam estilos de elementos; scripts inline continuam proibidos.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${payments ? ' https://http2.mlstatic.com' : ''}`,
    `font-src 'self'${payments ? ' https://http2.mlstatic.com' : ''}`,
    `connect-src 'self' ${origin} ${realtimeOrigin}${payments ? ' https://api.mercadopago.com https://api-static.mercadopago.com https://api.mercadolibre.com https://events.mercadopago.com https://sdk.mercadopago.com https://http2.mlstatic.com' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    payments
      ? 'frame-src https://sdk.mercadopago.com https://secure-fields.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.br'
      : "frame-src 'none'",
    "worker-src 'none'",
  ].join('; ');
}
