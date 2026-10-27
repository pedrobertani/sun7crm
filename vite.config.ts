import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { contentSecurityPolicy } from './src/lib/security-policy';

function productionSecurityPolicy(supabaseUrl?: string, payments = false): Plugin {
  return {
    name: 'sun7crm-production-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: contentSecurityPolicy(supabaseUrl, payments),
          },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [
      react(),
      tailwindcss(),
      productionSecurityPolicy(
        env.VITE_SUPABASE_URL?.trim() || undefined,
        env.VITE_ONLINE_BILLING_ENABLED === 'true',
      ),
    ],
    server: { allowedHosts: ['terminal.local'] },
    build: {
      outDir: 'dist',
      rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } },
    },
  };
});
