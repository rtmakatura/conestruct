# Mission site-walkthrough-audit: report (#396)

Walkthrough of www.conestruct.com at `c431ceb`, 1440 and 390 px wide, on 2026-10-25. It found 21 findings. Three light-lane items fixed 9 of them: L1 copy (W6, W7, the W20 copy) and L2/L3 CSS and layout (W12, W13, W14, W15, W21). The other findings went into issues #397–#405. While building, the fix items filed #406 and #407. Nothing was parked.

## Questions for Ryan

No item parked. Four things need you:

1. **Your "Download PDF" / "Download .md" wrap wasn't reproduced.** On the live build the crew card's shared row has said "PDF" / ".md" since #329 (`28b49a8`). Every download button is one line in the committed shots at 1440, 1024 and 390. The one long-label path left, "Sign up to download …", renders one link per card, so it can't wrap, and it is reached only signed in (L1 R145-4, noted on #204). If you saw the wrap, where was it? A real iPhone, the signed-in saved view, or an older cached build? Recommendation: tell me the device and page, and I'll file it with a repro.
2. **#407: accent-blue ✓ for "selected" vs Rule 18** ("A symbol never changes hue by context", `globals.css:2266`; P9). L2 added the ✓ to the kind chip and the toggle, copying the side chip's blue ✓ that shipped with #290. Recommendation: rule that "selected" ✓ in accent blue is a named exception to Rule 18. The alternative is a different glyph for "selected", which would then change all three controls.
3. **#400: Wadsworth Blvd (route 121) prefilled as Lakewood.** This needs a sourced ruling on who the jurisdiction is for a state highway inside a city.
4. **Check one thing on a real iPhone:** the dropdowns (W13, fixed with `color-scheme: dark`) and the full-screen picker (W14). Only Playwright's WebKit was tested.

## Ready to ship

Top branch: **`mission-swa-l3-picker`**. Chain, each stacked on the one before:

| Branch | Tip | Contents |
|---|---|---|
| `issue-395-prod-check` (base, already pushed) | `c9ccb07` | #395 production-check evidence |
| `issue-396-walkthrough` | `e96e530`, `a8b831b`, `ed0edf2` | walkthrough evidence and findings |
| `mission-swa-l1-copy` | `865aa33` | L1 copy |
| `mission-swa-l2-css` | `68f2321` | L2 CSS |
| `mission-swa-l3-picker` | `b0191f8` + this report | L3 picker layout |

One `ship.ps1 -Branch mission-swa-l3-picker` run ships the whole chain. Every visible change is a design change, so a browser check at phone width follows the ship (R145).

## Filed

- #396 tracking: https://github.com/rtmakatura/conestruct/issues/396
- #397 W1–W3, untouched setup values read as the operator's: https://github.com/rtmakatura/conestruct/issues/397
- #398 W4–W5, wait cues that never end: https://github.com/rtmakatura/conestruct/issues/398
- #399 W8, the near-intersection refusal's station and no way forward: https://github.com/rtmakatura/conestruct/issues/399
- #400 W9, a state highway in a city prefilled with the city: https://github.com/rtmakatura/conestruct/issues/400
- #401 W10–W11, the download package's file count and `plan.*` names: https://github.com/rtmakatura/conestruct/issues/401
- #402 W16, W20, picker and WHERE band states, Enter key: https://github.com/rtmakatura/conestruct/issues/402
- #403 W17, negative length reported as "required": https://github.com/rtmakatura/conestruct/issues/403
- #404 W18, flagger sliders repeat the step-2 selects: https://github.com/rtmakatura/conestruct/issues/404
- #405 W19, road detection takes 22–27 s: https://github.com/rtmakatura/conestruct/issues/405
- #406 (from L1): the jurisdiction row is red on a plan decline: https://github.com/rtmakatura/conestruct/issues/406
- #407 (from L2): the accent-blue ✓ vs Rule 18: https://github.com/rtmakatura/conestruct/issues/407
- A comment on #204 (signed-in saved mode says "Sign up"): https://github.com/rtmakatura/conestruct/issues/204#issuecomment-6401931642

## Calls I made

- Light-lane fixes ride on #396 with no issue of their own (CLAUDE.md light lane, widened by Ryan's mission text to UI copy, CSS and layout).
- Findings were grouped into one issue per shared cause (W1–W3, W4–W5, W10–W11, W16+W20).
- L1 R145-1–4: "the option shown stands", not who picked it. The red stays and is filed as #406. Name the "Pick on map" control. No change to the signup labels.
- L2 R145-2–4: the kind chip's ✓ goes after the label so it lines up with its citation. W13 uses `color-scheme: dark`, not a drawn arrow, which would need a new hex. W21 is fixed in AppNav only. Folded in (R154 fold test): a pressed chip keeps its border on hover. R145-1 (the blue ✓) was withdrawn and filed as #407.
- L3 R145-1–4: the warning goes on its own row below md. The dialog keeps its 1 px border. No change to the road list (it was never clipped; findings.md corrected). The picker moves to a new `--z-modal: 65` instead of hiding the frame. Stated behaviour change: at md and up the frame is dimmed under the backdrop while the picker is open.
- The evidence corrections were folded into the item that found them: L2 corrected findings.md's signup note, L3 corrected W14's row.

