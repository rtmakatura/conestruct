# #289 fidelity — the after set, measured on prod

The fidelity pass (F1–F8, `9dc1a14`…`403b482`) shipped on 2026-09-23:
healthz `403b48228f98687f810fbd76ffa94a7ea9c5f7ef` == `origin/main`.  This
folder is the pass measured the same way the audit measured the page it
was fixing: the same rig, the same states, the same widths, the real
deployed `/sandbox`.

## The bundle was the shipped one

Before any capture, the served `/sandbox` (HTML plus its 14 `/_next/static`
CSS and JS assets) was checked for one marker per F-commit.  All nine were
present on the first poll:

| commit | marker in the served bundle |
|---|---|
| F1 `9dc1a14` | `font-variant-emoji:text` (rules 17–18's symbol block) |
| F2 `da089bf` | ScheduleField's `" WINDOWS"` (caps written, not CSS-cased) |
| F3 `eda5df3` | `--canvas-tint:#16232f` |
| F4 `4e86722` | `nav-citation` (rule 23's right slot) |
| F5 `5bcde15` | `--vd-ready-line:#2d6b4d` (rule 53) |
| F6 `6df51a1` | `--on-act:#0c1622` (rule 130) and rule 29's "licensed PE prior to field use" |
| F7 `19a5645` | `--panel-ground:#0f1c29` (rule 90) |
| F8 `403b482` | `.ny-right{display:contents}` (rule 167) |

## The delta count

`fidelity-audit/analyze.cjs` run over both captures — the same rule table,
the same classification:

| | before (prod carrying `a04bd73`, 2026-09-23T20:41:46Z) | after (prod `403b482`, 2026-09-24T04:09:47Z) |
|---|---|---|
| **deltas** | **165** | **18** |
| A · wrong token | 62 | 11 |
| B · inherited old-page style | 92 | 5 |
| C · missing rule | 11 | 2 |
| unmapped text nodes | 25 | 24 |

Every state settled at both widths in both runs (`capture.json` →
`settled: true` ×10), and no state scrolls horizontally (`scrollW` equals
the viewport at 1440 and 380).

**Two before captures, one count.**  The audit's own table
(`fidelity-audit.md`) is its 2026-09-23T20:18:12Z capture of prod at
`193faab` (`fidelity-audit/capture.json`).  `a04bd73` (the strip's
"AWAITING KIND OF WORK") shipped after it and is the commit the pass was
built on, so the rig was run again at 2026-09-23T20:41:46Z; that capture
is `before/capture.json`, its table `before/deltas.md`, and it is what
the before screenshots show.  Its build is read off the data: it carries
`a04bd73`'s "AWAITING KIND OF WORK" six times; the 20:18 capture carries
it none.  Both count 165 with the same classification (62 / 92 / 11,
25 unmapped).  The after capture is `after/capture.json`, its table
`after/deltas.md`.

## The pairs

`before/` is the 20:41:46Z capture (prod carrying `a04bd73`); `after/` is
prod at `403b482`.  Same pin (E Colfax mid-block), same route, full-page.

| state | 1440 | 380 |
|---|---|---|
| S1 — nothing chosen | [before](before/w1440-S1.png) · [after](after/w1440-S1.png) | [before](before/w380-S1.png) · [after](after/w380-S1.png) |
| S2 — road confirmed, kind unchosen | [before](before/w1440-S2.png) · [after](after/w1440-S2.png) | [before](before/w380-S2.png) · [after](after/w380-S2.png) |
| S3 — WHAT open | [before](before/w1440-S3.png) · [after](after/w1440-S3.png) | [before](before/w380-S3.png) · [after](after/w380-S3.png) |
| S5 — generated | [before](before/w1440-S5.png) · [after](after/w1440-S5.png) | [before](before/w380-S5.png) · [after](after/w380-S5.png) |
| S7 — revising, 7c | [before](before/w1440-S7.png) · [after](after/w1440-S7.png) | [before](before/w380-S7.png) · [after](after/w380-S7.png) |

## The 18, triaged

The rig's rule table carries ONE spec value per element; several of the 18
are rules that vary that value by state or by width, which the table does
not model.  Each is named with the rule that decides it.

**Correct by rule — the table's single value is the wrong comparison (12):**

| # | element | why the measured value is the rule's |
|---|---|---|
| 2, 3 | S7 deferred phrase @380, 9.5 px / 14.25 | rule 95.15: "the deferred phrase drops to 9.5 px" |
| 4 | S7 band head, `rgba(52,169,232,.3)` hairline | rule 62: "(revision variant: rgba(52,169,232,.3))" |
| 7 | deferred panel row, 130 px now-track | rule 92: "widens to 130 px where a row carries the deferred phrase" |
| 8 | S7's field grid, one track | rule 121: the field column is 240 px, one field |
| 9 | WHERE's Confirm, `#6e7c8e` in S2 | rule 130 disabled — S2 has no kind chosen, so the primary is disabled |
| 11 | NEEDS YOU's "on" action in S5, `#c8d1dd` | rule 133 disabled: it is "Apply 0 corrections", disabled — measured at opacity 0.45 in `#c8d1dd`, which is "opacity .45" on the control's own ink |
| 10 | APPLY at 13.5 px | rule 94: "APPLY — RE-GENERATE (primary, 200 px wide, 44 px high, 13.5 px)" |
| 12 | the suggestion's name, `#c8d1dd` | rule 6: "Emphasis inside it is #c8d1dd at the same weight" |
| 13 | `main` bottom padding 30 | rule 24: "when the column is the last thing on the page, 30 px bottom" |
| 15 | Generate, `#6e7c8e` in S1/S2 | rule 130 disabled — nothing chosen yet |
| 17 | panel was / now @380, 11.5 px | rule 95.15: "at 11.5 px" |

**Ruled elsewhere (2):**

| # | element | ruling |
|---|---|---|
| 14 | the download row renders at 380 | rule 168 — Phase 4 (ruled Q7) |
| 16 | the hero geometry cell renders at 380 | rule 169 — Phase 4 (ruled Q7) |

**A judgement, stated (1):**

| # | element | the reading |
|---|---|---|
| 18 | S7's body @380, one 318 px track | rule 121 gives 240 px / 1fr and no 380 variant; at 380 that leaves the panel 52 px, below rule 95.15's own 1fr / 58 / 16 / 96 rows.  The two tracks stack — rule 173's "same stack, narrower". |

**Misses — fixed in the follow-up commit on this branch (3):**

| # | element | rule | fix |
|---|---|---|---|
| 1 | the scan time's dotted underline (`.sc-time`) | rule 6, ruled Q1 "dotted underline dropped" | `text-decoration: none` |
| 5 | NEEDS YOU items @380, column-gap 12 | rule 74's 14 px; rule 167 changes the tracks, not the gap — F8 set 12 | 14 |
| 6 | the Apply row, padding 14 16 | rule 78: "padding 13 px 16 px" | 13 16 |

## The audit-row annotation gutter, re-measured

`check-list-grid.test.ts` pinned the gutter at **197 px** — the natural
width of the strip dropdown's "OSM GROUND-TRUTH (SOFT CHECK)" (s2-arc26,
C6).  F5 removed that dropdown (ruled Q4), so the pin's sizing case no
longer renders anywhere.  `measure-gutter.cjs` drove prod to S5, opened
every disclosure, and measured each rendered `.check-list-src` as a
single line in its own computed style (`gutter.json`, 14 annotations,
2026-09-24T04:12Z):

| annotation | natural | rendered in the 197 px track |
|---|---|---|
| CDOT S-630-1 (July 2026) Sheet 2, General Note 22 | **333.2 px** | 197 (wraps) |
| CDOT S-630-1 (July 2026) Sheet 23, Case 38 Note 1 | 333.2 px | 197 (wraps) |
| CDOT S-630-1 (July 2026) Sheet 2, General Note 4 / 3 / 8 | 326.41 px | 197 (wraps) |
| MUTCD § 6N.12 p. 848 | 136 px | 136 |
| OPENSTREETMAP | 88.41 px | 88.41 |

JetBrains Mono 10 px, letter-spacing 0.8 px.  The s2-arc26 record already
noted "the section-03 S-630-1 cites still wrap inside the gutter"; with
the soft-check row gone they are the longest annotations on the page.
Following #225's method — the gutter is the measurement — the follow-up
sets it to **334 px** (333.2, next whole pixel).

## Reproduce

```
AUDIT_OUT=<dir> node fidelity-audit/probe.cjs         # AUDIT_SITE overrides the prod URL
AUDIT_IN=<dir>  node fidelity-audit/analyze.cjs       # reads <dir>/capture.json, writes <dir>/deltas.md
AUDIT_OUT=<dir> node fidelity-after/measure-gutter.cjs
```
