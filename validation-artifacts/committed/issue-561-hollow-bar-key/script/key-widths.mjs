// #561 (S3): how wide the key's entries are, and how many lines the key
// takes at four column gaps, in the Mon-to-Sun night state with a street
// class set (five entries in the whole week).  Same server and setup as
// walk-561.mjs.  The gap is set inline for each reading and then removed.
//   WALK_SITE=http://localhost:3561 node key-widths.mjs > ../key-widths-1440.txt
import { open, pin, confirm, dates, times, D } from "../../missions/ux-spacing-round/issue-555/script/lib.mjs";
const { b, p } = await open(1440, 900);
try {
  await pin(p); await confirm(p);
  await dates(p, "2026-12-07", "2026-12-13"); await times(p, "20.5", "5.5");
  await p.getByTestId("what-hours-all").click(); await p.waitForSelector(D);
  await p.getByTestId("hours-view-week").click(); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const dlg = document.querySelector("[data-testid=hours-dialog]");
    const lg = dlg.querySelector(".whd-legend"), body = dlg.querySelector(".whd-body");
    const lis = [...lg.querySelectorAll("li")];
    const r2 = (n) => Math.round(n * 100) / 100;
    const at = (gap) => { lg.style.columnGap = gap; const out = { keyLines: new Set(lis.map((li) => Math.round(li.getBoundingClientRect().top))).size, bodyHeight: body.clientHeight, contentHeight: body.scrollHeight }; lg.style.columnGap = ""; return out; };
    const entries = lis.map((li) => [li.textContent, r2(li.getBoundingClientRect().width)]);
    return { viewport: [innerWidth, innerHeight], keyWidth: lg.clientWidth, entries, entriesTotal: r2(entries.reduce((s, e) => s + e[1], 0)), asBuilt: { columnGap: getComputedStyle(lg).columnGap, ...at("") }, at16: at("16px"), at12: at("12px"), at10: at("10px"), at8: at("8px") };
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await b.close(); }
