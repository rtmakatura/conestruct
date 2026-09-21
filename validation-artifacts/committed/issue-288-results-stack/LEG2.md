# issue-288 leg 2 — the interim leg at `f81daa6`

**Run:** 2026-09-21. **Base:** `https://www.conestruct.com`. **Sha-gated both ends** —
`healthz` = `f81daa6847e8a70a3a4140a5aafa9ab65b78b3f7` = `origin/main`, checked before the
first leg and again after the last. **Output:** `%TEMP%\i288-leg2\out`, outside the repo,
copied here afterwards. **Probe:** `i288-leg2-probe.js`. **Bundle poll:**
`i288-bundle-poll.js`.

**34 rows · 0 FAIL, at 1440×1000 and 380×800.**

## The bundle poll — the arc is served

| mark | served |
|---|---|
| `ns-strip` | **absent** |
| `NEXT — 3 STEPS` | **absent** |
| `ns-chip` | **absent** |
| `--strip-h` | **absent** |
| `--fact-h` | **PRESENT** |
| `.needs-you` (CSS) | PRESENT |
| `NEEDS YOU` (copy) | **absent** — the component is built but not mounted |

Served: 28,900 B html · 11 chunks (1,099,403 B) · 3 sheets (142,211 B), against the
pre-ship 28,909 / 1,102,760 / 142,919. The CSS/copy split is the precise state: the block's
stylesheet ships, its markup does not, because nothing imports it yet.

## What the leg measured

### §8.29 — the strip is gone from the settled DOM, not just the bundle

`.ns-strip` absent · `.ns-chip` count 0 · `"NEXT — 3 STEPS"` absent — **both widths.**

### Rule 28 — the reserved first row

| row | 1440×1000 | 380×800 |
|---|---|---|
| absent pre-generate | PASS | PASS |
| mounted from the Generate click | **2 ms** | **2 ms** |
| `min-height` | **44px** (`--fact-h` resolves `44px`) | **44px** |
| measured height at the settle | **44px** | **44px** |
| `margin-bottom` (rule 27's first gap) | 14px | 14px |
| `position` | **static** (rule 32) | **static** |
| children at the settle | **0** | **0** |

One value at both widths, which is the ruling's point: `--fact-h` is read off rule 56 and
does not vary by viewport, where `--strip-h` carried a separate measured 192px at 380.

### Errors

0 `pageerror`, 0 hydration-shaped messages, both widths. The early tap attached before
`goto`, the late tap after `networkidle`; both read the same count, recorded as INFO not
PASS — on a clean page the two cannot distinguish a correct listener from a mis-ordered one.

Console errors (7 at 1440, 5 at 380) are all `events.mapbox.com` telemetry
`ERR_NAME_NOT_RESOLVED` plus two 400s from the same host — the harness environment cannot
resolve Mapbox's telemetry endpoint. Environmental, not product, and recorded rather than
filtered so the count is not quietly massaged.

## #288's acceptance, line by line

| # | line | verdict |
|---|---|---|
| 1 | Every S5/S6/S8 state at both widths | **NOT MEASURABLE** — NEEDS YOU is not mounted; the container, disclosures and S8 do not exist |
| 2 | One primary per state at both widths | **NOT MEASURABLE** — the primary derivation is unbuilt |
| 3 | NEEDS YOU always expanded; ledger the only sorter | **UNIT-TESTED ONLY** — 9 tests in `NeedsYou.test.tsx`; not on a served surface |
| 4 | File count stated once, from the served bundle | **OPEN — and now stated ZERO times.** See finding 5 in the README |
| 5 | **Reserved first row holds at the settle — no results movement, counted** | **PASS, both widths** — 44px, static, empty, mounted at 2 ms |
| 6 | Ribbon ≥ 4.5:1 mid-flight on the composited surface | NOT MEASURED — deferred to the stack's leg |
| 7 | Left edges ±1; TARGETS 0 under 32/44; axe `target-size` 0 at 380 | NOT MEASURED — deferred |
| 8 | Zero `pageerror`; nav citation carries no date | **PASS, both widths** (re-confirmed at this sha) |
| 9 | Nothing in §8 KEPT changes behaviour | **PASS by construction** |
| 10 | Ryan hand-check on a hard-refreshed tab | **OUTSTANDING** — correctly held until the stack is served |

**Three of ten closed** (5, 8, 9). Line 4 is open and its state is worse than before, by
design and on the record.

## The harness bug this leg found in itself — four runs to a green

Recorded because the correction is the part worth keeping, and because the same trap will
catch the next leg.

1. **Run 1** keyed Generate on `/Generate package/i`. No such control exists any more — the
   CTA's accessible name is now state-derived. Zero matches, 30 s timeout.
2. **Run 2** keyed on `/^Generate/`. That matched, and the leg reported "gate open" —
   but **no generation ever started**. The match was `button.rail-entry.st-generate`
   (`"→Generate"`, 21 px), the progress rail's step chip, which sorts first in the DOM and
   is a **read**, not a write. Two runs recorded "the reserved row never mounted" against a
   click that never generated anything.
3. **Run 3** split the wait in two — did the band appear, did the slot appear — which is
   what made the difference visible: *neither* did, so the fault was upstream of the slot.
4. **Run 4** keyed on `button.generate-btn` (`"Generate plan"`, 56 px — rule 130's `.pri`
   height). Band at 1 ms, slot at 2 ms, every reserve row green.

The lesson is the one #237 already states in another form: **a leg keyed on state-derived
copy rots silently, and a selector that matches the wrong element reports a product defect
that does not exist.** Two runs of this leg accused rule 28 of not mounting. Rule 28 was
fine; the probe was clicking a signpost. Keyed on the class now, with the reason in the
source.

Also fixed: reading the CTA's text after the click hung for 30 s, because the control
unmounts under the working-band lock. A probe must not block a leg on its own
instrumentation — it now records `(unreadable — the CTA is gone or locked)` and continues.

## The leg's artifacts tried to publish a credential

The first push of this evidence was **refused by GitHub's secret scanning**, and it was
right to refuse. Mapbox's telemetry endpoint carries its access token in the query string;
those requests fail in this harness environment (`ERR_NAME_NOT_RESOLVED`), so `err-tap.js`
recorded them — whole URL, token included — into `taps-1440.json` and `taps-380.json`.

Two fixes, both in this commit:

- the committed artifacts are **redacted** (`access_token=[REDACTED]`, 8 occurrences), not
  deleted — the failure rows are real evidence and the count must not change;
- `err-tap.js` now **drops the query string entirely** rather than truncating it. An
  evidence file has no use for a credential, and truncating to N characters would only have
  hidden it at some lengths.

The token is a public `pk.` Mapbox key that already ships in the client bundle, so nothing
was exposed that was not already public. The rule still holds: a harness that records
whatever a URL happens to carry will eventually record something that matters.

## What was not run, and why

S5 with three NEEDS YOU items · S5 with zero · S6 declined · S8 with the reference open.
None of those four surfaces exists at `f81daa6`: NEEDS YOU is built but unmounted, the stack
container and disclosure rows are unbuilt, and S8 would drive the old `TieredReference`
shape. Driving them would put the four state names on measurements of something else.
