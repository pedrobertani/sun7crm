import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Impede publicar Cloudflare Pages sem as regras HTTP emitidas pelo Vite.
const [headers, html] = await Promise.all([
  readFile(new URL('../dist/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
]);
assert.ok(headers.startsWith('/*\n'), 'O arquivo _headers deve ter uma regra /*');
assert.match(headers, /^  Content-Security-Policy: default-src 'self'; .*; frame-ancestors 'none'$/m);
assert.match(headers, /^  X-Content-Type-Options: nosniff$/m);
assert.match(headers, /^  Referrer-Policy: strict-origin-when-cross-origin$/m);
assert.match(headers, /^  X-Frame-Options: DENY$/m);
assert.ok(html.includes('http-equiv="Content-Security-Policy"'), 'Meta CSP ausente no HTML');
const headerPolicy = headers.match(/^  Content-Security-Policy: (.*); frame-ancestors 'none'$/m)?.[1];
assert.ok(headerPolicy, 'CSP ausente no cabeçalho HTTP');
const metaTag = html.match(/<meta\\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/i)?.[0];
const encodedMetaPolicy = metaTag?.match(/\\bcontent="([^"]*)"/i)?.[1];
assert.ok(encodedMetaPolicy, 'A meta CSP não contém a política esperada');
const metaPolicy = encodedMetaPolicy.replace(
  /&(#x[0-9a-f]+|#\\d+|amp|quot|apos|lt|gt);/gi,
  (entity, name) => {
    if (name.startsWith('#x')) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' }[name.toLowerCase()] ?? entity;
  },
);
assert.equal(
  metaPolicy,
  headerPolicy,
  'A meta CSP e o cabeçalho HTTP divergem; o navegador aplicaria ambas as políticas',
);
console.log('Cloudflare Pages: _headers existe, CSP HTTP/meta consistentes e cabeçalhos de segurança presentes.');
