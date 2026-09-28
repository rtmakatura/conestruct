/**
 * vercel-ignore.sh (the site root) — the Vercel "Ignored Build Step" (ship-loop
 * rulings R1).  Exit 0 = skip the build; anything else = build.
 *
 * The cases run the real script under bash, the way Vercel runs it, over
 * real ranges of this repo's history:
 *
 *   backend-only commit (71cc403: src/ + tests/ only)   -> skip
 *   site commit (a7225ff: 7 site files)                  -> build
 *   shared-input-only commit (aab8caa: an outside input) -> build
 *   the #301 zoom ship push (d6e00a7..0ddc85e)           -> build, although
 *     its tip alone (0ddc85e^..0ddc85e) touched no site file: the range is
 *     the push, not HEAD^..HEAD
 *   empty / missing PREVIOUS_SHA (a branch's first deploy) -> build
 *   PREVIOUS_SHA == COMMIT_SHA (a redeploy)               -> build
 *   an unknown PREVIOUS_SHA (git fails)                   -> build
 */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";

const SITE = path.resolve(__dirname, "..");
const SCRIPT = path.join(SITE, "vercel-ignore.sh");

// Git's own bash on Windows (never WSL's System32 bash, which cannot see
// this path); plain `bash` elsewhere, as on Vercel's build image.
function bashPath(): string {
  if (process.platform !== "win32") return "bash";
  const exec = execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim();
  return path.resolve(exec, "..", "..", "..", "bin", "bash.exe");
}

function sha(rev: string): string {
  return execFileSync("git", ["rev-parse", rev], { cwd: SITE, encoding: "utf8" }).trim();
}

function run(prev: string | undefined, cur: string | undefined) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.VERCEL_GIT_PREVIOUS_SHA;
  delete env.VERCEL_GIT_COMMIT_SHA;
  if (prev !== undefined) env.VERCEL_GIT_PREVIOUS_SHA = prev;
  if (cur !== undefined) env.VERCEL_GIT_COMMIT_SHA = cur;
  const r = spawnSync(bashPath(), [SCRIPT], { env, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("vercel-ignore.sh", () => {
  it("skips a backend-only commit", () => {
    const r = run(sha("71cc403^"), sha("71cc403"));
    expect(r.out).toContain("SKIP:");
    expect(r.code).toBe(0);
  });

  it("builds a site commit", () => {
    const r = run(sha("a7225ff^"), sha("a7225ff"));
    expect(r.out).toContain("BUILD: the site or its inputs changed");
    expect(r.code).toBe(1);
  });

  it("builds a change to an outside input only (no site file)", () => {
    const r = run(sha("aab8caa^"), sha("aab8caa"));
    expect(r.out).toContain("BUILD: the site or its inputs changed");
    expect(r.code).toBe(1);
  });

  it("compares the whole push: the #301 zoom ship builds though its tip touched no site file", () => {
    expect(run(sha("0ddc85e^"), sha("0ddc85e")).code).toBe(0); // the tip alone would skip
    const r = run(sha("d6e00a7"), sha("0ddc85e"));
    expect(r.code).toBe(1);
  });

  it("builds when PREVIOUS_SHA is empty or missing (a branch's first deploy)", () => {
    const head = sha("HEAD");
    for (const prev of ["", undefined]) {
      const r = run(prev, head);
      expect(r.out).toContain("BUILD: no previous deployed sha");
      expect(r.code).toBe(1);
    }
  });

  it("builds on a redeploy (PREVIOUS_SHA equals this sha)", () => {
    const head = sha("HEAD");
    const r = run(head, head);
    expect(r.out).toContain("BUILD: previous sha equals this sha");
    expect(r.code).toBe(1);
  });

  it("builds when git cannot compare (an unknown previous sha)", () => {
    const r = run("0".repeat(40), sha("HEAD"));
    expect(r.out).toContain("BUILD: git diff failed");
    expect(r.code).toBe(1);
  });
});
