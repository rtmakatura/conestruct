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


## Arc calls (R145 self-ruled)

*None yet. Added after the checkpoint.*
