# 📋 #311 checkpoint (R113): the work-side sidewalk pair only, on every road

Branch `issue-311-sidewalk-barricades`, off main `d6d2a49`. No code yet. Line refs are at `d6d2a49`. R113 rules option (a), so this checkpoint is the churn and the snapshots, not a design question.

## 1. The cause

`src/rules/site_adjustments.py:155-191`, `_adjust_pedestrian_facility`, runs for every scenario kind that has "Pedestrian sidewalks present" checked (`render_api.py:908`). The R94 gate is line 170:

```python
sides = (offset,) if getattr(params, "one_way_street", False) else (offset, -offset)
```

On two-way and divided roads that gives 6 devices: Type III barricades at (upstream, ±offset) and (downstream, ±offset), plus R9-9s at (upstream, +offset) and (downstream, +offset). `devices_added = len(barricades) + len(signs)` (:188). The `-offset` pair dates from `aa40c4f`. Its only basis is `_ped_offset`'s docstring (:37), "mirrored on each side… Matches the … formula in the spec", with no MUTCD text. The audit chip cites "MUTCD §6C.02: pedestrian considerations in work zones" (:189). That section covers pedestrian accommodation generally; nothing in the repo puts a closure on the far sidewalk.

Everything else in the plan puts the closure at the work side: both R9-9s, the page-1 hatch (`plan_sheet.py:1220-1221`, side `+1` only), and the audit's "sidewalk signs, posted at the sidewalk" (`audit.py:196`). The flag carries no side.

## 2. The change (R113 option (a), R94's reasoning)

- `site_adjustments.py:170` becomes `sides = (offset,)` on every road. Nothing else in the function changes: the action string and `devices_added` are computed from the lists, so they follow.
- The docstrings say why: `_ped_offset` (:34-42, "mirrored on each side") and `_adjust_pedestrian_facility` (:159-165, which today scopes the reasoning to one-way streets).
- `conestruct/site/components/AuditTrail.tsx:68-69` is a comment only, and it goes stale: "pedestrian_facility adds 2 Type III barricades on a one-way street and 4 elsewhere (#308 R94)". It's rewritten. No logic changes.
- The R94 test `test_a_divided_road_keeps_the_mirrored_pair` (`tests/test_r94_one_way_page1.py:98-105`) pinned the out-of-scope divided case. It's rewritten as its inverse: divided gets the work-side pair, all offsets > 0, `devices_added` 4, "Added 2…". A two-way twin is added beside it.

## 3. Before / after (measured)

`probes/probe311.py` uses TestClient `_placements_for` plus `/render/device-breakdown`, with Overpass stubbed.
- **Before** (`d6d2a49`): `probes/probe311-d6d2a49.txt`.
- **Predicted after:** the same probe run on a scratch copy of `d6d2a49` with only line 170 changed, saved as `probes/probe311-prediction-scratch-patch.txt`. The build re-runs it on the real commit.

| Road | Before | After |
|---|---|---|
| **Colorado Blvd** (39.70900, −104.94070), divided by verdict (14.8 m same-name twin), 3 × 11 ft, 35 mph, shoulder work | 40 devices; Type III at (0, ±45), (1000, ±45); breakdown qty 4; `devices_added` 6 | **38**; Type III at (0, +45), (1000, +45); qty **2**; **4** |
| **Lafayette St** (39.74362, −104.97070), two-way control (OSM way 581254411, `oneway=no`), 1 lane each way × 11 ft, 25 mph, shoulder work | 40; Type III at ±21; qty 4; 6 | **38**; +21 only; qty **2**; **4** |
| **N Broadway SB**, one-way (R94 already) | 35; Type III at +52; qty 2; 4 | **unchanged** |

The audit action reads "Added 4 Type III barricades (sidewalk closure points) and 2 R9-9…" today and "Added 2 …" after. On Lafayette, `−21` ft is 2 ft past the opposing shoulder, where no sidewalk band is drawn (`plan_sheet.py:1208`: the far band is drawn only when divided). So today's far pair sits just off the road on page 1, the R94 failure on a two-way road.

The build commits page-1 renders before and after for Colorado and Lafayette (the `issue-308-…/probes/r94_page1_render.py` method: TestClient `/render/pdf`, page 1 at 100 dpi). Each one comes with a text file listing every Type III / R9-9 offset, its page y, and whether it sits on a drawn band.

