import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// A new Edge Function must be classified before it can ship. This checks the
// routing contract; runtime auth and HMAC behavior have separate tests.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = join(root, 'functions');
const config = readFileSync(join(root, 'config.toml'), 'utf8');
const runtime = readFileSync(join(functionsDir, '_shared', 'runtime.ts'), 'utf8');
const http = readFileSync(join(functionsDir, '_shared', 'http.ts'), 'utf8');
const webhook = readFileSync(join(functionsDir, 'crm-billing-webhook', 'handler.ts'), 'utf8');

const routeKinds = {
  'crm-create-company': 'session',
  'crm-create-user': 'session',
  'crm-reset-password': 'session',
  'crm-first-access': 'session',
  'crm-update-company': 'session',
  'crm-billing-checkout': 'session',
  'crm-billing-checkout-hom': 'session',
  'crm-billing-webhook': 'signed-webhook',
  'crm-billing-webhook-hom': 'signed-webhook',
};

test('toda Edge Function publicada é inventariada e tem configuração de JWT explícita', () => {
  const routes = readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(functionsDir, entry.name, 'index.ts')))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(routes, Object.keys(routeKinds).sort(),
    'Novo endpoint deve receber classificação, controles e testes antes da publicação');
  for (const route of routes) {
    const match = config.match(new RegExp('\\[functions\\.' + route + '\\]\\s*\\nverify_jwt\\s*=\\s*(true|false)'));
    assert.ok(match, 'Configuração de gateway ausente para ' + route);
    assert.equal(match[1], 'false', 'Mudança de modo JWT exige plano de migração e teste');
  }
});

test('rotas de sessão passam pelo validador compartilhado; webhooks usam assinatura', () => {
  for (const [route, kind] of Object.entries(routeKinds)) {
    const entry = readFileSync(join(functionsDir, route, 'index.ts'), 'utf8');
    if (kind === 'session') {
      assert.ok(/serve\(|createHttpHandler\(/.test(entry),
        'Rota ' + route + ' deve exigir autenticação no HTTP compartilhado');
    } else {
      assert.ok(entry.includes('billingWebhook('), 'Webhook ' + route + ' sem handler assinado');
    }
  }
  assert.match(runtime, /auth\.getUser\(token\)/);
  assert.match(http, /backend\.authenticate\(token\)/);
  assert.match(http, /token\.startsWith\('sb_'\)/);
  assert.match(webhook, /await provider\.verify\(request, id\)/);
  assert.match(webhook, /await readBody\(request\)/);
});

test('somente credencial publishable pode estar no cliente React do Supabase', () => {
  const client = readFileSync(join(root, '..', 'src', 'lib', 'supabase.ts'), 'utf8');
  assert.match(client, /sb_publishable_/);
  assert.doesNotMatch(client, /sb_secret_|service_role|SUPABASE_SECRET_KEYS/);
});
