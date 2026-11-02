# UX group 2: "Needs you" as one question at a time: checkpoint

Branch `ux-group2-needs-you`, stacked on `ux-group1b-prod-check` `b02d68e` (group 1 and 1b are on main at `e2629c1`, so the dependency holds). Investigated 2026-11-02. No code yet.

Ruling 5 says: "If a line can't be traced, stop and report; do not ship an untraced claim." The trace found three lines that the backend doesn't support as written. So this checkpoint stops on S1–S5 below. Everything else is self-ruled (R145) and listed in § 5.

## Stop items (need Ryan)

### S1. "Yes, they're there" has no write to map to
Ruling 5 maps "Yes" to "the existing Confirm action". **No Confirm action exists for a detected condition.**
- The only actions are `dismiss` and `assert`: `action: Literal["dismiss","assert"]` (`src/api/site_scan.py:421`).
- An assert on a condition the scan already found is accepted but does nothing. It comes back `moot`, with the sentence "Operator assertion of {label} is moot: the scan detected it. The assertion changes nothing." (`site_scan.py:281-286`).
- Today's UI never sends it: a detected row offers only Dismiss (`NeedsYouConditions.tsx:533-535`). "Confirm dismiss" is the button that commits a dismiss, not a separate confirm.

Options:
- **A (recommended): "Yes" writes nothing.** The answer is held in the page's state, keyed by condition, and survives Apply. It is cleared on a new pin or a new Generate from the bands. The consequence line ("The 4 devices stay in the plan.") is true because nothing changes: the plan already includes them. Cost: the "yes" isn't recorded in the audit trail, and a reload asks again.
- B: "Yes" sends the moot assert. That makes it permanent, but the audit PDF would then print "…is moot… The assertion changes nothing." as the record of the operator's confirmation. That is the wrong wording for a confirmation.
- C: a backend change: a new `confirm` action that records "Operator confirmed the scan's Pedestrian sidewalks" and changes no flag. This is the honest permanent record, but it's out of this arc's scope ("No backend change"). I'd file it as a follow-up.

**Sub-question S1b:** under A, if every answer is "Yes", nothing is staged. What does the last button do? I recommend it still reads "Apply answers" but sends no request, and the block collapses to its answered records. The alternative is the label "Done" in that case. Ruling 6 names only "Apply answers", so I'm asking.

### S2. "No, there aren't any" has no dismiss reason
A dismiss must carry a reason, or the backend refuses with a 400: "Dismissing {label} needs a reason (fenced, removed, not in work zone, other)" (`site_scan.py:210-218`). The reasons are `fenced`, `removed`, `not_in_work_zone` and `other`, and `other` needs a typed note (`site-corrections.ts:128-133`). None of them means "they aren't there". `removed` would claim they once existed.

Options:
- **A (recommended):** a small backend change that adds a reason `not_there`, with the record clause "…: not there." It touches the schema Literal, `_reason_text`, `DISMISS_REASONS` and their tests, and needs no other backend change.
- B: "No" opens today's reason chips inline under the radio row. That keeps the backend as it is but makes the answer two clicks, and none of the chips matches "No".
- C: "No" sends `other` with an automatic note "not there". This puts words in a note field the operator never typed, so I'd advise against it.

### S3. Your open question: dismissing the intersection does **not** clear its flag
- A detected intersection adds **0 devices** (`src/rules/site_adjustments.py:186`). It adds a pending item, `intersection_layout_not_generated` (`src/api/audit.py:2646-2662`).
- A dismiss removes the flag (`site_scan.py:262-267`), so that pending item goes. But every applied correction adds its own pending item, `site_condition_overridden`, whose label is the dismiss sentence (`audit.py:2827-2835`).
- **Net effect:** the device count doesn't change, the pending count doesn't change, and the plan stays amber. One pending item is swapped for another.
- The signalized-approaches §6N.12 check keys on `approaches`, not on this flag (`audit.py:2687`), so a dismiss leaves it alone. The interchange works the same way (0 devices, `audit.py:2664-2678`).

Proposed lines, each traced to the code above:
- Q: "Is there an intersection next to the work?"
- Explanation: "The map shows an intersection 49.9 ft from the work. The plan adds no devices for it; the cross-street layout stays with your traffic control supervisor."
- Yes: "Nothing changes. The supervisor still lays out the cross street."
- No: "No devices change. The plan records that you said it isn't there, for the supervisor to check."

