# 📋 Checkpoint: #315, a stale left side empties the side control (R124, option (a))

Investigated on `469ebfb` (the cleanup branch's tip; `src/` there is prod `60bbe09`'s), 2026-10-09.
No code written. Rulings: `rulings.md`. Probe: `probes/stale_left_probe.py` →
`probes/stale_left_probe.txt` (TestClient, Overpass and the Mapbox fetch stubbed, no network).

## Plain English

**What's wrong.** The side control's choices come from the backend's corridor-geometry read. That
read sends the scenario with the stored left side, and the backend's pin-model check refuses it
(400) before any choice is built. The band's aerial read is refused the same way. So the operator
sees "the road's sides are unavailable", no curb to pick, and "The aerial didn't load."

**The fix (option a).** The two **read** endpoints, and only those, treat a left side the backend
won't build as no side at all. That is a state the pin-model check already accepts ("side absent is
NOT refused", `render_api.py:250`).
- The geometry read answers 200 with the curbs it builds, plus a new `side_refused` entry that
  says why the stored side doesn't count.
- The side control renders those curbs and the backend's one line.
- The aerial shows the pin picture, as before any side is chosen.

**What stays the same:**
- Every deliverable endpoint (audit, PDF, XLSX, crew sheet, quote, breakdowns, bundle) still
  refuses with R120's 400. The plan can't be generated with the stale side.
- The rail's NEEDS YOU pointer still sends the operator to the side control.

**Measured today vs proposed** (`probes/stale_left_probe.txt`, Broadway SB pin):

| Case | Geometry today | Geometry, side treated as unset | Aerial, pin stage |
|---|---|---|---|
| left built (Broadway shoulder) | 200 `laid_out`, West + East | (no change: the side stands) | 200 PNG |
| kind changed to flagger (the prod repro) | **400** R120 | 200 `side_not_confirmed`, West | 400 today → 200 PNG |
| answered divided | **400** | 200 `side_not_confirmed`, West | 400 → 200 PNG |
| undecided | **400** | 200 `side_not_confirmed`, West | 400 → 200 PNG |
| tagged two-way | **400** | 200 `side_not_confirmed`, West (southbound) + East (northbound), both right sides | 400 → 200 PNG |

The aerial's "work" stage answers 409 `side_not_confirmed` in every refused case: the honest
pre-side answer, which the band already words.

---

## 1. The exact response shape

### `POST /render/corridor-geometry`

**Unchanged** for every scenario whose side isn't a refused left: byte for byte, no new key. #315's
acceptance asks for right-side and built-left responses to be byte-identical, so the new key appears
**only** when there is a refusal.

**A stored `meta.work.side == "left"` where `schemas.left_side_built` is false:**

```json
{
  "status": "side_not_confirmed",
  "pin_model": "work_start",
  "pin": [39.7337, -104.98753],
  "travel_bearing_deg": null,
  "work": null,
  "approaches": [],
  "coverage_ft": null,
  "coverage_start_ft": null,
  "message": null,
  "side_options": [
    {"work": {"side": "right", "travel": "with_geometry"},
     "label": "West side · southbound traffic", "built": true}
  ],
  "side_refused": {
    "side": "left",
    "cause": "not_shoulder",
    "message": "Left-side work is laid out for shoulder work only. Pick a right-side curb, or switch back to Shoulder work."
  }
}
```

- **Every key but `side_refused`** is what the same scenario answers today with `meta.work`
  removed, verified by the probe.
- **`side_refused.side`** is always `"left"` (see median, below).
- **`side_refused.cause`** is one of six values, checked in this order. They mirror
  `left_side_built`'s conjuncts (`schemas.py:1186-1196`), so exactly one applies:

  | `cause` | When | Message (Q1 (b), draft, unslop-checked) |
  |---|---|---|
  | `not_shoulder` | `kind` isn't `shoulder` | "Left-side work is laid out for shoulder work only. Pick a right-side curb, or switch back to Shoulder work." |
  | `no_road` | no confirmed road (`meta.centerline` under 2 points) | "Left-side shoulder work needs a confirmed road. Pick the road on the map, or pick a right-side curb." |
  | `two_way` | `roadDirection.oneway` isn't a one-way tag (covers R119 Q5's operator-answered "one-way" on an untagged road) | "Left-side shoulder work needs a one-way street, and the map shows this road as two-way. Pick a right-side curb." |
  | `divided` | carriageway verdict `divided` (answered, or a same-name twin found) | "Left-side shoulder work needs a one-way street, and this road reads as divided. Pick a right-side curb, or change Carriageway." |
  | `undecided` | carriageway verdict `undecided` | "Left-side shoulder work needs a one-way street, and this road's carriageway is still open. Answer Carriageway, or pick a right-side curb." |
  | `highway` | verdict `not_applicable` with a one-way tag (a one-way road outside the street classes, e.g. a ramp) | "Left-side shoulder work is laid out on one-way streets, and this road is a highway. Pick a right-side curb." |

