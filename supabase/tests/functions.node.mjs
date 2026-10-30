import assert from 'node:assert/strict';
import test from 'node:test';
import { createHttpHandler, DEFAULT_ORIGIN } from '../functions/_shared/http.ts';
import { safeException } from '../functions/_shared/telemetry.ts';
import { updateCompany } from '../functions/crm-update-company/handler.ts';
import { databaseError, HttpError } from '../functions/_shared/errors.ts';
import { createCompany } from '../functions/crm-create-company/handler.ts';
import { createUser } from '../functions/crm-create-user/handler.ts';
import { resetPassword } from '../functions/crm-reset-password/handler.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const company = {
  name: 'Empresa fictícia',
  segment: 'Teste',
  monthly_amount_cents: 19000,
  due_date: '2026-12-01',
};
const person = {
  company_id: id(10),
  role: 'seller',
  display_name: 'Pessoa fictícia',
  email: 'teste@example.invalid',
  password: 'Somente-teste-12345',
};
function fixture(command, overrides = {}) {
  const calls = [];
  const backend = {
    authenticate: async (token) => {
      calls.push(['authenticate', token]);
      return token === 'valid-session' ? id(1) : null;
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === 'crm_edge_create_company') return id(10);
      if (name === 'crm_edge_prepare_user')
        return { state: 'pending', user_id: null, membership_id: null };
      if (name === 'crm_edge_finish_user')
        return { state: 'complete', user_id: id(2), membership_id: id(20) };
      if (name === 'crm_edge_cancel_user')
        return { state: 'cancelled', user_id: null, membership_id: null };
      return null;
    },
    createUser: async (input) => {
      calls.push(['auth.createUser', input]);
      return { id: id(2) };
    },
    deleteUser: async (user) => {
      calls.push(['auth.deleteUser', user]);
    },
    resetPassword: async (user, password) => {
      calls.push(['auth.resetPassword', user, password]);
    },
    report: (code, request) => calls.push(['report', code, request]),
    ...overrides,
  };
  const handler = createHttpHandler(backend, command);
  const request = (body, headers = {}, method = 'POST') =>
    handler(
      new Request('https://edge.example.invalid/test', {
        method,
        headers: {
          origin: DEFAULT_ORIGIN,
          authorization: 'Bearer valid-session',
          'content-type': 'application/json',
          'idempotency-key': id(500),
          ...headers,
        },
        ...(method === 'POST'
          ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
          : {}),
      }),
    );
  return { calls, backend, request };
}

