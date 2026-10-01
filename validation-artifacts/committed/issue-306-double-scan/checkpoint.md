# issue-306-double-scan — checkpoint (written before Ryan rules)

**Issue:** #306 — one Generate runs the site scan twice (device breakdown and audit at once), and either
can refuse on its own. `rulings.md` is beside this file.
**Base:** `5e05379` = prod `healthz`, 2026-10-01. Read-only probes against prod, through the gate. No
product code. Evidence: `probes/` here, and `../scan-refusal-rate/` (carried as `4a03ee7`).

## The answer, in brief

1. **The two halves of a Generate run on different Modal containers.**
   - The function allows one request per container (`modal_app.py:100-135`: `min_containers=1`,
     `max_containers=8`, no `@modal.concurrent`).
   - The scan memo is a module dict in each container (`src/api/site_scan.py:588`).
   - **Measured:** 5 of 5 concurrent pairs, audit on one container and breakdown on the other
     (`probes/out/container-pairs-logs.txt`, container ids from the Modal log). One breakdown also
     paid a ~5.7 s cold start (`duration 26.0 s, execution 20.3 s`).
   - **So the issue's option (a), a single-flight lock per container, can't work.** There is no
     shared memo for the second request to wait on.
2. **Sent one after the other, both halves land on the same container.**
   - 16 of 16 calls, 8 pairs (`probes/out/sequential-pairs-logs.txt`).
   - After an audit that **answered**, the breakdown hit the memo: 0.40–0.42 s server time, 4 of 4.
   - After an audit that **refused**, the breakdown scanned again, because a refusal is never
     memoised. Twice it answered where the audit had refused (`e-bayaud`, `w-alameda`: audit 400,
     breakdown 200): the split again, the other way round.
3. **The refusal rate this morning is far above yesterday's** (14:44–14:51Z):
   - 6 of 10 scans refused in the concurrent pairs; 4 of 8 audits in the sequential ones.
   - Split verdicts in 2 of 5 concurrent pairs (audit 200, breakdown 400).
   - The 09-30 18:57–19:14Z window measured 1 of 37 refused.
   - Every refusal is the third mirror's ReadTimeout at the 20 s budget, which is #292.
4. **Recommendation: (c), one request returns both.**
   - The audit request carries the breakdown, built from the same placements in the same handler.
     One Generate runs one scan, and the breakdown can't disagree with the audit, by construction.
   - **Cheaper alternative, (b):** the site sends the audit, then the breakdown only if the audit
     answered. Measured as one scan in practice (16 of 16 same container), but not guaranteed by
     any mechanism.

---

## 1. What happens today (`5e05379`)

**The site's two calls:**
- `conestruct/site/components/GeneratorShell.tsx:455-472` (device breakdown) and `:516-530` (audit)
  are two effects gated on the same `fetchArmed`.
- They send at the same moment on every Generate. The #243 sweep log shows both requests before
  either response.
- A third caller, `:640-660`, is the S7 preview. It posts `preview: true` and never scans
  (`render_api.py:755-762`); it is unaffected by all of this.

**The backend:**
- `/render/device-breakdown` (`render_api.py:1565-1600`) and `/render/audit` (`:1692-1720`) both
  build through `_placements_for` (`:755-766`).
- `_placements_for` runs `run_site_scan`, which serves from the per-container memo (TTL 120 s) or
  scans, and raises `400 site_scan_unavailable` on a refusal.
- The breakdown's own work after the plan is cheap: device rows, totals, `zone_geometry`, and the
  jurisdiction evaluation from the same placements (0.28 s server time on a memo hit).

**Modal:** one request per container. Two concurrent requests are two containers, and a third
waits or cold-starts one.

