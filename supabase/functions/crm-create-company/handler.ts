import type { CommandContext } from '../_shared/contracts.ts';
import { fingerprint, invalid, keys, text } from '../_shared/validation.ts';

export async function createCompany({ actorId, requestId, body, backend }: CommandContext) {
  keys(body, ['name', 'segment', 'template', 'theme', 'monthly_amount_cents', 'due_date']);
  const name = text(body.name, 'nome');
  const segment = text(body.segment, 'segmento');
  const template = body.template ?? 'aesthetic';
  if (template !== 'aesthetic' && template !== 'generic') invalid('Selecione um modelo válido.');
  const theme = body.theme ?? (template === 'generic' ? 'blue' : 'sun7');
  if (
    typeof theme !== 'string' ||
    !['sun7', 'blue', 'original', 'neutral', 'elegant', 'rose', 'barber'].includes(theme)
  )
    invalid('Selecione uma cor válida.');
  const amount = body.monthly_amount_cents;
  if (!Number.isSafeInteger(amount) || Number(amount) < 0 || Number(amount) > 2_147_483_647)
    invalid('Informe o valor em centavos inteiros.');
  const dueDate = body.due_date;
  if (
    typeof dueDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
    Number.isNaN(Date.parse(dueDate)) ||
    new Date(dueDate).toISOString().slice(0, 10) !== dueDate
  )
    invalid('Informe uma data de vencimento válida.');
  const values = {
    name,
    segment,
    template,
    theme,
    monthly_amount_cents: amount,
    due_date: dueDate,
  };
  const companyId = await backend.rpc<string>('crm_edge_create_company', {
    p_actor: actorId,
    p_request_id: requestId,
    p_fingerprint: await fingerprint([values]),
    p_values: values,
  });
  return { status: 201, data: { company_id: companyId, enabled: false } };
}
