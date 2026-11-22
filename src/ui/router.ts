// Hash routes (design 5.1). Work on GitHub Pages with no server.

export type Route =
  | { name: 'churchyard'; query: URLSearchParams }
  | { name: 'table'; query: URLSearchParams }
  | { name: 'sat'; norad: number; query: URLSearchParams }
  | { name: 'census'; query: URLSearchParams }
  | { name: 'method'; query: URLSearchParams }
  | { name: 'notfound'; query: URLSearchParams };

/** Reads a location hash such as "#/sat/27378" or "#/?verdict=buried". Never throws. */
export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const q = raw.indexOf('?');
  const path = q < 0 ? raw : raw.slice(0, q);
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(q < 0 ? '' : raw.slice(q + 1));
  } catch {
    query = new URLSearchParams();
  }
  const parts = path.split('/').filter((p) => p !== '');
  if (parts.length === 0) return { name: 'churchyard', query };
  const [first, second] = parts;
  if (parts.length === 1) {
    if (first === 'table' || first === 'census' || first === 'method') return { name: first, query };
  }
  if (parts.length === 2 && first === 'sat' && /^\d+$/.test(second!)) {
    const norad = Number(second);
    if (Number.isSafeInteger(norad) && norad > 0) return { name: 'sat', norad, query };
  }
  return { name: 'notfound', query };
}

/** The nav item a route belongs to. */
export const navRouteOf = (route: Route): string => (route.name === 'sat' ? 'table' : route.name);

/** Calls `render` now and on every hash change. Returns a function that stops listening. */
export function startRouter(render: (route: Route, isFirst: boolean) => void): () => void {
  let first = true;
  const run = (): void => {
    render(parseHash(window.location.hash), first);
    first = false;
  };
  window.addEventListener('hashchange', run);
  run();
  return () => window.removeEventListener('hashchange', run);
}
