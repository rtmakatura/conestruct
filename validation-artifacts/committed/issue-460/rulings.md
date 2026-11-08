# #460 rulings

## Ryan, 2026-11-08 (with screenshots), word for word

> 460. Ryan's ruling (2026-11-08, with screenshots): after the map picker's Save & Close, scroll so the WHERE band's top ("Where is the work?" heading and the whole aerial) sits just under the site's top bar, at every width; today at 1198x930 it lands with the aerial's top cut off. Also: when the aerial isn't drawn yet, show the picture the picker already loaded instead of the empty box with the mono "Drawing the corridor…" label. Re-walk at 1198x930, 1440x900 and 390x844, then the result: line.

This widens the issue body's proposal (`preventScroll` alone): the page now moves to a stated place after Save & Close, rather than staying where it was.

## R145 self-ruled

1. **The landing is ruling 184's, re-run.** Save & Close lands the open band through the same `scrollIntoView` + `armLandingCheck` a band change uses (`BandStack.tsx`), on the open band's wrapper, whose `scroll-margin-top` is already `calc(var(--nav-h) + 8px)`. "Just under the site's top bar" is that existing 8 px under the nav, not a new number. A save that also changes which band is open lands once, not twice.
2. **Only Save & Close lands.** Cancel moves nothing (P1): the background was scroll-locked while the picker was open, and the focus restore now uses `preventScroll`, so the page stays where it was.
3. **The picture is the picker's canvas at Save**, read with `toDataURL("image/jpeg", 0.85)` (the map is created with `preserveDrawingBuffer: true` so the frame can be read). It is held in GeneratorSidebar state, never on the scenario, the wire or the audit.
4. **Rule 10: the stand-in is never shown as the aerial.** It shows only while no aerial picture is on screen, and only while the scenario's pin equals the pin it was taken at. The wait sentence moves to the corner line `#456` already uses for a held picture (`.a-aerial-held`), and the frame is `aria-busy`. It takes no tap, no zoom and no key, and its alt says what it is: "The map as you saved it. The aerial is being drawn". Once the aerial answers, it replaces the stand-in. A refusal or failure still shows its sentence in place of any picture.
5. **Lane.** `scripts/cosmetic_lane_check.py` reads the diff as IN LANE, so this runs the cosmetic lane (R156). Ryan's three-size re-walk is run anyway, because the ruling asks for it.

## Ryan, 2026-11-08, amendment before ship, word for word

> One more change before ship: when the pin changed, show the picker's picture in place of the old map until the new map arrives (the old map is a different place). Keep the old map only when the pin didn't move.

This amends self-ruling 4. A held picture now records the pin it was drawn at (`BandAerial.tsx`, `Shown.pin`). While the new map is not drawn, a held picture from another pin gives way to the picker's picture, which carries the same corner wait line. A held picture at the same pin stays, as #456 M9 has it. With no picker picture (the pin moved some other way, such as a typed address), the old behaviour holds: the held picture with its corner line.
