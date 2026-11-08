# #448 rulings: the NEEDS YOU explanation when the map draws no line

Mission `ux-queue-2-6` (tracking #458), item #448. Branch `issue-448-no-line-text` on `issue-457-undo-links` `f5cec7d`.

## Ryan's ruling (cc-queue-ux.md item 4), verbatim

> - When a NEEDS YOU map draws no line for its subject, the sentence says what's true, e.g. "The scan found an intersection 73.2 ft from the work, but the map couldn't draw it. Check it at street level."
> - When the line is drawn, the sentence stays as it is.
> - Apply this to every question kind, and list each string with its source (Rule 10).

## R145 self-ruled

1. **Who knows "drawn".** The backend decides it and sends `x-map-subject: drawn | none` (`src/api/render_api.py:2113`); `useNeedsYouMap` reads it (`lib/needs-you-map.ts`). The card relays that header and computes no geometry (Rule 3). The explanation follows exactly what the map's key shows: the key names the subject's line only when `drawn`.
2. **Four map states, three sentences.** `drawn`: today's sentence, unchanged (ruling bullet 2). `none` (the backend answered and drew no line): Ryan's form, "The scan found … but the map couldn't draw it. Check it at street level." followed by what the plan did. `loading` (no picture yet) and `failed` (the image didn't load, or no map at all): "The scan found …" followed by what the plan did, with no claim about the picture. Reason for the last: while loading the map hasn't drawn or failed yet, so neither "shows" nor "couldn't draw" is true yet (Rule 10); on failure the card already says "The map didn't load. Your answer still works without it." (#447 ruling 7) and hides the street-level link, so pointing at street level from the sentence would point at a link that isn't there.
3. **What the plan did stays word for word.** The tail after the first clause (devices added, "The plan adds no devices for it", the TCS line) is today's text, so only the claim about the picture changes. In the `none` sentence the device clause becomes its own sentence ("We added 4 devices to protect people walking.") because "but the map couldn't draw it. Check it at street level." comes between.
4. **Pronoun.** "it" for the four singular kinds, "them" for sidewalks (`FLAG_WORDS.plural`), in the two new clauses only.
5. **0 px (P1).** The three sentences sit in one grid cell; the ones not in force are `visibility: hidden` and `aria-hidden`, so the paragraph is always as tall as the longest and the map and choices don't move when the map answers or fails. Cost: in the drawn state the paragraph can carry up to one blank line under the sentence. Recorded for Ryan.
6. **The strings and their sources** (ruling bullet 3). Built in `questionWords()`, `conestruct/site/lib/needs-you-items.ts`; pinned for every kind in `NeedsYouQuestion.test.tsx` ("#448: every kind's three sentences").
   - Distance: `nearest_distance_ft` from the scan bucket (`site_scan.buckets.*`), or "near the work" when the bucket has none.
   - Noun and pronoun: `FLAG_WORDS[flag].noun` / `.plural` (sidewalks / them; an intersection, a highway interchange, a bike lane, a school zone / it).
   - Devices: `devices_added` on the site-adjustment record; `purpose` and `tcs` from `FLAG_WORDS`. No record: no device words (Rule 10).
   - Which sentence: `x-map-subject` from `POST /render/needs-you-map` (`src/api/render_api.py:2113`), or the image's failure (#447 ruling 7).

   | Map state | Sentence (the 4-device / 0-device / no-record tail is today's) |
   |---|---|
   | drawn | `The map shows <noun> <ft> ft from the work` + today's tail, unchanged |
   | none | `The scan found <noun> <ft> ft from the work, but the map couldn't draw <it>. Check <it> at street level.` + ` We added <n> device(s) <purpose>. Your answer decides whether they stay.` / ` The plan adds no devices for it[; <tcs>].` / nothing |
   | loading, failed, no map | `The scan found <noun> <ft> ft from the work` + today's tail |

7. **Lane.** Whatever `scripts/cosmetic_lane_check.py` says; reported as its first line.
