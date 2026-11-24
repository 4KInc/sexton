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
/** The page body for a document text. The document is the only content, so the page cannot drift from the file. */
export function methodHtml(text: string = METHODOLOGY): string {
  const doc = renderDocument(text, METHOD.tableLabel);
  return `<div class="method-layout">${tocHtml(headingsOf(doc))}<article class="method">${doc}</article></div>`;
}
export function mountMethod(root: HTMLElement): () => void {
  root.innerHTML = methodHtml();
  const toc = root.querySelector<HTMLDetailsElement>('.toc')!;
  // Open on a wide screen, where it sits beside the text. Closed on a phone, where it would push the text down.
  toc.open = window.matchMedia('(min-width: 1000px)').matches;
  const onClick = (event: Event): void => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-toc]');
    if (link === null) return;
    event.preventDefault();
    const heading = root.querySelector<HTMLElement>(`#${CSS.escape(link.dataset['toc']!)}`);
    heading?.focus();
    toc.open = window.matchMedia('(min-width: 1000px)').matches;
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
