// Headstone glyphs (design 5.4). One shape per verdict, so colour is never the only cue.
// Drawn in local coordinates: the origin is the middle of the stone's base, y grows downward.
// Colours come from CSS classes only.
import type { VerdictName } from '../../engine/types.ts';
import { LAYOUT, MOSS_COVERAGE } from './scale.ts';

const W = LAYOUT.stoneWidth;
const H = LAYOUT.stoneHeight;
const HALF = W / 2;
const ARCH = H - HALF; // where the rounded top starts

/** Upright stone outline: straight sides, rounded top. */
export const STONE_PATH = `M ${-HALF} 0 L ${-HALF} ${-ARCH} A ${HALF} ${HALF} 0 0 1 ${HALF} ${-ARCH} L ${HALF} 0 Z`;

/** The clip paths and gradients live in index.html's zero-size SVG (`.shared-defs`), so each chart does not carry its own copy. */
export const CLIP_ID = 'stone-clip';
/** Clips everything below the base line, so a sunk stone shows only its top. */
export const ABOVE_GROUND_ID = 'above-ground';
/** A jagged moss patch along the base, covering `coverage` of the stone's height. */
function mossPath(coverage: number): string {
  const h = H * coverage;
  const teeth = 4;
  const bump = Math.max(1.2, W * 0.13);
  const step = W / teeth;
  let d = `M ${-HALF} 0 L ${-HALF} ${-h}`;
  for (let i = 1; i <= teeth; i++) {
    const x = -HALF + i * step;
    const up = i % 2 === 1 ? -bump : 0;
    d += ` L ${x - step / 2} ${-h + up} L ${x} ${-h}`;
  }
  return `${d} L ${HALF} 0 Z`;
}

export interface GlyphOptions {
  verdict: VerdictName;
  /** 0 to 4. */
  moss: 0 | 1 | 2 | 3 | 4;
}

/** The stone itself. Moss is clipped to the upright outline. */
export function stoneBody({ verdict, moss }: GlyphOptions): string {
  const mossG = moss > 0 ? `<g clip-path="url(#${CLIP_ID})"><path class="moss" d="${mossPath(MOSS_COVERAGE[moss])}"/></g>` : '';
  const upright = (extra: string, className: string): string =>
    `<g class="stone-shape ${className}">` +
    `<path class="stone-body" d="${STONE_PATH}"/>` +
    mossG +
    extra +
    `</g>`;
  switch (verdict) {
    case 'buried':
      return upright(`<path class="ground-line" d="M ${-HALF - 3} 0 L ${HALF + 3} 0"/>`, 'stone--buried');
    case 'uncertain':
      return upright(`<text class="carving" x="0" y="${-HALF + 3.5}" text-anchor="middle">?</text>`, 'stone--uncertain');
    case 'shallow grave': {
      // Sunk to half height in a mound: the part below the base line is hidden.
      const sink = H / 2 - 1;
      return (
        `<g class="stone-shape stone--shallow"><g clip-path="url(#${ABOVE_GROUND_ID})"><g transform="translate(0 ${sink})">` +
        `<path class="stone-body" d="${STONE_PATH}"/>` +
        mossG +
        `</g></g><path class="mound" d="M ${-HALF - 4} 0 Q 0 -6 ${HALF + 4} 0 Z"/></g>`
      );
    }
    case 'unquiet':
      return upright('', 'stone--unquiet');
    case 'restless':
      return upright(
        `<path class="crack" d="M ${-HALF + 1.5} ${-ARCH + 1} L -1 ${-ARCH + 4} L 1 ${-ARCH + 6} L ${HALF - 2} ${-ARCH + 9}"/>`,
        'stone--restless',
      );
    case 'fallen':
      // Lying flat on its side, resting on the ground line.
      return `<g class="stone-shape stone--fallen"><g transform="translate(${-H / 2} ${-HALF}) rotate(90)">` +
        `<path class="stone-body" d="${STONE_PATH}"/>` +
        mossG +
        `</g></g>`;
  }
}
