import type { CommandContext } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { keys, password, uuid } from '../_shared/validation.ts';

export async function resetPassword({ actorId, requestId, body, backend }: CommandContext) {
  keys(body, ['company_id', 'user_id', 'password']);
  const companyId = uuid(body.company_id, 'empresa');
  const targetUser = uuid(body.user_id, 'usuário');
  const nextPassword = password(body.password);
  const args = { p_actor: actorId, p_request_id: requestId };
  await backend.rpc('crm_edge_begin_password_reset', {
    ...args,
    p_company: companyId,
    p_target: targetUser,
  });
  try {
    await backend.resetPassword(targetUser, nextPassword);
  } catch {
    try {
      await backend.rpc('crm_edge_end_password_reset', { ...args, p_succeeded: false });
    } catch {
      backend.report('PASSWORD_RESET_AUDIT_PENDING', requestId);
    }
    // Não repetir automaticamente: o Auth pode ter recebido a alteração antes da queda de rede.
    throw new HttpError(
      502,
      'AUTH_RESET_UNCONFIRMED',
      'Não foi possível confirmar a alteração. Confira o acesso antes de tentar novamente.',
    );
  }
  try {
    await backend.rpc('crm_edge_end_password_reset', { ...args, p_succeeded: true });
  } catch {
    backend.report('PASSWORD_RESET_AUDIT_PENDING', requestId);
  }
  return { status: 200, data: { password_changed: true } };
}
