# #460 evidence: the local walk

**Setup.** `next dev` on the issue-460 worktree (port 3460) and the local backend (port 8460), both started by `script/launch.cjs`, copied from #456's. Overpass is **stubbed** (`script/serve_stub.py`, replaying ux-group3-where's recorded answers; no live call). `/api/road-bearing` is stubbed in the browser from the same fixture. The walk is headless Chromium at DPR 1 (`script/walk460.mjs`). Results: `walk/<size>.json`, `walk/summary.txt`, and screenshots `walk/<size>-NN-<step>.png`. The walk ran on the working tree that is committed as this branch's fix commit.

**What each size walks.** (1) Pin E Colfax in the picker, then Save & Close with every aerial answer held 3 s. (2) Scroll to the page's end, then Edit on map and Save & Close again. (3) Scroll to y=200, then Edit on map and Cancel.

`band-nav` is the open band's top minus the nav's bottom; the band's landing target is `--nav-h + 8`.

| size | after Save (02/03) | aerial in view | stand-in while not drawn | re-save from the end (05) | Cancel (06) |
|---|---|---|---|---|---|
| 1198x930 | y 99, band-nav **8**, heading in view | whole, 560/560 px | yes; corner line "Drawing the corridor…" | y 99 (was 343 = max), band-nav 8 | y 200, unchanged |
| 1440x900 | y 99, band-nav **8**, heading in view | whole, 560/560 px | yes; corner line | y 99 (was 373 = max), band-nav 8 | y 200, unchanged |
| 390x844 | y 112, band-nav **8**, heading in view | whole strip, 150/150 px | yes; corner line | y 112 (was 690 = max), band-nav 8 | y 200, unchanged |

- **The frame's trail after the first Save** (MutationObserver, every size) goes stand-in → aerial. The frame was never empty and never showed the centred "Drawing the corridor…" note: 1198 `[stand-in @8283 ms, aerial @13472 ms]`, and the same shape at 1440 and 390 (`walk/summary.txt`).
- **The reported state is gone.** Before this fix, #460's body measured the page landing at its maximum scroll (1198x930: y=324 = max, 440 of 560 px of the aerial on screen). After it, the same Save lands at y=99 with all 560 px on screen.
- **Focus.** After Save it is on the open band's wrapper (`DIV`, tabIndex -1, rule 33). After Cancel it returns to `where-open-picker`, the opener (#193). Neither scrolls the page.
- **Page errors:** 0 at every size.

**The picture.** The stand-in is the picker's own map at Save, so it is framed as the picker framed it (its zoom, cropped to the frame by `object-fit: cover`). The DOM pin marker isn't on it, because it is not part of the map's canvas. Once the aerial answers it replaces the stand-in (`walk/*-02-*` vs `*-03-*`).
