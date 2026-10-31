import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflarePagesSecurityHeaders, contentSecurityPolicy } from './src/lib/security-policy';

function productionSecurityPolicy(supabaseUrl?: string, payments = false): Plugin {
  return {
    name: 'sun7crm-production-security-policy',
    apply: 'build',
    // O Cloudflare Pages lê _headers da raiz de dist, não do HTML.
    // Gera com os mesmos hosts e flags da meta CSP para evitar políticas divergentes.
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: cloudflarePagesSecurityHeaders(supabaseUrl, payments),
      });
    },
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
