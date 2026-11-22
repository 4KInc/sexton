// Escaping for strings that go into HTML or SVG text and attributes.
export function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Escapes text and sets every run of digits in the sans face. IM Fell English draws old-style
 * figures (a 7 drops below the line), which are hard to read in names and ids.
 */
export function withSansDigits(text: string): string {
  return esc(text).replace(/\d+/g, '<span class="num">$&</span>');
}
