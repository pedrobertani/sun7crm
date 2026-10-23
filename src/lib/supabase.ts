import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

// Inicialização sob demanda: abrir a demo não cria uma sessão ou consulta o banco real.
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Configure a URL e a chave pública do Supabase no ambiente do frontend.');
  }
  if (!key.startsWith('sb_publishable_')) {
    throw new Error('O frontend deve usar uma chave publicável do Supabase.');
  }
  client = createClient(url, key, {
    auth: {
      storageKey: 'sun7crm:auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
