# #323 R153: the left-turn bay storage field, before wiring

R153 (Ryan, 2026-10-15): the left-turn bay's storage length is site geometry, so the operator enters it. No default, no value from TA-22. Screenshots of the field at 1440 and 360 go to Ryan before it's wired.

Captured on the branch preview of `90fb84f` with `cap323f.cjs` (gate token read silently). The setup: N Broadway SB (`39.73370, -104.98753`, one-way), "Lane closure near intersection", the cross street marked on the map, Occupied side "East side · southbound traffic" (left), cross-street speed 30 mph.

| file | what |
|---|---|
| `turnbay-1440.png` | the field at 1440 px |
| `turnbay-360.png` | the field at 360 px (2x) |
| `turnbay-1440-full.png`, `turnbay-360-full.png` | the whole page at each width |

Measured: the field is empty (`value: ""`), and `scrollWidth - innerWidth` is `0` at both widths.

The field isn't wired: the backend ignores `turnBayStorageFt`, and the far side still refuses with `LEFT_LANE_FAR_SIDE_MESSAGE` (the audit 400 is in the capture log). The page's banner shows the generic left-side pointer over that message, which is a pre-existing mirror bug filed as #327.

TA-22's A reads "shown once the checks run": a far-side left plan's audit refuses until the wiring lands, so no A reaches the page yet.
