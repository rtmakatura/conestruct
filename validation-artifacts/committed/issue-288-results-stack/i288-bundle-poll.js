// #288 — is the arc in the served bundle?  Measurement, not assumption.
const https = require("https");
const BASE = "https://www.conestruct.com";
const get = (u) => new Promise((res, rej) => {
  https.get(u, (r) => {
    if (r.statusCode !== 200) { r.resume(); return rej(new Error(`${r.statusCode} ${u}`)); }
    let b = ""; r.setEncoding("utf-8"); r.on("data", d => b += d); r.on("end", () => res(b));
  }).on("error", rej);
});
(async () => {
  const hz = JSON.parse(await get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"));
  console.log("healthz sha:", hz.sha);
  const html = await get(`${BASE}/sandbox`);
  const chunks = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]))];
  const sheets = [...new Set([...html.matchAll(/href="(\/_next\/static\/css\/[^"]+)"/g)].map(m => m[1]))];
  let js = "", css = "";
  for (const c of chunks) { try { js += await get(BASE + c); } catch {} }
  for (const s of sheets) { try { css += await get(BASE + s); } catch {} }
  const blob = html + js + css;
  console.log(`served: ${html.length} B html · ${chunks.length} chunks (${js.length} B) · ${sheets.length} sheets (${css.length} B)`);
  const marks = {
    "ns-strip (should be ABSENT if 2ef4a8f shipped)": /ns-strip/.test(blob),
    "NEXT — 3 STEPS (ABSENT if shipped)": /NEXT — 3 STEPS/.test(blob),
    "ns-chip (ABSENT if shipped)": /ns-chip/.test(blob),
    "--strip-h (ABSENT if shipped)": /--strip-h/.test(blob),
    "--fact-h (PRESENT if shipped)": /--fact-h/.test(blob),
    "needs-you (PRESENT if mounted)": /needs-you/.test(blob),
    "NEEDS YOU copy (PRESENT if mounted)": /NEEDS YOU/.test(blob),
    "results-head-slot (present either way)": /results-head-slot/.test(blob),
  };
  for (const [k, v] of Object.entries(marks)) console.log(`  ${v ? "PRESENT" : "absent "}  ${k}`);
})().catch(e => { console.log("POLL FAILED", e.message); process.exit(3); });