## Flakes and process misses

- **L1 baseline:** the first cold vitest run had 9 failures in 1 file, and the builder re-ran before saving the names (against the session rule). Every run after was green. The names are lost.
- **The walkthrough evidence was committed before its gates** (`e96e530`). Both gates then ran on it. The diff-verifier caught two wrong line cites (fixed in `a8b831b`). The reviewer caught wrong counts and claims about measurements that weren't saved (fixed in `ed0edf2`). `e96e530`'s message still says "11 light, 10 filed" and "29 screenshots"; findings.md records the right figures (7 LIGHT, 13 FILE, 1 both; 28 PNGs).
- **Road detection (Overpass) timed out** during the L1 and L2 builds, on production too, so local runs stubbed `/api/road-bearing` and everything else ran live. See #405.
- **The first `git push` hung** on the credential prompt (known; memory), and the retry went through `gh auth git-credential`.
- **Local `mypy .`** fails on duplicate `build_index` modules under validation-artifacts. CI's plain `uv run mypy` is clean. Not a regression.

## Per item

### Walkthrough (`e96e530`, `a8b831b`, `ed0edf2`)
The change: `walkthrough/findings.md`, 28 before PNGs, `public-pages.json`, the driving scripts. No token in any file.
- diff-verifier: first `VERDICT: REPAIR` (two wrong path:line cites), then `VERDICT: PASS` on `a8b831b`, then `VERDICT: PASS` on `ed0edf2`.
- Independent reviewer: first `FAIL` (counts, unsaved measurements, the Wadsworth overclaim, the screenshot count), then `PASS` on `ed0edf2`.

### L1 copy (`865aa33`)
The change: `rail.ts:139` "Generation declined. The PLAN DECLINED notice says why." (was "See the notice below."). `rail.ts:142-143` "Set a location first: use Pick on map to find the site." (was "… or enter it manually."). `WhatBand.tsx:393` "the option shown stands" (was "the option you picked stands"). 3 source lines; 8 test files updated with the new strings.
- vitest: `Test Files 239 passed | 1 skipped (240)`, `Tests 2548 passed | 1 skipped (2549)`.
- diff-verifier: `VERDICT: PASS`.
- Independent reviewer: `PASS`.

### L2 CSS (`68f2321`)
The change: a ✓ on the pressed kind chip and toggle, held out of the label's flow (label centres move 0.00 px; ✓ contrast 5.61 / 5.19). `.a-fld` `color-scheme: dark` (WebKit 390 select 1.04:1 → 10.85:1). "STEP n OF 4" nowrap, no overflow at 360. The phone nav border is gone. The hover fold-in. 5 new tests, red on base.
- vitest: `Test Files 240 passed | 1 skipped (241)`, `Tests 2553 passed | 1 skipped (2554)`.
- diff-verifier: `VERDICT: PASS`, then `VERDICT: PASS` after repair 1.
- Independent reviewer: first `FAIL` (the toggle labels shifted about 7 px, a dev error toast in one shot, hover not like-for-like, the Rule 18 conflict self-ruled), then `PASS` after repair 1.

### L3 phone picker (`b0191f8`)
The change: below md the backdrop drops its padding, the footer wraps, Save is nowrap (44 px, one line), and the picker sits at `--z-modal: 65`. 4 new tests, red on base.
- vitest: `Test Files 241 passed | 1 skipped (242)`, `Tests 2557 passed | 1 skipped (2558)`.
- diff-verifier: `VERDICT: PASS`, then `VERDICT: PASS` after repair 1.
- Independent reviewer: first `FAIL` (the frame's 1 px rule ran through the edge-to-edge dialog; W14 wording; a dead citation; shots not like-for-like), then `FAIL` after repair 1 (the desktop frame dimming was undisclosed; stale rulings lines), then `PASS` after repair 2 (evidence only; the orchestrator recounted the 12,760 px per 1440 shot with Pillow).

## Top-branch checks (`b0191f8`, local)

- pytest: `3593 passed, 2 skipped`
- mypy (as CI runs it): `Success: no issues found in 49 source files`
- ruff: `All checks passed!`, `260 files already formatted`
- vitest: `Test Files 241 passed | 1 skipped (242)`, `Tests 2557 passed | 1 skipped (2558)`
