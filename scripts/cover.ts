// Takes the Devpost cover (1200x630) from a running site with headless Chrome. Dev tool only.
// Usage: node scripts/cover.ts <site-url> <out.png> [viewportWidth=1440]
// The viewport is W x (W * 630/1200) and the crop is the whole viewport, so nothing is stretched: the page is
// captured at 3x and scaled down evenly. Before saving, it asserts that the title sits fully inside the crop
// with at least 24 px clear above it, and that the chart's last label (LAUNCH YEAR) is inside too.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = process.env['CHROME'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [site, out, widthArg] = process.argv.slice(2);
if (site === undefined || out === undefined) {
  console.error('Usage: node scripts/cover.ts <site-url> <out.png> [viewportWidth]');
  process.exit(2);
}
const W = Number(widthArg ?? 1440);
const H = (W * 630) / 1200;
if (!Number.isInteger(H)) throw new Error(`width ${W} gives a fractional height ${H}; use a multiple of 40`);
const SCALE = 3;
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sexton-cover-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
try {
  let tabs: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 50; i++) {
    try {
      tabs = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as typeof tabs;
      if (tabs.some((t) => t.type === 'page')) break;
    } catch {
      // Chrome is not up yet.
    }
    await sleep(200);
  }
  const ws = new WebSocket(tabs.find((t) => t.type === 'page')!.webSocketDebuggerUrl);
  await new Promise<void>((ok) => (ws.onopen = () => ok()));
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  ws.onmessage = (m) => {
    const d = JSON.parse(String(m.data));
    if (d.id && pending.has(d.id)) pending.get(d.id)!(d.result);
  };
  const send = (method: string, params: object = {}): Promise<any> =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
  await send('Page.navigate', { url: `${site.replace(/\/?$/, '/')}#/?cover=1` });
  await sleep(3500);
  const res = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
      const title = document.querySelector('.cover-title');
      const labels = [...document.querySelectorAll('.cover-capture svg text')].filter((t) => /LAUNCH YEAR/i.test(t.textContent));
      return JSON.stringify({ title: r(title), launch: labels.length ? r(labels[0]) : null, scrollX: scrollX, scrollY: scrollY });
    })()`,
  });
  const m = JSON.parse(res.result.value) as { title: Box; launch: Box | null; scrollX: number; scrollY: number };
  const crop = { left: 0, top: 0, right: W, bottom: H };
  console.log(JSON.stringify({ viewport: `${W}x${H}`, crop, title: m.title, launch: m.launch }));
  const inside = (b: Box): boolean => b.left >= crop.left && b.top >= crop.top && b.right <= crop.right && b.bottom <= crop.bottom;
  if (!inside(m.title)) throw new Error('the title is not fully inside the crop');
  if (m.title.top - crop.top < 24) throw new Error(`only ${m.title.top - crop.top} px clear above the title (need 24)`);
  if (m.launch === null) throw new Error('the LAUNCH YEAR label was not found');
  if (!inside(m.launch)) throw new Error('the LAUNCH YEAR label is not inside the crop');
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`wrote ${out} (${W * SCALE}x${H * SCALE}); scale it to 1200x630 evenly`);
  ws.close();
} finally {
  chrome.kill();
}
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
process.exit(0);
