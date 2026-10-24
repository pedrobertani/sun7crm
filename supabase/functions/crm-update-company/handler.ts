import type { CommandContext } from '../_shared/contracts.ts';
import { fingerprint, invalid, keys, text, uuid } from '../_shared/validation.ts';

export async function updateCompany({ actorId, requestId, body, backend }: CommandContext) {
  keys(body, [
    'company_id',
    'name',
    'segment',
    'template',
    'theme',
    'monthly_amount_cents',
    'due_date',
    'enabled',
  ]);
  const companyId = uuid(body.company_id, 'empresa');
  const name = text(body.name, 'nome'),
    segment = text(body.segment, 'segmento');
  const template = body.template,
    theme = body.theme;
  if (template !== 'aesthetic' && template !== 'generic') invalid('Selecione um modelo válido.');
  if (
    typeof theme !== 'string' ||
    !['sun7', 'blue', 'original', 'neutral', 'elegant', 'rose', 'barber'].includes(theme)
  )
    invalid('Selecione uma cor válida.');
  const amount = body.monthly_amount_cents,
    dueDate = body.due_date;
  if (!Number.isSafeInteger(amount) || Number(amount) < 0 || Number(amount) > 2_147_483_647)
    invalid('Informe o valor em centavos inteiros.');
  if (
    typeof dueDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    Number.isNaN(Date.parse(dueDate)) ||
    new Date(dueDate).toISOString().slice(0, 10) !== dueDate
  )
    invalid('Informe uma data de vencimento válida.');
  if (typeof body.enabled !== 'boolean') invalid('Informe a situação da empresa.');
  const values = {
    name,
    segment,
    template,
    theme,
    monthly_amount_cents: amount,
    due_date: dueDate,
    enabled: body.enabled,
  };
  await backend.rpc('crm_edge_update_company', {
    p_actor: actorId,
    p_request_id: requestId,
    p_company: companyId,
    p_fingerprint: await fingerprint([companyId, values]),
    p_values: values,
  });
  return { status: 200, data: { company_id: companyId, enabled: body.enabled } };
}
