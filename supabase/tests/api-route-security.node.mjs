import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { createHttpHandler, DEFAULT_ORIGIN } from '../functions/_shared/http.ts';
import { HttpError } from '../functions/_shared/errors.ts';

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


test('origem de fallback é o Cloudflare Pages da produção e CORS é exato (sem sufixos ou site legado)', async () => {
  assert.equal(DEFAULT_ORIGIN, 'https://sun7crm.pages.dev');
  const attempts = [];
  const handler = createHttpHandler({
    authenticate: async (token) => { attempts.push(['auth', token]); return token === 'fixture-jwt' ? 'actor-fixture' : null; },
    report: async () => {},
  }, async () => { attempts.push(['mutation']); return { status: 200, data: { ok: true } }; });
  const request = (origin, method = 'POST', authorization = 'Bearer fixture-jwt') =>
    handler(new Request('https://edge.example.invalid/functions/v1/crm-create-user', {
      method,
      headers: {
        origin,
        authorization,
        'content-type': 'application/json',
        'idempotency-key': '00000000-0000-4000-8000-000000000001',
      },
      ...(method === 'POST' ? { body: '{}' } : {}),
    }));

  const valid = await request(DEFAULT_ORIGIN);
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get('access-control-allow-origin'), DEFAULT_ORIGIN);
  assert.ok(attempts.some(([call]) => call === 'mutation'));

  for (const origin of [
    'https://sun7crm.pages.dev.evil.example',
    'https://evil.example',
    'null',
    'https://sun7crm-base.dreamygull10.chatgpt.site',
  ]) {
    attempts.length = 0;
    const blocked = await request(origin);
    assert.equal(blocked.status, 403, 'Origem rejeitada: ' + origin);
    assert.equal((await blocked.json()).error.code, 'ORIGIN_DENIED');
    assert.equal(blocked.headers.get('access-control-allow-origin'), null);
    assert.deepEqual(attempts, [], 'Origem indevida não deve sequer autenticar');
    const preflight = await request(origin, 'OPTIONS', '');
    assert.equal(preflight.status, 403);
    assert.equal(preflight.headers.get('access-control-allow-origin'), null);
  }
  attempts.length = 0;
  const allowedPreflight = await request(DEFAULT_ORIGIN, 'OPTIONS', '');
  assert.equal(allowedPreflight.status, 204);
  assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), DEFAULT_ORIGIN);
  assert.deepEqual(attempts, []);
});

test('camada HTTP bloqueia tokens malformados, chaves secretas, tokens excessivos e métodos indevidos antes de executar comandos', async () => {
  const events = [];
  const handler = createHttpHandler({
    authenticate: async (token) => { events.push('authenticate'); return token === 'fixture-jwt' ? 'actor-fixture' : null; },
    report: async () => {},
  }, async () => { events.push('command'); return { status: 200, data: { ok: true } }; });
  const ask = async (method, authorization, key = '00000000-0000-4000-8000-000000000001') => {
    const response = await handler(new Request('https://edge.example.invalid/functions/v1/crm-reset-password', {
      method,
      headers: {
        origin: DEFAULT_ORIGIN,
        authorization,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      ...(method === 'POST' ? { body: '{}' } : {}),
    }));
    return response;
  };
  for (const [authorization, shouldAuthenticate] of [
    ['', false],
    ['Basic abc', false],
    ['Bearer ', false],
    ['Bearer fixture-jwt extra', false],
    ['Bearer sb_publishable_fake', false],
    ['Bearer sb_secret_fake', false],
    ['Bearer ' + 'x'.repeat(8193), false],
    ['Bearer invalid-user-jwt', true],
  ]) {
    events.length = 0;
    const response = await ask('POST', authorization);
    assert.equal(response.status, 401, 'Credencial bloqueada: ' + authorization.slice(0, 30));
    assert.equal(events.includes('authenticate'), shouldAuthenticate);
    assert.ok(!events.includes('command'), 'Credencial inválida não pode produzir efeitos');
  }
  events.length = 0;
  const forbiddenMethod = await ask('GET', 'Bearer fixture-jwt');
  assert.equal(forbiddenMethod.status, 405);
  assert.equal(forbiddenMethod.headers.get('allow'), 'POST, OPTIONS');
  assert.deepEqual(events, []);
  events.length = 0;
  const badIdempotency = await ask('POST', 'Bearer fixture-jwt', 'invalid-key');
  assert.equal(badIdempotency.status, 400);
  assert.deepEqual(events, ['authenticate']);
});

test('falha no serviço Auth não libera a função e retorna erro genérico sem credenciais', async () => {
  let executed = false;
  const handler = createHttpHandler({
    authenticate: async () => {
      throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Serviço de autenticação indisponível.');
    },
    report: async () => {},
  }, async () => {
    executed = true;
    return { status: 200, data: { ok: true } };
  });
  const response = await handler(new Request('https://edge.example.invalid/test', {
    method: 'POST',
    headers: {
      origin: DEFAULT_ORIGIN,
      authorization: 'Bearer fixture-private-token',
      'content-type': 'application/json',
      'idempotency-key': '00000000-0000-4000-8000-000000000001',
    },
    body: JSON.stringify({ secret: 'fixture-private-secret' }),
  }));
  assert.equal(response.status, 503);
  assert.equal(executed, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.text();
  assert.ok(!body.includes('fixture-private-token'));
  assert.ok(!body.includes('fixture-private-secret'));
  assert.equal(JSON.parse(body).error.code, 'AUTH_UNAVAILABLE');
});
