import type { SupabaseClient } from '@supabase/supabase-js';
import {
  legalReadiness,
  type LegalAcceptance,
  type PublishedDocument,
  type RequiredDocument,
} from './flow';

export interface AccountUser {
  id: string;
  email: string;
  displayName: string;
}

export type AccountAccess =
  | { stage: 'signed-out' }
  | { stage: 'password'; email: string }
  | { stage: 'legal-unavailable'; email: string }
  | { stage: 'accept'; email: string; documents: PublishedDocument[]; pending: RequiredDocument[] }
  | { stage: 'ready'; email: string; user: AccountUser; isAdmin: boolean };

// A função não consulta empresas nem usa metadados editáveis para decidir o perfil.
export async function loadAccountAccess(client: SupabaseClient): Promise<AccountAccess> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user || auth.user.is_anonymous) return { stage: 'signed-out' };
  const email = auth.user.email || '';
  const firstAccess = await client.rpc('crm_first_access_status');
  if (firstAccess.error) throw firstAccess.error;
  if (firstAccess.data?.password_change_required !== false) return { stage: 'password', email };

  const [requirements, documents, acceptances] = await Promise.all([
    client.from('crm_legal_requirements').select('kind,version'),
    client.from('crm_legal_documents').select('kind,version,body,content_sha256,published_at'),
    client.from('crm_legal_acceptances').select('kind,version').eq('user_id', auth.user.id),
  ]);
  if (requirements.error || documents.error || acceptances.error) {
    throw requirements.error || documents.error || acceptances.error;
  }
  const legal = legalReadiness(
    (requirements.data || []) as RequiredDocument[],
    (documents.data || []) as PublishedDocument[],
    (acceptances.data || []) as LegalAcceptance[],
  );
  if (!legal.ready) return { stage: 'legal-unavailable', email };
  if (!legal.accepted)
    return { stage: 'accept', email, documents: legal.documents, pending: legal.pending };

  const [admin, profile] = await Promise.all([
    client.rpc('crm_is_platform_admin'),
    client.from('crm_profiles').select('display_name').eq('id', auth.user.id).single(),
  ]);
  if (admin.error || profile.error || typeof admin.data !== 'boolean' || !profile.data) {
    throw admin.error || profile.error || Error('Perfil indisponível.');
  }
  return {
    stage: 'ready',
    email,
    isAdmin: admin.data,
    user: { id: auth.user.id, email, displayName: profile.data.display_name },
  };
}

export class AccessChangedError extends Error {
  constructor() {
    super('Seu acesso precisa ser verificado novamente.');
  }
}

export async function requireReadyAdmin(client: SupabaseClient, expectedUserId: string) {
  const access = await loadAccountAccess(client);
  if (access.stage !== 'ready' || !access.isAdmin || access.user.id !== expectedUserId) {
    throw new AccessChangedError();
  }
}
