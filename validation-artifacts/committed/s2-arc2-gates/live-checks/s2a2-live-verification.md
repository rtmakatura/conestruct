# s2-arc2 live checks — production, 2026-08-18

Runner: `s2a2-live-checks.js` (headless Playwright, read-only —
transient picker/form state and compute-only renders, nothing saved
server-side). Raw log: `outS2A2/assertions-raw.md`. One earlier run
carried a runner defect (S2 expected the raw 400 sentence on the page;
the #180 design shortens the banner to the mirror pointer when a match
exists — the runner's expectation was wrong, not the product) — fixed
in the script; this is the complete run.

## Gate

healthz `c76dc9c…` == `git rev-parse origin/main` == served-bundle sha
(found in the served `_next/static` chunks). Passed first probe.

## The real refusing pin

The plan's corridor sweep found one (`outS2A2/corridor-sweep.md`):
Colfax carries no per-direction lane tags anywhere probed (sparse tags
never gate, by design), but an Overpass scan of 300 fully-lane-tagged
central-Denver ways surfaced 2 genuine mismatches, and our own
detection API confirms both as refusing shapes. **E Bayaud Ave
(39.71466, −104.94071)**: primary candidate way 39508704, `lanes=2 /
forward=2 / backward=2` (2 ≠ 4), `oneway=no`, signal **13.75 m**, snap
0.05 m — real OSM data exhibiting exactly the turn-pocket
double-counting the gate exists for (`turn:lanes:* = left|through`
both directions). No synthetic relays anywhere in the browser flow.

## Results — 16 checks: 14 PASS (gate included), 2 FAIL (both the one pre-existing node)

The raw log records check names; rendered-text assertions are the
runner's regexes (`s2a2-live-checks.js`), with the numbered screenshots
as visual evidence. The refusal sentences under P1/P2/P5 are quoted
(truncated) in the log itself from the live HTTP responses.

| # | check (assertion target in the runner) | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | log | PASS |
| P1 | shoulder near-signal + mismatch → 400, sentence starts `A signalized intersection is about 88 ft from this location…` | log (quoted) | PASS |
| P2 | flagger variant → 400, same sentence with the confirm-row recovery | log (quoted) | PASS |
| P3 | mismatch without the signal fact → 200 (caution-only preserved) | log | PASS |
| P4 | signal fact with clean relays → 200 | log | PASS |
| P5 | boundary 30.00 m → 400 (`about 98 ft`, inclusive) | log (quoted) | PASS |
| P6 | boundary 30.01 m → 200 | log | PASS |
| S1 | shoulder refusal surfaces on the real Bayaud pin (mirror pointer regex) | `01-…png` | PASS |
| S2 | banner is the shortened #180 pointer, not the raw 400 | log | PASS |
| S3 | lane edit lifts the refusal, plan regenerates | `02-…png` | PASS |
| F1 | flagger refusal surfaces, its own pointer | `03-…png` | PASS |
| F2 | the new "Lane count is right" row armed in the Road section | `03-…png` | PASS |
| F3 | tick lifts the refusal; row stays checked describing the override | `04-…png` | PASS |
| N1 | served NI narrative carries the rightmost-lane note | `ni-narrative-served.md` | PASS |
| AX1 | axe, page in the shoulder refusal state | `axe-shoulder-refusal.json` | **FAIL — pre-existing node (below)** |
| AX2 | axe, flagger armed-confirm-row state | `axe-flagger-armed-row.json` | **FAIL — same pre-existing node (below)** |

## Byte-compare (#176's zero-change claim on the served surface)

`outS2A2/byte-compare.md`: `/render/audit` JSON byte-identical served
vs local at `c76dc9c` (7037 == 7037); the narrative equal after exactly
two named environmental normalizations (local CRLF ×101 lines; the
server's UTC `Generated:` date). Base-vs-HEAD identity is carried by
the committed equality tests + unchanged snapshot suites.

## The two axe FAILs — one pre-existing node, both states

Both findings are the identical `color-contrast (serious)` on
`.opacity-80` — the recorded **faint-register family**
(`AuditTrail.tsx:333`), byte-identical to s2-arc1's AX2 record and
named by the arc16 coda as likely-failing anywhere it renders. Zero
diff hits for `opacity-80` this arc; the two new page STATES (refusal
banner, armed confirm row) merely give the known node two more places
to surface. Left FAILING rather than exempted in the script — the
disposition is Ryan's; already pile-bound with the s2-arc1 instances.

Notably absent: no NEW findings on anything this arc touched — the
armed confirm row itself scans clean.

## Verdict

s2-arc2 is live and verified at `c76dc9c`: gate green first probe, 14
of 16 checks PASS — every payload branch of the signal-proximity gate
measured on prod with the sentences verbatim, the full refusal →
recovery loop driven in the browser on a REAL mismatched-tags pin
beside a real signal for both kinds (no synthetic relays), the #180
banner shortening confirmed, and #176's zero-change claim held on the
served surface. Two honest FAILs on record, both the one known
pre-existing faint-register node. Refs #173, #176.