test('cada endpoint recusa sessão ausente, inválida e chave de API no lugar do JWT', async () => {
  for (const command of [createCompany, createUser, resetPassword, updateCompany]) {
    for (const authorization of [
      '',
      'Bearer invalid',
      'Bearer sb_publishable_fake',
      'Bearer sb_secret_fake',
    ]) {
      const f = fixture(command);
      const response = await f.request({}, { authorization });
      assert.equal(response.status, 401);
      assert.ok(
        !f.calls.some(([name]) => name.startsWith('crm_edge_') || name.startsWith('auth.')),
      );
    }
  }
});
test('CORS permite a origem configurada e rejeita outra antes de autenticar', async () => {
  const f = fixture(createCompany);
  assert.equal((await f.request({}, {}, 'OPTIONS')).status, 204);
  assert.equal(f.calls.length, 0);
  const response = await f.request({}, { origin: 'https://outside.example.invalid' });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
test('camada HTTP limita método, formato, tamanho e identificador da solicitação', async () => {
  for (const [body, headers, method, expected] of [
    [{}, {}, 'GET', 405],
    ['{bad', {}, 'POST', 400],
    [[], {}, 'POST', 400],
    [{}, { 'content-type': 'text/plain' }, 'POST', 415],
    [{}, { 'idempotency-key': 'invalid' }, 'POST', 400],
    [{ large: 'x'.repeat(17000) }, {}, 'POST', 413],
  ]) {
    const response = await fixture(createCompany).request(body, headers, method);
    assert.equal(response.status, expected);
  }
});
test('criação de empresa usa ator da sessão, valor em centavos e mantém desabilitada', async () => {
  const f = fixture(createCompany);
  const response = await f.request(company);
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await response.json()).data, { company_id: id(10), enabled: false });
  const args = f.calls.find(([name]) => name === 'crm_edge_create_company')[1];
  assert.equal(args.p_actor, id(1));
  assert.equal(args.p_values.monthly_amount_cents, 19000);
  assert.equal(args.p_values.theme, 'sun7');
});
test('empresa rejeita campos privilegiados, valores fracionários e datas inexistentes', async () => {
  for (const fields of [
    { actor_id: id(2) },
    { enabled: true },
    { monthly_amount_cents: 10.5 },
    { monthly_amount_cents: -1 },
    { due_date: '2026-02-30' },
    { name: '' },
    { template: 'other' },
    { theme: ['sun7'] },
  ])
    assert.equal((await fixture(createCompany).request({ ...company, ...fields })).status, 400);
});
test('usuário é autorizado antes do Auth e senha não entra em argumentos SQL', async () => {
  const f = fixture(createUser);
  const response = await f.request(person);
  assert.equal(response.status, 201);
  assert.deepEqual(
    f.calls.map(([name]) => name),
    ['authenticate', 'crm_edge_prepare_user', 'auth.createUser', 'crm_edge_finish_user'],
  );
  const sqlCalls = f.calls.filter(([name]) => name.startsWith('crm_edge_'));
  assert.ok(!JSON.stringify(sqlCalls).includes(person.password));
  assert.ok(!JSON.stringify(sqlCalls).includes(person.email));
  assert.ok(!JSON.stringify(await response.json()).includes(person.password));
});
test('proibição do banco impede criação no Auth', async () => {
  const f = fixture(createUser, {
    rpc: async () => {
      throw new HttpError(403, 'FORBIDDEN', 'Sem permissão.');
    },
  });
  assert.equal((await f.request(person)).status, 403);
  assert.ok(!f.calls.some(([name]) => name === 'auth.createUser'));
});
test('usuário rejeita perfil administrativo, ator forjado, e-mail e senha inválidos', async () => {
  for (const fields of [
    { role: 'platform_admin' },
    { role: ['seller'] },
    { p_actor: id(2) },
    { email: 'invalid' },
    { password: 'short' },
    { password: 'é'.repeat(40) },
  ])
    assert.equal((await fixture(createUser).request({ ...person, ...fields })).status, 400);
});
test('cancelamento confirmado permite remover apenas a conta recém-criada', async () => {
  const f = fixture(createUser);
  const rpc = f.backend.rpc;
  f.backend.rpc = async (name, args) => {
    if (name === 'crm_edge_finish_user')
      throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Falha simulada.');
    return rpc(name, args);
  };
  assert.equal((await f.request(person)).status, 503);
  assert.deepEqual(
    f.calls.find(([name]) => name === 'auth.deleteUser'),
    ['auth.deleteUser', id(2)],
  );
});
test('commit confirmado depois de falha de rede retorna sucesso sem excluir o usuário', async () => {
  const f = fixture(createUser);
  const rpc = f.backend.rpc;
  f.backend.rpc = async (name, args) => {
    if (name === 'crm_edge_finish_user') throw new Error('falha depois de commit');
    if (name === 'crm_edge_cancel_user')
      return { state: 'complete', user_id: id(2), membership_id: id(20) };
    return rpc(name, args);
  };
  assert.equal((await f.request(person)).status, 200);
  assert.ok(!f.calls.some(([name]) => name === 'auth.deleteUser'));
});
test('cancelamento indisponível preserva conta para conciliação', async () => {
  const f = fixture(createUser);
  const rpc = f.backend.rpc;
  f.backend.rpc = async (name, args) => {
    if (['crm_edge_finish_user', 'crm_edge_cancel_user'].includes(name))
      throw new Error('falha simulada');
    return rpc(name, args);
  };
  const response = await f.request(person);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'PROVISIONING_REVIEW_REQUIRED');
  assert.ok(!f.calls.some(([name]) => name === 'auth.deleteUser'));
});
test('repetição concluída não cria outra conta nem redefine sua senha', async () => {
  const f = fixture(createUser, {
    rpc: async () => ({ state: 'complete', user_id: id(2), membership_id: id(20) }),
  });
  assert.equal((await f.request(person)).status, 200);
  assert.ok(!f.calls.some(([name]) => name.startsWith('auth.')));
});
test('falha no Auth não tenta excluir usuário desconhecido', async () => {
  const f = fixture(createUser, {
    createUser: async () => {
      throw new Error('falha simulada');
    },
  });
  assert.equal((await f.request(person)).status, 500);
  assert.ok(!f.calls.some(([name]) => name === 'auth.deleteUser'));
});
test('reset exige autorização antes de alterar senha e registra resultado', async () => {
  const f = fixture(resetPassword);
  const response = await f.request({
    company_id: id(10),
    user_id: id(2),
    password: person.password,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(
    f.calls.map(([name]) => name),
    [
      'authenticate',
      'crm_edge_begin_password_reset',
      'auth.resetPassword',
      'crm_edge_end_password_reset',
    ],
  );
  assert.ok(
    !JSON.stringify(f.calls.filter(([name]) => name.startsWith('crm_edge_'))).includes(
      person.password,
    ),
  );
});
test('reset proibido não toca o Auth', async () => {
  const f = fixture(resetPassword, {
    rpc: async () => {
      throw new HttpError(403, 'FORBIDDEN', 'Sem permissão.');
    },
  });
  assert.equal(
    (await f.request({ company_id: id(10), user_id: id(2), password: person.password })).status,
    403,
  );
  assert.ok(!f.calls.some(([name]) => name === 'auth.resetPassword'));
});
test('reset sem confirmação não é repetido e não expõe erros internos', async () => {
  const f = fixture(resetPassword, {
    resetPassword: async () => {
      throw new Error('senha-ou-chave-na-mensagem-interna');
    },
  });
  const response = await f.request({
    company_id: id(10),
    user_id: id(2),
    password: person.password,
  });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('senha-ou-chave'));
  assert.equal(
    f.calls.find(([name]) => name === 'crm_edge_end_password_reset')[1].p_succeeded,
    false,
  );
});
test('senha alterada continua confirmada se o registro final ficar indisponível', async () => {
  const f = fixture(resetPassword);
  const rpc = f.backend.rpc;
  f.backend.rpc = async (name, args) => {
    if (name === 'crm_edge_end_password_reset') throw new Error('falha simulada');
    return rpc(name, args);
  };
  const response = await f.request({
    company_id: id(10),
    user_id: id(2),
    password: person.password,
  });
  assert.equal(response.status, 200);
  assert.ok(
    f.calls.some(([name, code]) => name === 'report' && code === 'PASSWORD_RESET_AUDIT_PENDING'),
  );
});
test('erros de banco são mapeados sem devolver detalhes da consulta', () => {
  for (const [code, message, status] of [
    ['42501', 'CRM_LEGAL_REQUIRED', 403],
    ['42501', 'private details', 403],
    ['23505', 'private details', 409],
    ['P0003', 'private details', 429],
    ['23514', 'private details', 400],
    ['unknown', 'private details', 503],
  ]) {
    const safe = databaseError({ code, message });
    assert.equal(safe.status, status);
    assert.ok(!safe.message.includes('private details'));
  }
});

test('erros carregam trace e correlação sem expor mensagem original, senha ou token', async () => {
  const reports = [];
  const exception = new TypeError('Conteúdo sensível: credencial-local-nunca-logar');
  exception.stack =
    'TypeError: credencial-local-nunca-logar\n    at command (/runtime/handler.ts:42:8)\n    at route (https://example.invalid/http.ts:15:2?token=segredo)';
  const f = fixture(
    async () => {
      throw exception;
    },
    { report: async (code, request, context) => reports.push({ code, request, context }) },
  );
  const response = await f.request({ password: 'credencial-local-nunca-logar' });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(reports[0].request, body.request_id);
  assert.equal(reports[0].context.operationId, id(500));
  assert.equal(reports[0].context.actorId, id(1));
  assert.equal(reports[0].context.exceptionType, 'TypeError');
  assert.equal(reports[0].context.trace, 'handler.ts:42:8\nhttp.ts:15:2');
  assert.ok(!JSON.stringify(reports).includes('credencial-local-nunca-logar'));
  assert.ok(!JSON.stringify(reports).includes('token='));
  assert.ok(!JSON.stringify(body).includes('credencial-local-nunca-logar'));
});

test('falha ao registrar erro preserva a resposta original da função', async () => {
  const f = fixture(
    async () => {
      throw new Error('Falha local');
    },
    {
      report: async () => {
        throw new Error('Log indisponível');
      },
    },
  );
  const response = await f.request({});
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, 'INTERNAL_ERROR');
});

