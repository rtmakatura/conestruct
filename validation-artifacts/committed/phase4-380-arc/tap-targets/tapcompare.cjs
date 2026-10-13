// node tapcompare.cjs <beforeDir> <afterDir> <out.md>
// Before/after table of every control's size per surface and width.
// Controls are matched by label in document order (the n-th "Local" before
// pairs with the n-th "Local" after).
const fs = require("fs");
const path = require("path");
const [B, A, OUT] = process.argv.slice(2);
const fmt = (c) => (c ? `${c.w} × ${c.h}` : "—");
const small = (c) => c && Math.min(c.w, c.h) < 44;
let md = "";
const totals = [];
for (const w of [1440, 360]) {
  const b = JSON.parse(fs.readFileSync(path.join(B, `tapsize-${w}.json`), "utf8"));
  const a = JSON.parse(fs.readFileSync(path.join(A, `tapsize-${w}.json`), "utf8"));
  for (const surf of Object.keys(b).filter((k) => k !== "width")) {
    const bl = b[surf] || [], al = a[surf] || [];
    const key = (list) => {
      const seen = {};
      return list.map((c) => {
        seen[c.label] = (seen[c.label] || 0) + 1;
        return [`${c.label}#${seen[c.label]}`, c];
      });
    };
    const bm = new Map(key(bl)), am = new Map(key(al));
    const keys = [...new Set([...bm.keys(), ...am.keys()])];
    md += `\n### ${surf} at ${w === 1440 ? "1440×1000" : "360×800"}\n\n| Control | Before (w × h) | After (w × h) | |\n|---|---|---|---|\n`;
    let nb = 0, na = 0;
    for (const k of keys) {
      const bc = bm.get(k), ac = am.get(k);
      if (small(bc)) nb++;
      if (small(ac)) na++;
      const label = k.replace(/#\d+$/, "").replace(/\|/g, "\\|");
      const mark = !bc || !ac ? "only one side" : small(bc) && !small(ac) ? "✓ fixed" : small(ac) ? "under 44" : bc.w !== ac.w || bc.h !== ac.h ? "changed" : "";
      md += `| ${label} | ${fmt(bc)} | ${fmt(ac)} | ${mark} |\n`;
    }
    totals.push(`| ${surf} | ${w} | ${bl.length} | ${nb} | ${al.length} | ${na} |`);
  }
}
const head = "| Surface | Width | Controls before | Under 44 before | Controls after | Under 44 after |\n|---|---|---|---|---|---|\n" + totals.join("\n") + "\n";
fs.writeFileSync(OUT, "## Totals\n\n" + head + "\n## Every control\n" + md);
console.log(head);