These are new factual claims about who does what, so they need your go.

### S4. "Total goes from 43 to 39" isn't on the wire
- No field states the total after a dismiss. The page would have to subtract the condition's devices (`sections.site_adjustments[].devices_added`) from the total (`breakdown.total_devices`). Rule 3 says the backend owns this kind of number.
- The subtraction is exact today. Dismissing drops the condition's whole adjustment (`site_adjustments.py:366-387`), the only "modified" adjustment is a manual flag (`:152`), and no jurisdiction or night rule keys on these flags (`jurisdiction.py:692-697`, `:790-832`; `night_adjustments.py:96-118`).
- But nothing enforces that, and one real case makes it false. On a flagger plan with pedestrian access, the generator places its own R9-9 signs (`render_api.py:1319-1327`), and a dismiss doesn't remove those.

Options:
- **A (recommended):** drop the "Total goes from X to Y" clause. The No line reads "The 4 devices come off the plan." (`devices_added` from the condition's own record). The new total shows in Your plan after Apply. I'd file a follow-up for a backend `total_if_dismissed` per record if you want the before/after back (P22).
- B: subtract on the page, labelled as a mirror (Rule 3's mirror exception is for rendering decisions, not shown values). I'd advise against it.

### S5. Most NEEDS YOU items can't be a yes/no question
Only the **five scanned conditions** have a write that answers yes/no. The other item types are:

| Item | Id | Write today | Changes the plan? |
|---|---|---|---|
| Jurisdiction delta, ▲ changed | `jur:delta:*` | Acknowledge / Withdraw, only when the delta has a `key` (`needs-you-items.ts:154-155`). The backend only records it (`schemas.py:271-276`). | yes (the wire says so: tier changed) |
| Site adjustment with devices | `audit:site:<flag>` | none on the row. It merges into its condition's row. | yes (`devices_added`/`devices_modified`) |
| Fines double | `audit:fines_double` | none | yes (tier changed) |
| Jurisdiction delta, ⚠ attention | `jur:delta:*` | Acknowledge, as above | no |
| Colorado FAIL | `audit:colorado:fail:<label>` | none | no |
| Scan not checked | `audit:scan:not_checked` | none | no |
| Corridor | `audit:corridor` | none | no |
| Geometry | `audit:geometry` | none | no |
| Signalized approaches | `audit:approaches` | none | no |
| Detected scanned condition (5 flags) | condition row | Dismiss; Assert only when absent | yes when its record has `devices_added > 0`, otherwise it only flags |
| Manual keys (2) | condition row | Assert / Undo | yes when asserted (limited sight distance moves signs) |

Ruling d (#288) bans a button that writes nothing.

**Recommendation:**
- The questions are the **detected scanned conditions** only. N (the "Question k of N" count and the verdict strip's "Answer N quick questions") counts them.
- Every other item renders under the question card as a plain "Also on this plan" list: glyph, title, citation. Acknowledge stays where it exists today.
- An asserted manual key renders as an answered record (✓ asserted by you · Undo). Unasserted keys go inside "Show them" (ruling 8).
- This changes what ruling 2's "N = the NEEDS YOU count" means, which is why it's here.
- For ruling 4's order on the Colfax pin: sidewalks (4 devices added) is Q1 and the intersection (0 added) is Q2, which matches the artboard.

## 1. NEEDS YOU item types the wire produces today
See the S5 table. The source is `lib/tier-sources.ts:147-281`, mapped in `lib/needs-you-items.ts:122-193`. Condition rows come from `lib/needs-you-conditions.ts:61-106`, and the site-adjustment merge is at `:136-149`.

"Changed the plan" on the wire means one of: tier `changed` (`assignTiers`, `lib/tiering.ts`), or a site adjustment record with `devices_added > 0 || devices_modified > 0` (`tier-sources.ts:184-186`). `primaryCount` (`needs-you-conditions.ts:165-182`) already uses the same test. The new order (ruling 4) will read that one producer, in `lib/needs-you-items.ts`.

## 2. Confirm / Dismiss / Assert / Apply traced
| Action | Frontend | Backend | Effect on the regenerated plan |
|---|---|---|---|
| Dismiss on a detected flag | `dismissMarker` (`site-corrections.ts:222`) staged, written to `meta.siteConditionOverrides` at Apply | `_apply_corrections` pops the flag (`site_scan.py:262-267`), status `applied` | The adjustment doesn't run: −`devices_added` devices (sidewalks 4 = 2 Type III + 2 R9-9, `site_adjustments.py:259-282`; bike 2 M4-9a `:303`; school 2 S1-1 `:334`; intersection and interchange 0). Plus one `site_condition_overridden` pending item (`audit.py:2827`). |
| Dismiss on an absent flag | blocked by `dismissAllowed` (`site-corrections.ts:256-262`) | would be `moot` (`:268-273`) | nothing |
| Assert on an absent flag | `assertMarker` (`:238`) | `out[flag]=True`, `applied` (`:287-294`) | the adjustment runs, plus a pending item |
| Assert on a detected flag | never sent today | `moot` (`:281-286`) | nothing (S1) |
| "Confirm" | the "Confirm dismiss" button commits a dismiss (`NeedsYouConditions.tsx:486`) | — | no separate action exists (S1) |
| Acknowledge | `withAck` → `meta.acknowledged` | recorded only (`schemas.py:271-276`, `render_api.py:2461-2469`) | no device change |
| Apply | `applyStagedAll` (`GeneratorShell.tsx:794-805`): one `setScenario` + `onGenerate()` | one audit request with `include_breakdown`, one scan | one regenerate per Apply (#254 staging unchanged) |
| Undo | `unstage` (staged), or a null marker (applied record) | marker removed | the byte-identical `meta` round trip (#224) |

Caveats that limit consequence lines:
- On a freeway, sidewalks are forced to `detected: False` (`site_scan.py:678-690`), so no sidewalk question appears there.
- An S7 preview builds with no site adjustments (`render_api.py:1265-1272`). Its totals are never used as "today's total".

## 3. Predicted churn (Rule 5)
This is a big arc: about 33 test files and about 450 assertions move. There are no snapshots, Playwright specs or Python string pins.

| Change | Files (main) | ~assertions |
|---|---|---|
| (a) stack order | GeneratorShell.live-speakers, .disclosures, .ribbons, .needs-you, .results-head; results-slot-tokens (`--setup-box-h` 167/359 goes) | ~25 |
| (b) strip wording, chip removed | StatusBar.test (~30), check-list-grid (1) | ~31 |
| (c) one question at a time | NeedsYouConditions.test (~120, near-total rewrite), NeedsYouConditions.tokens (~60, rewrite), GeneratorShell.batch-corrections (~55, rewrite), GeneratorShell.needs-you, NeedsYou.test, NeedsYou.acknowledge, GeneratorShell.primary, WorkingBand, WriteLock, hit-targets, TieredReference.signposts, walkthrough-l2-css, type-census rows | ~300 |
| (d) Setup row, grid behind Edit | ResultsHead.grid (~28, rewrite), GeneratorShell.value-links (~40), hit-targets, revision, BandStack.landing / one-open, zone-staging; type-exceptions `.a-setup-v` | ~80 |
| (e) Your plan | ResultsHero.test (~35), severity-ramp, rule-169, revision; type-exceptions hero rows. `.hero` is kept as the class name, so ~16 "results landed" markers stay put. | ~45 |
| (f) download cards, warning row, quote row | OutputCards.test (~30), phone-note, rule-168, bundle-settings (Pricing quote moves to the Downloads row); type-exceptions `.dl-card` rows | ~45 |
| (g) landing scroll | see below | ~10 |

- **Landing target (#250/#271):** `resultsRef.scrollIntoView` (`GeneratorShell.tsx:1202`, `:1227`) targets the results section (`:1928`), with scroll margin `--nav-h + 8 + --status-h + 24` (`globals.css:1686-1688`).
  - Today it lands on the Setup grid (the section's first child).
  - After the reorder the same target lands on NEEDS YOU, which is the point of ruling 1. The verdict strip stays outside the section, so the margin formula and `shell-chrome.test.tsx`'s 141/164 stay.
  - Moves: `post-generate-scroll` (the target still contains `.hero`: unchanged), `BandStack.landing:119` (it asserts that the section contains `fact-setup`: it still does, lower down), `a11y-focus` / `zone-headings` (unchanged).
- **Source churn, predicted:**

| File | Predicted |
|---|---|
| NeedsYouConditions.tsx | rewrite, ~−450/+350 |
| NeedsYou.tsx | ~±150 |
| new `NeedsYouQuestion.tsx` | ~+250 |
| lib/needs-you-items.ts + needs-you-conditions.ts | ~+120 (question model, order) |
| GeneratorShell.tsx | ~±120 (order, staged answers to downloads) |
| ResultsHead.tsx | ~±120 |
| ResultsHero.tsx | ~±80 |
| OutputCards.tsx | ~±100 |
| PricingCard.tsx | ~±40 |
| StatusBar.tsx | ~±20 |
| globals.css | ~+300/−200 (group 1's miss was CSS; this time it's predicted high) |
| type-exceptions.ts | ~±40 |

  If S2-A or S1-C is ruled in, add `src/api/schemas.py`, `site_scan.py` and tests, ~+40.
- **Recommendation: split into two branches**, stacked, under one issue: 2a NEEDS YOU + the strip + order (a, b, c, g), and 2b Setup row + Your plan + Downloads (d, e, f). Each stays reviewable. One ship go covers both (R147).

## 4. P1–P22 on the changed surfaces
FLOW.md step served: **4 Look** ("Did it work, and what does it want from me?") for the strip, NEEDS YOU and Your plan; **5 Take** for Downloads. User: the rep winning a bid today, and the estimator drafting.

| P | Plan |
|---|---|
| P1 | The question card reserves the height of its longest state: the radio rows are always mounted, and Details opens below the button row, not between. Rects measured on Next / Undo / reopen. Risk: `NeedsYouQuestion` body height differs per question; measured per state. |
| P2 | The count lives in the strip (in words) and the NEEDS YOU header ("Question k of N"); both read one producer. The `.ny-count` numeral goes, so N isn't stated three times. |
| P3 | The post-Generate landing is NEEDS YOU with Q1 open (ruling 1). |
| P4 | The radio rows share one left edge; the button and the source line share one baseline row; the download buttons share one bottom edge (grid). Measured. |
| P5 | The question is 19 px Inter 600 `--ink`; the explanation is 13.5; the consequence is 12.5 `--ink-mute`; mono only for "NEEDS YOU", "SETUP", "YOUR PLAN" and the tile labels. |
| P6 | Fixed tracks for the plan cells (3 × minmax(0,1fr)) and the cards (4 → 2 → 1). |
| P7 | Answers stage; one Apply = one regenerate (request count measured). |
| P8 | Downloads stay live (ruling 11); the warning row discloses instead of locking. |
| P9 | ✓ / × / ◌ on records and remaining rows, each with a word. The radio marker's chosen state is fill + inset + border, not hue alone (Option C's marker). |
| P10 | Radio rows 56 px min, buttons 44, Edit / Show them / Details / Open have 44 px hit areas. axe target-size. |
| P11 | The radio marker reuses group 1's picker marker CSS; buttons reuse `.act` / `.pri`. |
| P12 | Ryan's browser check. |
| P13 / P19 | Details (ruling 7), Show them (ruling 8), Setup grid behind Edit (ruling 9): each one click, with a count or label. At most one disclosure open by default. |
| P14 | N = 0: no question card. The strip keeps today's wording; the "N other conditions checked" row still shows. |
| P15 | Answered → a one-line record with ✓/× and Undo. Applied dismiss records persist from the wire. Under S1-A, a "Yes" record persists in page state only (a deviation if A is ruled; C fixes it). |
| P16 | No placeholder numbers: the quote total appears only after a preview (otherwise "Open" without $); the counts on the cards come only from the wire. |
| P17 | Rep / estimator, step 4 / 5 (above). |
| P18 | One primary: the question card's button while N > 0; "Download all" when N = 0 (`derivePrimaryOwner` unchanged). |
| P20 | Each section's lead line answers a question: "Question k of N", "As it stands now", "N files, quote included". |
| P21 | The question asks what the rep can see on site ("Are there sidewalks…?"), not a scan-correction verb. |
| P22 | Each answer shows its consequence before Apply (ruling 5). The before/after total waits on S4. |

## 5. R145 self-ruled calls (say if you want any different)
- **D1.** The 19 px question heading reuses the existing step-question token `--fs-step-question-520` at every width (19 is already in the census; 62 rides the hero's ruled token). No new sizes.
- **D2.** The verdict strip with N > 0: "⚠ Plan ready. Answer N quick questions before you send it." in Inter 13.5/600. It keeps `status-bar caution` and its ⚠ glyph (Rule 13 second channel). N is the question count from S5.
- **D3.** Setup row (ruling 9): values from `setupSegments()` (`band-facts.ts`), joined with " · ", skipping cells that are not set (Rule 10; the Dates "◌ not set" cell is dropped from the one line, but stays in the grid). Edit opens the current grid in place; each cell keeps its current revision path.
- **D4.** Your plan (ruling 10): TOTAL DEVICES = `total_devices`, DEVICE TYPES = `unique_types`, KEY DISTANCES = `zone_geometry.taper_l_ft / buffer_b_ft / device_spacing_ft / work_len_ft`. A row whose field is missing (older backend) is omitted, never "—" (P16).
- **D5.** The download descriptions' numbers: devices = `total_devices`, types = `unique_types`, steps = `summary.step_count`, checks = the existing `auditChecked` (frontend tiering, mirrored by Python on the PDF cover, already shipped). A missing number drops its sentence.
- **D6.** Warning row (ruling 11): its N = questions not yet applied (unanswered plus staged). It shows while N > 0 and hides when nothing is unanswered or staged. A "Yes"-only set under S1-A doesn't count as staged, because the files already match.
- **D7.** Price-quote row (ruling 13): "Price quote · Contractor estimate, not a permit fee · $total · Open". Before any preview, `$total` is absent (Rule 10) and the row reads "Price quote · Contractor estimate, not a permit fee · Open". The disclosure body is unchanged.
- **D8.** Ruling 8's count is the folded rows (none found + not asserted) from `conditionSummary`. If a manual key is asserted, it's a record above, not in the count.
- **D9.** The old Apply row's standing sentence and the scan footer leave NEEDS YOU. Ruling 7 moves the scan time and duration into each question's Details. The `corrections_advisory` sentence moves under the question card's button row (the backend's verify line, once).
- **D10.** The "Correct in setup ↑" signposts in Reference still jump to `#site-corrections`, which stays on the NEEDS YOU section.

## 6. New strings and where their numbers come from
| String | Numbers from |
|---|---|
| "Plan ready. Answer N quick questions before you send it." / "1 quick question" | question count (S5) |
| "Question k of N" | question model |
| "Are there sidewalks along the work zone?" (and per flag: "Is there an intersection next to the work?", "Is there a highway interchange next to the work?", "Is there a bike lane along the work zone?", "Is there a school zone along the work?") | fixed copy |
| "The map shows sidewalks 25.6 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay." | `nearest_distance_ft` (scan bucket), `devices_added` (site_adjustments record) |
| "Yes, they're there" / "The 4 devices stay in the plan." | `devices_added` |
| "No, there aren't any" / "The 4 devices come off the plan." | `devices_added` (S4 drops the total clause) |
| Intersection lines | S3 |
| "Source: MUTCD § 6C.02 · map data from OpenStreetMap · Details" | the record's `citation` |
| Details: "57 found · nearest 25.6 ft · corridor scan · 2 nov · 16:13 utc · 3.8 s" | bucket `count`, `nearest_distance_ft`, `measured_at`, `duration_ms` |
| "Next question" / "Apply answers" | — |
| "Next: <plain title>" | fixed per flag ("an intersection next to the work", "sidewalks along the work zone", …) |
| "✓ N other conditions checked. Nothing else needs you." / "Show them" | `conditionSummary` (D8) |
| "SETUP" row values · "Edit" | `setupSegments()` |
| "YOUR PLAN" · "As it stands now" · "On the plan sheet" · "Different devices to pull from the yard" | D4 |
| "These files match the plan before your N answers. Answer first and they'll update." | D6 |
| "The drawing for the crew and the permit. N devices." / "What to load on the truck. N types, CDOT bid items." / "Setup and takedown, in order. N steps." / "Every number and the rule behind it. N checks." | D5. "CDOT bid items" repeats the card's existing "CDOT BID-READY" claim (`OutputCards.tsx:204`) |
| "N files, quote included" / "Download all (.zip) ↓" | `bundleLabel()` (`render-types.ts:35`) |
| Price-quote row | D7 |

The "1 quick question" sentence, the consequence lines and the card lines are checked against the unslop list in docs/style.md at build.

## Evidence plan
As the prompt says: a browser run at 1440 and 390 on the preview with the Denver Colfax pin (two conditions):
- walk both questions with Yes and No each way, Undo each, and Apply once;
- record the request count (one regenerate per Apply), the device total before and after, and that the downloads stay live with the warning row until done;
- render N = 0 and N = 1;
- axe 0, no target under 44 px;
- crops beside `OptionB.dc.html`.
