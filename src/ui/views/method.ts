// The methodology page (design 5.9, R9): docs/methodology.md rendered as it is written.
import { METHOD } from '../copy.ts';
import { METHODOLOGY } from '../content.ts';
import { renderDocument } from '../markdown.ts';

/** The page body for a document text. The document is the only content, so the page cannot drift from the file. */
export function methodHtml(text: string = METHODOLOGY): string {
  return `<article class="method">${renderDocument(text, METHOD.tableLabel)}</article>`;
}
export function mountMethod(root: HTMLElement): () => void {
  root.innerHTML = methodHtml();
  return () => undefined;
}