test('sanitização elimina a primeira linha e limita os frames de trace', () => {
  assert.equal(safeException(new HttpError(503,'DATABASE_UNAVAILABLE','Mensagem segura')).exceptionType,'HttpError');
  const error = new Error('Não registrar esta mensagem');
  error.stack =
    'Error: Não registrar esta mensagem\n' +
    Array.from({ length: 30 }, (_, i) => `    at helper (/app/modulo.ts:${i + 1}:2)`).join('\n');
  const safe = safeException(error);
  assert.equal(safe.trace.split('\n').length, 12);
  assert.ok(!safe.trace.includes('Não registrar'));
  assert.deepEqual(safeException('erro não estruturado'), { exceptionType: 'Error', trace: '' });
});

test('alteração da empresa usa endpoint próprio, valida campos e não aceita papel forjado', async () => {
  const values = {
    ...company,
    template: 'aesthetic',
    theme: 'sun7',
    company_id: id(10),
    enabled: true,
  };
  const f = fixture(updateCompany);
  const response = await f.request(values);
  assert.equal(response.status, 200);
  const call = f.calls.find(([name]) => name === 'crm_edge_update_company');
  assert.equal(call[1].p_actor, id(1));
  assert.equal(call[1].p_company, id(10));
  assert.equal(call[1].p_values.enabled, true);
  assert.equal(call[1].p_values.monthly_amount_cents, company.monthly_amount_cents);
  for (const body of [
    { ...values, enabled: 'true' },
    { ...values, due_date: '2026-02-30' },
    { ...values, role: 'admin' },
    { ...values, monthly_amount_cents: -1 },
  ])
    assert.equal((await fixture(updateCompany).request(body)).status, 400);
});

test('respostas de sucesso, erro e preflight mantêm controles HTTP de segurança', async () => {
  const f = fixture(createCompany);
  const replies = [
    await f.request(company),
    await f.request({}, { authorization: '' }),
    await f.request({}, {}, 'OPTIONS'),
  ];
  assert.deepEqual(replies.map((response) => response.status), [201, 401, 204]);
  for (const response of replies) {
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('vary'), 'Origin');
  }
  assert.ok(replies[0].headers.get('x-request-id'));
  assert.equal(replies[1].headers.get('access-control-allow-origin'), DEFAULT_ORIGIN);
  assert.equal(replies[2].headers.get('access-control-allow-origin'), DEFAULT_ORIGIN);
});

test('API negada por origem não expõe CORS nem aciona autenticação ou banco', async () => {
  const f = fixture(createUser);
  const denied = await f.request(person, { origin: 'https://terceiro.example.invalid' });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  assert.equal(denied.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(!f.calls.some(([name]) => name === 'authenticate' || name.startsWith('auth.') || name.startsWith('crm_edge_')));
});
