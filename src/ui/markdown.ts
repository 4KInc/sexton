// Markdown for case files (design 5.8). Built on `marked`, with three safety rules:
//  - raw HTML, block or inline, is escaped and shown as text;
//  - a link keeps its address only if it starts with http://, https:// or "#". Anything else
//    (javascript:, data:, vbscript:, relative paths, entity or space tricks) becomes plain text;
//  - an image becomes its alt text. The site loads nothing from other hosts.
import { Marked } from 'marked';
import type { Tokens } from 'marked';
import { esc } from './html.ts';

/** Case-file headings sit under the section's h2 and the case title's h3, so # becomes h4. */
export const HEADING_SHIFT = 3;

const SAFE_HREF = /^(https?:\/\/|#)/i;

/** True when a link address is one the site keeps. */
export const isSafeHref = (href: string): boolean => SAFE_HREF.test(href);

/** Ids for the headings of a document, so the table of contents can point at them. Reset for each document. */
let usedIds = new Set<string>();
const slugOf = (text: string): string => {
  const base = `m-${text.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'}`;
  let id = base;
  for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`;
  usedIds.add(id);
  return id;
};
const SOURCE_HEAD = ['Source', 'Link', 'What was checked'];
function makeMarked(shift: number, ids = false): Marked {
  return new Marked({
    async: false,
    gfm: true,
    breaks: false,
    renderer: {
      html(token: Tokens.HTML | Tokens.Tag): string {
        return esc(token.text);
      },
      link(this, token: Tokens.Link): string {
        const inner = this.parser.parseInline(token.tokens);
        if (!isSafeHref(token.href)) return inner;
        const title = token.title ? ` title="${esc(token.title)}"` : '';
        const external = token.href.startsWith('#') ? '' : ' rel="noopener noreferrer"';
        return `<a href="${esc(token.href)}"${title}${external}>${inner}</a>`;
      },
      image(token: Tokens.Image): string {
        return esc(token.text);
      },
      heading(this, token: Tokens.Heading): string {
        const level = Math.min(6, token.depth + shift);
        const attrs = ids ? ` id="${slugOf(token.text)}" tabindex="-1"` : '';
        return `<h${level}${attrs}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
      },
      // The Sources table (Source, Link, What was checked) is drawn as citations. Any other table keeps the default.
      table(this, token: Tokens.Table): string | false {
        if (!ids || token.header.length !== 3 || token.header.some((h, i) => h.text !== SOURCE_HEAD[i])) return false;
        const p = (cls: string, cell: Tokens.TableCell): string => `<p class="${cls}">${this.parser.parseInline(cell.tokens)}</p>`;
        const items = token.rows.map(([name, link, note]) => `<li class="cite">${p('cite-name', name!)}${p('cite-link', link!)}${p('cite-note', note!)}</li>`);
        return `<ul class="cites">${items.join('')}</ul>\n`;
      },
    },
  });
}
const caseMd = makeMarked(HEADING_SHIFT);
const docMd = makeMarked(0, true);
/** Markdown to an HTML string that is safe to set as innerHTML. */
export function renderMarkdown(text: string): string {
  return caseMd.parse(text) as string;
}
/**
 * A project document (docs/methodology.md): the same safety rules, headings kept at their level.
 * A leading "# Title" line is dropped, because the page already has its own h1. Bare http(s)
 * addresses in the text become links, and each table sits in a labelled box that scrolls sideways.
 */
export function renderDocument(text: string, tableLabel: string): string {
  usedIds = new Set();
  const body = text.replace(/^# [^\n]*\n+/, '');
  const html = docMd.parse(body) as string;
  return html
    // Markdown tables have column headers only.
    .replace(/<th(?=[ >])/g, '<th scope="col"')
    .replace(/<table>/g, `<div class="table-wrap method-wrap" role="region" aria-label="${esc(tableLabel)}" tabindex="0"><table class="register-table method-table">`)
    .replace(/<\/table>/g, '</table></div>');
}
