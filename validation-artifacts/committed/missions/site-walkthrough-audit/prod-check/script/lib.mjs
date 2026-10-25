// #396 production check: shared helpers. The gate token is read in code from the
// main checkout's .env.local and attached only to conestruct.com requests; it is
// never printed or written.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('C:/Users/rtmak/Documents/traffic-control-tool/package.json');
export const { chromium, webkit } = require('playwright');
const env = fs.readFileSync('C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local', 'utf8');
const TOK = env.split(/\r?\n/).find(l => l.startsWith('GATE_BYPASS_TOKEN=')).slice(18).replace(/^"|"$/g, '');
export const clean = (s) => String(s).split(TOK).join('[gate]').slice(0, 400);
export const BASE = 'https://www.conestruct.com';
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..') + path.sep;
export const SHOTS = OUT + 'shots' + path.sep;
export const SITE = '200 E 14th Ave, Denver';
export async function open(engine, w, h, extra = {}) {
  const b = await (engine === 'webkit' ? webkit : chromium).launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, ...extra });
  await ctx.route(/^https:\/\/(www\.)?conestruct\.com\//, r => r.continue({ headers: { ...r.request().headers(), 'x-conestruct-gate': TOK } }));
  const p = await ctx.newPage();
  const log = { consoleErrors: [], pageErrors: [], httpErrors: {}, roadBearing: [] };
  p.on('console', m => { if (m.type() === 'error') log.consoleErrors.push(clean(m.text()).slice(0, 200)); });
  p.on('pageerror', e => log.pageErrors.push(clean(e).slice(0, 200)));
  p.on('response', r => { const u = new URL(r.url());
    if (r.status() >= 400) { const k = r.status() + ' ' + u.host + u.pathname; log.httpErrors[k] = (log.httpErrors[k] || 0) + 1; }
    if (/\/api\/road-bearing/.test(u.pathname)) log.roadBearing.push(r.status()); });
  return { b, ctx, p, log };
}
export async function park(p) { const v = p.viewportSize(); await p.mouse.move(v.width - 3, v.height - 3); await p.waitForTimeout(300); }
// Mapbox tile/style/glyph requests settled: none in flight for 1.5 s (cap 45 s).
export function tileWatch(p) {
  const inflight = { n: 0 }; const isTile = (r) => /mapbox\.com/.test(r.url()) && !/events\.mapbox/.test(r.url());
  p.on('request', r => { if (isTile(r)) inflight.n++; }); p.on('requestfinished', r => { if (isTile(r)) inflight.n--; }); p.on('requestfailed', r => { if (isTile(r)) inflight.n--; });
  return inflight;
}
export async function settle(p, inflight) {
  await p.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  await park(p);
  const t0 = Date.now(); let quietSince = Date.now();
  while (Date.now() - t0 < 45000) { if (inflight.n > 0) quietSince = Date.now(); else if (Date.now() - quietSince > 1500) break; await p.waitForTimeout(100); }
  await p.waitForTimeout(500);
  return { waitedMs: Date.now() - t0, inflightAtShot: inflight.n };
}
export async function sandbox(p) {
  await p.goto(BASE + '/sandbox', { waitUntil: 'networkidle', timeout: 180000 });
  await p.waitForSelector('.a-open .a-head', { timeout: 120000 });
  await p.waitForTimeout(1000);
}
// Live road detection (no stub): search, wait for the detected road, pick it, save, pick a side.
export async function locate(p, roadRe = /14th/i) {
  await p.getByRole('button', { name: 'Pick on map' }).click();
  await p.waitForSelector('[role=dialog]', { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.getByLabel('Address or intersection search').fill(SITE);
  await p.getByRole('button', { name: 'SEARCH' }).click();
  await p.waitForFunction(() => /ROAD DETECTED|Which road/i.test(document.querySelector('[role=dialog]')?.innerText || ''), null, { timeout: 120000 });
  await p.getByRole('dialog').getByRole('button', { name: roadRe }).first().click();
  await p.waitForTimeout(2500);
  await p.getByRole('button', { name: 'Save & Close' }).click();
  await p.waitForSelector('[data-testid=side-option]', { timeout: 60000 });
  await p.locator('[data-testid=side-option]').first().click();
  await p.waitForSelector('[data-testid=kind-chip-flagger_lane_closure]', { timeout: 60000 });
  await p.waitForTimeout(1200);
}
export function save(name, obj) { fs.writeFileSync(OUT + name, JSON.stringify(obj, null, 1)); }
