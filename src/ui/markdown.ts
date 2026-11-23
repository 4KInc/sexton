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

function makeMarked(shift: number): Marked {
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
        return `<h${level}>${this.parser.parseInline(token.tokens)}</h${level}>\n`;
      },
    },
  });
}
const caseMd = makeMarked(HEADING_SHIFT);
const docMd = makeMarked(0);
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
  const body = text.replace(/^# [^\n]*\n+/, '');
  const html = docMd.parse(body) as string;
  return html
    .replace(/<table>/g, `<div class="table-wrap method-wrap" role="region" aria-label="${esc(tableLabel)}" tabindex="0"><table class="register-table method-table">`)
    .replace(/<\/table>/g, '</table></div>');
}