- **`side_refused.message`** is the line the side control renders, verbatim. The frontend composes
  nothing (Rule 3; one voice, P2).
- **Median is unchanged:** a stored `median` still answers 400 on every endpoint, including the
  reads. The UI never offers it, so no operator can hold a stale one, and #315 is about left.

### `POST /render/corridor-map`

**No shape change.** The same rule applies, so a refused left reads as no side:
- `stage: "pin"` → 200 PNG (the pin);
- `"work"` / `"laid_out"` → the existing 409 `{"status": "side_not_confirmed", "message": null}`.

The band already asks for `"pin"` when the geometry status is `side_not_confirmed`
(`lib/corridor-aerial.ts:26`), so the aerial shows the pin and the pre-side sentence with no
frontend change.

### Every other endpoint

**Unchanged:** `_ensure_pin_model_complete` still refuses a stale left with R120's 400 at
`/render/audit`, `/pdf`, `/xlsx`, `/markdown`, `/crew-pdf`, `/quote`, `/device-breakdown`,
`/quote-breakdown`, `/replication-snapshot` and the site's bundle.

### Where it lives (the build)

- **One helper**, `_side_refusal(scenario) -> dict | None`, beside `_ensure_pin_model_complete` in
  `render_api.py`. It names the cause from the same conjuncts `left_side_built` reads.
- **One wrapper**, used by the two reads only: it returns the scenario with `meta.work` dropped,
  plus the refusal, when the helper finds one. Both reads then run their existing code on that
  scenario.
- `_ensure_pin_model_complete` itself does not change.
- **A test pins the agreement:** `_side_refusal(s) is None` exactly when `s` is right-side or
  `left_side_built(s)` holds, over the parametrised stale shapes and the built ones.

## 2. The frontend

- **`lib/corridor-geometry.ts`:** a `SideRefusal` type and an optional
  `side_refused?: SideRefusal | null` on `CorridorGeometry`. Optional, so no test fixture typed as
  `CorridorGeometry` has to change.
- **`components/bands/WhereBand.tsx`:**
  - `staleLeft` becomes `geometry.side_refused` (present) instead of a local predicate.
  - The line renders `side_refused.message` verbatim, under `data-testid="side-control-stale"`.
  - The hard-coded R120 string at `:295-296` goes; the copy now lives in the backend.
  - The P9 symbol: the line gains a leading "⚠" like the band's other needs-you lines (Q3).
- **Unchanged:**
  - `BandAerial` / `corridor-aerial.ts`: stage selection already reads the status.
  - The rail's `work_side` row (`lib/scenarios/auto-apply.ts:207-217`): a pointer to the control,
    not a second statement of the reason.
  - The picker modal: its overlay reads the same geometry and draws the pin and the sentence.

---

## 3. Questions

**Q1. The message: (a) one line for every cause, or (b) a line per cause?** Recommend **(b)**.
- **(a)** Move R120's picker line to the backend unchanged: "Left-side shoulder work needs a
  one-way street. Pick a right-side curb, or plan shoulder work on a one-way street." It can't say
  why, and for a kind change "plan shoulder work on a one-way street" is the wrong fix.
- **(b)** The six lines in §1. R120's own example named the cause ("This road is set as divided,
  so pick a right-side curb or change Carriageway"). The frontend couldn't, because it can't tell
  the causes apart. The backend can.
- `cause` stays on the wire under either answer, so tests assert the reason without matching copy.

**Q2. The aerial: show the pin picture (recommended) or keep refusing?**
- #315's option (a) text says "The aerial stays refused until a side is chosen".
- Read literally, the band keeps "The aerial didn't load. Edit on map shows the corridor.", which
  is the false failure (P8) this issue exists to remove.
- Recommend: the same rule on `/render/corridor-map`, so the band shows exactly what it shows
  before any side is chosen (the pin and "Say which side is occupied to lay out the work", #290's
  pre-side ruling). Nothing laid out is drawn until a side is chosen, which is what the issue's
  sentence meant.

**Q3. A "⚠" on the line?** Recommend **yes** (P9: every state has a symbol and a word). Today's
line has none; the band's other needs-you lines lead with ⚠.

---

## 4. Rule 5: predicted churn

**Deliberate behaviour changes:**
1. **Geometry read:** for a stored left that `left_side_built` refuses, `/render/corridor-geometry`
   answers 200 `side_not_confirmed` with the built options and `side_refused`, instead of 400
   `pin_model_input`.
2. **Aerial read:** `/render/corridor-map` answers a refused left as no side: PNG at `pin`, 409
   `side_not_confirmed` at `work` / `laid_out`, instead of 400.
