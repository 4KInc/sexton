// Orbit figures in case files (R8, R14). A distance in km in a case file must be cited to the register, or to
// docs/methodology.md, or to a row of the Sources table that holds that figure in its own text. A figure with no
// citation, or one cited to a row that does not contain it, is a problem. Pure: the caller passes the texts.
export interface FigureProblem {
  line: string;
  figure: string;
  problem: string;
}
const KM = /(\d[\d,]*(?:\.\d+)?)\s?(?:km|㎞)/g;
const CITATION = /\[([^\]]+)\]/g;
/** The Sources-table row (the whole line) that holds `url`, or null. */
export function sourcesRow(methodology: string, url: string): string | null {
  return methodology.split('\n').find((l) => l.startsWith('| ') && l.includes(url)) ?? null;
}
const hasFigure = (text: string, figure: string): boolean => {
  const bare = figure.replace(/,/g, '');
  return new RegExp(`(?<![\\d.])${bare.replace('.', '\\.')}(?!\\d)`).test(text.replace(/(\d),(\d)/g, '$1$2'));
};
/** Splits a line into segments of text, each with the citations that follow it. */
function segments(line: string): { text: string; cites: string[] }[] {
  const out: { text: string; cites: string[] }[] = [];
  let last = 0;
  let current: { text: string; cites: string[] } | null = null;
  for (const m of line.matchAll(CITATION)) {
    const between = line.slice(last, m.index);
    if (current !== null && between.trim() === '') current.cites.push(m[1]!);
    else {
      current = { text: between, cites: [m[1]!] };
      out.push(current);
    }
    last = m.index! + m[0].length;
  }
  const tail = line.slice(last);
  if (tail.trim() !== '') out.push({ text: tail, cites: [] });
  return out;
}
/** Problems with the km figures in one case file's text. */
export function figureProblems(caseText: string, methodology: string): FigureProblem[] {
  const out: FigureProblem[] = [];
  for (const line of caseText.split('\n')) {
    if (!/\d\s?(km|㎞)/.test(line)) continue;
    for (const seg of segments(line)) {
      for (const f of seg.text.matchAll(KM)) {
        const figure = f[1]!;
        const bad = (problem: string): number => out.push({ line, figure, problem });
        if (seg.cites.length === 0) {
          bad('no citation');
          continue;
        }
        const covered = seg.cites.some((c) => {
          if (c.startsWith('register:') || c.startsWith('docs/methodology.md:')) return true;
          const url = /(https?:\/\/\S+)$/.exec(c)?.[1];
          if (url === undefined) return false;
          const row = sourcesRow(methodology, url);
          return row !== null && !/IADC|47 CFR/.test(c) && hasFigure(row, figure);
        });
        if (!covered) bad('not in the register, the methodology, or the cited Sources row');
      }
    }
  }
  return out;
}
