# #411 and #420 production check (mission lane-doubt, tracking #421)

- Served sha checked: `c8a973baba135554549cd075c393fe62afde3905`. The backend `/healthz` returns it, and the worktree HEAD (`origin/main`) is the same commit.
- Checked on 2026-10-27 against https://www.conestruct.com/sandbox, headless Chromium, DPR 2, at 1440x900 and 390x844.
- Real interaction throughout, with the live road lookup and no stubs or injected DOM. The only script added to the page is axe-core (`conestruct/site/node_modules/axe-core/axe.min.js`), to audit each state. Three sites:
  - **Clarkson**: a pin typed in the coordinate boxes at 39.72547, −104.97757, on Clarkson Street in Denver (OSM way 44932808, `oneway=yes`, `lanes=1`). The road facts leave shoulder work as the only kind, so the live backend proposes it (`src/rules/kind_proposal.py`). The operator picks Clarkson Street and the first side option. The proposed chip is shot unpicked, then picked, then the plan is confirmed and the Hours and Speed reduction rows are read.
  - **Colfax**: "1600 E Colfax Ave, Denver". The operator picks the Colfax road, the first side option and the "Shoulder work" chip, types a length of 800 and presses Enter (marker "✓ yours"). Then they press the near-intersection chip. No crossing is marked, so the side control shows its ⚠ line. At 1440 the address search's live lookup said "Detection service unavailable" on three runs, even after the script's four "Re-detect roads" retries (`prod-1440-colfax-address-lookup-unavailable.png`; its error is kept in `text-prod.json` under `1440.colfax`). So at 1440 the same steps ran on the same Colfax block as a typed pin, 39.74003, −104.96555 (`colfaxPin`, the coordinates #411's own probe used). The picker read "2 detected · East Colfax Avenue".
  - **Wadsworth**: "Wadsworth Blvd & W 10th Ave, Lakewood, CO", the site #420 used. The operator picks Wadsworth Boulevard northbound, the first side option and the near-intersection chip, types a length of 500 (as #397's and #420's scripts did) and confirms. The lane count is then changed from 2 to 3 per side in its own select.
- Colours are computed styles. Contrast is measured against the painted ground (the alpha-composited ancestor backgrounds). Tokens read live: `--pass` #4fd787, `--act` #34a9e8, `--warn` #f4c020, `--none` = `--ink-faint` #93a0b0.
- The script is `prodcheck421.mjs`. It reads the gate token from `conestruct/site/.env.local` at run time, sends it as `x-conestruct-gate`, and never prints or writes it. The raw text, colours and axe results of every state are in `text-prod.json`.

| # | Claim | Width | Live reading | Result |
|---|---|---|---|---|
| 1 | #411: Hours on its default reads "default" alone, no ✓ | 1440 | Marker "default", class `is-plain`, 0 glyph spans; ink rgb(147, 160, 176) on rgb(16, 28, 41), 6.47:1 | PASS |
| 1 | same | 390 | same | PASS |
| 2 | #411: Speed reduction on its default reads "default" alone | 1440 | Marker "default", `is-plain`, 0 glyph spans, 6.47:1 | PASS |
| 2 | same | 390 | same | PASS |
| 3 | #411: the unpicked proposed chip reads "⚠ proposed", ⚠ amber | 1440 | Chip "Shoulder work TA-3/TA-5 · S-630-1 · ⚠ proposed"; ⚠ `sym-warn` rgb(244, 192, 32), 10.17:1. The note reads "⚠ proposed: Only shoulder work fits this road: it is one-way, so a flagger has no opposing traffic to hold; and it has one lane in total. Pick it to use it.", its ⚠ also `sym-warn`, 10.17:1. The word "proposed" keeps the line's faint ink, rgb(147, 160, 176), 6.47:1 (as #411 states: the glyph takes the hue) | PASS |
| 3 | same | 390 | same strings and values | PASS |
| 4 | #411: once picked, only ● and the citation show, and the note is gone | 1440 | Chip text "Shoulder work TA-3/TA-5 · S-630-1", `aria-pressed="true"`, the ● drawn beside the name (CSS, so not in the text; see the shot); `kind-proposed-mark` count 0, `kind-proposal-note` count 0 | PASS |
| 4 | same | 390 | same | PASS |
| 5 | #411: marker ✓ green (`--pass`), its word faint | 1440 | Length marker "✓ yours" (`is-ok`): ✓ `sym-pass` rgb(79, 215, 135), 9.35:1; word rgb(147, 160, 176), 6.47:1 | PASS |
| 5 | same | 390 | same | PASS |
| 6 | #411: marker i blue (`--act`) | 1440 | No reachable live row shows an "i" marker on a working run (#411 measured it on an injected copy for the same reason). Not injected here | N/A |
| 6 | same | 390 | same | N/A |
| 7 | #411: a guess-tone marker's word is amber | 1440 | Road type "⚠ from the road" (`is-guess`): ⚠ `sym-warn` rgb(244, 192, 32) and word rgb(244, 192, 32), both 10.17:1 | PASS |
| 7 | same | 390 | same | PASS |
| 8a | #411: the side control's ⚠ line (crossing not marked) is amber | 1440 | "⚠ Mark the cross street on the map to lay out the sides."; ⚠ `sym-warn` rgb(244, 192, 32), 10.17:1; the line's words rgb(147, 160, 176), 6.47:1 | PASS |
| 8a | same | 390 | same | PASS |
| 8b | #411: the side control's other ⚠ line (`side-control-stale`) is amber | 1440 | Needs a stored left side that the backend no longer builds, which a fresh sandbox session can't hold. Count 0 on every run | N/A |
| 8b | same | 390 | same | N/A |
| 9 | #420: Wadsworth WHAT header counts the row ⚠ marks plus the lane doubt | 1440 | "3 guesses marked ⚠ · change any that are wrong"; the row marks are "⚠ from the road" ×2, plus the doubt line | PASS |
| 9 | same | 390 | same | PASS |
| 10 | #420: editing the lane count drops N by one | 1440 | Lanes 2 → 3 per side: header "2 guesses marked ⚠ · change any that are wrong"; row marks still "⚠ from the road" ×2; Lanes marker "✓ yours", details "your change · operator-set from here on", and the doubt line is gone | PASS |
| 10 | same | 390 | same | PASS |
| 11 | #420: the Lanes row still reads plain "default" with the amber "⚠ not confirmed · …" line in its details | 1440 | Marker "default" (`is-plain`, 0 glyph spans, 6.47:1). Details: "default · set the real count", "Lane width · default · …", "⚠ not confirmed · the map reads 4 per side, but turn lanes can inflate counts near an intersection" (`tr-prov is-amber`, rgb(244, 192, 32) on rgb(34, 52, 74), 7.48:1) | PASS |
| 11 | same | 390 | same | PASS |
| 12 | axe: no violations on any state | 1440 | 0 violations in all 7 states: Clarkson unpicked proposal, picked proposal, step 2; Colfax typed length, crossing not marked; Wadsworth untouched, lanes edited | PASS |
| 12 | same | 390 | same, 0 in all 7 | PASS |

**Counts: 22 PASS, 0 FAIL, 4 N/A.**

All measured contrasts are at or above the AA 4.5:1 floor. The lowest is 6.47:1, on the faint words.

Note on a degraded run (not scored): one 390 Clarkson run (since replaced in `text-prod.json` by a full re-run) showed no proposal, no Carriageway row, and the Jurisdiction marker as "i details", with the header at "3 guesses". The picker had found the road, so a later answer had evidently not come back. With no geometry answer there's no proposal, and that's the honest absence. It isn't #411's or #420's change, and it's recorded here as found. The "i details" marker appeared only on that run, so its hue wasn't measured.

Shots (25 files), each at 1440 and 390: `prod-<width>-b1-{hours,reduction}.png`, `prod-<width>-b2-kind-proposed-chip{,-pressed}.png`, `prod-<width>-b2-kind-proposal-note.png`, `prod-<width>-b2-kind-block-pressed.png`, `prod-<width>-b3-length-typed-marker-check.png`, `prod-<width>-b4-side-warn-not-marked.png`, `prod-<width>-c1-what-header-untouched.png`, `prod-<width>-c2-lanes-details.png`, `prod-<width>-c3-what-header-lanes-edited.png`, `prod-<width>-c3-lanes-details-edited.png`; plus `prod-1440-colfax-address-lookup-unavailable.png`.
