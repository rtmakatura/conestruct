// Checks 1-3 (L1 copy, live decline) at 1440 and 390 Chromium, and check 10 (downloads) at 1440.
// usage: DL_DIR=<scratch dir> node l1_downloads.mjs
import fs from 'fs';
import { open, park, sandbox, locate, save, clean, SHOTS } from './lib.mjs';
const M = {};
const textOf = (p) => p.evaluate(() => {
  const lines = document.body.innerText.split('\n');
  const find = (re) => lines.filter(l => re.test(l));
  const strip = [...document.querySelectorAll('body *')].find(e => e.children.length === 0 && /^PLAN DECLINED/.test(e.innerText || ''));
  const sr = strip?.getBoundingClientRect();
  return { w20: find(/Set a location first/), w7: find(/Generation declined/), w6: find(/option (shown|you picked) stands/), declinedStrip: find(/^PLAN DECLINED/),
    stripRect: sr ? { x: Math.round(sr.x), y: Math.round(sr.y + scrollY), w: Math.round(sr.width), h: Math.round(sr.height), visible: sr.width > 0 && getComputedStyle(strip).visibility !== 'hidden' } : null,
    generateDisabled: document.querySelector('[data-testid=generate-plan]')?.disabled ?? null };
});
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { b, p, log } = await open('chromium', w, h);
  const o = { log };
  try {
    await sandbox(p); await park(p);
    o.fresh = await textOf(p);
    await p.screenshot({ path: `${SHOTS}${w}-w20-no-location-fullpage.png`, fullPage: true });
    await locate(p);
    await p.locator('[data-testid=kind-chip-flagger_lane_closure]').click();
    await p.waitForTimeout(800);
    await p.getByTestId('where-confirm').click();
    await p.waitForFunction(() => /PLAN DECLINED/.test(document.body.innerText) && /Generation declined/.test(document.body.innerText), null, { timeout: 120000 });
    await p.waitForTimeout(4000); await park(p);
    o.declined = await textOf(p);
    await p.screenshot({ path: `${SHOTS}${w}-w7-w6-declined-fullpage.png`, fullPage: true });
    await p.getByTestId('info-toggle-jurisdiction').scrollIntoViewIfNeeded(); await park(p);
    await p.screenshot({ path: `${SHOTS}${w}-w6-jurisdiction-after-decline.png` });
    await p.getByTestId('generate-plan').scrollIntoViewIfNeeded(); await park(p);
    await p.screenshot({ path: `${SHOTS}${w}-w7-generate-reason-viewport.png` });
  } catch (e) { o.error = clean(e); await p.screenshot({ path: `${SHOTS}${w}-l1-error.png` }).catch(() => {}); }
  await b.close(); M[w] = o; console.log('L1', w, o.error || 'ok');
}
// Check 10: one shoulder plan, every download fetched (read-only: nothing saved to an account).
{
  const { b, p, log } = await open('chromium', 1440, 900, { acceptDownloads: true });
  const o = { log, files: [] };
  const DL = process.env.DL_DIR; fs.mkdirSync(DL, { recursive: true });
  try {
    await sandbox(p); await locate(p);
    await p.locator('[data-testid=kind-chip-shoulder]').click(); await p.waitForTimeout(800);
    await p.getByTestId('where-confirm').click();
    await p.waitForFunction(() => { const g = document.querySelector('[data-testid=generate-plan]'); return g && !g.disabled; }, null, { timeout: 120000 });
    await p.waitForTimeout(2000);
    const t0 = Date.now();
    await p.getByTestId('generate-plan').click();
    await p.waitForSelector('.dl-btn, button:has-text("(.ZIP)"), button:has-text("(.zip)")', { timeout: 180000 });
    o.generateMs = Date.now() - t0;
    await p.waitForTimeout(3000); await park(p);
    o.banner = await p.evaluate(() => document.body.innerText.match(/PLAN DECLINED[^\n]*|INVALID INPUT[^\n]*|VERIFIED[^\n]*|AWAITING[^\n]*/)?.[0] || 'no banner');
    await p.screenshot({ path: `${SHOTS}1440-downloads-fullpage.png`, fullPage: true });
    const btns = await p.locator('.dl-btn, button:has-text("(.ZIP)"), button:has-text("(.zip)")').all();
    for (let i = 0; i < btns.length; i++) {
      const bt = btns[i];
      if (!(await bt.isVisible())) { o.files.push({ i, hidden: true }); continue; }
      const label = ((await bt.getAttribute('aria-label')) || (await bt.innerText())).replace(/\s+/g, ' ').trim();
      const respP = p.waitForResponse(r => /\/api\/render\/(pdf|xlsx|markdown|crew-pdf|audit-pdf|bundle)\b/.test(r.url()), { timeout: 150000 }).catch(() => null);
      const dlP = p.waitForEvent('download', { timeout: 150000 }).catch(() => null);
      const s = Date.now(); await bt.click();
      const [resp, dl] = await Promise.all([respP, dlP]);
      let size = null, fn = null;
      if (dl) { fn = dl.suggestedFilename(); const fp = `${DL}/${i}-${fn}`; await dl.saveAs(fp); size = fs.statSync(fp).size; }
      o.files.push({ i, label, status: resp?.status() ?? null, route: resp ? new URL(resp.url()).pathname : null, contentType: resp?.headers()['content-type'] ?? null, filename: fn, bytes: size, ms: Date.now() - s });
      await p.waitForTimeout(1200);
    }
  } catch (e) { o.error = clean(e); await p.screenshot({ path: `${SHOTS}1440-downloads-error.png` }).catch(() => {}); }
  await b.close(); M.downloads = o; console.log('DL', o.error || 'ok', o.files.length);
}
save('measure-l1-downloads.json', M);