## 4. Rule 5 churn: every pinned value that changes

The patched backend suite on the scratch copy had 6 failures caused by the change, all green at `d6d2a49`. (34 more failed on files the scratch copy lacked; those fail the same way without the patch.) The build re-runs the full suite in the worktree.

| File | Pinned now | After |
|---|---|---|
| `tests/test_verification.py:642-665` `test_site_adjustments_pedestrian_facility_adds_six` | `len(adjusted) == 37`, Δ barricades 4, `devices_added` 6 | 35, 2, 4; the test name becomes `…_adds_four` |
| `tests/test_verification.py:668-697` `test_site_adjustments_all_flags_add_ten` (docstring :678 "6 (4 barricades + 2 R9-9)") | `len(adjusted) == 41` | 39; docstring "4 (2 barricades + 2 R9-9)"; name `…_add_eight` |
| `tests/test_night_adjustments.py:230` | `len(baseline) + 6` | `+ 4` |
| `tests/test_crew_narrative.py:529` | `"4 Type III barricades" in markdown` | `"2 Type III barricades"` |
| `tests/test_r94_one_way_page1.py:98-105` | divided: 4 mirrored offsets, 6, "Added 4" | rewritten as the inverse (§2) |
| **Snapshot** `tests/snapshots/corpus/grid_site_pedestrian_facility.json:126, 128` (divided Case 11, 55 mph) | `"action": "Added 4 Type III barricades…"`, `"devices_added": 6` | `"Added 2 Type III barricades…"`, `4`. These are the only two fields that differ in the projection (the probe diffs snapshot against live). It's the one snapshot that changes. |

**Stay green but carry the old count (recorded or hand-built data; nothing re-derives them).** This is Q1.
- Recorded tiering fixtures with `devices_added` 6 and breakdown "Type III Barricade" qty 4: `tests/fixtures/tiering/adv-ni-denver.json`, `control-lakewood.json`, `scanned-asserted.json`, `scanned-lakewood.json`, `scanned-not-checked.json`.
- `conestruct/site/components/__fixtures__/audit-shoulder-full.json` (`site_adjustments[2].devices_added` 6).
- Hand-built frontend inputs: `lib/tiering.test.ts:203` (`devices_added: 6`), `lib/needs-you-conditions.test.ts:35` ("6 devices added").

**No change:**
- No frontend logic reads the count; it reads `devices_added > 0`, which stays true.
- No XLSX, quote or PDF test pins the Type III quantity.
- The `pdf_worst_case` fixtures are inputs; their PDFs lose 2 glyphs, and nothing pins that.
- The crew sheet's "Sidewalk closure points are barricaded (MUTCD §6C.02)." (`base.md.j2:136`) names no count.
- One-way plans (R94) don't change.

**Surfaces that change for every two-way and divided sidewalk plan, all kinds:**
- placements: −2;
- device summary, XLSX and quote: Type III −2;
- audit `site_adjustments` action and `devices_added`;
- crew sheet Site-Specific Notes (the action sentence);
- the NeedsYou/TieredReference row, which prints the backend sentence;
- page 1: the far pair is gone.

**Interaction with Part 2 (#309):** once this ships, the near-intersection kind's one-way plans pick up no extra sidewalk churn when #309 sets `one_way_street` on them. That's why the ship order puts Part 3 first.

## 5. Question

**Q1. The recorded and hand-built fixtures that carry 6 / qty 4.** I recommend **leaving them as recorded**. They're dated recordings of what the backend said, used as frontend inputs that read only `devices_added > 0`. Rewriting them would forge a recording nobody made. The build lists them in its README as recorded before R113. The alternative is re-recording the five tiering fixtures from the patched backend. That's real churn in five files and buys no extra coverage.

## 6. Principles

No mounted surface changes shape. The NeedsYou/TieredReference row prints a different backend sentence ("Added 2…"); its layout, row count and controls stay the same. P2 (one voice per fact): the device list, the hatch, the R9-9s and the audit sentence finally agree on one closed sidewalk. P8/P14 (honesty): the far-pair barricades no longer claim a closure nothing else in the plan states.

## 7. Out of scope: the arrows in the sidewalk band

Drafted as its own issue in `issue-draft-arrows.md`, for the chat to repost.
