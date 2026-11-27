// Fetches register.json, then starts the router. The site loads no other data (R4.5).
import './styles/tokens.css';
import './styles/base.css';
import './styles/churchyard.css';
import './styles/filters.css';
import './styles/table.css';
import './styles/ledger.css';
import './styles/census.css';
import './styles/parish.css';
import './styles/method.css';
import './styles/print.css';
import { NAV, PAGE_HEADINGS, PAGE_TITLES, SITE } from './copy.ts';
import { esc, withSansDigits } from './html.ts';
import { isRegister } from './register.ts';
import type { UiRegister } from './register.ts';
import { navRouteOf, parseHash, QUERY_EVENT, startRouter } from './router.ts';
import type { Route } from './router.ts';
import { hashFor, parseState } from './state.ts';
import { mountCensus } from './views/census.ts';
import { mountChurchyard } from './views/churchyard.ts';
import { runLazy } from './lazy.ts';
import { loadErrorHtml, notFoundHtml } from './messages.ts';
import { mountTable } from './views/table.ts';

// The wide chart is 1,650 units across and scales to its box, so below this width its 12-unit text
// would be too small to read. At 200% zoom a 1,440 px screen is 720 px wide, so it gets the natural-size
// chart that scrolls inside its own box.
const NARROW = '(max-width: 900px)';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`index.html has no #${id}`);
  return found as T;
}

/** The churchyard and table links carry the filters of the page you are on, so both views show the same set. */
function navHref(item: (typeof NAV)[number], route: Route): string {
  if (item.route !== 'churchyard' && item.route !== 'table') return item.href;
  if (route.name !== 'churchyard' && route.name !== 'table') return item.href;
  return hashFor(item.route === 'table' ? 'table' : '', parseState(route.query));
}
function renderNav(route: Route): void {
  const current = navRouteOf(route);
  el('nav-list').innerHTML = NAV.map(
    (item) => `<li><a href="${esc(navHref(item, route))}"${item.route === current ? ' aria-current="page"' : ''}>${esc(item.label)}</a></li>`,
  ).join('');
}

function heading(route: Route): string {
  if (route.name === 'sat') return `${PAGE_TITLES.sat}: NORAD ${route.norad}`;
  if (route.name === 'parish' && route.scope !== 'index') return `${PAGE_TITLES.parish}: ${route.key}`;
  return PAGE_TITLES[route.name];
}
/** The h1. The same as the page title, except where PAGE_HEADINGS says it in the churchyard's words (the 404: "An empty plot"; its <title> stays "Not found · Sexton"). */
function visibleHeading(route: Route): string {
  return (route.name === 'sat' ? undefined : PAGE_HEADINGS[route.name]) ?? heading(route);
}

/** The list the visitor was last on, so a ledger can link back to it. A visitor who arrives on a ledger came from the churchyard. */
let lastList: { name: 'churchyard' | 'table'; query: URLSearchParams } = { name: 'churchyard', query: new URLSearchParams() };
let stopView: (() => void) | null = null;
let drawnNarrow: boolean | null = null;
/** Counts redraws, so a lazy view that arrives after the reader has moved on is dropped. */
let renderId = 0;

/** The churchyard, the table, the census, the method page and a ledger have a visible title of their own (a kicker and a lead line, the "At a glance" card,
 * or the header card), so their heading stays for screen readers and as the focus target only. */
