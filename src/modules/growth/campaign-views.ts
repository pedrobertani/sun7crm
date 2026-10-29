/** As mesmas seções de campanha na demo e no aplicativo real. */
export const campaignViews = [
  { value: 'overview', label: 'Resumo' },
  { value: 'referrals', label: 'Indicações' },
  { value: 'history', label: 'Histórico' },
] as const;

export type CampaignView = (typeof campaignViews)[number]['value'];
