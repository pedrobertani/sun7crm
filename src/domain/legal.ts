import type { Session } from './types';

// A interface e o registro usam exatamente as mesmas versões.
export const LEGAL = {
  terms: '2026-10-23-r2',
  privacy: '2026-10-23-r2',
  label: '23 de outubro de 2026 · rascunho 2',
} as const;
export const LEGAL_KEY = 'sun7crm:preview:legal:v1';
export interface LegalAcceptance {
  identity: string;
  companyId: string;
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
  source: 'preview_first_access';
}
export function legalIdentity(session: Session) {
  return session.role === 'admin'
    ? 'platform:admin'
    : `${session.companyId}:${session.role}:${session.memberId}`;
}
export function currentAcceptance(records: LegalAcceptance[], session: Session) {
  return records.find(
    (r) =>
      r.identity === legalIdentity(session) &&
      r.termsVersion === LEGAL.terms &&
      r.privacyVersion === LEGAL.privacy,
  );
}
export function readAcceptances(storage: Pick<Storage, 'getItem'>): LegalAcceptance[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(LEGAL_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is LegalAcceptance =>
        r &&
        typeof r.identity === 'string' &&
        typeof r.companyId === 'string' &&
        typeof r.userId === 'string' &&
        typeof r.termsVersion === 'string' &&
        typeof r.privacyVersion === 'string' &&
        typeof r.acceptedAt === 'string' &&
        Number.isFinite(Date.parse(r.acceptedAt)) &&
        r.source === 'preview_first_access',
    );
  } catch {
    return [];
  }
}
export function recordAcceptance(
  storage: Pick<Storage, 'setItem'>,
  records: LegalAcceptance[],
  session: Session,
  terms: boolean,
  privacy: boolean,
): LegalAcceptance[] {
  if (!terms || !privacy)
    throw Error('Confirme os Termos de Uso e a leitura da Política de Privacidade.');
  if (currentAcceptance(records, session)) return records;
  const next = [
    ...records,
    {
      identity: legalIdentity(session),
      companyId: session.companyId,
      userId: session.role === 'admin' ? 'preview-admin' : session.memberId,
      termsVersion: LEGAL.terms,
      privacyVersion: LEGAL.privacy,
      acceptedAt: new Date().toISOString(),
      source: 'preview_first_access' as const,
    },
  ];
  storage.setItem(LEGAL_KEY, JSON.stringify(next));
  return next;
}
