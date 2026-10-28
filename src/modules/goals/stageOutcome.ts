// Shared business semantics for both the isolated preview and authenticated CRM.
// A kanban column alone never means a real, paid sale.
export type HighImpactStage = 'sale' | 'other' | null;
export function highImpactStage(name: string): HighImpactStage {
  const value=name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if (/^(fechado|ganho|venda realizada|venda concluida|procedimento realizado|atendimento realizado)$/.test(value)) return 'sale';
  if (/^(no[ -]?show|perdido|cancelado|desqualificado|nao compareceu)$/.test(value)) return 'other';
  return null;
}
