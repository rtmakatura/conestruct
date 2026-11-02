# UX group 1: spacing and text rules on the tool page (/sandbox): rulings

Ruled 2026-11-02 by Ryan (chose Option C on the "Tool page: spacing and text" design canvas, https://claude.ai/artifact/WYUpkwpZT2vHQUKVEt5br1, artboards `OptionC.dc.html` and `OptionCDetail.dc.html`). Quoted verbatim from cc-prompt-ux-group1-spacing-text.md § Rulings.


1. **Three vertical gaps only on the tool page.** 8 px between a label and the line it labels (`space-tight`); 16 px inside a band: band padding, block-to-block (`space-block`); 24 px between bands, and between the last band and the footer line (`space-section`). Band header row: padding 12 px top/bottom, 16 px left/right. No other vertical gap on the surfaces in scope.
2. **Mono is for short labels only.** Mono stays on step labels ("STEP 1 OF 4"), section labels ("WHERE"), status-strip labels and field-group labels of four words or fewer, in caps. Every full sentence moves to Inter: 13.5 px `--ink-on-dark` for the main helper line, 12.5 px `--ink-faint` for secondary lines and the footer. No new font sizes and no new hexes (the type census and ink-literal gates must stay green).
3. **Controls are 44 px tall** in the bands in scope: the address input, Pick on map / Edit on map, Change buttons, road-picker rows (56 px min, they carry two lines).
4. **Road picker (map window, "which road").** Neutral band panel, not the yellow frame: header row `⚠` + mono "PICK THE ROAD · N FOUND". Each candidate is a real button row: a 14 px square radio marker (filled `--act` with a 2 px inset gap when picked, `--pri-off-ink` outline when not), then the road name in Inter 13.5/600 sentence case as "East Colfax Avenue, westbound", then one Inter 12.5 `--ink-mute` line: "<road class in plain words> · <N> m from your pin". The way ID, bearing in degrees and "OSM" leave the default view; they stay available behind the existing per-field "i details" toggle pattern (P19: one click away, never deleted). The picked road gets the `--act` border.
5. **Road picked summary.** One row: `✓` glyph, mono "ROAD" label, the road name in Inter 13.5/600, and a 44 px "Change" button. The detected-from line moves behind "i details" as in ruling 4.
6. **Disclosure headers** (Checked & passed, Pending / not verified, Reference): header padding per ruling 1; count in plain words in Inter 12.5 `--ink-faint` ("15 checks, each cited"); 16 px padding on the opened body, 8 px between its paragraphs. This fixes the zero gap under "Checked & passed" and above "1 REFERENCE PENDING". Their inner content is out of scope (group 5 redraws it).
7. **Copy in scope** (unslop rules apply; flag any line that changes meaning rather than rewording it):
   - Status strip: "NO SITE CHOSEN YET".
   - WHERE helper: "Type an address or two cross streets, the way an 811 ticket describes it. Or drop a pin on the map."
   - What's the job? collapsed: right side "Opens after you find the work".
   - Generate band: one line, "Find the work first, then Generate turns on." The "Output requires TCS review · every dimension cited to MUTCD or CDOT" line folds into the footer.
   - Footer: "Draft, not a sealed plan. Every dimension is cited to MUTCD or CDOT. A licensed PE must review and seal it before field use." **This changes the standing draft line; confirm the wording against wherever it is pinned (tests, PDFs) and list every place it appears at the checkpoint before changing any.**
   - The WHERE header's right-hand hint "the work, not the first sign" is dropped.


## Ryan's checkpoint rulings, 2026-11-02 (quoted verbatim; issue #435)

> 1. Draft line: use this wording instead of the one in the prompt. It keeps "engineering reference" because that phrase limits what the plan claims to be:
> "Draft, not a sealed plan. This is engineering reference, with every dimension cited to MUTCD or CDOT. A licensed PE must review and seal it before field use."
> Leave the site footer, the public / page and the PDF strings alone.
>
> 2. Change it at the source (rail.ts:143), but keep the how:
> "Type an address or pick on map first, then Generate turns on."
>
> 3. Yes. 24 px replaces the 18 px #289 ruling.
>
> Your nine calls are all approved, including the plain-words road types, the "i details" placement and the one-road case.
>
> Issue: ignore the prompt on that point. Post it yourself per R146, then build.

So: ruling 7's draft line and Generate line are replaced by the two lines above. Checkpoint calls C1-C9 are approved as written (checkpoint.md), and so are the type-role and spacing-token calls. Issue posted: https://github.com/rtmakatura/conestruct/issues/435

## Arc calls made during the build (R145 self-ruled)

- **B1. InfoToggle is its own small component; FieldCell keeps its copy** (this narrows C3). FieldCell's popover has two openers sharing one open state (the marker triggers and the toggle), so pulling the toggle out would restructure the WHAT cell. `components/InfoToggle.tsx` renders the same classes and DOM shape (`a-lk a-info-toggle` → `a-info a-pop`) and closes on a click outside or Escape. Its Escape handler runs in the capture phase and stops there, so it doesn't also cancel the picker (pinned by a test).
- **B2. One element, one role.** The band question's helper line (`OpenBand`) is `.tr-help` in every band, and a collapsed band's pending line (`FactLine`) is `.tr-note` in every band. They are the same element as the in-scope WHERE helper and WHAT line; "locked" stays a provenance word. The WHERE hint is dropped by returning "" from `whereProvenance` with no location, and OpenBand renders no element for an empty provenance (Rule 10).
- **B3. The footer line's 24 belongs to what sits above it.** A `margin-top` of 24 on `.draft-notice` measured 48 at landing: the setup zone's 24 plus its own, with an sr-only line between them stopping the collapse. After a Generate it measured 40. So `.draft-notice` takes `margin-top: 0`, the results zone (the column's last zone) gives up its 24, and `.results-disc` (the last block above the line) takes 24, up from 16. Measured 24 at both widths, landing and after Generate.
- **B4. "i details" is 32 px at desktop and 44 at 480 and under.** That's rule 15 / rule 163, the WHAT band's `.a-lk` sizing. Ruling 3's 44 px list doesn't name it.
- **B5. The picker's mono header and the ROAD label use the existing `.tr-step` role** (mono 10, .12em, written in caps; the open question reads in `--ink`), so no new size site. The marker is a CSS box, so no glyph enters the P9 vocabulary. The Change button is Inter 13.5 / 600, sentence case, in `--act` on the neutral ground. The old amber-ground reason for `--act-bright` is gone.
- **B6. Type-role pairs.** `.tr-note` and `.tr-field` share family, casing, size and tracking, because ruling 2 sets the note at the label's size in Inter. They differ in colour and weight, and the pair is recorded as the second ruled one-axis exception in type-roles.test.ts. Sizes are compared as displayed: each token maps to the px it equals.
- **B7. A counted tier's words.** `DisclosureRow` gains `countWords` and `plainWords`. The quote and the output cards pass neither and are unchanged. The Pricing quote row's mono provenance is untouched: it isn't one of the three headers ruling 6 names.
- **B8. The picker's spacing guard** (`LocationPickerModal.spacing.test.ts`) was non-vacuous at more than 100 Tailwind spacing tokens. The picker card moved to CSS (115 → 100), so the floor is now more than 90.
