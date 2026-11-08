// #460 walk launcher (copied from #456's): the local backend (Overpass stubbed) and `next dev` on the
// issue-460 worktree.  Reads the main checkout's .env.local into the child
// environments (no copy into the worktree), and sets a walk-only render secret
// and gate token (written to walk-secrets.json in this scratchpad dir, never
// printed).  usage: node launch.cjs <backend|site>
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const HERE = __dirname;
const REPO = "C:/Users/rtmak/Documents/traffic-control-tool";
const WT = `${REPO}/.claude/worktrees/issue-460`;
const SITE_PORT = 3460;
const API_PORT = 8460;

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
const secretsFile = path.join(process.env.WALK_SECRETS_DIR, "walk-secrets.json");
let secrets;
if (fs.existsSync(secretsFile)) secrets = JSON.parse(fs.readFileSync(secretsFile, "utf8"));
else {
  secrets = { render: crypto.randomBytes(24).toString("hex"), gate: crypto.randomBytes(24).toString("hex") };
  fs.writeFileSync(secretsFile, JSON.stringify(secrets));
}
const local = readEnv(`${REPO}/conestruct/site/.env.local`);
const which = process.argv[2];
let child;
if (which === "backend") {
  const env = { ...process.env, RENDER_API_SECRET: secrets.render, MAPBOX_TOKEN: local.MAPBOX_TOKEN, PYTHONIOENCODING: "utf-8" };
  child = spawn("uv", ["run", "--extra", "dev", "python", path.join(HERE, "serve_stub.py"), WT, `${WT}/validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture`, String(API_PORT)], { cwd: WT, env, stdio: "inherit", shell: true });
} else {
  const env = { ...process.env, ...local, MODAL_RENDER_URL: `http://127.0.0.1:${API_PORT}`, MODAL_RENDER_SECRET: secrets.render, GATE_BYPASS_TOKEN: secrets.gate };
  delete env.UPSTASH_REDIS_REST_URL;
  delete env.UPSTASH_REDIS_REST_TOKEN;
  const args = which === "build" ? ["next", "build"] : which === "start" ? ["next", "start", "-p", String(SITE_PORT)] : ["next", "dev", "-p", String(SITE_PORT)];
  child = spawn("npx", args, { cwd: `${WT}/conestruct/site`, env, stdio: "inherit", shell: true });
}
console.log(`[launch] ${which} pid ${child.pid}`);
child.on("exit", (c) => process.exit(c ?? 0));