function markTitle(route: Route, view: HTMLElement): void {
  el('page-title').classList.toggle(
    'visually-hidden',
    route.name === 'churchyard' || route.name === 'table' || route.name === 'census' || route.name === 'method' || view.querySelector('.ledger-head') !== null,
  );
}
/** Loads a view's module, then mounts it, unless the reader has already gone elsewhere. A failed load shows a message with a link that reloads the page. */
function lazyView(view: HTMLElement, id: number, load: () => Promise<() => () => void>): void {
  view.innerHTML = `<p>${esc(SITE.loading)}</p>`;
  void runLazy(
    load,
    () => id === renderId,
    (stop) => {
      stopView = stop;
      markTitle(parseHash(window.location.hash), view);
    },
    (html) => {
      view.innerHTML = html;
      view.querySelector<HTMLAnchorElement>('[data-retry]')?.addEventListener('click', (event) => {
        event.preventDefault();
        window.location.reload();
      });
    },
    window.location.hash,
  );
}
function renderRoute(reg: UiRegister, route: Route, isFirst: boolean): void {
  stopView?.();
  stopView = null;
  const id = ++renderId;
  const main = el('main');
  document.title = `${heading(route)} · ${SITE.title}`;
  renderNav(route);
  // `#/?cover=1` is a capture-only flag for a screenshot (the Devpost cover): the churchyard draws a compact
  // title over the bare chart instead, so the site header is hidden here too. It never changes the page when
  // the flag is absent, and nothing but this check reads it outside the churchyard view.
  document.querySelector('.site-header')?.classList.toggle('visually-hidden', route.name === 'churchyard' && route.query.get('cover') === '1');
  if (route.name === 'churchyard' || route.name === 'table') lastList = { name: route.name, query: route.query };
  const back =
    route.name === 'sat'
      ? `<p class="back-link"><a href="${esc(hashFor(lastList.name === 'table' ? 'table' : '', parseState(lastList.query)))}">${esc(SITE.backTo[lastList.name])}</a></p>`
      : '';
  main.innerHTML = `<h1 id="page-title" tabindex="-1">${withSansDigits(visibleHeading(route))}</h1>${back}<div id="view"></div>`;
  const view = el('view');
  if (route.name === 'churchyard') {
    drawnNarrow = window.matchMedia(NARROW).matches;
    stopView = mountChurchyard(view, reg, drawnNarrow, route.query);
  } else if (route.name === 'table') {
    stopView = mountTable(view, reg, route.query);
  } else if (route.name === 'sat') {
    // The ledger and the method page carry the case files, the methodology text and the Markdown reader, so they load when first opened.
    const { norad } = route;
    lazyView(view, id, () => import('./views/ledger.ts').then((m) => () => m.mountLedger(view, reg, norad)));
  } else if (route.name === 'census') {
    stopView = mountCensus(view, reg);
  } else if (route.name === 'parish') {
    // The parish pages carry their own text, so they load when first opened.
    const { scope, key } = route;
    lazyView(view, id, () => import('./views/parish.ts').then((m) => () => m.mountParish(view, reg, scope, key)));
  } else if (route.name === 'method') {
    const { query } = route;
    lazyView(view, id, () => import('./views/method.ts').then((m) => () => m.mountMethod(view, query)));
  } else {
    view.innerHTML = notFoundHtml();
  }
  markTitle(route, view);
  // After a navigation, move keyboard and screen-reader focus to the new page title.
  if (!isFirst) el('page-title').focus({ preventScroll: false });
}

async function boot(): Promise<void> {
  const main = el('main');
  // "#main" would be read as a route, so the skip link moves focus itself.
  el('skip-main').addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
  });
  main.innerHTML = `<p>${esc(SITE.loading)}</p>`;
  let reg: UiRegister;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}register.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    if (!isRegister(data)) throw new Error('register.json is not the expected shape');
    reg = data;
  } catch {
    renderNav({ name: 'churchyard', query: new URLSearchParams() });
    main.innerHTML = `<h1>${esc(SITE.title)}</h1>${loadErrorHtml()}`;
    main.querySelector('[data-retry]')?.addEventListener('click', () => window.location.reload());
    return;
  }
  const banner = el('sample-banner');
  banner.hidden = !reg.sample;
  banner.textContent = reg.sample ? SITE.sampleBanner : '';
  el('skip-main').textContent = SITE.skipToMain;
  startRouter((route, isFirst) => renderRoute(reg, route, isFirst));
  // Filters and sort change the hash without a redraw, so the nav links are rebuilt here.
  window.addEventListener(QUERY_EVENT, () => renderNav(parseHash(window.location.hash)));
  // Redraw when the screen crosses the phone width, because the columns change.
  window.matchMedia(NARROW).addEventListener('change', () => {
    if (window.matchMedia(NARROW).matches !== drawnNarrow) renderRoute(reg, parseHash(window.location.hash), true);
  });
}

void boot();
