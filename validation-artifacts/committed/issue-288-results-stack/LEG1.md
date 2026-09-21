# issue-288 leg 1 — what is live at `e55b23a`

**Run:** 2026-09-21. **Base:** `https://www.conestruct.com`. **Sha-gated both ends** —
`healthz` = `e55b23a351077a66172ce52046250154a4c9cd37` = `origin/main`, checked before the
first leg and again after the last. **Output:** written to `%TEMP%\i288-leg1\out`, outside
the repo, and copied here afterwards. **Probe:** `i288-leg1-probe.js`. **Artifacts:**
`outProd-e55b23a/` — `log.txt`, `rows.json`, `taps-1440.json`, `taps-380.json`, and a
full-page screenshot per width.

**27 rows · 24 PASS/INFO · 3 FAIL.** The three FAILs are the finding, not a defect in the
shipped change. They are the measured proof that **the results stack is not in this build.**

## The headline

What shipped at `e55b23a` was the arc's two early commits — the `§8.32` date removal and the
error-tap harness. The stack, NEEDS YOU, the disclosures and the S8 rework **were never
built** (they are blocked on the missing checkpoint; see `rulings.md`). This leg therefore
measured what is actually there.

| polled for | expected if the stack had shipped | **measured** |
|---|---|---|
| `ns-strip` in the served bundle | absent (§8.29 drops the strip) | **PRESENT** |
| `results-head-slot` | absent | **PRESENT** |
| `NEXT — 3 STEPS` literal | absent | **PRESENT** |
| `needs-you` | present | absent |
| `stack-container` | present | absent |
| `verdict-strip` | present | absent |
| `counts-hero` | present | absent |
| `disclosure-row` | present | absent |

Served build: 28,909 B of HTML, 11 chunks (1,102,760 B), 3 stylesheets (142,919 B) — all
searched, not just the document.

## What the shipped change proves out — PASS

| row | measure |
|---|---|
| `bundle.issued-gone` | `ISSUED` absent from the served `/sandbox` HTML |
| `bundle.strip-renders` | `LOCATION` **and** `AS NOTED` present — the strip rendered, so the absence above is a removal and not a blank page |
| `bundle.no-iso-date` | no `20\d\d-\d\d-\d\d` anywhere in the served document |
| `1440.pageerror-zero` / `380.pageerror-zero` | **0** `pageerror`, **0** console errors, at both widths |
| `1440.hydration-zero` / `380.hydration-zero` | **0** hydration-shaped messages |
| `1440.requests-ok` / `380.requests-ok` | 0 failed requests |
| `1440.dom.issued-absent` / `380.dom.issued-absent` | `ISSUED` absent from the settled page's text, not just the HTML |
| `1440.dom.no-date-rendered` / `380.dom.no-date-rendered` | no ISO date rendered anywhere on the settled page |

The tap ordering held: the early tap attached before `goto`, the late tap after
`networkidle`. Both read **0**, recorded as INFO rather than PASS — with a clean page the two
counts cannot distinguish a correct listener from a mis-ordered one, and claiming otherwise
would be the exact assertion `err-tap.js` exists to prevent.

## #288's acceptance list, line by line

| # | acceptance line | verdict |
|---|---|---|
| 1 | Every S5/S6/S8 state measured on prod at 1440×1000 and 380×800 | **NOT MEASURABLE** — those states do not exist in this build |
| 2 | One primary per state at both widths | **NOT MEASURABLE** — no primary is derived yet (clause c unbuilt) |
| 3 | NEEDS YOU always expanded; five-tier ledger the only sorter | **NOT MEASURABLE** — NEEDS YOU unbuilt |
| 4 | File count stated once, from the served bundle; counts are wire digits | **NOT MEASURABLE** — counts hero unbuilt |
| 5 | Reserved first row holds at the settle, counted | **NOT MEASURABLE** — the reserved row is the stack's |
| 6 | Ribbon ≥ 4.5:1 measured mid-flight on the composited surface | **NOT MEASURED** — ribbons carry over unchanged; no stack to measure them in |
| 7 | Heading/row left edges ±1; TARGETS 0 under 32/44 px; axe `target-size` 0 at 380 | **NOT MEASURED** — deferred to the stack's leg |
| 8 | **Zero `pageerror` on the settled page; nav citation carries no date** | **PASS — both widths.** 0 pageerror, 0 hydration-shaped, no ISO date on the page or in the document |
| 9 | Nothing in Part 1 §8 KEPT changes behaviour (§8.5, §8.7, §8.12) | **PASS by construction** — the only product change was the ISSUED field; §8.5/§8.7/§8.12 surfaces were not touched (`git diff main...` on the arc: 2 product files) |
| 10 | Ryan hand-check on a hard-refreshed tab | **OUTSTANDING — yours** |

**One of ten acceptance lines is closed.** Line 9 is closed by construction and line 8 by
measurement; lines 1–7 need the stack, and line 10 needs you.

## The states that were asked for and could not be taken

S5 with three NEEDS YOU items · S5 with zero (the `↓ All (.zip)` primary) · S6 declined ·
S8 with the reference open. **None of these four surfaces exists at `e55b23a`.** Driving a
generate against this build would measure the *old* results head — a legitimate pre-change
baseline, but not the leg that was asked for, and recording it under those names would put
the wrong label on real numbers. It was not run.

When the stack lands, this probe's gates and taps are reusable as they stand; only the leg
bodies change.
