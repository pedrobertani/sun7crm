export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function databaseError(error: { code?: string; message?: string }): HttpError {
  if (error.message?.includes('CRM_BILLING_CHANGED')) {
    return new HttpError(
      409,
      'BILLING_CHANGED',
      'O plano mudou. Atualize os dados e gerencie o vencimento na aba Planos.',
    );
  }
  if (error.message?.includes('CRM_MANAGER_REQUIRED')) {
    return new HttpError(
      400,
      'MANAGER_REQUIRED',
      'Cadastre um gestor ativo antes de habilitar a empresa.',
    );
  }
  if (error.message?.includes('CRM_LEGAL_REQUIRED')) {
    return new HttpError(403, 'LEGAL_REQUIRED', 'Confirme os documentos vigentes para continuar.');
  }
  if (error.code === '42501') {
    return new HttpError(403, 'FORBIDDEN', 'Você não tem permissão para esta ação.');
  }
  if (error.code === '23505') {
    return new HttpError(409, 'CONFLICT', 'Esta solicitação já existe ou está em andamento.');
  }
  if (error.code === 'P0002') {
    return new HttpError(404, 'NOT_FOUND', 'Registro não encontrado.');
  }
  if (error.code === 'P0003') {
    return new HttpError(429, 'RATE_LIMITED', 'Aguarde antes de tentar novamente.');
  }
  if (error.code?.startsWith('22') || error.code === '23514') {
    return new HttpError(400, 'INVALID_INPUT', 'Confira os dados informados.');
  }
  return new HttpError(503, 'DATABASE_UNAVAILABLE', 'Não foi possível concluir a solicitação.');
}