3. **Side control:** shows the built curbs and the backend's line, instead of "the road's sides
   are unavailable". The band's aerial shows the pin, instead of "The aerial didn't load." The
   modal's overlay shows the pin and the sentence, instead of its refused state.
4. **Copy:** the line's text per Q1, plus Q3's "⚠".

**Not changing, proved at the build:**
- Every geometry and aerial response for a right side, an unset side, a built left or a median:
  byte-identical (the agreement test's right and built-left legs, plus the existing suites).
- Every deliverable endpoint's answer to a stale left: the same 400 and R120 text.
- No plan, audit, PDF, XLSX or crew sheet changes. No pricing.

**Backend tests:**
- `tests/test_left_side_oneway.py::test_a_left_side_the_gate_refuses_names_the_fix` (4 cases)
  posts to `/render/corridor-geometry` and expects 400. **Rewritten:** the gate cases move to
  `/render/audit`, where the 400 stays, with the same three substring assertions.
- New geometry tests assert, for the same four shapes plus `not_shoulder`, `no_road` and `highway`:
  200, `side_not_confirmed`, the built options, `side_refused.cause`.
- `test_median_is_still_named_and_refused` shares the `_refusal` helper. It stays on
  corridor-geometry: median still refuses there.
- **New tests:**
  - `_side_refusal` agreement with `left_side_built` (parametrised);
  - corridor-map `pin` → 200 and `work` → 409 for a refused left (`tests/test_corridor_map.py`
    already stubs the fetch);
  - the deliverable gate unchanged (audit 400);
  - the right and built-left geometry responses carry no `side_refused` key.
- **Unchanged:** `tests/test_corridor_geometry.py`, `test_corridor_map.py`'s existing cases,
  `test_page_two_laid_out.py`, `test_corridor_agreement.py`. None sends a stale left. No full-dict
  or key-set equality on the geometry response exists (grep), so no baseline moves.

**Frontend tests:**
- `WhereBand.left-side.test.tsx` "a stored left side … says why": its fetch mock answers options
  whatever the request says. **Rewritten:** the mock answers by the request, the way the backend
  will (a left on the flagger kind → the right curb plus `side_refused`). The test asserts the
  backend's message renders verbatim (with ⚠) and that picking West writes the right side. That
  meets #315's acceptance "no options-always mock".
- **New:** a geometry answer without `side_refused` renders no stale line, even with a stored left
  (the predicate is the backend's now).
- **Unchanged:** `WhereBand.side-control` (its fixtures carry no `side_refused`; optional field),
  `BandAerial.test.tsx`, `corridor-aerial.test.ts`, every `GeneratorShell.*` that mocks the
  geometry read.

**Lane:** backend + frontend, `frontend-only: no`. Prod check after the ship: the r120-prod
`picker.cjs` repro re-run against prod. Expected: West offered, the line, the aerial's pin
picture.

## 5. Principles, for the changed surfaces

The surfaces are the WHERE band's side control and aerial, and the modal's overlay: FLOW step 1
(Where), the rep and the estimator.

| P | Verdict | Note |
|---|---|---|
| P1 | honoured | The line renders in the same response as the options, under the chips (`WhereBand.tsx:293-298`); nothing above it moves. |
| P2 | honoured | One voice: the backend's `message`; the rail points to it (`auto-apply.ts:207-217`). |
| P3 | **fixes a deviation** | The next action (a right-side curb) is on screen again. |
| P4 | honoured | The line reuses `tr-prov mt-1` under the chips; no new edge. |
| P5 | honoured | `tr-prov`, as today. |
| P6 | honoured | The line wraps in the column at 390 (measured at the build). |
| P7 | n/a | |
| P8 | **fixes a deviation** | "the road's sides are unavailable" and "The aerial didn't load." were false wait/failure states. |
| P9 | deviates today; fixed by Q3 | The line has no symbol at `:294-297`. |
| P10 | honoured | The chips are unchanged (44 px at ≤480). |
| P11 | honoured | The aerial and overlay use the existing pre-side state. |
| P12 | honoured | |
| P13 | honoured | |
| P14 | honoured | The pre-side picture is the shape of the answer. |
| P15 | honoured | Nothing reset (R119 Q4); the stored side stays until the operator picks. |
| P16 | honoured | No skeleton; the prior picture rule is unchanged. |
| P17 | honoured | FLOW step 1, the rep and the estimator. |
| P18 | honoured | The step asks one question: which side. |
| P19 | n/a | |
| P20 | honoured | |
| P21 | honoured | |
| P22 | honoured | Revision: a kind change after a side is the revision path this fixes. |

## 6. What I need from you

Q1–Q3. With (b) / pin picture / yes, I build on this branch: backend and frontend in one commit
with their tests, the verifier, the push, then a report with the ship line. Ship order per R124:
after `issue-301-modal-cleanup`.
