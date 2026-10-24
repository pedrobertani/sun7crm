import { HttpError } from './errors.ts';
import type { JsonObject } from './contracts.ts';

export function invalid(message: string): never {
  throw new HttpError(400, 'INVALID_INPUT', message);
}

export function keys(body: JsonObject, allowed: string[]) {
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    invalid('A solicitação contém campos não permitidos.');
  }
}

export function text(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    invalid(`Confira o campo ${label}.`);
  }
  return value.trim();
}

export function uuid(value: unknown, label: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    invalid(`Confira o identificador de ${label}.`);
  }
  return value.toLowerCase();
}

export function password(value: unknown): string {
  // Supabase Auth pode usar bcrypt; não truncar silenciosamente acima de 72 bytes.
  if (
    typeof value !== 'string' ||
    [...value].length < 12 ||
    new TextEncoder().encode(value).length > 72
  ) {
    invalid('Use uma senha com pelo menos 12 caracteres e no máximo 72 bytes.');
  }
  return value;
}

export async function fingerprint(values: unknown[]): Promise<string> {
  // Nunca incluir senha, token ou chave nesta lista.
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('');
}
