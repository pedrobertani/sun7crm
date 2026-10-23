import type { CommandContext } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { keys, password, uuid } from '../_shared/validation.ts';

// Apenas o proprio usuario autenticado pode substituir a senha temporaria.
// A identitidade vem de Auth.getUser(token), nunca do JSON enviado.
export async function completeFirstAccess({ actorId, body, backend }: CommandContext) {
  keys(body, ['password']);
  const nextPassword = password(body.password);
  const nonce = uuid(
    await backend.rpc<string>('crm_first_access_begin', { p_actor: actorId }),
    'primeiro acesso',
  );
  try {
    await backend.resetPassword(actorId, nextPassword);
  } catch {
    throw new HttpError(
      502,
      'PASSWORD_CHANGE_UNCONFIRMED',
      'Nao foi possivel confirmar a troca da senha. Confira seu acesso antes de tentar novamente.',
    );
  }
  try {
    await backend.rpc<boolean>('crm_first_access_complete', {
      p_actor: actorId,
      p_nonce: nonce,
    });
  } catch {
    backend.report('FIRST_ACCESS_REVIEW_REQUIRED', actorId);
    throw new HttpError(
      503,
      'FIRST_ACCESS_REVIEW_REQUIRED',
      'A senha foi alterada, mas a liberacao da conta precisa de revisao. Nao informe a senha a outra pessoa.',
    );
  }
  return { status: 200, data: { password_changed: true } };
}