| Pattern | Containers | Breakdown's scan | Measured |
|---|---|---|---|
| Concurrent, today's site | 2 (5 of 5 pairs) | its own | 2 of 5 pairs split (audit 200 / breakdown 400); 2 both refused |
| Sequential, audit answered | 1 (4 of 4) | memo hit, 0.40–0.42 s | no split |
| Sequential, audit refused | 1 (4 of 4) | its own (refusals aren't memoised) | 2 of 4 split the other way (audit 400 / breakdown 200) |

## 2. The options

| | Change | One scan per Generate? | Split possible? | Cost |
|---|---|---|---|---|
| **(a) single-flight per container** | a lock per memo key in `run_site_scan` | no: the halves are on different containers (5 of 5) | yes | — ruled out by measurement |
| **(b) sequence in the site** | the breakdown effect waits for the audit's answer; a refused audit sends no breakdown (the plan is declined; Retry re-asks both) | usually: 16 of 16 same container, memo hit 4 of 4. Not by mechanism: Modal routes the second request to any idle container | rarely (another container under load) | site only. The device list arrives ~0.4 s after the audit instead of beside it |
| **(c) one request, both answers** | the audit request asks for the breakdown too, and the backend builds it from the same placements (one `_placements_for`, one scan). The site's Generate sends one request and fills both states from it. The preview path keeps `/render/device-breakdown` with `preview: true` | **yes, by construction** | **no** | backend + proxy + site; details in §4 |
| (d) shared cache across containers | a `modal.Dict` memo plus an in-flight marker | yes, for every endpoint, the downloads included | no | a new Modal resource, a network hop per scan, lock-expiry rules (CHOSEN constants). Out of proportion for this issue |
| (e) `@modal.concurrent` plus single-flight | let one container take several requests | only if Modal packs both halves onto one container: unmeasured, and not promised | yes | changes the threading model for every endpoint (PDF renders in one process) |

**Recommendation: (c).**
- It is the only option short of (d) that meets the issue's acceptance, "at most one Overpass scan
  per Generate", by mechanism instead of by luck.
- It also removes the reverse split, since a refused audit never has a breakdown that answered.
- **(b) is the honest fallback** if (c)'s site change is too big for now. State it as "usually one
  scan", and re-word the acceptance to match.

## 3. Related, and outside this issue

**The downloads scan again.**
- `render_api.py:803` is the helper behind `/render/pdf`, `/render/xlsx`, `/render/markdown`,
  `/render/crew-pdf` and `/render/quote`, and it runs `_placements_for` with the scan.
- A download hits the memo only on a container that scanned that corridor in the last 120 s.
  Otherwise it scans again, and can refuse while the page shows a plan.
- Only (d) covers that. **Propose: record it on #306's close, or a separate issue.** Not measured here.

**The refusal rate itself is #292.** This morning's numbers (§1, item 3) belong on #292 too.

## 4. Option (c) in detail, if ruled

**Backend:**
- `/render/audit` accepts an opt-in on the scenario, `include_breakdown: true` (the same mixin
  pattern as #282's `preview`).
- When it is set, the response gains `breakdown`: the exact object `/render/device-breakdown`
  returns, built by one shared function from the placements the audit already holds.
- When it isn't set, the response is byte-identical to today's. **0 recorded audits move.**
- `/render/device-breakdown` keeps serving the preview and any other caller.

**Proxy:** `lib/render-proxy.ts` `fetchAuditTrail` passes the flag through, and nothing else changes.

**Site:**
- Generate's two effects become one request.
- The breakdown state (`genState`, `deviceBreakdown`) is set from `audit.breakdown`, and the audit
  state from the rest.
- A refused audit sets both to the refusal, which is what today's page already shows for a
  declined plan.
- The jurisdiction block that "rides the device-breakdown response" (`GeneratorShell.tsx:887`)
  rides the same object.

**Rule 5, predicted:**
- **Recorded audits:** 0 (the key is opt-in).
- **The breakdown's own baselines:** 0 (endpoint unchanged).
- **Site tests that mock the two Generate fetches by URL:** they move. Count to be taken before
  the diff; every `GeneratorShell.*.test.tsx` that stubs `/api/render/device-breakdown` for a
  Generate. The preview-path tests don't move.
- **Wire:** one optional request field and one optional response key (the three-hop rule:
  schema, proxy, site).

## 5. Proof plan (for whichever option is ruled)

- **Backend (c):** `include_breakdown` gives `breakdown` equal to `/render/device-breakdown`'s
  answer for the same scenario. One `run_site_scan` call per request, asserted with a counting stub.
  Without the flag, the response is byte-identical (the recorded-audit suites).
- **Site:**
  - A Generate sends one request (fetch count) and fills both states.
  - A refusal shows the declined plan, with no "Device breakdown failed" row beside a plan.
  - The preview still calls `/api/render/device-breakdown` with `preview: true`.
- **Prod after the ship:** `probes/container_pairs.py`, adapted to the site's new request,
  20 Generates. The breakdown and the audit never disagree, and the Modal log shows one
  `/render/audit` and no `/render/device-breakdown` per Generate.

## 6. Questions (surfaced, not decided)

- **Q1.** (c) as recommended, (b) as the cheaper stand-in, or both: (b) now, (c) later?
- **Q2.** If (c): the opt-in on `/render/audit` (recommended: no recorded churn, one endpoint),
  or a new `/render/generate` endpoint (cleaner name, a fourth proxy route)?
- **Q3.** The downloads' re-scans (§3): a separate issue, or a note on #306's close?
- **Q4.** Post this morning's refusal numbers on #292? (6 of 10 and 4 of 8, against 1 of 37
  yesterday evening.)

## Evidence index

- `probes/container_pairs.py` → `out/container-pairs.txt`, `out/container-pairs-logs.txt`
  (5 concurrent pairs, 14:44–14:47Z, container ids).
- `probes/sequential_pairs.py` → `out/sequential-pairs.txt`, `out/sequential-pairs-logs.txt`
  (8 sequential pairs, 14:48–14:51Z, container ids).
- `../scan-refusal-rate/` (`4a03ee7`): the 09-30 measurement behind the issue.
