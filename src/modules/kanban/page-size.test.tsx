import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { KanbanSizeControl } from './page-size';

describe('Quantidade de cards por etapa', () => {
  it('oferece as quatro opções sem mudar a paginação de outras tabelas', () => {
    const html = renderToStaticMarkup(<KanbanSizeControl size={10} onChange={() => {}} />);
    for (const option of ['10', '50', '100']) {
      expect(html).toContain(`value="${option}"`);
    }
    expect(html).toContain('value="all"');
    expect(html).toContain('Todos');
    expect(html).toContain('Cards por etapa');
  });
  it('marca Todos como opção selecionada ao carregar todos os cards', () => {
    const html = renderToStaticMarkup(<KanbanSizeControl size="all" onChange={() => {}} />);
    expect(html).toContain('value="all" selected=""');
  });
});
