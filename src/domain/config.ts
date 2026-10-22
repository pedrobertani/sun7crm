// Propostas isoladas até a validação comercial. Nomes não representam eventos de negócio.
export const PROVISIONAL_MAX_STAGES = 10;
export const roleLabels = {
  admin: 'Caio · Administração',
  manager: 'Gestor',
  seller: 'Vendedor / Consultora',
  reception: 'Recepção',
};
export const temperatureLabels = {
  unclassified: 'Sem classificação',
  cold: 'Frio',
  warm: 'Morno',
  hot: 'Quente',
};
export const defaultStages = {
  leads: ['Lead novo', 'Nutrição', 'Agendado', 'No-show', 'Compareceu', 'Fechado'],
  clients: ['Clientes ativos', 'Relacionamento', 'Indicação', 'Nova oportunidade'],
};
