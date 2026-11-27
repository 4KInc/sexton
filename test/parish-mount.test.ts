// @vitest-environment happy-dom
// The parish view in a DOM: the unknown owner's title, and the download buttons.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { UiRegister } from '../src/ui/register.ts';
import { mountParish, parishCsv } from '../src/ui/views/parish.ts';
const ROOT = process.cwd();
const real = JSON.parse(readFileSync(join(ROOT, 'data/register.json'), 'utf8')) as UiRegister;
function page(): HTMLElement {
  document.body.innerHTML = '<h1 id="page-title">Parish: unknown</h1><div id="view"></div>';
  return document.getElementById('view')!;
}
describe('mountParish', () => {
  it('titles the unknown owner "Owner not given"', () => {
    const withOne: UiRegister = { ...real, records: real.records.map((r) => (r.norad === 32500 ? { ...r, owner: null } : r)) };
    const view = page();
    mountParish(view, withOne, 'owner', 'unknown');
    expect(document.getElementById('page-title')!.textContent).toBe('Parish: Owner not given');
    expect(document.title).toContain('Owner not given');
  });
  it('the CSV button saves the CSV of the page, with a byte-order mark and a plain file name', async () => {
    const view = page();
    const stop = mountParish(view, real, 'operator', 'JAXA');
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      blob = b as Blob;
      return 'blob:x';
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const orig = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = orig(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = () => names.push((el as HTMLAnchorElement).download);
      }
      return el;
    });
    view.querySelector<HTMLButtonElement>('[data-parish-csv]')!.click();
    expect(names).toEqual(['sexton-parish-operator-JAXA-2026-11-22.csv']);
    expect(await (blob as unknown as Blob).text()).toBe(`\uFEFF${parishCsv(real, 'operator', 'JAXA')}`);
    stop();
    vi.restoreAllMocks();
  });
  it('the list needs no listener', () => {
    const view = page();
    expect(() => mountParish(view, real, 'index', '')()).not.toThrow();
    expect(view.querySelector('.parish-list')).not.toBeNull();
  });
});
