// Asks the local /api/road-bearing at a few pins and prints names and cross streets only.
const fs = require("node:fs");
const tok = (fs.readFileSync("C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local", "utf8").match(/^GATE_BYPASS_TOKEN=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const pins = process.argv.slice(2).map((s) => s.split(",").map(Number));
(async () => {
  for (const [lat, lng] of pins) {
    const r = await fetch("http://localhost:3536/api/road-bearing", {
      method: "POST",
      headers: { "content-type": "application/json", ...(tok ? { "x-conestruct-gate": tok } : {}) },
      body: JSON.stringify({ lat, lng }),
    });
    const j = await r.json().catch(() => null);
    const c = (j?.candidates ?? j ?? []);
    console.log(lat, lng, r.status, Array.isArray(c) ? c.map((x) => `${x.name}|${x.cross_street ?? "-"}|${Math.round(x.snap_distance_m)}`).join(" ; ") : JSON.stringify(j).slice(0, 200));
  }
})();
