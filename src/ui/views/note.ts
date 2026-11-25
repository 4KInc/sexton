// The one short mono note under a chart or a section: its caveats in a line, and a link to the method section that explains them.
import { NOTES } from '../copy.ts';
import { esc } from '../html.ts';

export function noteHtml(parts: readonly string[], section: string): string {
  return `<p class="chart-note-mono">${parts.map(esc).join(' \u00B7 ')} \u00B7 ${esc(NOTES.method)} <a href="#/method?s=${section}" aria-label="${esc(NOTES.link(section))}">\u00A7</a></p>`;
}
