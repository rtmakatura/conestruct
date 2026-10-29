# #402 (round 4): the picker's side sentence

Mission `walkthrough-round-4` (tracking #433). Branch `issue-402-side-sentence`, stacked on
`issue-425-check-failed` (74cb1b5). Line cites are on 74cb1b5 unless marked.

Baseline on 74cb1b5 (quiet): vitest 253 files passed, 1 skipped; 2667 tests passed, 1 skipped.
pytest 3612 passed, 2 skipped.

## The ruling

Ryan, 2026-10-29, ruling 2 (`validation-artifacts/committed/missions/walkthrough-round-3/ryan-rulings.md:8`):

> #402 side sentence: "Save, then say which side is occupied." in the picker only.

The same file, `:9`: "This replaces the #290 sentence ("Say which side is occupied to lay out the work"), but only in
the picker: the map overlay and the panel. Copy elsewhere stays as it is." It answers the question
round 3 parked (`walkthrough-round-3/402/rulings.md`, call 3) and supersedes, in the picker only,
Ryan's #290 pre-side ruling of 2026-09-25 (`validation-artifacts/committed/issue-290-pin-work/rulings.md:243-257`).

## Plan (written before the diff)

1. **Problem.** `const SIDE_SENTENCE = "Say which side is occupied to lay out the work";`
   (`conestruct/site/components/LocationPickerModal.tsx:2291`) is drawn on the map while a pin waits
   on its side (`:1684-1690`, `data-testid="picker-side-sentence"`, no period) and in the panel for
   status "side" (`:2377-2378`, `${SIDE_SENTENCE}.`). The picker has no side control (#290 moved it to
   the band), so the sentence asks for something the picker can't take.
2. **Rulings.** Ryan's ruling 2 above. Who else carries the #290 words: the rail's own constant
   `SIDE_BLOCKER` (`lib/scenarios/rail.ts:151`), read by the move ledger's side row and the Generate
   blocker (the band, where the side control lives), and by the band's aerial, which renders it as its
   note before the side is chosen (`components/bands/BandAerial.tsx:148`, `note = SIDE_BLOCKER`; its
   header comment, `:15-16`, quotes the same words).
   `SIDE_SENTENCE` is local to the picker (not exported), so changing it touches no other surface.
3. **Change.** `SIDE_SENTENCE` becomes Ryan's string verbatim, with its period:
   "Save, then say which side is occupied."; the panel draws it as is (the `.` the panel appended
   goes). The comments that quote the #290 sentence in the picker say ruling 2 supersedes it there.
   `SIDE_BLOCKER`, its tests and BandAerial stay as they are.
4. **Churn prediction (Rule 5).**
   - `components/LocationPickerModal.tsx`: ~+8/-5 (the constant, the panel line, two comments).
   - `components/LocationPickerModal.coverage.test.tsx`: ~+4/-4 (two expectations move to the new
     sentence, with a note that ruling 2 supersedes the #290 words there).
   - `components/LocationPickerModal.side-sentence.test.tsx`, new: ~+110. Amended before the diff
     (was one new test inside the coverage file): the map overlay renders only with a Mapbox token
     (`tokenAvailable`, LocationPickerModal.tsx:1661), and the coverage file runs without one, so the
     overlay test needs its own file with a stubbed `mapbox-gl` module (`vi.mock` is file-wide).
   - Byte-identical: `lib/scenarios/rail.ts` (`SIDE_BLOCKER`), `rail.test.ts`, `MoveLedger.form.test.tsx`,
     `GeneratorShell.kind-confirm.test.tsx`, `BandAerial.tsx`, every other picker state and line, the
     backend, every payload.
   - Stated behaviour change: with a pin dropped and the side not yet answered, the picker's map
     overlay reads "SAVE, THEN SAY WHICH SIDE IS OCCUPIED." (uppercase by its class; was
     "SAY WHICH SIDE IS OCCUPIED TO LAY OUT THE WORK", no period) and the panel note reads
     "SAVE, THEN SAY WHICH SIDE IS OCCUPIED." (was "... TO LAY OUT THE WORK."). The band's side row and
     Generate blocker keep "Say which side is occupied to lay out the work".
5. **Proof.** A mounted `LocationPickerModal` test (Rule 11), with a token and a stubbed map, opens
   on a pinned plan whose geometry answers "side_not_confirmed" and reads the overlay (`picker-side-sentence`) and the panel (`picker-corridor-note`)
   text; red on 74cb1b5 from a `git archive` (red-proof.txt). vitest and tsc (tests.txt). Shots
   before/after at 1440 and 390 of the picker with a pin dropped, overlay and panel (shots/,
   script/shoot.mjs).

## Calls

1. **The period on the map too (R145 self-ruled).** Ryan quoted the sentence with its period, and
   one constant feeds both places (the #290 comment's "one string for the map and the panel"), so
   both show it verbatim. The overlay had no period before; it gains one. The panel's appended `.`
   goes, so the panel doesn't read "occupied..".
2. **The #290 wording elsewhere is not moved (Ryan's ruling 2: "in the picker only").** `SIDE_BLOCKER`
   (`rail.ts:151`) and its readers keep "Say which side is occupied to lay out the work"; the comment
   on `SIDE_SENTENCE` that said "The same words as the rail's SIDE_BLOCKER" now says they differ, and
   why. The BandAerial comment describes the band, which keeps the #290 sentence, so it stays.

## Outcome

- **Churn (predicted -> actual):** LocationPickerModal.tsx ~+8/-5 -> +12/-5 (over: the constant's
  comment states the ruling and why the band's string differs); LocationPickerModal.coverage.test.tsx
  ~+4/-4 -> +4/-2; LocationPickerModal.side-sentence.test.tsx (new, amended before the diff)
  ~+110 -> +128. Every byte-identical file in the prediction is unchanged.
- **Measured (local next dev, DPR 2; text-before.json / text-after.json):** overlay 399.38 x 32 ->
  334.09 x 32 at 1440, 194 x 72 -> 194 x 52 at 390 (three lines -> two); the panel note 407 x 23 at
  1440 and 340 x 23 at 390, unchanged. Colours unchanged (overlay white on rgba(0,0,0,0.7); panel
  rgb(147, 160, 176)).
- **Tests:** red-proof.txt (1 red on 74cb1b5), tests.txt (vitest 2668 passed, 1 skipped; tsc clean).
