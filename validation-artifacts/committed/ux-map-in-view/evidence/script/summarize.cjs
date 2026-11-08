// usage: node summarize.cjs <dir>
const fs = require("fs");
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
  const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
  const cls = (j.cls || []).filter((e) => !e.recent);
  const band = cls.filter((e) => e.sources.includes("band"));
  console.log(`== ${j.size} errors=${j.errors.length} ${j.errors.map((e) => e.slice(0, 120)).join(" | ")}`);
  console.log(`   CLS (no recent input) total=${cls.reduce((a, e) => a + e.value, 0).toFixed(4)} band-sourced=${band.reduce((a, e) => a + e.value, 0).toFixed(4)}`);
  const net = j.net || [];
  console.log(`   requests: aerial=${net.filter((e) => e.kind === "aerial").length} geometry=${net.filter((e) => e.kind === "geometry").length} nearest=${net.filter((e) => e.kind === "nearest").length}`);
  for (const s of j.steps) {
    const t = s.timing;
    const parts = [s.name.padEnd(26), `layout band=${s.bandWidth}`, `frame=${s.frame ? `${s.frame.top}..${s.frame.bottom} h${s.frame.h} w${s.frame.w}` : "-"}`, `vis=${s.frameVisiblePx}`, `card=${s.card ? `${s.card.top}..${s.card.bottom}` : "-"}`, `qInView=${s.questionInView}`, `y=${s.scrollY}`];
    if (t) parts.push(`T ms=${t.msToNewMap} blank=${t.blankSeen} wait=${t.waitNoteSeen} a=${t.aerialRequests} g=${t.geometryRequests} n=${t.nearestRequests}`);
    if (s.axe) parts.push(`axe=${s.axe.length} small=${JSON.stringify(s.small)} new=${JSON.stringify(s.newTargets)}`);
    if (s.scrollBefore !== undefined) parts.push(`scroll ${s.scrollBefore}->${s.scrollAfter}`);
    if (/strings|kind-question|confirmed/.test(s.name)) parts.push(`WHAT="${s.whatRow}" GEN="${s.generateHint}"`);
    if (s.docOverflowX) parts.push("OVERFLOW-X");
    console.log("   " + parts.join(" | "));
  }
}
