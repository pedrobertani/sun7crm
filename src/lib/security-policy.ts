import { DEFAULT_SUPABASE_URL, supabaseOrigin } from './public-config';

/** Política única para o HTML e os cabeçalhos HTTP gerados para Cloudflare Pages. */
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
    `connect-src 'self' ${origin} ${realtimeOrigin}${payments ? ' https://api.mercadopago.com https://api-static.mercadopago.com https://secure-fields.mercadopago.com https://api.mercadolibre.com https://events.mercadopago.com https://sdk.mercadopago.com https://http2.mlstatic.com' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    payments
      ? 'frame-src https://sdk.mercadopago.com https://secure-fields.mercadopago.com https://api-static.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.br'
      : "frame-src 'none'",
    "worker-src 'none'",
  ].join('; ');
}

/** Regra Cloudflare Pages copiada para dist/_headers durante o build.
 * Usa a mesma CSP da meta tag; somente os cabeçalhos HTTP podem aplicar frame-ancestors.
 * Respostas de Pages Functions não herdam essas regras (o SUN7CRM é estático).
 */
export function cloudflarePagesSecurityHeaders(
  supabaseUrl = DEFAULT_SUPABASE_URL,
  payments = false,
): string {
  return [
    '/*',
    `  Content-Security-Policy: ${contentSecurityPolicy(supabaseUrl, payments)}; frame-ancestors 'none'`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  X-Frame-Options: DENY',
    '',
  ].join('\n');
}
