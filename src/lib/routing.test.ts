import { describe, expect, it } from 'vitest';
import { legacyRouteTarget } from './routing';

describe('Migração dos links compartilhados', () => {
  it.each(['/acessar', '/admin/empresas', '/app/funil', '/demo/painel', '/'])(
    'abre o endereço limpo de %s',
    (path) => {
      expect(legacyRouteTarget('https://sun7crm.pages.dev/#' + path)).toBe(path);
    },
  );

  it('mantém o card selecionado e a âncora de uma URL antiga', () => {
    expect(legacyRouteTarget('https://sun7crm.pages.dev/#/app/funil?card=abc#detalhes')).toBe(
      '/app/funil?card=abc#detalhes',
    );
  });

  it('preserva parâmetros externos e prioriza os filtros da rota antiga', () => {
    const target = legacyRouteTarget(
      'https://sun7crm.pages.dev/?utm_source=indicacao&status=antigo#/demo/contatos?status=ativo&tag=a&tag=b',
    );
    const route = new URL(target!, 'https://sun7crm.pages.dev');
    expect(route.pathname).toBe('/demo/contatos');
    expect(route.searchParams.get('utm_source')).toBe('indicacao');
    expect(route.searchParams.getAll('status')).toEqual(['ativo']);
    expect(route.searchParams.getAll('tag')).toEqual(['a', 'b']);
  });

  it.each([
    '/acessar',
    '/termos#secao-2',
    '/conta#access_token=exemplo&type=recovery',
    '/conta?code=exemplo',
  ])('preserva a URL atual ou o fragmento de autenticação em %s', (path) => {
    expect(legacyRouteTarget('https://sun7crm.pages.dev' + path)).toBeNull();
  });

  it.each(['#//outro.example/acessar', '#/\\outro.example/acessar'])(
    'recusa um destino externo em %s',
    (hash) => {
      expect(legacyRouteTarget('https://sun7crm.pages.dev/' + hash)).toBeNull();
    },
  );

  it.each(['#//[', '#//%'])('ignora um link antigo inválido sem interromper o app: %s', (hash) => {
    expect(legacyRouteTarget('https://sun7crm.pages.dev/' + hash)).toBeNull();
  });
});
