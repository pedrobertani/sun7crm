export type LegalKind = 'terms' | 'privacy';

export interface RequiredDocument {
  kind: LegalKind;
  version: string;
}
export interface PublishedDocument extends RequiredDocument {
  body: string;
  content_sha256: string;
  published_at: string;
}
export interface LegalAcceptance extends RequiredDocument {}

export function passwordValidation(value: string, confirmation: string): string | null {
  if ([...value].length < 12 || new TextEncoder().encode(value).length > 72) {
    return 'A nova senha deve ter pelo menos 12 caracteres e no máximo 72 bytes.';
  }
  if (value !== confirmation) return 'As senhas informadas não coincidem.';
  return null;
}

export function legalReadiness(
  required: RequiredDocument[],
  published: PublishedDocument[],
  accepted: LegalAcceptance[],
) {
  const kinds: LegalKind[] = ['terms', 'privacy'];
  if (
    required.length !== 2 ||
    kinds.some((kind) => required.filter((item) => item.kind === kind).length !== 1)
  ) return { ready: false, accepted: false, documents: [] as PublishedDocument[], pending: [] as RequiredDocument[] };
  const documents = kinds.map((kind) => {
    const requirement = required.find((item) => item.kind === kind)!;
    return published.find(
      (item) =>
        item.kind === kind &&
        item.version === requirement.version &&
        item.body.trim().length > 0 &&
        /^[a-f\d]{64}$/i.test(item.content_sha256),
    );
  });
  if (documents.some((doc) => !doc))
    return { ready: false, accepted: false, documents: [] as PublishedDocument[] };
  return {
    ready: true,
    accepted: required.every((item) =>
      accepted.some((record) => record.kind === item.kind && record.version === item.version),
    ),
    documents: documents as PublishedDocument[],
    pending: required.filter((item) =>
      !accepted.some((record) => record.kind === item.kind && record.version === item.version)),
  };
}
