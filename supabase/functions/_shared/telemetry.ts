import type { Backend, ErrorContext } from './contracts.ts';
import { ProviderError } from './errors.ts';

export function safeException(error: unknown) {
  const type =
    error instanceof Error && /^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(error.name)
      ? error.name
      : 'Error';
  // Somente arquivo/linha/coluna: elimina a mensagem original, URLs, parâmetros e valores.
  const stack = error instanceof Error ? error.stack || '' : '';
  const frames = [
    ...stack
      .split('\n')
      .slice(1)
      .join('\n')
      .matchAll(/([A-Za-z0-9_.-]+\.(?:[cm]?js|tsx?)):(\d+):(\d+)/g),
  ]
    .slice(0, 12)
    .map((match) => `${match[1]}:${match[2]}:${match[3]}`);
  const provider =
    error instanceof ProviderError
      ? `provider_operation=${error.providerOperation};provider_status=${error.providerStatus}`
      : '';
  return {
    exceptionType: type,
    trace: [provider, ...frames].filter(Boolean).join('\n').slice(0, 2048),
  };
}

export async function reportSafely(
  backend: Backend,
  code: string,
  requestId: string,
  context?: ErrorContext,
) {
  try {
    await backend.report(code, requestId, context);
  } catch {
    // Uma falha no armazenamento do log nunca altera a resposta da operação original.
    console.error(JSON.stringify({ code: 'ERROR_LOG_UNAVAILABLE', request_id: requestId }));
  }
}
