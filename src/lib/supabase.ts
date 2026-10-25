import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SUPABASE_URL, supabaseOrigin } from './public-config';

// Chave publicável, de baixo privilégio, destinada a ser visível no navegador.
// A configuração VITE_ prevalece para ambientes próprios e rotação de chaves.
const CURRENT_PUBLIC_KEY = 'sb_publishable_MJw-0sM305ZMO6YjJyiTHQ_NqRkAY_8';

let client: SupabaseClient | undefined;

// Inicialização sob demanda: abrir a demo não cria uma sessão ou consulta o banco real.
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = supabaseOrigin(import.meta.env.VITE_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL);
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || CURRENT_PUBLIC_KEY;
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
