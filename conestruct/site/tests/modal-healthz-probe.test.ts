/**
 * Exit-code taxonomy coverage for scripts/modal-healthz-probe.mjs
 * (repo root) — the deploy-gap monitor's probe, extracted from
 * modal-deploy-check.yml by #169 so these cases replace the manual
 * workflow_dispatch as the standing proof (taxonomy from PR #168):
 *
 *   dead port              -> exit 1, "unreachable" error
 *   reachable but non-200  -> exit 1, distinct "returned HTTP" error
 *   200, sha present       -> exit 0, sha faithfully extracted (the
 *                             extracted sha is what drives the
 *                             workflow's downstream drift-vs-current
 *                             decision, so wrong-sha and matching-sha
 *                             both prove the c/d half of the taxonomy)
 *   200, no sha field      -> exit 0, sha = "unknown" (jq's
 *                             `.sha // "unknown"` behavior preserved)
 *   200, non-JSON body     -> exit 1 (deliberately kept red)
 *
 * The tests spawn the real script as a child process — the same way
 * the workflow runs it — against local mock servers.
 */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.resolve(__dirname, "../../../scripts/modal-healthz-probe.mjs");

// A sha pair for the wrong-vs-matching cases; the probe treats them
// identically (extraction, not comparison — the workflow's owed step
// owns the comparison), which is exactly what these cases pin.
const HEAD_SHA = "b6d0b7f7073263158ecfd7732a455dc32048d9c2";
const DRIFTED_SHA = "4760308aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// Async spawn — spawnSync would block this worker's event loop, and
// the mock /healthz servers live in THIS process: the child's fetch
// would deadlock against a parent that can't accept the connection.
function runProbe(url: string) {
  const outFile = path.join(mkdtempSync(path.join(tmpdir(), "probe-")), "gh-output");
  return new Promise<{
    status: number | null;
    stdout: string;
    stderr: string;
    output: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT, url], {
      env: {
        ...process.env,
        // Test hooks only — defaults (3 attempts / 10 s) are the
        // workflow's behavior and stay untouched in CI.
        MODAL_PROBE_ATTEMPTS: "2",
        MODAL_PROBE_SLEEP_SECONDS: "0",
        GITHUB_OUTPUT: outFile,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (status) => {
      let output = "";
      try {
        output = readFileSync(outFile, "utf-8");
      } catch {
        // no output written (error paths)
      }
      resolve({ status, stdout, stderr, output });
    });
  });
}

function serve(handler: (res: import("node:http").ServerResponse) => void): Promise<{
  server: Server;
  url: string;
}> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => handler(res));
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") throw new Error("no port");
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

describe("modal-healthz-probe exit-code taxonomy (#169 / PR #168)", () => {
  it("dead port -> exit 1, unreachable error", async () => {
    const r = await runProbe("http://127.0.0.1:1");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("::error::Modal /healthz unreachable at");
    expect(r.output).toBe("");
  });

  it("mock 500 -> exit 1, distinct non-200 error", async () => {
    const { server, url } = await serve((res) => {
      res.writeHead(500);
      res.end("boom");
    });
    try {
      const r = await runProbe(url);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("::error::Modal /healthz returned HTTP 500 at");
      expect(r.output).toBe("");
    } finally {
      server.close();
    }
  });

  it("mock 200 with a DRIFTED sha -> exit 0, sha faithfully extracted", async () => {
    const { server, url } = await serve((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sha: DRIFTED_SHA }));
    });
    try {
      const r = await runProbe(url);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`Served SHA: ${DRIFTED_SHA}`);
      expect(r.output).toContain("reachable=true");
      expect(r.output).toContain(`served_sha=${DRIFTED_SHA}`);
    } finally {
      server.close();
    }
  });

  it("mock 200 with the MATCHING sha -> exit 0, sha faithfully extracted", async () => {
    const { server, url } = await serve((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", sha: HEAD_SHA }));
    });
    try {
      const r = await runProbe(url);
      expect(r.status).toBe(0);
      expect(r.output).toContain(`served_sha=${HEAD_SHA}`);
    } finally {
      server.close();
    }
  });

  it('mock 200 without a sha field -> exit 0, served_sha=unknown (jq `.sha // "unknown"` preserved)', async () => {
    const { server, url } = await serve((res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    });
    try {
      const r = await runProbe(url);
      expect(r.status).toBe(0);
      expect(r.output).toContain("served_sha=unknown");
    } finally {
      server.close();
    }
  });

  it("mock 200 with a non-JSON body -> exit 1 (deliberately red)", async () => {
    const { server, url } = await serve((res) => {
      res.writeHead(200);
      res.end("<html>not a healthz</html>");
    });
    try {
      const r = await runProbe(url);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("but the body is not JSON");
      expect(r.output).toBe("");
    } finally {
      server.close();
    }
  });
});
