/** Seções padronizadas de campanha na demo e no aplicativo real. */
export type CampaignView = 'overview' | 'referrals' | 'history';

export const campaignViews: { value: CampaignView; label: string }[] = [
  { value: 'overview', label: 'Resumo' },
  { value: 'referrals', label: 'Indicações' },
  { value: 'history', label: 'Histórico' },
];
