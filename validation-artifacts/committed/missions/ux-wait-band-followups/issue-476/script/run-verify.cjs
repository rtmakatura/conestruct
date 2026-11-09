// #476 walk: runs scripts/verify-generate-cls.mjs against the local site with
// the walk's gate token (read from walk-secrets.json, never printed).
// usage: node run-verify.cjs <outfile> [ENV=VAL ...]
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const S = __dirname;
const WT = "C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-476";
const secrets = JSON.parse(fs.readFileSync(path.join(process.env.WALK_SECRETS_DIR, "walk-secrets.json"), "utf8"));
const [out, ...pairs] = process.argv.slice(2);
const extra = Object.fromEntries(pairs.map((p) => p.split("=")));
const env = { ...process.env, SITE: "http://localhost:3476", GATE_BYPASS_TOKEN: secrets.gate, ...extra };
const r = spawnSync("node", [process.env.SCRIPT || "scripts/verify-generate-cls.mjs"], { cwd: WT, env, encoding: "utf8" });
fs.writeFileSync(out, (r.stdout || "") + (r.stderr || "") + `exit ${r.status}\n`);
console.log(fs.readFileSync(out, "utf8"));
