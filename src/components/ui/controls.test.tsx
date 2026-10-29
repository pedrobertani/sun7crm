import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { Button } from './button';
import { ViewSwitcher } from './view-switcher';
import { campaignViews } from '../../modules/growth/campaign-views';
import { WhatsAppButton } from '../WhatsAppButton';
import { ActivityReportView } from '../../modules/reports/ActivityReport';

describe('Controles compartilhados', () => {
  it('mantém nome acessível e destino em ações compactas de navegação', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Button asChild size="icon" aria-label="Abrir histórico">
          <Link to="/demo/relatorios">
            <History />
          </Link>
        </Button>
      </MemoryRouter>,
    );
    expect(html).toContain('href="/demo/relatorios"');
    expect(html).toContain('aria-label="Abrir histórico"');
    expect(html).not.toContain('<button');
  });
  it('selecionar uma visualização não submete o formulário que a contém', () => {
    const html = renderToStaticMarkup(
      <form>
        <ViewSwitcher
          label="Visualização"
          value="lista"
          onValueChange={() => {}}
          items={[
            { value: 'lista', label: 'Lista' },
            { value: 'quadro', label: 'Quadro' },
          ]}
        />
      </form>,
    );
    expect(html.match(/type="button"/g)).toHaveLength(2);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('role="group"');
  });
  it('mantém as abas da campanha no padrão compartilhado da demo e do app real', () => {
    const html = renderToStaticMarkup(
      <ViewSwitcher
        label="Seções da campanha"
        value="overview"
        onValueChange={() => {}}
        items={campaignViews}
      />,
    );
    expect(html).toContain('aria-label="Seções da campanha"');
    expect(html).toContain('Resumo');
    expect(html).toContain('Indicações');
    expect(html).toContain('Histórico');
    expect(html.match(/type="button"/g)).toHaveLength(3);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
  it('explica WhatsApp desabilitado sem atribuir falta de telefone a quem não tem permissão', () => {
    const blocked = renderToStaticMarkup(
      <WhatsAppButton name="QA" phone="11900000001" compact disabled />,
    );
    expect(blocked).toContain('Sem permissão');
    expect(blocked).toContain('tabindex="0"');
    expect(blocked).toContain('aria-disabled="true"');
    expect(blocked).not.toContain('telefone válido');
    const missing = renderToStaticMarkup(<WhatsAppButton name="QA" phone="" compact />);
    expect(missing).toContain('telefone válido com DDD');
    expect(missing).not.toContain('href=');
  });
  it('relatório mantém cada contagem na sua coluna e o título abre o histórico', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ActivityReportView
          rows={[
            {
              contactId: 'qa',
              name: 'QA Cliente',
              phone: '11900000001',
              ownerId: 'owner',
              ownerName: 'QA Gestor',
              createdAt: '2020-01-01',
              lastActivityAt: null,
              lastWhatsappAt: null,
              lastMovementAt: null,
              whatsappCount: 3,
              movementCount: 2,
              noteCount: 1,
            },
          ]}
          actors={[]}
          onHistory={() => {}}
          onWhatsapp={() => {}}
        />
      </MemoryRouter>,
    );
    expect(html).toContain('Abrir histórico de QA Cliente');
    expect(html).toContain('class="numeric">3</td>');
    expect(html).toContain('class="numeric">2</td>');
    expect(html).toContain('class="numeric">1</td>');
    expect(html).toContain('Como os dados são contados');
  });
});
