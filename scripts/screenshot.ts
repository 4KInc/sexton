// Takes a full-page screenshot of the running site with headless Chrome, at a true viewport width.
// Usage: node scripts/screenshot.ts <url> <width> <out.png> [--mobile]
// Prints the page's horizontal overflow, so "no page-level horizontal scroll" can be checked.
// Needs Google Chrome on macOS. Dev tool only: the site and the tests do not use it.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const CHROME = process.env['CHROME'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [url, widthArg, out, flag] = process.argv.slice(2);
if (url === undefined || widthArg === undefined || out === undefined) {
  console.error('Usage: node scripts/screenshot.ts <url> <width> <out.png> [--mobile]');
  process.exit(2);
}
const width = Number(widthArg);
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sexton-chrome-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function connect(): Promise<WebSocket> {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const tabs = (await res.json()) as { type: string; webSocketDebuggerUrl: string }[];
      const page = tabs.find((t) => t.type === 'page');
      if (page !== undefined) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise<void>((ok, bad) => {
          ws.onopen = () => ok();
          ws.onerror = () => bad(new Error('websocket error'));
        });
        return ws;
      }
    } catch {
      // Chrome is not up yet.
    }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}
try {
  const ws = await connect();
  let id = 0;
  const waiting = new Map<number, (v: any) => void>();
  ws.onmessage = (m) => {
    const msg = JSON.parse(String(m.data));
    if (msg.id !== undefined) waiting.get(msg.id)?.(msg);
  };
  const send = (method: string, params: object = {}): Promise<any> =>
    new Promise((ok) => {
      const n = ++id;
      waiting.set(n, ok);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression: string): Promise<any> => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: flag === '--mobile' });
  await send('Page.navigate', { url });
  await sleep(2500);
  const m = await evaluate(
    `JSON.stringify({ viewport: innerWidth, pageScrollWidth: document.documentElement.scrollWidth, host: (() => { const h = document.querySelector('#chart-host'); return h ? { clientWidth: h.clientWidth, scrollWidth: h.scrollWidth } : null; })() })`,
  );
  console.log(m);
  const height = Number(await evaluate('document.documentElement.scrollHeight'));
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  ws.close();
} finally {
  chrome.kill();
}
