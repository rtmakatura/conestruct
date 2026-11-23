# #548: no pin from half a coordinate

Mission `coords-wrong-pin` (tracking #549), item #548, with #550, #551 and #552 folded in. Branch `issue-548-refuse-half-coords` on `origin/issue-549-prod-check` (`216a03b`). The plan and the Rule 5 prediction are in `checkpoint.md`; amendment 4 there is this round's, written before the diff.

Rounds 1 to 3 built a refusal rule and were never committed. Round 4 withdraws them: the four code files were put back to the base and this change was made against it. The round-3 state is kept outside the repo (`validation-artifacts-extra/coords-wrong-pin/issue-548/`: `parked-round3-on-216a03b.patch`, `round3-evidence/`).

## Ryan's ruling, round 4

Ryan, 2026-11-23, in the `/start 548` message, verbatim:

> Fourth gate round approved, with a simpler rule that replaces the refusal rule: the coordinate parser places a pin ONLY for (a) two numbers that both contain a decimal point and are in lat/long range, optionally with brackets, degree signs or N/S/E/W letters, or (b) a full degrees-minutes(-seconds) pair with a hemisphere letter on both halves. Everything else goes to the geocoder exactly as on main. No new refusals; keep only #541's out-of-range and swapped-pair lines. "39° 44.4", "39 N, 44.4" and "105° W, 39.7401" therefore search, and every address in #552 searches. Fold #552 in. Add tests for every example in #548, #550, #551 and #552.

It replaces the second, third and fourth bullets of ruling 1 in `docs/prompts/cc-prompt-coords-wrong-pin.md` ("must parse as a full latitude/longitude pair, or be refused"; the refused line; "It never goes to the geocoder") and Ryan's round-3 answers 3 and 4. Ruling 1's first bullet (no pin from half a coordinate), its fifth (accept full degrees-minutes(-seconds) pairs with hemispheres) and ruling 3 (no new hex, list every string) stand.

## What the search box does with typed text

| Typed | Result | Source |
|---|---|---|
| Two numbers that each have a decimal point, in range: every format in #541's list (`ux-coords-in-search/issue-541/rulings.md` § Formats) | the pin, as on the base | ruling (a) |
| The same inside one pair of `( )` or `[ ]` (#544) | the pin, as on the base | ruling (a), "optionally with brackets" |
| `39° 44.406' N, 104° 58.866' W`, `39°44'24"N 104°59'W`, the letters in front, either order | the pin (the "Use decimal degrees" line on the base) | ruling (b); call 3 |
| Two decimal numbers, one out of range (`139.7401, -104.9811`) | #541's range line, as on the base | "keep only #541's out-of-range and swapped-pair lines" |
| A bare decimal pair the wrong way round (`-104.9811, 39.7401`) | #541's "Did you mean" choice, as on the base | the same |
| A full degrees-minutes pair out of range (`91° 0' N, 104° 0' W`) | #541's range line (the "Use decimal degrees" line on the base) | call 4 |
| Everything else | the geocoder | "Everything else goes to the geocoder" |

"Everything else" by example, each one tested:

- Half a coordinate: `39° 44.4`, `(39° 44.4)`, `[39° 44.4]` (a pin at 39, 44.4 on the base), `39 N, 44.4`, `105° W, 39.7401`, `39°, 44.4`, `39° 44.4°`.
- Any pair with a whole number in it: `39, -105`, `39 -105`, `39 44.4`, `39.7401, -105`, `39 N, 104 W`, `90, 180`, `104°, 39` (pins or range lines on the base; call 2).
- What the base refused with "Use decimal degrees": a lone `39.7401°` or `39.7401° N`, two latitudes, two longitudes, a minus sign with a letter, degrees and minutes that are not a full lettered pair (call 1).
- Every address in #551 and #552: `E-470`, `W. 6`, `S-630-1`, `E 470 N`, `1437 N 14`, `500 N 200 W 84103` and the rest.
- Every input in #550: joined letters, other separators, lookalike degree marks.

## Calls

1. **Read from the ruling: the "Use decimal degrees" line is deleted.** The base has three coordinate lines: the two range lines with the swap choice, and "Use decimal degrees, like 39.7401, -104.9811" for text that looks like coordinates and is not a pair. "Keep only #541's out-of-range and swapped-pair lines" and "Everything else goes to the geocoder" are read together as: that third line goes, and what it answered is searched. So the `unreadable` kind is removed from `SearchCoords`, and `COORDS_UNREADABLE` from the window. This takes back #541's calls 2 and 3 and the base parser's header comment (text that looks like coordinates and is wrong never goes to the geocoder; Ryan's #541 ruling 1 itself says only "A string that parses as coordinates never goes to the geocoder") on Ryan's own words, so it is not a reversal made here. **Flagged for Ryan in the report:** the other reading keeps that line for exactly what the base gave it to. It can't be kept as a whole, though: on the base the line answers any text with a degree sign that is not a pair, which would refuse `39°` and `E-470 39°` while `39° 44.4` searches.
2. **R145 self-ruled, CHOSEN (not safety): "contain a decimal point" means a point with a digit after it.** `39.7401` and `.5` count; `39.` does not, so `39., -105.` and `W 6.` are addresses. A full stop that ends a number is punctuation more often than a decimal. Consequence, stated: a pair with a whole number on either side is no longer a pin (`39, -105`, `39.7401, -105`), per the ruling's "both".
3. **Ruling (b), with its conditions (carried from round 1's call 1; R145 self-ruled).** A degrees-minutes(-seconds) pair is read only when all of these hold; otherwise it is an address:
   - both halves carry a hemisphere letter, before or after the numbers, and the two letters name different axes;
   - each half has whole unsigned degrees with a degree sign (`°` or `º`), minutes with a minutes mark right after them (`'`, `′`, `’`), and, if it has seconds, a seconds mark right after them (`"`, `″`, `”`, or two minutes marks together);
   - with seconds, the minutes are whole (`39° 44.5' 24" N` is an address: a fraction in two places can disagree);
   - minutes and seconds are each under 60 (the units' definition, not a chosen number);
   - a comma or a space separates the halves.
   The value is (degrees x 3600 + minutes x 60 + seconds) / 3600, one division, nothing rounded or clamped; the sign comes from the letter. Both halves must be of this kind: `39° 44.406' N, 104.9811° W` (one half in decimals) is an address, since the ruling names two shapes and this is neither.
4. **R145 self-ruled: a full degrees-minutes pair out of range gets #541's range line.** `91° 0' N, 104° 0' W` was refused on the base (with the other line), so this is no new refusal, and the range line is the true one. No swap is offered: the letters name the axes, as for decimal pairs.
5. **R145 self-ruled: two decimal numbers that are not a pair are an address.** A minus sign with a letter (`-39.7401 S, 104.9811 W`) and two letters on one axis (`39.7401 N, 40.1 N`) got the deleted line on the base. They are searched now (call 1).
6. **Round 3's answers, under the new rule.**
   - Answer 2 (`39 N`, `500 N 200 W`, `39N 104W` stay addresses): holds, and now for every text of whole numbers and letters.
   - Answer 3 (refusing `39.7401° -104.9811` and `39.7401 N -104.9811` "is fine"): not used. Both have two decimal numbers and are the pin they are on the base.
   - Answer 4 (refuse `39°, 44.4`; `39.7401°, -104.9811` still pins): `39°, 44.4` is searched, not refused; `39.7401°, -104.9811` still pins.
   - "Real road names like E-470 must always search": holds with no exception (`E-470 6'` and `E-470 39°` are searched too, #552 finding 3).
7. **#550, #551, #552 folded in.** Every input the three issues name has a parser test under a block named for its issue. #552 finding 3's slow pattern: the decimal pair pattern no longer backtracks over a digit run (a number needs its point), and the test reads two 30,000-digit texts in under a second (4 s on the base for one). The degrees-minutes pattern is slow on a long digit run after a degree sign instead (`39° ` and 30,000 digits: about 650 ms, 0 ms on the base; found by the round-4 reviewer, no wrong answer); filed as #553, not fixed here.
8. **Recorded: what can still pin away from what was meant.** The parser places a pin only from two decimal numbers or a full lettered pair, as typed. Text sent to the geocoder can still come back as a place (`39° 44.4` may match something); that pin is the geocoder's answer for the text shown in the box, and the coarse-match notice (#543) applies as for any address. `39.7401 44.4` (two decimals, a space) is still the pin 39.7401, 44.4, as on the base.
9. **R145 self-ruled: Rule 3 is not in play.** The parser turns typed text into a latitude and a longitude in the browser; no backend value is mirrored.
10. **No browser walk in this round.** Nothing visible is added or changed; one line can no longer appear. The mounted tests (Rule 11) drive the real window at both geocode senders. The round-2 walk (`walk.md`, `walk-script/`, `shots/`) showed the reworded refusal line, which does not exist now; it was moved out of this folder to `validation-artifacts-extra/coords-wrong-pin/issue-548/round3-evidence/`. The production check after the ship types `39° 44.4` on the real site.

## Base against round 4, over a generated corpus

A throwaway test (not committed) read 32,515,392 texts with the base parser and with this one: 1,344 single halves (7 prefixes x 16 numbers x 12 suffixes) and every pair of them with 6 separators and 3 bracketings. Checked for every text: (1) an address on the base is an address now; (2) a point now is the same point on the base or was refused there; (3) a range line now is the same on the base or was refused there; (4) a pair the base read that holds two decimal numbers keeps its answer. 0 failures.

| Base | Round 4 | Texts |
|---|---|---|
| address | address | 10,619,287 |
| "Use decimal degrees" | address | 21,532,358 |
| point | address | 93,180 |
| range line | address | 213,141 |
| "Use decimal degrees" | point | 1,392 |
| "Use decimal degrees" | range line | 7,134 |
| point | point | 31,512 |
| range line | range line | 17,388 |

## Churn: predicted against actual

Against the base `216a03b`; predicted in `checkpoint.md`, amendment 4.

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/lib/search-coords.ts` | +75 / -55 | +92 / -44 |
| `conestruct/site/lib/search-coords.test.ts` | +190 / -30 | +267 / -26 |
| `conestruct/site/components/LocationPickerModal.tsx` | +3 / -8 | +6 / -8 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +75 / -8 | +98 / -3 |
| `../report.md` (addendum) | +4 / -0 | +4 / -0 |
| this folder | rewritten | rewritten |

Rule 5 misses, recorded: the parser tests are 77 added lines over (one line per input, and the three issues name more inputs than estimated); the mounted tests 23 over (15 inputs at both senders); the parser 17 added lines over (the header comment lists both shapes). The same files as predicted, none added. Behaviour changes are (A) to (D) in amendment 4 and nothing else.

Existing tests changed, each a stated behaviour change:

- `lib/search-coords.test.ts`: the "can't be read" block is gone (D; seven of its eight inputs are asserted in the #548 blocks, one as a point and six as addresses; the eighth, `39° 44.4' N, 104° 58.9' W`, a point now, has no case of its own, and the ruling's `39° 44.406' N, 104° 58.866' W` covers its shape). Whole-number cases now carry a decimal point where they test range (`90.0, 180.0`, `95.5 N, 104.5 W`, `90.0001, 0.0`) and are asserted as addresses in the #548 (a) block where they don't (B). `(39.7401°)` moved from the bracket test's refusals to the addresses (D).
- `components/LocationPickerModal.coords-bar.test.tsx`: #541's "degrees and minutes are refused with a line" becomes "#548: a full degrees, minutes and seconds pair places the pin" for the same text (C).

## Tests

- Red proof: `red-proof.txt`. On the base, 99 of the 297 tests in the two files fail, the bare form among them (`expected { kind: 'point', lat: 39, lng: 44.4 } to deeply equal { kind: 'address' }`).
- After the change: `lib/search-coords.test.ts` and `components/LocationPickerModal.coords-bar.test.tsx`, 297 passed.
- `npx tsc --noEmit`: clean. `next lint` on the four changed files: 0 errors, 1 warning, not from this change (`react-hooks/exhaustive-deps` on `restoreFallbackRef`, `LocationPickerModal.tsx`).
- `python scripts/cosmetic_lane_check.py`: OUT OF LANE (`lib/search-coords.ts` and its test), so the diff-verifier and the independent reviewer both run.
