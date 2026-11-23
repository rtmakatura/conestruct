# cc-prompt: UX map window tidy: no-pin ring, notices that float, two #544 fixes, the attribution button

Ryan ruled this on 2026-11-22, after #541 shipped.

One small mission (up to four small items). Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. Build on `issue-542-prod-check` so its evidence ships with this. Commit the crops for Ryan's hand check.

## Rulings (quote verbatim into rulings.md)

1. **The no-pin mark.**
   - With no pin, the mark beside "No pin yet" is a hollow ring: an `--ink-faint` outline, no fill.
   - It turns into today's orange (`--dim`) dot only once a pin exists.
   - The bar keeps its height and position.
2. **#543: notices float.** The coarse-match notice and the bearing note move into the search's floating list over the map, the same place as #541's out-of-range line. The map column, the search row and the right panel move 0 px whenever either one shows. Measure it. Their wording stays the same unless it uses jargon; list any change.
3. **#544, two fixes only.**
   - Coordinates in brackets, e.g. "(39.7401, -104.9811)" or "[39.7401, -104.9811]", parse as coordinates and never reach the geocoder. Add a test for each form.
   - At 390, "Did you mean 39.7401, -104.9811?" keeps the numbers together on one line. The pair must not wrap in the middle.
   - The rest of #544 goes to the spacing round list in handoff.md.
4. **Mapbox's "Toggle attribution" button (24 x 24 at 1198).** If a CSS-only change gives it a 44 px tap area without changing how Mapbox's attribution looks or what it says, do that. If not, add it to #505's exception by name and record why. Don't hide or remove the attribution.
5. Inter only, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. List every new string with its source. Unslop.

## Evidence

Capture at 1440, 1198x930 and 390:
- the bar with no pin and with a pin
- the coarse-match notice and the bearing note in the floating list, with the 0 px size check
- bracketed coordinates placing the pin
- "Did you mean" at 390
- the attribution button's tap area

Run axe and the 44 px measure. Also measure closing the window with Cancel and with the Close button, which #541's production check skipped. Commit the crops.
