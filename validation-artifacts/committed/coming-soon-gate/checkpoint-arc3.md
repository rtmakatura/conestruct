# Arc 3 checkpoint — the full page, founders note, 404

Branch `coming-soon-lower` off `origin/main` @ `fe81491` (Arc 2 live). First commit `752d683`: R12–R20 appended word for word; `design/FullPage.dc.html` (sha256 `0c8d9429…`) and `design/NotFound.dc.html` (`64ad2ada…`) committed, byte-identical to main's untracked copies, which are now deleted from main's checkout.

**Why this stops:** one sentence of R17's verbatim note is contradicted by the product code (the prompt's stop rule: "a claim on the page can't be verified"). Everything else checked out; the build is ready to go on the answer to Q1.

## 1. The blocking item

### Q1 — R17 paragraph 3: "…shows the source for every number…"
The artboard: *"It applies the manual to your road, shows the source for every number, and leaves the calls that need experience to the people who have it."*

**FALSE as written today:** the same class of claim Arc 2 narrowed (checkpoint-arc2.md §3; A2-Q6 took "every dimension cited" → "every taper, buffer and spacing cited"). Re-checked on `main` today:
- Lane width: hardcoded `laneWidthFt: 12` (`conestruct/site/lib/road-detection/classify.ts:302`), then labelled "OSM detection" (`components/bands/HandoffNotes.tsx:106`). It is the taper's `W` on lane closures (`src/api/audit.py:231`).
- Shoulder width: 8/10 ft by kind, uncited (`src/api/schemas.py:1068-1086`).
- Device daily rates: built in, `# TODO: replace placeholder rates` (`src/export/quote_generator.py:54-55`). They drive the quote's numbers.
- A2-I's issue draft covers the first two. It is not posted yet as far as this branch knows.

**Proposed (A2-Q6's wording, one voice with the hero and 02):** *"It applies the manual to your road, shows the source for every taper, buffer and spacing, and leaves the calls that need experience to the people who have it."*
- Alt (b): keep the sentence verbatim and hold Arc 3's ship until A2-I's fix lands (then lane and shoulder widths say "assumed"; the rates stay built in, so "every number" still overstates).
- Alt (c): "…shows its sources…" (true, less specific).

**Recommendation: the proposed wording.** It is the only one of the three that is true today and matches what the page already says twice.

## 2. Defaults I'll build unless you say otherwise (not blocking)

- **Q2 — /404 public (R19).** The gate sends every unknown path to `/` for an anonymous visitor (`middleware.ts:56-66`, R1.2 / C-Q1), so no anonymous visitor would ever see a 404 at `/xyz`. *Default:* add `/404` to `PUBLIC_EXACT` (`lib/gate.ts:16`). That makes the page public at `/404`, and it answers any unknown path for allowlisted or bypass requests and for paths the matcher skips (e.g. `/missing.png`). Gated paths still go to `/` (tested in the route table). This is a one-path change to R1.2's public set.
- **Q3 — marker under reduced motion (R14).** The artboard hides the marker under `reduce`: it derives the marker from the eased road front, which is pinned at "fully drawn". *Default:* under `reduce`, the marker still shows and updates per stretch from the scroll position, with no transition. It is a location readout, not motion.
- **Q4 — map wording (the verify brief: "keep it labelled a drawing").** *Default:* the map's accessible name is "Drawing of Colorado, not a road map: mountains west of the Front Range, I-25 north–south and I-70 east–west crossing at Denver, which is pinned." The visible "COLORADO" tag stays.
- **Heads-up, no action proposed:** 03's live heading "Every dimension has a source" (ruled under A2-Q6) has the same weakness as Q1. Changing it is your call; Arc 3 keeps it as ruled.

## 3. Verified (Rule 10/12) — nothing to rule

| Claim | Source | Verdict |
|---|---|---|
| "The first national manual on traffic control devices came out in 1935." | FHWA, *The Evolution of MUTCD* (mutcd.fhwa.dot.gov/kno-history.htm, "Updated December 2023"), saved at `arc3-evidence/fhwa-kno-history.htm`: "In 1935, the first MUTCD was published." / "On November 7, 1935, the first edition of MUTCD was approved as a National standard by the American Standards Institute." The predecessors were narrower: AASHO 1927, "addressed only use and design for signs on rural roads"; NCSHS 1930, urban devices. | **TRUE.** The first national standard covering traffic control devices is 1935. "Ninety years": 1935 → 2026 = 91. |
| "Every edition since has added what the last one learned: how far ahead a driver needs warning, how long a merge has to be, how much room a crew needs to work safely." | Same page: 1961 "A new part addressed construction and maintenance operations"; 1978 "revisions addressing the fundamental safety principles concerning work zones…". The three topics are MUTCD 2023's Table 6B-1, Table 6B-3 and §6B.06, the chips 03 already shows. | Rhetorical in "every edition" (1942 was the blackout edition). The substance is true. Keep. |
| Colorado map: city and interstate positions | The artboard plots an equirectangular box from −109.05° to −102.05° and 37° to 41° into 286 × 210 px (aspect 1.362 vs 7·cos 39° / 4 = 1.36). Recomputed: Denver (39.739, −104.990) → (175.9, 76.2); artboard (175.9, 76.1). Fort Collins, Colorado Springs, Pueblo, Grand Junction and Durango are all within 2 px. I-25 passes through the Front Range cities; I-70 runs from Grand Junction through Denver to the east edge. | **TRUE as a drawing.** Labelled as one (Q4). |
| 02 paper stacks show no figure | Placeholder bars; "§" marks; the crew sheet's "1–4" are list ordinals. | No number is implied. |
| 03 detail | Buffer x 323–563 empty; devices along the lane line (y 207 on the 210 line) through the work; labels "taper", "buffer", "spacing", no values; one note, "source cited in the audit", three leaders. | Matches A2-Q5 / R15. |
| Milepost road | The same order and emptiness as the product: buffer stretch empty, devices along the lane through the work; stretch colours equal `ZONE_COLOR` (`lib/corridor-zones.ts:31-37`) hex for hex. | Matches R13. |
| R20 | `FLOW.md:8` still reads "…Knows where the work is. Does not know MUTCD. Wants: …" | Will delete the sentence only. |

## 4. After the rulings (commit sequence)
1. Red tests: reduced motion (static, fully drawn); marker per stretch; highlight end == road end at max scroll; fan class toggle; 404 at an unknown path; the gate route table (`/404` public, unknown gated → `/`).
2. Build: copy into `lib/coming-soon-copy.ts`; the road and marker (one passive listener + rAF, direct attribute writes, marker state only on stretch change); sections 01–05 and the close band; `app/not-found.tsx`; `/404` in the gate; R20's FLOW.md sentence; the motion census extended for R13/R15 (recorded as R10's exception, extended).
3. Evidence: `measure.cjs` at 1440/1024/768/390/380 with axe, target sizes, contrast pairs and no sideways scroll; the scroll-effect probe.
4. Diff-verifier; stop before ship.
