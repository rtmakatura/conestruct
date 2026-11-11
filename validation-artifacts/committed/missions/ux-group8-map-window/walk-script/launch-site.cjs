// Starts `next dev` for the worktree's site with the main checkout's
// .env.local read raw (no $ expansion, nothing printed), MODAL_RENDER_URL
// pointed at the local stub backend, and the Overpass preload.
//   node launch-site.cjs <site dir> <env file> <preload> <fixture dir> <port> [record]
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const [site, envFile, preload, fixDir, port, record] = process.argv.slice(2);
const env = { ...process.env };
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
env.MODAL_RENDER_URL = "http://127.0.0.1:8000";
env.OVERPASS_FIX_DIR = fixDir;
env.OVERPASS_RECORD = record === "record" ? "1" : "0";
env.NODE_OPTIONS = `--require "${preload.replace(/\\/g, "/")}"`;
const child = spawn(process.execPath, [path.join(site, "node_modules/next/dist/bin/next"), "dev", "-p", port], {
  cwd: site, env, stdio: ["ignore", "pipe", "pipe"],
});
const scrub = (b) => {
  let s = b.toString();
  for (const k of ["GATE_BYPASS_TOKEN", "CLERK_SECRET_KEY", "MODAL_RENDER_SECRET", "CLERK_WEBHOOK_SECRET"]) {
    if (env[k]) s = s.split(env[k]).join("[redacted]");
  }
  return s;
};
child.stdout.on("data", (b) => process.stdout.write(scrub(b)));
child.stderr.on("data", (b) => process.stderr.write(scrub(b)));
child.on("exit", (c) => process.exit(c ?? 0));
