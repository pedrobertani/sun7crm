/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_ONLINE_BILLING_ENABLED?: string;
  readonly VITE_BILLING_ENVIRONMENT?: string;
}
