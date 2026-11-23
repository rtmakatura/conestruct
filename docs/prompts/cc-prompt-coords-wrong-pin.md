# cc-prompt: refuse half coordinates (no wrong pins), and remove the dead bearing note

Ryan ruled this on 2026-11-23, after `ux-map-window-tidy` shipped.

One small mission, two items. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issues yourself (R146), and build on `issue-546-prod-check` so its evidence ships with this.

## Rulings (quote verbatim into rulings.md)

1. **No pin from half a coordinate.**
   - Today `(39° 44.4)` and its bare form `39° 44.4` place a pin at 39, 44.4. That drops a pin in the wrong place without a warning, which could put a plan on the wrong street.
   - Any input that contains a degree sign, a minutes or seconds mark, or a hemisphere letter must parse as a full latitude/longitude pair, or be refused.
   - A refused input shows #541's one floating line, e.g. "That looks like part of a coordinate. Enter latitude and longitude, like 39.7401, -104.9811." Nothing moves (0 px).
   - It never goes to the geocoder, and it never places a pin.
   - Accept full degrees-minutes(-seconds) pairs with hemispheres (e.g. `39° 44.406' N, 104° 58.866' W`) if the parser can do so honestly. Otherwise refuse them with the same line, and record which you chose.
   - Every format #541 and #544 accept keeps working. Add tests for each refused form and each accepted form. The bare-form test must fail on the old code.
2. **The dead bearing note (#547).** Delete the bearing-note state, its empty slot and any code that can no longer run (it has had no setter since #507). Record what was removed. Nothing visible changes.
3. Inter only, tokens only, no new hex. List every new string with its source. Unslop.

## Evidence

Capture at 1440, 1198x930 and 390:
- the refused line for `39° 44.4` and `(39° 44.4)`, with 0 geocode requests and no pin
- one accepted full pair

Run axe and the 0 px size check, and commit the crops.
