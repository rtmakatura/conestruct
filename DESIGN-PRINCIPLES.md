# DESIGN-PRINCIPLES.md — house rules for the interface
*Adopted 2026-09-08 (P1–P12); P13–P16 added the same day, P14 moved here from memory.md — memory.md holds engineering facts, this file holds design principles. Each rule below is drawn from a complaint Ryan raised on a shipped surface between 2026-09-05 and 09-08, generalised, and traced to a published source. These sit alongside Rules 3/10/13 in CLAUDE.md and are checked at every UI checkpoint under a "principles" heading, the way contracts are. Claude Design starter prompts include them verbatim under "Constraints".*

## How to use this file
- **At investigate:** for any arc that touches a screen, list which of P1–P16 the change could break, with the file:line where it would happen.
- **At checkpoint:** a "Principles" section states, per rule, how the plan honours it or why it deviates (deviations are rulings, like Rule 5 churn).
- **At evidence:** the browser leg measures what can be measured (layout shift, target size, one-edge alignment, contrast, response latency). Asserted is not measured.
- **In Claude Design prompts:** paste P1–P16 under Constraints. A spec that violates one must say so in its conflicts section.

---

## P1 — Nothing moves that the user did not ask to move
Late-arriving content never displaces earlier content. Reserve space before the answer lands; a control that appears on click appears in room that was already allocated; a row's height is set by its longest possible content, not its current content.
- **Source:** Google Core Web Vitals, *Cumulative Layout Shift* (2020) — layout instability is measured and penalised because users experience it as loss of control. Nielsen H1 (visibility of system status) and H4 (consistency).
- **Origin here:** the "Other (say what)" note box shoving Confirm to a new line (#255); the two-line record sentence growing its row (#255); the wait line under the nav (#247); the pre-band 411 px landing drift (arc 23, commit 4a).
- **Measure:** rects before and after every state change in the live check; a row height table per state.

## P2 — One voice per fact
Each fact the interface states has exactly one place it is stated. Status has one home (the band). A count has one source field and one surface per zone. Two elements that could disagree are one element too many.
- **Source:** Nielsen H1 and H2 (match between system and the real world); Krug, *Don't Make Me Think* ("omit needless words"); house `deriveRail` / `deriveResultsHead` idiom (#228).
- **Origin here:** the scattered working signals (#252); the lockup vs the #253 chip both stating the detected count (ruled: one of them goes).
- **Measure:** the aria-live region count; a grep for duplicated strings across components.

## P3 — The next thing to do is visible without being told
After any action, the operator can see, from where they land, what the system is doing or what it wants next. A fact is not an instruction; if a step matters, name it as a step.
- **Source:** Nielsen H1, H6 (recognition over recall); Krug ch. 1 ("don't make me think"); Doherty threshold (Laws of UX): feedback within ~400 ms or a visible progress state.
- **Origin here:** the "N detected · correct in setup ↑" line Ryan did not read as step one (#253); the block above the landing (#246); the VERIFYING line off-screen (#247).
- **Measure:** the post-action viewport contains the status or the next-step element, both sizes.

## P4 — Edges, not eyeballing
Things that are the same kind of thing share an edge. All actions in a list share one vertical edge; all labels in a column share one left edge; numerals right-align on the decimal. Alignment is a measured coordinate, not a look.
- **Source:** Wathan & Schoger, *Refactoring UI* ("align everything to a few strong edges"); Gestalt law of alignment/continuity; Rams #10 ("as little design as possible").
- **Origin here:** buttons wrapping under prose and three distinct action x-positions (#248); the chip labels off-centre (#255).
- **Measure:** one `right` (±1 px) for every action in a block; label `left` equal across rows; chip text centred by bounding box.

## P5 — Hierarchy by weight and colour, not by size alone
Primary text, secondary text, and system text are three registers, distinguished by weight and ink before size. Secondary information is quieter, never merely smaller. Mono caps = the system speaking; sentence-case sans = the thing the user named (#226 type roles).
- **Source:** *Refactoring UI* ("emphasise by de-emphasising"; "labels are a last resort"); the house four-role type table (`lib/design/type-roles.ts`).
- **Origin here:** the prose-dump block where label, verdict, count, and a raw coordinate string ran together in one register (#248).
- **Measure:** every text node maps to exactly one `tr-*` role; no ad-hoc sizes (spec rule "no other type sizes" is P5 in the designer's words).

## P6 — Content never dictates layout
The grid is decided first; content fits the grid. A long name wraps inside its cell; it does not widen the column. A sentence that cannot be shortened gets its own reserved row; it does not stretch a shared one.
- **Source:** *Refactoring UI* ("don't let content dictate layout"); CSS Grid `minmax(0, 1fr)` as the technical form of the rule.
- **Origin here:** the record sentence sizing the evidence track and starving the name track (arc 20 deviation 1); the same sentence growing rows (#255).
- **Measure:** column tracks fixed per state; the row-height table shows one height per row kind.

## P7 — Reversible before irreversible; batch before commit
Cheap, reversible actions never trigger expensive, locking work by themselves. Stage, then apply. A single click that starts a 20 s locked cycle is a design defect unless the click is "apply".
- **Source:** Nielsen H3 (user control and freedom); Tesler's law (conserve complexity — but put the cost where the user chose it); Hick's law (fewer forced decisions per moment).
- **Origin here:** each Dismiss/Assert re-generating the plan and locking the page (#254).
- **Measure:** number of requests per operator intent; the band mounts once per Apply, not per edit.

## P8 — Wait states are honest, visible, and non-blocking
While the system works: say so once, in one place, on screen; disable what would conflict; never block reading or scrolling; never cover the content; never fake progress. A spinner with no words is a violation; a percent with no basis is a violation.
- **Source:** Nielsen H1; Doherty threshold; Laws of UX "Goal-gradient effect" caveat (fake progress backfires); house Rule 10.
- **Origin here:** #252, and the "STEP n OF total" the spec wanted with no server stages (ruled out).
- **Measure:** band present iff a request is open (fake-timer test); scroll and expanders work under lock.

## P9 — Every state has a symbol and a word
No state is carried by colour alone, by position alone, or by an icon alone. Symbol + word, from the fixed vocabulary (▲ ✓ × ⚠ ◌ ⌁), each glyph with one meaning and one colour. Decorative colour is exempt and must be labelled decorative.
- **Source:** WCAG 1.4.1 (use of colour) and 1.4.3 (contrast); house Rule 13; DESIGN-SPACING vocabulary table.
- **Origin here:** the ●/○ glyphs a spec proposed (rejected — not in vocabulary, ◌ misread as "none"); ◌ doing double duty (ruled: "pending", one colour).
- **Measure:** contrast measured per pair on the actual surface; glyph audit against the table.

## P10 — Targets are sized for the hand that uses them
Controls a crew member taps in a truck are ≥ 44 px hit targets, even if the visible box is smaller. Desk density is not an excuse for phone targets under 32 px.
- **Source:** Fitts's law; Apple HIG (44 pt) and Material (48 dp) minimums; WCAG 2.5.5.
- **Origin here:** the 26 px buttons and 24 px chips in the ledger spec (K74), deferred to #153.
- **Measure:** axe `target-size` at 380; the two named pre-existing findings are the debt, not the baseline.

## P11 — Consistency is a rule, not a preference
A control that means X looks like X everywhere. One disabled treatment, one hover treatment, one focus ring, one action-button style per surface. New components reuse tokens; a new hex without a role is a defect.
- **Source:** Nielsen H4; Jakob's law (users expect your app to behave like the others they use); design-systems practice (Material, Fluent, HIG).
- **Origin here:** three act-washes at 0.12/0.14/0.16 collapsed to one (#249 ruling a); `#a9dcf8` rejected twice; the uniform 0.45 lock tier (#252).
- **Measure:** the token test; the CSS-rule tests that pin selectors to named tokens.

## P12 — Polish is trust
Operators judge correctness by finish. Uneven spacing, off-centre labels, raw ISO timestamps, and jittering layouts read as "cheap" and lower trust in the numbers, even when the numbers are right.
- **Source:** the aesthetic-usability effect (Kurosu & Kashimura 1995; Laws of UX); Rams #1–#3 (innovative, useful, aesthetic — in that order, but aesthetic is on the list); Krug on credibility.
- **Origin here:** "this is horrendous" (#248); the raw `2026-09-05T14:00:26+00:00` footer (#249 ruling e).
- **Measure:** none numeric — this is the rule that says the others are worth the cost. Ryan's hand-check is its test.

## P13 — Show the simple thing first; the rest on request
The default view carries what most operators need most of the time. Detail, provenance, and advanced controls sit one deliberate click away — expanders, chips, disclosures — never hidden, never forced. Disclosure is body copy in a container, not a label role.
- **Source:** Nielsen H8 (aesthetic and minimalist design); progressive disclosure (NN/g); Hick's law.
- **Origin here:** already practised — AuditTrail expanders, reference chips, the quote settings disclosure, the ▲/✓ tier chips. Written down so a new surface does not regress it.
- **Measure:** every expander is a `data-read` control that stays live under the lock (P8); the default post-generate viewport has no more than one open disclosure.

## P14 — Empty states show the shape of the answer
When there is no data yet, the surface shows the rows, columns, or slots the answer will occupy, labelled, with an honest "not set" / "none" / "not scanned" word in the fixed vocabulary. A blank region is a question the operator cannot answer. The one ruled exception is the pinned-only fact strip.
- **Source:** NN/g on empty states; Krug (the page should explain itself); house Rule 10 (absence renders as absence, in words).
- **Origin here:** the schedule rows' three states (#227); "None — baseline" as a real answer; absent site-condition rows reading "none along the corridor" (#249). Moved here from memory.md 2026-09-08.
- **Measure:** every list/table surface has a test for its zero-row render.

## P15 — Every operator action can be undone, and the record stays
An action that changes the plan has an Undo that restores the exact prior state (byte-identical wire), and the fact that the action happened stays visible — ✓/× + evidence + Undo — until the operator undoes it or moves the pin. The interface forgives; it does not forget.
- **Source:** Nielsen H3 (user control and freedom) and H9 (help users recover); Shneiderman's golden rules ("permit easy reversal of actions").
- **Origin here:** #179 undo family; #227 resolved-suggestion records; #224 phase 4 corrections (Undo → byte-identical `meta`).
- **Measure:** the undo → byte-identity tests; a resolved record renders for every applied correction.

## P16 — Don't: loading skeletons, placeholder numbers, fake progress
No grey bars pretending to be rows, no "—" standing in for a value the system has not computed, no percent that means nothing. While waiting, the surface shows its last honest state (dimmed and labelled "previous answer") or its empty state (P14) — and the wait itself is said once (P8).
- **Source:** house Rule 10; Doherty threshold read correctly (feedback, not fabricated structure); Laws of UX on the goal-gradient caveat.
- **Origin here:** the "STEP n OF total" stage line with no server stages (ruled out, #252); the stale ribbon keeping "previous answer" (#252 ruling f).
- **Measure:** no skeleton component exists in `components/`; the stale wrapper carries its text channel; fake-timer test on the band.

---

## Recommended reading, in order of usefulness to this project
1. Wathan & Schoger, *Refactoring UI* (2018) — short, visual; P4/P5/P6 come from here.
2. Nielsen Norman Group, *10 Usability Heuristics for User Interface Design* (1994, revised) — one page; the vocabulary everyone uses.
3. Jon Yablonski, *Laws of UX* (lawsofux.com; book 2020) — Fitts, Hick, Doherty, Jakob, aesthetic-usability, one card each.
4. Google, *Web Vitals: Cumulative Layout Shift* (web.dev) — P1 with a number attached.
5. Krug, *Don't Make Me Think* (3rd ed. 2014) — the argument for P3.
6. Apple Human Interface Guidelines; Material Design 3 — reference for targets, motion, states (P10/P11).
7. Dieter Rams, *Ten Principles for Good Design* — the one-page manifesto version.

## Standing check for CC (paste into investigate templates)
> **Principles (DESIGN-PRINCIPLES.md):** for each of P1–P16, state honoured / not applicable / deviates-with-ruling, with file:line for anything that could violate P1, P4, P6, or P9. Measurable rules get a browser leg.
