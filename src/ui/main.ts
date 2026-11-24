// Fetches register.json, then starts the router. The site loads no other data (R4.5).
import './styles/tokens.css';
import './styles/base.css';
import './styles/churchyard.css';
import './styles/table.css';
import './styles/ledger.css';
import './styles/census.css';
import './styles/method.css';
import './styles/print.css';
import { NAV, PAGE_TITLES, SITE } from './copy.ts';
import { esc, withSansDigits } from './html.ts';
import { isRegister } from './register.ts';
import type { UiRegister } from './register.ts';
import { navRouteOf, parseHash, QUERY_EVENT, startRouter } from './router.ts';
import type { Route } from './router.ts';
import { hashFor, parseState } from './state.ts';
import { mountCensus } from './views/census.ts';
import { mountChurchyard } from './views/churchyard.ts';
import { mountLedger } from './views/ledger.ts';
import { mountMethod } from './views/method.ts';
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
  return PAGE_TITLES[route.name];
}

/** The list the visitor was last on, so a ledger can link back to it. A visitor who arrives on a ledger came from the churchyard. */
let lastList: { name: 'churchyard' | 'table'; query: URLSearchParams } = { name: 'churchyard', query: new URLSearchParams() };
let stopView: (() => void) | null = null;
let drawnNarrow: boolean | null = null;

function renderRoute(reg: UiRegister, route: Route, isFirst: boolean): void {
  stopView?.();
  stopView = null;
  const main = el('main');
  document.title = `${heading(route)} · ${SITE.title}`;
  renderNav(route);
  if (route.name === 'churchyard' || route.name === 'table') lastList = { name: route.name, query: route.query };
  const back =
    route.name === 'sat'
      ? `<p class="back-link"><a href="${esc(hashFor(lastList.name === 'table' ? 'table' : '', parseState(lastList.query)))}">${esc(SITE.backTo[lastList.name])}</a></p>`
      : '';
  main.innerHTML = `<h1 id="page-title" tabindex="-1">${withSansDigits(heading(route))}</h1>${back}<div id="view"></div>`;
  const view = el('view');
  if (route.name === 'churchyard') {
    drawnNarrow = window.matchMedia(NARROW).matches;
    stopView = mountChurchyard(view, reg, drawnNarrow, route.query);
  } else if (route.name === 'table') {
    stopView = mountTable(view, reg, route.query);
  } else if (route.name === 'sat') {
    stopView = mountLedger(view, reg, route.norad);
  } else if (route.name === 'census') {
    stopView = mountCensus(view, reg);
  } else if (route.name === 'method') {
    stopView = mountMethod(view);
  } else {
    view.innerHTML = `<p>${esc(SITE.notFound)}</p><p><a href="#/">${esc(SITE.backToChurchyard)}</a></p>`;
  }
  // The churchyard and a ledger have a visible title of their own (the nav, or the header card), so their heading stays
  // for screen readers and as the focus target only.
  el('page-title').classList.toggle('visually-hidden', route.name === 'churchyard' || view.querySelector('.ledger-head') !== null);
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
    main.innerHTML = `<h1>${esc(SITE.title)}</h1><p role="alert">${esc(SITE.loadError)}</p>`;
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
