// node ask-roads.cjs <worktree> lat,lng [lat,lng ...]  — POSTs /api/road-bearing
// on the local site (gate header from scripts/gate.cjs) and prints a summary.
const [wt, ...pts] = process.argv.slice(2);
const { gateHeaders, guardOutput } = require(`${wt}/scripts/gate.cjs`);
guardOutput();
const SITE = "http://localhost:3000";
(async () => {
  for (const p of pts) {
    const [lat, lng] = p.split(",").map(Number);
    const r = await fetch(`${SITE}/api/road-bearing`, {
      method: "POST",
      headers: { "content-type": "application/json", ...gateHeaders(SITE) },
      body: JSON.stringify({ lat, lng }),
    });
    const j = await r.json().catch(() => null);
    console.log(`${p} HTTP ${r.status} ${j?.scan_status}`);
    for (const c of j?.candidates ?? []) {
      console.log(`  ${c.name ?? c.ref} [${c.highway_class}] oneway=${c.tags?.oneway} brg=${c.bearing} snap=${c.snap_distance_m} twin_m=${c.twin_distance_m ?? "-"}${c.twin ? ` GROUPED twin ${c.twin.way_id} oneway=${c.twin.tags?.oneway} brg=${c.twin.bearing} snap=${c.twin.snap_distance_m}` : ""}`);
    }
  }
})();
