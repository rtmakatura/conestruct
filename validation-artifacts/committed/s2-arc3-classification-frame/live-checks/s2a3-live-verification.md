# s2-arc3 live checks, round 1 — production at `71a1144`, 2026-08-18

Runner: `s2a3-live-checks.js` (headless Playwright + direct proxy
POSTs, read-only — transient picker/form state and compute-only detect
calls, nothing saved server-side). Raw log: `outS2A3/assertions-raw.md`.
One earlier run carried a runner defect (the picker-open button regex
didn't match the real "Pick Location on Map" name) — fixed in the
script; this is the complete run.

## Gate

healthz `71a1144…` == `git rev-parse origin/main` == served-bundle sha
(`/_next/static/chunks/720-4fe41fb05e8c0511.js`). Passed first probe.

## THE FINDING — the shipped relay is inert on the served surface

The wire crosses three hops: browser → **Vercel proxy route** → Modal.
The arc verified the first and third; the middle hop
(`app/api/render/detect-site/route.ts`) is an allowlist re-constructor
with a 1 KB body cap sized before the geometry existed. Measured live:

- a realistic relay-bearing detect (the 166-vertex fixture geometry,
  ~6 KB) → **HTTP 413** — a confirmed-road user clicking Detect gets
  "Detection failed (413)." (a live regression introduced by this arc:
  pre-#207 the same click carried no geometry and succeeded);
- a sub-1 KB body with a sharply bent 3-vertex centerline → HTTP 200
  but the response canonicalizes **identically** to the no-centerline
  response — the allowlist strips the field before Modal ever sees it.

Fix staged on `issue-207-proxy-relay` (`d657e33`, this branch stacks on
it): the cap joins the render-family 32 KB bound (the same payload
class those routes already carry), the centerline validated and passed
through, and a route-level regression test pins the hop — red-proven
against the shipped route. **Not merged, not shipped — Ryan's go.**

## Results — 8 checks: 4 PASS (gate included), 4 FAIL (three are the finding, one the known pre-existing node)

| # | check | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | log | PASS |
| D1 | corridor-mode detect without a centerline serves (HTTP 200, mode corridor) | `d1-no-centerline.json` | PASS |
| D2 | relay-bearing detect (166-vertex fixture geometry) reaches the backend | `d2-with-centerline.txt` | **FAIL — HTTP 413 (the finding)** |
| D3 | sub-1 KB bent centerline changes the classification (not silently stripped) | `d3-bent-small.json` vs `d1` | **FAIL — canonically identical to D1 (the finding)** |
| B1 | the browser's detect body carries the confirmed road's centerline (59-vertex Wadsworth geometry) | `b1-browser-detect-body.json` | PASS |
| B2 | the relay-bearing browser detect succeeds end-to-end | log | **FAIL — HTTP 413 (the finding, user-facing)** |
| B3 | the outcome surfaces honestly ("Detection failed (413).", never silence) | `01-post-detect-state.png` | PASS |
| AX1 | axe zero violations — post-detect state | `axe-post-detect.json` | **FAIL — the known pre-existing node (below)** |

B1 is the positive half the finding leaves standing: the shipped
frontend relay IS live — the browser POSTs the staleness-guarded
geometry exactly as designed. The 413 is the proxy's, not the form's.

## The axe FAIL — the known node

`color-contrast (serious)` on `.opacity-80` — the recorded
faint-register family, byte-identical to the s2-arc1/s2-arc2 records.
Zero diff hits for `opacity-80` this arc; left FAILING rather than
exempted — disposition Ryan's, already pile-bound. Nothing new on the
touched surface.

## Blocked to round 2 (after the proxy fix ships)

The plan's two substantive checks need the road frame reachable
through the served proxy, which the finding blocks:

- **curved-pin drawn-vs-classified consistency** (a real feature's
  served station verified against the locally computed road frame);
- **straight-control A/B** (Lakewood: chord vs road frame — zones
  identical, stations within ±0.2 ft, declared).

Round 2 re-runs the D/B series with D3's assertion inverted (the bent
centerline MUST change the response once the field passes) plus those
two. The Lookout corridor itself carries no in-corridor OSM features
(nearest cluster ~3,100 ft upstream, honestly outside even the 250 ft
intersection tolerance) — round 2's curved consistency check uses the
served feature records on a curved pin that has them, or states the
gap honestly if central-Denver curves offer none.

## Verdict

Round 1 is an honest partial: gate green first probe, the shipped
frontend relay proven live in the browser (B1), the pre-#207 serving
paths intact (D1), error honesty holds under the failure (B3) — and
the arc's served classification frame is **not yet reachable** because
the proxy hop 413s/strips the relay (D2/D3/B2, the finding; fix
staged, red-proven, awaiting Ryan's ship). One known pre-existing axe
node on record. Refs #207.
