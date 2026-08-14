# Arc 16 live checks — raw log

- `2026-08-14T17:07:18.351Z` healthz sha: 8c45d27b82a323c18be45f74048ef13fa97b91b7
- `2026-08-14T17:07:18.352Z` expected (git rev-parse origin/main): 8c45d27b82a323c18be45f74048ef13fa97b91b7
- `2026-08-14T17:07:20.594Z` served bundle sha: 8c45d27b82a323c18be45f74048ef13fa97b91b7
- `2026-08-14T17:07:20.595Z` **PASS** — gate. healthz == origin/main == served bundle (8c45d27)
- `2026-08-14T17:07:20.861Z` **PASS** — 1. served CSS carries the junction rule (12px row step)
- `2026-08-14T17:07:24.089Z` **PASS** — 2a. jurisdiction strip inside the select's .jctl-field, after it
- `2026-08-14T17:07:24.089Z` **PASS** — 2b. strip computed margin-top 12px, padding-left 0 (mt=12px pl=0px)
- `2026-08-14T17:07:24.089Z` **PASS** — 6a. moved strip carries glyph+text channels (never hue alone) ("◌Drop a site pin for a jurisdiction suggestion")
- `2026-08-14T17:07:24.231Z` screenshots: 01/02 jctl strips color + grayscale (Rule 13 pair)
- `2026-08-14T17:07:24.237Z` **PASS** — 3a. generate footer padding 24/24 (section) (pt=24px pb=24px)
- `2026-08-14T17:07:24.238Z` **PASS** — 3b. scenario-picker block padding-bottom 16 (block) (pb=16px)
- `2026-08-14T17:07:24.244Z` **PASS** — 3c. .empty-state 24px inset-y + 24px margin (section) [DOM] ({"paddingTop":"24px","paddingBottom":"24px","marginBottom":"24px"})
- `2026-08-14T17:07:24.601Z` **FAIL** — 5a. axe zero violations — generator page (Arc 7 baseline) (1 finding(s) — axe-generator.json)
- `2026-08-14T17:07:24.601Z` 5a note: color-contrast on .jbar-suggest quiet text — PRE-EXISTING (colors/opacity byte-identical pre-arc; state newly scanned)
- `2026-08-14T17:07:26.501Z` **PASS** — 4a. modal header gutter padding-x 24 (section, was 20) ([{"pl":"24px","pr":"24px"}])
- `2026-08-14T17:07:26.512Z` **PASS** — 4b. coord-grid gutter padding-left 24 (an ancestor inside the dialog) (pl=24px)
- `2026-08-14T17:07:27.254Z` **FAIL** — 5b. axe zero violations — open modal (1 finding(s) — axe-modal.json)
- `2026-08-14T17:07:52.599Z` picker saved (Lakewood pin)
- `2026-08-14T17:08:22.983Z` width gate fired (honest 400) — following its recovery: lane width -> 10.5
- `2026-08-14T17:08:22.987Z` lane width set to 10.5 through the form
- `2026-08-14T17:08:25.094Z` **PASS** — 3d. quote-settings grid margin-bottom 16 (block) (mb=16px)
- `2026-08-14T17:08:25.095Z` 3e. delta legend not rendered at this pin/scenario — unreachable read-only; covered by diff + mounted suite (stated, not silently skipped)

Failures: 2
