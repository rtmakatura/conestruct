# #426 rulings (mission walkthrough-round-3, #431)

Base: `issue-430-preview-refusal` at 5661100. Branch: `issue-426-mht-spelled-out`.

## Ryan's ruling (2026-10-28, on the issue)

> Ruling (Ryan, 2026-10-28): keep "MHT". Spell it out once, at its first use in the package wording, as "Method of Handling Traffic (MHT)"; after that, "MHT" alone.

Built exactly as ruled. Not widened: no other "MHT" string on the site moves (AppNav "New MHT", ResultsHero "Baseline · MHT", AppSheetMeta's "MHT" cell, the landing Hero, the sandbox meta description); they are not package wording.

## The package wording on 5661100

Two strings, both in `conestruct/site/components/GeneratorShell.tsx`:

1. `:1092` `const endRender = beginRender("MHT package ZIP");` -- the working band's object while the zip renders. The band is visible and its row is a live region (`role="status" aria-live="polite"`, `components/WorkingBand.tsx:33`), so every reader who downloads the zip meets it, sighted or not.
2. `:1390` `: "Plan generated. MHT package ready.",` -- the sr-only #193 announcement (`:1899-1901`), and only when the device counts aren't ready at the settle (`:1387-1389`); otherwise it reads "Plan generated: N devices, M types." with no package wording.

## Call 1 (R145 self-ruled): "once" lands in the working band's label

The band label becomes "Method of Handling Traffic (MHT) package ZIP"; the announcement stays "Plan generated. MHT package ready."

Reason: the band is the one package string every reader meets: it is on screen and it is spoken through its own live region. The announcement is sr-only and conditional (it carries package wording only when the counts are missing), so spelling the term out there would leave every sighted reader, and every screen-reader user whose counts arrived, with "MHT" never expanded.

Open edge, recorded: a screen-reader user whose counts are missing hears "MHT package ready" at Generate before the band spells the term out at the zip. That reader has already landed on the page's only heading, the sr-only H1 "Method of Handling Traffic plan generator" (`GeneratorShell.tsx:1668-1670` on 5661100), so the long form reaches them first, without "(MHT)". Spelling it out in both places would break "once"; not done.

## Call 2 (R145 self-ruled): the zip's filename stays `<base>_package.zip`

The issue's acceptance asks that the band, the announcement and the filename "use one name for the package". After the ruling all three say "package"; the two sentences add "MHT" as the ruling keeps it. Putting "MHT" back into the filename (`lib/download-name.ts`, `packageFilename`, #401) is not in the ruling, so it would widen it; left as #401 built it.

## Plan (5 bullets)

1. Problem: `GeneratorShell.tsx:1092` and `:1390` on 5661100 use "MHT" with no expansion anywhere in the package wording.
2. Ruling: Ryan 2026-10-28 (quoted above); calls 1-2 here.
3. Change: the band label string at `:1092` becomes "Method of Handling Traffic (MHT) package ZIP", with a comment naming the ruling; `:1390` is unchanged.
4. Rule 5 churn prediction, written before the diff:
   - `conestruct/site/components/GeneratorShell.tsx` ~+4/-1 (the string, a 3-line comment);
   - `conestruct/site/components/WorkingBand.render.test.tsx` ~+1/-1 (`:197` follows the label);
   - `conestruct/site/components/GeneratorShell.a11y-announce.test.tsx` ~+35 (one mounted flow: counts missing -> the announcement reads "Plan generated. MHT package ready."; click the zip -> the band reads the spelled-out label);
   - stated behaviour change: the band's object while the zip renders reads "Method of Handling Traffic (MHT) package ZIP" (was "MHT package ZIP"), on screen and from the band's live region; it may wrap to a second line at 390 (measured in the shots). Byte-identical: the announcement, every other band label, the filename, the zip's contents, the backend (no backend change).
5. Proof: the mounted tests above, red on 5661100 via `git archive` (red-proof.txt); vitest and tsc (tests.txt); shots of the band at 1440 and 390, before and after, with measured boxes, in `shots/`.

## Baseline, recorded

The first quiet baseline run on 5661100 (`vitest run --reporter=dot`, tail only) reported 1 file, 9 tests failed, 2640 passed, 1 skipped. Their names were not saved before the re-run: the dot reporter's tail held only the summary, and the next run (JSON reporter, to get the names) was all green, 2649 passed, 0 failed. A miss against the "save failing names before any re-run" rule; the 9 failures are unnamed and passed in the immediate re-run of the whole suite, so they read as a load flake, not a base defect. tsc clean on the base.

## Result

Churn (predicted -> actual):
- `conestruct/site/components/GeneratorShell.tsx` ~+4/-1 -> +4/-1;
- `conestruct/site/components/WorkingBand.render.test.tsx` ~+1/-1 -> +1/-1;
- `conestruct/site/components/GeneratorShell.a11y-announce.test.tsx` ~+35 -> +54 (over: the held-bundle branch of the fetch mock and its reset, 17 lines, not foreseen; the suite's bundle mock resolved at once, so the band unmounted before it could be read).

Red proof: 2 tests red on 5661100 (red-proof.txt); the #426 test's announcement assertion passes there, as ruled (the announcement doesn't change).

Shots (`shots/`, `script/shoot.mjs`; local `next dev` of this worktree, the bundle request held open, DPR 2; "before" is the same server with the one string set back to 5661100's, "after" the branch). Measured from the DOM (`text-before.json`, `text-after.json`):
- 1440: band 1440 x 41.13, row 1180 x 40.13, `.wb-object` 888.83 x 18.13, the same before and after (one line).
- 390: band 390 x 61.38 -> 390 x 79.5 (+18.12 px); `.wb-object` 231.59 x 18.13 -> 231.59 x 36.25 (1 line -> 2: "Method of Handling Traffic" / "(MHT) package ZIP"); the lock line stays at y 818.75. The band is fixed to the bottom, so while the zip renders it covers 18.12 px more of the page above it at 390; it leaves when the request closes, as before.
