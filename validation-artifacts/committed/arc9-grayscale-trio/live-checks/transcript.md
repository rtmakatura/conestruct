# Arc 9 live-site verification — grayscale trio (#132 / #159 / #144)

Run 2026-08-03, headless Playwright + pypdfium2/Pillow measurement,
read-only (no accounts, no DB writes, no saves; PDF downloads are
stateless renders through the page's own buttons; zero route
interception this arc).

## Build gate

| Surface | sha |
|---|---|
| healthz | `d65dd6791f8bf7b450aeddec473056d38f77021c` |
| `git rev-parse origin/main` | `d65dd6791f8bf7b450aeddec473056d38f77021c` |
| served bundle (`/_next/static` chunk) | `d65dd6791f8bf7b450aeddec473056d38f77021c` |

## Tally

**20/20 PASS, 0 failures** — 12 browser assertions (gate + 11, `assertions-raw.md`,
verified by count: 12 PASS / 0 FAIL) + 8 served-PDF measurements
(`measure-served-pdfs.py` output, inlined below).

## #132 — nav (touched surface)

- 1a badge text "MUTCD 2023 · CDOT" present; 1b zero `animate-pulse`
  elements in nav; 1c zero empty color-painted spans. Screenshots:
  `01-nav-post-fix-color.png` / `-grayscale.png` — pair against the
  pre-fix prod shots in the parent evidence dir (green pulsing dot,
  grayscales to a meaningless blob; post-fix the badge is text alone).
- 2a **zero axe violations rooted in the nav**; 2b **Arc 7's
  zero-violation post-generate baseline holds** (full-page scan,
  wcag2a/aa + 2.1/2.2aa: `axe-post-generate.json` = `[]`).

## #159 — the served shoulder-divided PDF

Configured live: Shoulder work kind, Lakewood control pin (Wadsworth
southbound candidate), road type "Rural — divided hwy", lanes 2/dir;
strip settled VERIFIED · READY; PDF downloaded via the page's own
"Download PDF" (`served-shoulder-divided.pdf`, 799,656 B). Measured on
the rasterized served document (bands identified by modal color, middle
60% measured so edge lines don't count):

- hatch strokes cross **100.0%** of closed-shoulder-band columns (bar >90%)
- open band **0.8%** (bar <5%)
- fills unchanged: modal grayscale **215** closed / **208** open (the
  pink kept, hatch additive)
- photocopy proof: `04-served-shoulder-bands-pair.png` (top = open,
  flat; bottom = closed, hatched), full sheet
  `03-served-shoulder-grayscale.png`

## Flagger regression glance

`served-flagger.pdf` (quiet Park pin, VERIFIED · READY): closed-lane
pink band present and untouched; dark-column fraction in the band
**1.6%** — no hatch where none belongs (hatch measures >90%; bar <50%
because devices/labels legitimately sit in a lane band).

## #144 — stated, not faked

PCMS emission is retired (#142), so no production PDF can contain the
glyph and no live check can exercise it without synthesizing a fake
document. The verification of record is
`tests/test_plan_sheet_grayscale.py::TestPcmsGlyphDistinct`, which
renders both glyphs through the production `_DEVICE_GLYPHS` mapping and
measures the grayscale split (pre-fix byte-identical; post-fix max
delta 184, polarity split).

## Run notes (runs 1–3 failed only their own probe assumptions)

1. Run 1: Wadsworth detection hands off 4 lanes/direction; with the
   divided flip that honestly fails the 52-ft drawable-width input
   check (INVALID INPUT, Generate disabled — working as designed). The
   script now sets lanes to 2.
2. Run 2: script locator bug (innermost div filter matched the label
   itself).
3. Run 3: one FAIL on the whole-page axe scan — a scan-order artifact:
   the scan ran after the download click and caught the first card's
   button in its transient dimmed "downloading" state. Probed: the
   settled button computes rgb(86,188,242) on rgb(20,32,46) and the
   flagger post-generate surface scans **zero** violations at this same
   sha. The scan now runs before the download; run 4 clean. No
   production assertion that executed correctly ever failed.
