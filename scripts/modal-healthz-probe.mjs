#!/usr/bin/env node
/**
 * Modal /healthz probe — the deploy-gap monitor's reachability check,
 * extracted from .github/workflows/modal-deploy-check.yml so its
 * exit-code taxonomy is vitest-covered instead of proven only by
 * manual workflow_dispatch (#169; taxonomy shipped by PR #168).
 *
 * Usage:  node scripts/modal-healthz-probe.mjs <base-url>
 *
 * Behavior (preserved 1:1 from the #168 bash step):
 *   - probes <base-url>/healthz up to ATTEMPTS times, SLEEP seconds
 *     apart, 30 s timeout per attempt (covers a Modal cold start)
 *   - unreachable after all attempts  -> ::error:: + exit 1
 *   - reachable but non-200          -> distinct ::error:: + exit 1
 *   - 200                            -> exit 0; served sha (JSON
 *     `.sha`, missing -> "unknown") printed and, when GITHUB_OUTPUT
 *     is set, appended as `reachable=true` / `served_sha=<sha>`
 *   - 200 with an unparsable body    -> ::error:: + exit 1 (the bash
 *     version failed the step via jq under `set -e`; kept red — a
 *     healthz we cannot read is a healthz we cannot verify)
 *
 * MODAL_PROBE_ATTEMPTS / MODAL_PROBE_SLEEP_SECONDS override the retry
 * knobs — test hooks only; the defaults are the workflow's behavior.
 */
import fs from "node:fs";

const url = process.argv[2];
if (!url) {
  console.error("::error::modal-healthz-probe: no base URL argument given.");
  process.exit(1);
}

const ATTEMPTS = Number(process.env.MODAL_PROBE_ATTEMPTS ?? "3");
const SLEEP_S = Number(process.env.MODAL_PROBE_SLEEP_SECONDS ?? "10");
const TIMEOUT_MS = 30_000;

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

let code = null;
let body = "";
for (let i = 1; i <= ATTEMPTS; i++) {
  try {
    const res = await fetch(`${url}/healthz`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    code = res.status;
    body = await res.text();
    if (code === 200) break;
    console.log(`Attempt ${i}/${ATTEMPTS}: /healthz returned HTTP ${code}.`);
  } catch (err) {
    code = null;
    console.log(
      `Attempt ${i}/${ATTEMPTS}: could not reach ${url}/healthz (fetch: ${err.cause?.code ?? err.name}).`,
    );
  }
  if (i < ATTEMPTS) await sleep(SLEEP_S);
}

// An unreachable or non-200 /healthz means we CANNOT read the live
// backend state.  That is the exact scenario this monitor exists for,
// so fail loudly (red run -> notification) instead of exiting green.
if (code === null) {
  console.error(
    `::error::Modal /healthz unreachable at ${url} after ${ATTEMPTS} attempts (network/timeout/DNS). Cannot verify the deployed backend — investigate the backend or the MODAL_RENDER_URL variable.`,
  );
  process.exit(1);
}
if (code !== 200) {
  console.error(
    `::error::Modal /healthz returned HTTP ${code} at ${url} after ${ATTEMPTS} attempts. Cannot verify the deployed backend — investigate the backend or the MODAL_RENDER_URL variable.`,
  );
  process.exit(1);
}

let served;
try {
  const parsed = JSON.parse(body);
  served = typeof parsed.sha === "string" && parsed.sha ? parsed.sha : "unknown";
} catch {
  console.error(
    `::error::Modal /healthz returned 200 at ${url} but the body is not JSON. Cannot verify the deployed backend — investigate the backend or the MODAL_RENDER_URL variable.`,
  );
  process.exit(1);
}

console.log(`Served SHA: ${served}`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `reachable=true\nserved_sha=${served}\n`,
  );
}
