# phase-0-287 — Phase 0 is complete

**Umbrella:** #287 — Phase 0 of Direction A (#281). **Closed:** 2026-09-18.
**Members:** #256, #279, #282 — and #294, which closed with #279.
**Design authority:** #281 (Part 1 in the body, Part 2 rev. 2026-09-16 in comment 1).

Phase 0 is the work the four UI phases lean on and none of them can be honest without: the
scan chain that feeds the detected-vs-applied surface, the classifier that fills its
`roadType` row, and the backend flag that lets a preview be a read. All three are shipped,
measured and closed.

Per the arc convention, **every arc opened with its own `rulings.md` as its first commit**,
quoting Ryan's rulings verbatim with the date; each commit cites that file as its authority,
and the diff-verifier checks the commit against it rather than against the commit's own
summary. The per-item tables below name the ruling each piece of work landed under.

## The three arcs

| issue | arc directory | what closed it |
|---|---|---|
| **#256** | `issue-256-scan-chain/` | three acceptance legs, not one — Denver 1/1/1, Lakewood 0/2/0 |
| **#279** | `issue-279-classifier/` | `PLACE_RADIUS_M` 3,000 → 5,000, one constant, on a measured sample |
| **#282** | `issue-282-preview-flag/` | `preview: bool = False`, Pydantic first, payload-level tests |
| **#294** | (in `issue-279-classifier/`) | the `isUrban` masking defect — its own commit, closed with #279 |

### #256 — the scan chain, the fold, the memo key

Rulings `a`–`j` in `issue-256-scan-chain/rulings.md`, with ruling `a` corrected the same
day (6 s → 7 s) and the superseded text kept beside the correction.

| landed under | what shipped |
|---|---|
| `a` (revised) + `j` | per-mirror cap `PER_MIRROR_READ_S = 7.0` / `PER_MIRROR_CONNECT_S = 3.0`; a 429 advances the chain instead of stopping it |
| `c` | the corridor-check fold — one Overpass round trip serves the scan and the bearing check; `CORRIDOR_CHECK_BUDGET_S` retired with a Rule-5 declaration |
| `d` | the memo key — `MEMO_KEY_VERSION = 2` hashed into the key, the smallest honest change, ruled at its own checkpoint rather than assumed |
| `e` | commit order fix 1 → fold → memo key, each shippable, healthz between |
| `f` | acceptance N = 20 cold runs per pin, sha-gated both ends |
| `b`, `g`, `h`, `i` | no retry-on-timeout; the re-baseline predicted single-leaf (and found unnecessary — the fixture is a stub, recorded not hidden); fallback kept in fix 1; the corridor-bbox `use_max` question **held for Phase 3** |

**What it measured:** `check_unavailable` **0 of 115** ok rows across three runs, against
arc-31's 43 % (Denver) / 65 % (Lakewood) before. Mirror 2-or-3 reached on 15, 16 and 21 of
40 cold rows, against **0 of 80** before. Denver's `residual_ms` p90 fell 16,312 ms → 906 →
958 ms, which is the fold measured rather than asserted.

**What it did not settle,** and says so: Lakewood's 0/2/0 is real variance; run 3's FAIL is
committed intact rather than smoothed.

### #279 — the classifier

One ruling, then a withdrawn ruling `(c)`, then the tiebreaker ruling of 2026-09-17. All
three states are in `issue-279-classifier/rulings.md`; none was edited away.

| landed under | what shipped |
|---|---|
| the tiebreaker ruling (2026-09-17) | `PLACE_RADIUS_M` 3,000 → 5,000 in `route.ts`, CHOSEN with three measurements and the ~2 km margin as the stated argument; old 3,000 recorded CHOSEN-by-inheritance |
| same ruling, "the masking fix rides along" | #294's commit, claiming nothing about #279 |
| same ruling, "the inferred marker fires…" | **verified, not re-implemented** — `classify.ts` is not in the diff |
| same ruling, "do NOT move the predicate to the backend" | honoured; that belongs to #291's arc |
| Rule 5 | churn predicted as **zero files**, three legs each checked in source |
| Rule 12 | the constant traced to the sample; `bayaud/` added when two quoted distances turned out to have no committed evidence |

**Three of this arc's own claims were falsified by its own evidence** — the masking
diagnosis, the Ouray reading, and "three localities inside 3,000 m". Each is recorded beside
the correction rather than deleted, because the correction is the part worth keeping. All
three were caught by opening a file; none by re-reading the prose written from it.

### #282 — preview-as-read

One ruling, in `issue-282-preview-flag/rulings.md`.

| landed under | what shipped |
|---|---|
| the ruling, "Pydantic first" | `PreviewScenarioFields` mixin on all seven scenario classes — backend first, because Pydantic silently drops unknown fields |
| "runs the breakdown path only" | no memo write, no audit, no scan, no PDF |
| "a `preview: true` echo" | echoed on device-breakdown only, so a preview can never be mistaken for a generate |
| "payload-level tests for both branches (Rule 11)" | tested at the payload, where the defect would live |
| "absent → byte-identical to today" | fixtures unchanged |
| "enumerate every sender" | enumerated: **none send it yet** — the flag is a capability Phase 3 will use, not a live behaviour change |

## What Phase 0 handed on rather than finished

Filed as issues so that "closed" is not read as "nothing left":

| issue | what |
|---|---|
| **#291** | Lookout Mountain Rd classifies urban on shipped code and under **every** #279 candidate — plus the Ouray pin, a second case where the place classes cannot express what the road is |
| **#292** | Overpass mirror ordering — the least reliable mirror is asked first; the remaining lever on the refusal rate |
| **#293** | negative `residual_ms` in #256's own committed acceptance artifacts — unexplained, and filed rather than left |

None blocks Phase 1. #291 and #292 are the honest residue of the two fixes; #293 is a defect
in evidence rather than in product.

## What Phase 0 does not claim

- **#256's closure rests on three runs, not a best run.** Overpass load is a property of the
  hour, not of the sha.
- **#279's radius is the smallest value *tested*, not the smallest possible.** No minimum
  search was run, by ruling: a value fitted to one pin's 3,056 m node is a value fitted to
  one pin.
- **#282 changes no live behaviour.** Nothing sends the flag yet.
- **Phase 0 completing does not make Phase 1 unblocked by itself** — Phase 1 never needed
  #256; per the triage's FLOW §9 reading, #256 needed to be *running* during Phase 1 so that
  Phase 2 is not built on a refusing scan. That condition is now met.

## Where the record lives

- `validation-artifacts/committed/issue-256-scan-chain/` — `rulings.md`, `README.md`, the
  acceptance harness and four runs including the crashed one and the failing one.
- `validation-artifacts/committed/issue-279-classifier/` — `rulings.md` (the arc's
  authority, carrying two withdrawn/falsified positions), `rate/`, `candidates/`,
  `tiebreak/`, `bayaud/`.
- `validation-artifacts/committed/issue-282-preview-flag/` — `rulings.md`.
- `validation-artifacts/committed/s2-triage-3/findings.md` — the triage that produced #287
  and the phase assignment for every open issue.
