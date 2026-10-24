import type { Backend, Command, JsonObject } from './contracts.ts';
import { HttpError } from './errors.ts';
import { uuid } from './validation.ts';
import { reportSafely, safeException } from './telemetry.ts';

export const DEFAULT_ORIGIN = 'https://sun7crm-base.dreamygull10.chatgpt.site';
const MAX_BODY_BYTES = 16_384;

async function readBody(request: Request): Promise<JsonObject> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  ) {
    throw new HttpError(415, 'JSON_REQUIRED', 'Envie os dados em JSON.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON', 'Informe os dados da solicitação.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'BODY_TOO_LARGE', 'A solicitação excede o tamanho permitido.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'JSON inválido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_JSON', 'Informe um objeto JSON.');
  }
  return body as JsonObject;
}

export function createHttpHandler(backend: Backend, command: Command, origins = [DEFAULT_ORIGIN]) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    let actorId: string | null = null;
    let operationId: string | null = null;
    const origin = request.headers.get('origin');
    const headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Request-Id': requestId,
    });
    if (origin && origins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'authorization, apikey, content-type, x-client-info, idempotency-key',
      );
      headers.set('Access-Control-Expose-Headers', 'x-request-id');
    }
    try {
      if (origin && !origins.includes(origin)) {
        throw new HttpError(403, 'ORIGIN_DENIED', 'Origem não autorizada.');
      }
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method !== 'POST') {
        headers.set('Allow', 'POST, OPTIONS');
        throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.');
      }
      const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
      if (!token || token.length > 8192 || token.startsWith('sb_')) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.');
      }
      actorId = await backend.authenticate(token);
      if (!actorId)
        throw new HttpError(401, 'UNAUTHENTICATED', 'Sua sessão não é válida. Entre novamente.');
      operationId = uuid(request.headers.get('idempotency-key'), 'solicitação');
      const body = await readBody(request);
      const result = await command({
        actorId,
        requestId: operationId,
        traceId: requestId,
        body,
        backend,
      });
      return Response.json(
        { data: result.data, request_id: requestId },
        { status: result.status, headers },
      );
    } catch (error) {
      const safe =
        error instanceof HttpError
          ? error
          : new HttpError(500, 'INTERNAL_ERROR', 'Não foi possível concluir a solicitação.');
      await reportSafely(backend, safe.code, requestId, {
        actorId,
        operationId,
        status: safe.status,
        message: safe.message,
        ...safeException(error),
      });
      return Response.json(
        { error: { code: safe.code, message: safe.message }, request_id: requestId },
        { status: safe.status, headers },
      );
    }
  };
}
