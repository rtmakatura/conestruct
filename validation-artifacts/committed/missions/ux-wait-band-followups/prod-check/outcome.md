# Production check: mission ux-wait-band-followups (#478) on 85e339a

Date: 2026-11-09.  `/healthz` sha = `85e339ac9102d204b4da0f618f9f40357ea3f2be` = `origin/main`.
Site: https://www.conestruct.com/sandbox, headless Chromium (Playwright), DPR 1, pin 1600 E Colfax Ave, Denver (live road data,
road picked: "East Colfax Avenue, eastbound" at every width).  The only things done on the page were loading it and one Generate per run.
The gate header went only to www.conestruct.com, through `scripts/gate.cjs`.

| Item | Result |
|---|---|
| #476 permanent check runs on prod | **PASS**: CLS 0 at all three widths, with both HOLD_MS=0 and HOLD_MS=4000; outline check PASS; 0 outlines left; no WARN line |
| #477 Generate wait | **PASS**: 14 s line byte-equal at all three widths; no bar; no "Step N of M"; the map frame shows the stand-in aerial (not blank) before the map loads |
| #469 Details on the WHERE kind question | **PASS**: band height is the same with Details open and closed at all three widths (spread 0.0 px); panel on top and in view; Esc returns focus to the toggle |
| axe / 44 px / console | **PASS**: axe 0 violations at all three widths; under 44 px: only the WHERE aerial's zoom `+`/`−` (32x32) at 1440 and 1198, the known rule-133 exception (#469 evidence.md, "axe and 44 px"); 0 in the results; console errors 0, page errors 0 |

## 1. Permanent check (`scripts/verify-generate-cls.mjs`, unmodified)

Run as `SITE=https://www.conestruct.com HOLD_MS=<0|4000> node --require script/disposed-guard.cjs scripts/verify-generate-cls.mjs`.
Logs: `logs/verify-generate-cls-hold0.txt`, `logs/verify-generate-cls-hold4000.txt`.

| Width | HOLD_MS=0 CLS | HOLD_MS=4000 CLS | Outline check (4000) | NEEDS YOU delta vs reserve | Outlines left |
|---|---|---|---|---|---|
| 1440x900 | 0 | 0 | PASS (8 px) | +91 px (sections below moved +89 px, heights 0) | 0 / 0 |
| 1198x930 | 0 | 0 | PASS | +91 px (+89 px) | 0 / 0 |
| 390x844 | 0 | 0 | PASS | +53 px (+51 px) | 0 / 0 |

Strip at settle at every width: "⚠ Plan ready. Answer 3 quick questions before you send it."  Live NEEDS YOU had **3 questions**
(1 card on screen at a time).  So it came in taller than the one-question reserve and grew downward (#477 answer 1): the reported
delta is not a failure, and the top-delta checks apply only when NEEDS YOU comes in at its reserve.  Every fixed-height
section (map, Setup, Your plan, references) matched its outline within 0 px.

**Unexpected (harness, not the site).** Without the guard, both first runs crashed: HOLD_MS=0 at the first width, HOLD_MS=4000 at
390.  A gated request (`/api/needs-you-map`, routed through `gate.cjs` `fetchGated`) was still in flight when the script closed
its browser.  `route.fetch` then rejected with "Request context disposed" in a route handler that nothing awaits, so Node exited
on the unhandled rejection.  **Playwright's error text includes a call log that lists the request headers, the gate header among them**,
so the crash printed the token to stderr.  The two logs went only to the scratchpad and were deleted.  No such text is in this folder.
The reruns used `script/disposed-guard.cjs`, a `--require` preload that ignores only that rejection, prints its first line and
fails on any other rejection.  It fired once per run, after a width's results were already taken, so the measurements are unaffected.
Recommend a follow-up: `fetchGated` should catch a disposed context, and `gate.cjs` should never let a call log reach output.

## 2. #477 on prod (`script/walk-prod.mjs`, log `logs/walk-prod.txt`, per-width JSON `walk/`)

In the browser, the walk held the audit answer for 16 s from the press.  The real answer came back in 3587 / 3698 / 446 ms (1440 / 1198 / 390).
It also held `/api/needs-you-map` for 4 s, so the frame could be read before the map loads.

- At 1.2 s: the strip reads "Checking the road and laying out the taper, buffer and devices…".  Progress bars: 0.  "Step N of M" anywhere on the page: none.
- At 14.5 s: `.wait-line` class is `status-bar wait-line caution is-slow`, and its text is byte-equal to
  "This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." (true at all three).  Bars 0, no "Step N of M".
  Crops: `crops/<w>x<h>-14s-strip.png`; the 1.2 s strip is in `crops/<w>x<h>-wait-strip-1s.png`.
- At the swap (outline gone, map still held), the NEEDS YOU map frame (423 px tall at 1440/1198, 270 at 390) holds the stand-in:
  the WHERE aerial `<img>`, loaded (naturalWidth > 0), opacity 0.35.  The grey-block fallback is not used, and the map image is not there yet.
  Crops: `crops/<w>x<h>-frame-standin.png` (shows the Colfax aerial, dimmed).
- After the settle: the map image is present, the stand-in is gone, and 0 outlines are left.
- NEEDS YOU live: 3 questions (1 card shown).  Its outline started at the same top as the settled section (149 px at 1440/1198, 162 at 390).
  Outline height was 934 → 1025 px settled at 1440/1198 and 1082 → 1135 px at 390: the same +91 / +53 px as the permanent check.  It grew downward from its outline's top.

## 3. #469 on prod

The walk opened the WHERE kind question ("What kind of work is it?") and set Details closed, then open, closed, open, and closed with Esc:

| Width | Band height closed / open / closed / open / after Esc | Spread | Panel | Esc focus on toggle |
|---|---|---|---|---|
| 1440x900 | 762.5 / 762.5 / 762.5 / 762.5 / 762.5 | 0.0 | `position: absolute`, on top at 5 points, in view | true |
| 1198x930 | 762.5 × 5 | 0.0 | absolute, on top, in view | true |
| 390x844 | 875.8 × 5 | 0.0 | absolute, on top, in view | true |

Crops: `crops/1440x900-details-open.png`, `crops/390x844-details-open.png`.  They are full-page clips from the band's top to the panel's bottom,
so the sticky header shows over the top at 390.  The panel lists the three kinds with their sheets.

## 4. axe, 44 px, console

- axe (whole document): 0 violations at all three widths, at the kind question (Details closed and open) and after the settle.
- Visible controls under 44 px: in the WHERE band, the aerial zoom `+` and `−` at 32x32 at 1440 and 1198.  This is the existing rule-133 exception,
  the same as #469's evidence.  None at 390.  In the settled results: 0 at all three widths.
- Console errors 0 and page errors 0 for the whole walk at every width.

## Files

- `script/walk-prod.mjs`: the walk (#469, #477, axe, 44 px, console).  `script/disposed-guard.cjs`: the preload described in section 1.
- `logs/`: the three run logs.  `walk/`: per-width JSON.  `crops/`: strips, the stand-in frames and Details open.
- Token check: the gate token string appears 0 times in this folder.
