import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecordTitle } from '../components/RecordTitle';
import { Panel, Empty } from '../components/shared';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { whatsappLink } from './whatsapp';

const payloads = [
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '</strong><script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
];

describe('XSS: renderização segura de conteúdo de clientes', () => {
  it.each(payloads)(
    'renderiza dados como texto escapado em títulos, painéis e estados vazios: %s',
    (payload) => {
      const html = renderToStaticMarkup(
        <>
          <RecordTitle title={payload} />
          <Panel title={payload} description={payload}>
            <span>{payload}</span>
          </Panel>
          <Empty title={payload} description={payload} />
        </>,
      );
      expect(html).toContain('&lt;');
      expect(html).not.toContain('<img src=x');
      expect(html).not.toContain('<svg onload');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</strong><script>');
    },
  );

  it('escapa conteúdo não confiável em atributos acessíveis do WhatsApp', () => {
    const suspiciousName = '"><img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(
      <WhatsAppButton name={suspiciousName} phone="11987654321" />,
    );
    expect(html).toContain('href="https://wa.me/5511987654321"');
    expect(html).toContain('aria-label="Abrir WhatsApp de &quot;&gt;&lt;img');
    expect(html).not.toContain('<img src=x');
  });

  it('não aceita protocolo javascript como destino do botão WhatsApp', () => {
    expect(whatsappLink('javascript:alert(1)')).toBeNull();
    const html = renderToStaticMarkup(
      <WhatsAppButton name="Pessoa" phone="javascript:alert(1)" />,
    );
    expect(html).not.toContain('href=');
    expect(html).toContain('disabled=""');
  });
});
