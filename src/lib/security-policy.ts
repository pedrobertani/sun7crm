import { DEFAULT_SUPABASE_URL, supabaseOrigin } from './public-config';

/** CSP entregue por meta no HTML estático; não substitui os controles de acesso do servidor. */
export function contentSecurityPolicy(supabaseUrl = DEFAULT_SUPABASE_URL): string {
  const origin = supabaseOrigin(supabaseUrl);
  const realtimeOrigin = origin.replace(/^http/, 'ws');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    // Radix, Recharts e os temas utilizam estilos de elementos; scripts inline continuam proibidos.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${origin} ${realtimeOrigin}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-src 'none'",
    "worker-src 'none'",
  ].join('; ');
}
