# #280: "Freeway / interstate" at the phone width (Phase 4 branch 7, R137 Q5), measured first

**Outcome: not shortened. R145 self-ruled; #280 closed as ruled-against, per its own acceptance
("If not shortened: the reason recorded and this issue closed as ruled-against").**

## Consumers (#280's first bullet)

The wire carries the key `freeway`; the label is presentation only.

| Where | File |
|---|---|
| WHAT road-type select and the setup box value | `conestruct/site/lib/scenarios/what-cells.ts:119-124` (`LABEL`) |
| Fact lines and the revision panel | `conestruct/site/lib/scenarios/band-facts.ts:95-104` (`roadTypeLabel`), `components/bands/RevisionBand.tsx:127` |
| Detected rows | `conestruct/site/lib/road-detection/detected-rows.ts:39-44` |
| Handoff notes | `conestruct/site/components/bands/HandoffNotes.tsx:42-47` |
| Gated kinds' forms | `LaneClosureForm.tsx:19`, `MobileOpMultilaneForm.tsx:17`, `WorkBeyondShoulderForm.tsx:22` |

**No deliverable carries it.** The string appears nowhere under `src/` (the backend that renders
every deliverable). Where a deliverable names the road, it prints the MUTCD Table 6B-1 category
from `ROAD_TYPE_DISPLAY` (`src/rules/validators.py:305-315`, "the crew header and the quote header
read this": `"freeway": "Freeway"`), a different enum. No legally meaningful term is at stake.

## Re-measured (Rule 12; the 332.8 / 236 / 128 px figures were retired with the ledger)

Production `72a602a`, shoulder on N Broadway SB with road type set to freeway, at WHAT and after
Generate (`probe280.cjs`, `measure/measure.json`). The label renders in two places:

| Where | 320 | 360 | 1440 |
|---|---|---|---|
| WHAT select (`select.a-fld`) | 126.2 px in 232: fits | 126.2 in 272: fits | 126.2 in 237: fits |
| Setup box value (`span.a-setup-v`) | **2 lines** ("Freeway /" "interstate") | 1 line, no headroom (126.2 in 126) | 1 line |

What the wrap costs, with the value's text swapped in place for each candidate:

| Candidate | Width | Setup box at 320 | at 360 | at 1440 |
|---|---|---|---|---|
| Freeway / interstate | 126.2 px | **335.1** (cell 78.1) | 321 | 129 |
| Freeway/interstate | 117.9 | 321 (cell 64) | 321 | 129 |
| Interstate | 60.2 | 321 | 321 | 129 |
| Freeway | 54.0 | 321 | 321 | 129 |

Screenshot: `measure/setup-320.png` (the wrap), `setup-360.png`, `setup-1440.png`.

## R145 self-ruled: not shortened

- **The cost is 14 px at the 320 floor, and nothing at the 360 test size or the desk.** The wrap
  is clean, at the label's own "/", and clips nothing. #280's correction comment (s2-triage-2)
  already warned against shortening "a domain label for a saving that was not there"; this is
  the saving that is there, and it is one line at the floor.
- **"interstate" does work in the picker:** it's how an operator finds an interstate among the
  four road types. "Freeway" alone would match the deliverables' spelling, but the deliverables
  print a different enum (the Table 6B-1 category), so the two are already two names for two
  things.
- **360 has no headroom.** A device whose fallback font is a hair wider wraps there too, for the
  same 14 px and the same clean break. Recorded, not acted on.

#279, which #280 was sequenced after, closed 2026-09-18.
