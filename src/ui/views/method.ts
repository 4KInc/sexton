// The methodology page (design 5.9, R9): docs/methodology.md rendered as it is written, with a table of contents.
// The contents are built from the document's own headings, so they cannot drift from it.
import { METHOD } from '../copy.ts';
import { METHODOLOGY } from '../content.ts';
import { esc } from '../html.ts';
import { renderDocument } from '../markdown.ts';
interface Entry {
  id: string;
  text: string;
  level: 2 | 3;
}
/** The h2 and h3 headings of rendered document HTML, in order. */
export function headingsOf(html: string): Entry[] {
  return [...html.matchAll(/<h([23]) id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: Number(m[1]) as 2 | 3,
    id: m[2]!,
    text: m[3]!.replace(/<[^>]*>/g, ''),
  }));
}
/** The contents list. Links keep the hash route (`#/method`) and a script moves the page, because a bare `#id` would be read as a route. */
export function tocHtml(entries: readonly Entry[]): string {
  const items = entries
    .map((e) => `<li class="toc-${e.level}"><a href="#/method" data-toc="${esc(e.id)}">${esc(e.text)}</a></li>`)
    .join('');
  return `<details class="toc"><summary>${esc(METHOD.contents)}</summary><nav aria-label="${esc(METHOD.contents)}"><ul>${items}</ul></nav></details>`;
}
/**
 * The page body for a document text. Each section is an expander (a <details>) that holds its own heading, so a link to
 * `#/method?s=<heading id>` can open it. "At a glance" starts open. The document is the only content, so the page cannot drift from the file.
 */
export function methodHtml(text: string = METHODOLOGY): string {
  const doc = renderDocument(text, METHOD.tableLabel);
  const parts = doc.split(/(?=<h2 )/);
  const intro = parts[0]!.startsWith('<h2 ') ? '' : parts.shift()!;
  const body = parts
    .map((chunk) => {
      const end = chunk.indexOf('</h2>') + 5;
      const glance = chunk.includes('id="m-at-a-glance"');
      return `<details class="msec${glance ? ' msec--glance' : ''}"${glance ? ' open' : ''}><summary>${chunk.slice(0, end)}</summary><div class="msec-body">${chunk.slice(end)}</div></details>`;
    })
    .join('');
  const controls = `<p class="method-controls"><button type="button" class="link-button" data-open-all>${esc(METHOD.openAll)}</button> <button type="button" class="link-button" data-close-all>${esc(METHOD.closeAll)}</button></p>`;
  return `<div class="method-layout">${tocHtml(headingsOf(doc))}<article class="method">${intro}${controls}${body}</article></div>`;
}
/** Draws the page. `?s=<heading id>` in the address opens the page at that section (a chart's "Method §" link). */
export function mountMethod(root: HTMLElement, query: URLSearchParams = new URLSearchParams()): () => void {
  root.innerHTML = methodHtml();
  const toc = root.querySelector<HTMLDetailsElement>('.toc')!;
  // Open on a wide screen, where it sits beside the text. Closed on a phone, where it would push the text down.
  toc.open = window.matchMedia('(min-width: 1000px)').matches;
  // After the router has moved focus to the page heading, so the section keeps it.
  const target = query.get('s');
  if (target !== null && /^m-[a-z0-9-]+$/.test(target)) {
    window.setTimeout(() => {
      const heading = root.querySelector<HTMLElement>(`#${target}`);
      heading?.closest('details')?.setAttribute('open', '');
      heading?.focus();
    }, 0);
  }
  const onClick = (event: Event): void => {
    const el = event.target as Element;
    const all = el.closest('[data-open-all], [data-close-all]');
    if (all !== null) {
      for (const d of root.querySelectorAll<HTMLDetailsElement>('details.msec')) d.open = all.hasAttribute('data-open-all');
      return;
    }
    const link = el.closest<HTMLAnchorElement>('a[data-toc]');
    if (link === null) return;
    event.preventDefault();
    const heading = root.querySelector<HTMLElement>(`#${CSS.escape(link.dataset['toc']!)}`);
    heading?.closest('details')?.setAttribute('open', '');
    heading?.focus();
    toc.open = window.matchMedia('(min-width: 1000px)').matches;
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
