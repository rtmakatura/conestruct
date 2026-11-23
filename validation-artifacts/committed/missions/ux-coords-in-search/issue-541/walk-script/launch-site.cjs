// #541 (copied from #537): starts `next dev` for the worktree's site with the main checkout's
// .env.local read raw (nothing printed).  Live Overpass and the
// .env.local backend, as the site runs locally.  Adapted from group 8's
// launch-site.cjs without the stub backend and the Overpass replay.
//   node launch-site.cjs <site dir> <env file> <port>
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const [site, envFile, port] = process.argv.slice(2);
const env = { ...process.env };
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[m[1]] = v;
}
const child = spawn(process.execPath, [path.join(site, "node_modules/next/dist/bin/next"), "dev", "-p", port], {
  cwd: site, env, stdio: ["ignore", "pipe", "pipe"],
});
const scrub = (b) => {
  let s = b.toString();
  for (const k of ["GATE_BYPASS_TOKEN", "CLERK_SECRET_KEY", "MODAL_RENDER_SECRET", "CLERK_WEBHOOK_SECRET", "DATABASE_URL", "VERCEL_OIDC_TOKEN"]) {
    if (env[k]) s = s.split(env[k]).join("[redacted]");
  }
  return s;
};
child.stdout.on("data", (b) => process.stdout.write(scrub(b)));
child.stderr.on("data", (b) => process.stderr.write(scrub(b)));
child.on("exit", (c) => process.exit(c ?? 0));
