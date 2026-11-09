// usage: node summarize.cjs <dir>   (reads walk-prod.mjs's <size>.json files)
const fs = require("fs");
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  console.log(`== ${j.size} pageerrors=${j.errors.length} console-errors=${j.console.length} ${[...j.errors, ...j.console].map((e) => e.slice(0, 120)).join(" | ")}`);
  for (const s of j.steps) {
    const parts = [s.name.padEnd(22), `strip="${s.stripText ?? "-"}"`, `cover=${s.cover}`, `qTop=${s.qTop ?? "-"}`, `clear=${s.headingClear}/${s.firstLineClear}`, `frame=${s.frame ?? "-"}`, `whole=${s.aerialWhole}`, `y=${s.y}`];
    if (s.bar) parts.push(`bar=${s.bar.kind}:"${s.bar.text}"`);
    console.log("   " + parts.join(" | "));
  }
  for (const h of j.held) {
    console.log(`   held ${h.label}: mid bar=${h.mid.bar?.kind}:"${h.mid.bar?.text}" armed=${h.mid.armed} focus=${h.focusMid} tapMidLoad=${h.tapMidLoad} tapRequests=${h.tapRequests} aerialRequests=${h.aerialRequests} after=${h.after.bar?.kind}:"${h.after.bar?.text}"`);
    console.log(`     log: ${h.log.map((e) => `${e.at}ms ${e.kind}${e.armed ? "+armed" : ""}${e.busy ? "+busy" : ""} "${e.text}"`).join(" -> ")}`);
  }
}
