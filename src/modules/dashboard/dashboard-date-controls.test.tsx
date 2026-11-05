import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardDateControls } from './DashboardDateControls';

describe('datas do Dashboard', () => {
  const initial = {from: '2026-11-01', to: '2026-11-05'};

  it('mostra calendário, filtro de intervalo e período legível', () => {
    const html = renderToStaticMarkup(
      <DashboardDateControls value={initial} initial={initial} onChange={() => {}} />,
    );
    expect(html).toContain('Selecionar dia do dashboard');
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-11-05"');
    expect(html).toContain('Período: 01/11/2026 – 05/11/2026');
    expect(html).toContain('Filtros');
  });

  it('resume o dia selecionado sem deixar período ambíguo', () => {
    const day = {from: '2026-11-03', to: '2026-11-03'};
    const html = renderToStaticMarkup(
      <DashboardDateControls value={day} initial={initial} onChange={() => {}} />,
    );
    expect(html).toContain('Dia: 03/11/2026');
  });
});
