import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpHandler, DEFAULT_ORIGIN } from '../functions/_shared/http.ts';
import { completeFirstAccess } from '../functions/crm-first-access/handler.ts';

const actor = '00000000-0000-4000-8000-000000000001';
const nonce = '00000000-0000-4000-8000-000000000002';
const operation = '00000000-0000-4000-8000-000000000003';
const password = 'Senha-nova-segura-12345';

function fixture(overrides = {}) {
  const calls = [];
  const backend = {
    authenticate: async (token) => token === 'valid-token' ? actor : null,
    rpc: async (name, args) => { calls.push({ name, args }); return name === 'crm_first_access_begin' ? nonce : true; },
    resetPassword: async (uid, pass) => { calls.push({ name: 'resetPassword', args: { uid, pass } }); },
    report: () => {},
    ...overrides,
  };
  const handler = createHttpHandler(backend, completeFirstAccess);
  const request = (body, token = 'valid-token') => handler(new Request('https://example.invalid/first-access', {
    method: 'POST',
    headers: { origin: DEFAULT_ORIGIN, authorization: token ? `Bearer ${token}` : '', 'content-type': 'application/json', 'idempotency-key': operation },
    body: JSON.stringify(body),
  }));
  return { calls, request };
}

test('bloqueia acesso sem token valido e sem chamar o backend privilegiado', async () => {
  for (const token of ['', 'invalid', 'sb_publishable_fake']) {
    const f = fixture();
    assert.equal((await f.request({ password }, token)).status, 401);
    assert.deepEqual(f.calls, []);
  }
});

test('valida tamanho, formato e campos do novo segredo sem atingir Auth', async () => {
  for (const body of [{password: 'fraca'}, {password, role:'admin'}, {}, { password: 'é'.repeat(40) }]) {
    const f=fixture();
    assert.equal((await f.request(body)).status, 400);
    assert.deepEqual(f.calls, []);
  }
});

test('primeiro acesso: valida estado, muda apenas a propria senha e marca concluido', async () => {
  const f=fixture();
  const res=await f.request({password});
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, {password_changed:true});
  assert.deepEqual(f.calls.map(x=>x.name), ['crm_first_access_begin','resetPassword','crm_first_access_complete']);
  assert.deepEqual(f.calls[0].args,{p_actor:actor});
  assert.deepEqual(f.calls[1].args,{uid:actor,pass:password});
  assert.deepEqual(f.calls[2].args,{p_actor:actor,p_nonce:nonce});
});

test('nao altera senha se banco nao autorizou primeiro acesso', async () => {
  const f=fixture({rpc:async()=>{throw Error('not pending')}});
  assert.equal((await f.request({password})).status,500);
  assert.deepEqual(f.calls,[]);
});

test('se Auth falha, a operacao nao marca a troca como concluida', async () => {
  const f=fixture({resetPassword:async()=>{throw Error('auth unavailable')}});
  const res=await f.request({password});
  assert.equal(res.status,502);
  assert.deepEqual(f.calls.map(x=>x.name),['crm_first_access_begin']);
});

test('falha apos troca do Auth nao libera o acesso', async () => {
  const f=fixture({rpc:async(name,args)=>{f.calls.push({name,args}); if(name==='crm_first_access_complete')throw Error('db unavailable');return nonce;}});
  const res=await f.request({password});
  assert.equal(res.status,503);
  assert.deepEqual(f.calls.map(x=>x.name),['crm_first_access_begin','resetPassword','crm_first_access_complete']);
});
