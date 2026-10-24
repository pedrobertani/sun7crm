import { reportSafely } from '../_shared/telemetry.ts';
import type { CommandContext } from '../_shared/contracts.ts';
import { HttpError } from '../_shared/errors.ts';
import { fingerprint, invalid, keys, password, text, uuid } from '../_shared/validation.ts';

interface Provisioning {
  state: 'pending' | 'complete' | 'cancelled';
  user_id: string | null;
  membership_id: string | null;
}

export async function createUser({ actorId, requestId, traceId, body, backend }: CommandContext) {
  keys(body, ['company_id', 'role', 'display_name', 'email', 'password']);
  const companyId = uuid(body.company_id, 'empresa');
  const role = body.role;
  if (typeof role !== 'string' || !['manager', 'seller', 'reception'].includes(role))
    invalid('Selecione um perfil válido.');
  const displayName = text(body.display_name, 'nome');
  const email = text(body.email, 'e-mail', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid('Informe um e-mail válido.');
  const initialPassword = password(body.password);
  const args = { p_actor: actorId, p_request_id: requestId };
  const prepared = await backend.rpc<Provisioning>('crm_edge_prepare_user', {
    ...args,
    p_company: companyId,
    p_role: role,
    p_fingerprint: await fingerprint([companyId, role, displayName, email]),
  });
  if (prepared.state === 'complete') {
    return {
      status: 200,
      data: { user_id: prepared.user_id, membership_id: prepared.membership_id },
    };
  }

  let createdUser: { id: string } | undefined;
  try {
    createdUser = await backend.createUser({
      email,
      password: initialPassword,
      operationId: requestId,
    });
    const result = await backend.rpc<Provisioning>('crm_edge_finish_user', {
      ...args,
      p_user: createdUser.id,
      p_display_name: displayName,
    });
    return { status: 201, data: { user_id: result.user_id, membership_id: result.membership_id } };
  } catch (error) {
    let state: Provisioning;
    try {
      // A trava no banco resolve se o commit aconteceu antes de uma falha de rede.
      state = await backend.rpc<Provisioning>('crm_edge_cancel_user', args);
    } catch {
      await reportSafely(backend, 'PROVISIONING_REVIEW_REQUIRED', traceId || requestId, {
        actorId,
        operationId: requestId,
      });
      throw new HttpError(
        503,
        'PROVISIONING_REVIEW_REQUIRED',
        'O cadastro precisa de revisão antes de uma nova tentativa.',
      );
    }
    if (state.state === 'complete') {
      return { status: 200, data: { user_id: state.user_id, membership_id: state.membership_id } };
    }
    if (createdUser) {
      try {
        await backend.deleteUser(createdUser.id);
      } catch {
        await reportSafely(backend, 'PROVISIONING_REVIEW_REQUIRED', traceId || requestId, {
          actorId,
          operationId: requestId,
        });
        throw new HttpError(
          503,
          'PROVISIONING_REVIEW_REQUIRED',
          'O cadastro precisa de revisão antes de uma nova tentativa.',
        );
      }
    }
    // Uma falha de transporte no Auth pode ter criado a conta sem devolver seu ID.
    // O marcador administrativo crm_provisioning_id permite a conciliação pelo operador.
    if (!createdUser)
      await reportSafely(backend, 'AUTH_CREATE_REVIEW_IF_AMBIGUOUS', traceId || requestId, {
        actorId,
        operationId: requestId,
      });
    throw error;
  }
}
