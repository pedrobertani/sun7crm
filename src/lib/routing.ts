/** Converte links compartilhados pelo roteador antigo sem alterar âncoras ou tokens. */
export function legacyRouteTarget(href: string): string | null {
  const current = new URL(href);
  if (!current.hash.startsWith('#/')) return null;

  let route: URL;
  try {
    route = new URL(current.hash.slice(1), current.origin);
  } catch {
    return null;
  }
  if (route.origin !== current.origin) return null;

  const routeKeys = new Set(route.searchParams.keys());
  for (const [name, value] of current.searchParams) {
    if (!routeKeys.has(name)) route.searchParams.append(name, value);
  }
  return route.pathname + route.search + route.hash;
}
