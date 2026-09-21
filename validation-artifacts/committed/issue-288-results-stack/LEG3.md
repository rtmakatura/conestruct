# issue-288 leg 3 — the four-state leg at `65bc7e8`

**Run:** 2026-09-21. **Base:** `https://www.conestruct.com`. **Sha-gated both ends** —
`healthz` = `65bc7e87b524fc5241bba232f774454bc6f6cb67` = `origin/main`. **Output:**
`%TEMP%\i288-leg3\out`, outside the repo, copied here. **Probe:** `i288-leg3-probe.js`.

**52 rows · 0 FAIL, at 1440×1000 and 380×800.**

## The bundle poll

`ns-strip`, `NEXT — 3 STEPS`, `ns-chip`, `--strip-h` **absent**; `--fact-h` **present**; and
for the first time the `NEEDS YOU` **copy** is in the served page, not just the `.needs-you`
stylesheet. Served: 28,900 B html · 11 chunks (1,105,730 B) · 3 sheets (142,781 B).

## S5 with items — both widths

| row | 1440 | 380 |
|---|---|---|
| `.ns-strip` present | false | false |
| reserved row height | **44px** | **44px** |
| header count | **"3"** | **"3"** |
| rows rendered | 3 (2 changed, 1 attention) | 3 (2 changed, 1 attention) |
| count is the sum (ruling 185) | PASS | PASS |
| buttons in the block (ruling d) | **0** | **0** |
| caret in the header (ruling 186) | false | false |

The provenance line, verbatim from the run:

> changed the plan, or waiting on your word · 2 changed this plan · 1 needs attention

## S8 — both widths

| row | 1440 | 380 |
|---|---|---|
| reference disclosure mounted | true | true |
| closed in S5 | `aria-expanded=false` | `aria-expanded=false` |
| panel absent while closed | PASS | PASS |
| numeral on the uncounted tier (rule 89) | none | none |
| `data-read` / `data-write` (rule 129) | true / false | true / false |
| opens on click | `aria-expanded=true`, panel present | same |
| **nothing above it moves** | NEEDS YOU rows 3 → 3 | 3 → 3 |

## S6 declined — both widths, BY REPLAY

**Labelled as a replay, because it is one.** The audit call is answered at the network
boundary with a real-shaped 400 (`Work zone geometry refused: taper length below the MUTCD
floor for the posted speed.`). What this measures is the **frontend's** S6 behaviour against
a refusal that did not originate on this run. It does not measure the backend.

| row | 1440 | 380 |
|---|---|---|
| Generate gated under the declined audit (#180) | **disabled** | **disabled** |
| a refusal is on screen | true | true |
| NEEDS YOU beside the refusal (spec 31, rule 10) | **false** | **false** |

## S5 with none — NOT REACHED on prod

The fixture pin (E Bayaud, `39.71466,-104.94071`, way 39508704) yields three items on every
run at both widths, so the zero-item state never occurred. It is not faked here: a clean plan
is a property of a location, and asserting one by suppressing rows would measure the probe,
not the product.

It **is** covered, at the mount, by `GeneratorShell.needs-you.test.tsx` — *"S5 with none: a
clean plan mounts NO block at all — not an empty one"* — driving the real shell with a clean
audit. What remains unmeasured is only that state **on prod**, and closing it needs a pin
whose plan is genuinely clean, not a harness change.

## #288's acceptance, line by line

| # | line | verdict |
|---|---|---|
| 1 | Every S5/S6/S8 state at both widths | **PASS for S5-with-items, S6, S8**; S5-with-none not reached on prod (above) |
| 2 | One primary per state at both widths | **NOT MEASURED** — the primary derivation (rulings 182/183) is unbuilt; it belongs with the counts hero and cards |
| 3 | NEEDS YOU always expanded; ledger the only sorter | **PASS** — no caret, all rows on screen, both widths; `assignTiers` is the only classifier and this arc re-groups rather than re-decides |
| 4 | File count stated once, from the served bundle | **OPEN — stated ZERO times.** Finding 5; closes with the counts hero and cards |
| 5 | Reserved first row holds at the settle | **PASS** — 44px, both widths |
| 6 | Ribbon ≥ 4.5:1 mid-flight on the composited surface | **NOT MEASURED** — deferred with the ribbons |
| 7 | Left edges ±1; TARGETS 0 under 32/44; axe `target-size` 0 at 380 | **NOT MEASURED** — deferred |
| 8 | Zero `pageerror`; nav citation carries no date | **PASS** — 0 pageerror, 0 hydration-shaped, both widths |
| 9 | Nothing in §8 KEPT changes behaviour | **PASS by construction** |
| 10 | Ryan hand-check on a hard-refreshed tab | **OUTSTANDING — now worth doing:** the stack is served |

**Five of ten closed** (1 partial, 3, 5, 8, 9) against three at leg 2. Lines 2, 4, 6 and 7
all wait on the same unbuilt piece — the counts hero, the download cards and the primary
derivation.

## Rule 88 measured as a gap, then fixed

The leg recorded `.disc-name` computing to **16px** at both widths — inherited, where rule 88
specifies Inter 500 13px. That is the gap reported with `65bc7e8` rather than discovered
after it, and `abb8cc0` on this branch closes it: a declared exception with an owner in
`lib/design/type-exceptions.ts` (13px is not one of #283's nine role sizes), pinned by a
CSS-contract test. `65bc7e8` is the sha the leg measured, so the 16px reading stands as the
before.

## What the harness got wrong this time — four runs again

Kept for the same reason leg 2's list is kept.

1. **An out-of-range work length is not a backend refusal.** `StatusBar`'s precedence puts
   *invalid input* (the client bounds, #180) above *plan declined*, so the length never
   reached the backend — it blocked the CTA and produced a different state. S6 needs input
   the client accepts and the backend refuses, which prod will not produce on demand. Hence
   the replay.
2. **Routing the whole `/api/render/` tree refused the detection too**, leaving the CTA
   un-clickable. Narrowed to `/audit/`, which is what drives the declined verdict.
3. **The replay was never armed.** An earlier edit of the probe dropped the call to its own
   `beforeGenerate` hook — the option was passed, nothing invoked it. Two runs reported "S6
   unreachable" against a replay that never ran. The hook existed; nothing called it.
4. **A declined audit gates Generate, and that is the product working.** Once the replay
   armed, the click timed out — because #180's input gating disables Generate under a
   backend 400. S6 is reached *without* a generate, so the leg stopped clicking. Two runs
   read correct behaviour as a probe failure.

The pattern across both legs: **three of this leg's four dead ends were the harness, and one
was the product behaving correctly and being misread.** None was a defect in the arc.
