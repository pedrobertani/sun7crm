/** Configuração pública compartilhada entre o navegador e a política de segurança do build. */
export const DEFAULT_SUPABASE_URL = 'https://oduhbimlxnuyqliayvpl.supabase.co';

export function supabaseOrigin(value = DEFAULT_SUPABASE_URL): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const validHostname =
    /^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(url.hostname) || url.hostname === '[::1]';
  if (
    !validHostname ||
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Configure uma origem HTTPS válida para o Supabase.');
  }
  return url.origin;
}
