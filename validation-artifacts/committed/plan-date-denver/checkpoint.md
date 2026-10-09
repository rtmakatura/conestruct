# plan-date-denver — surfaces, build plan and Rule 5 prediction (written before the diff)

## Every surface that prints a date (at `11c81b4`)

All five read one producer, `src/rules/validators.py:290-323` (#268): `_utcnow()` → `generated_at()` (a naive UTC datetime) → `generated_stamp()` (`YYYY-MM-DD`).

| Surface | Reads | Where |
|---|---|---|
| Plan sheet title block, "DATE" | `generated_stamp()` | `src/rendering/plan_sheet.py:2232` |
| Crew sheet markdown, "**Generated:**" | `generated_stamp()` via `generation_date` | `src/narrative/crew_narrative.py:917`, `templates/base.md.j2:12` |
| Crew sheet PDF | the same markdown, rendered | `/render/crew-pdf` |
| XLSX device list, Summary "Generated" | `generated_at()`, a date cell (`yyyy-mm-dd`) | `src/export/device_list.py:261` |
| Quote, B3 "Generated" | `generated_at()`, a date cell | `src/export/quote_generator.py:600-601` |

- **The audit prints no date.** No date or "Generated" field in `src/api/audit.py`, and the audit PDF goes through the same document renderer with no stamp.
- **Not a date stamp, out of scope:** the site scan's `measured_at` (`src/api/site_scan.py:788`) is an ISO instant carrying its own `+00:00` offset. The UI either prints it raw with the offset (`AuditTrail.tsx:1370`) or formats it in the browser (`GeneratorShell.tsx:1942-1950`). It's an instant with its zone, not a calendar date.
- **The XLSX and quote cells hold a time too.** `generated_at()` is the full instant to the second, shown through a date-only format. If the cell stayed UTC while page 1 went local, the two would disagree on a 22:30 MDT plan. So the cell becomes the Denver wall-clock instant.

## Build plan

- `validators.py`: `DELIVERABLE_TZ = ZoneInfo("America/Denver")` (CHOSEN, `rulings.md`). `generated_at()` returns the instant in Denver, naive, to the second; a naive `now` is still read as UTC (the seam's contract). `generated_stamp()` is that date. `_utcnow()` unchanged: the clock stays UTC and only the stamp's zone changes.
- `tzdata` added to `modal_app.py`'s `RENDER_DEPS` and to `pyproject.toml`, so the zone database ships with the code rather than depending on the base image (`debian_slim`) or Windows having one.
- The five surfaces: no change (one producer).

## Rule 5: the churn prediction

**Behavior change, deliberate:** every deliverable's date is Denver's calendar date. On a plan generated between 18:00 and 24:00 MDT (17:00-24:00 MST), every surface moves back one day from today's output. At other hours the printed date is unchanged. The XLSX and quote cells' hidden time of day moves by -6 h (MDT) / -7 h (MST).

**Assertions predicted to change** (`tests/test_generated_stamp.py`, `tests/test_generated_stamp_surfaces.py`; the pinned instant is 2026-09-08 16:07:35 UTC = 10:07:35 MDT, the same date):
- `test_generated_stamp_converts_a_non_utc_instant_to_the_utc_date`: 23:30 Denver on the 8th → `"2026-09-09"` flips to `"2026-09-08"` (renamed for what it now proves).
- `test_generated_at_is_naive_utc_to_the_second`: `16:07:35` → `10:07:35`.
- `test_generated_at_treats_a_naive_now_as_utc`: a naive 16:07:35 is still read as UTC, so it comes back as `10:07:35`, not unchanged.
- `test_default_now_reads_the_utc_clock_seam`: `generated_at()` `16:07:35` → `10:07:35` (the stamp line holds).
- Surfaces: the XLSX and quote cell values `datetime(2026, 9, 8, 16, 7, 35)` → `datetime(2026, 9, 8, 10, 7, 35)`. The five `STAMP == "2026-09-08"` assertions hold.
- Docstrings in both test files that say "UTC" are restated.

**Predicted unchanged:** `test_generated_stamp_is_the_utc_date_zone_omitted` (its value, though it's renamed), `test_stamp_and_at_agree_on_the_same_instant`, `test_utcnow_is_zone_aware_utc`; every recorded baseline (the snapshots are audit JSON, with no stamp). `test_replication_snapshot`'s crew-narrative proof compares two runs of one instant, so it's unaffected by which zone the stamp uses.

**New tests (Rule 11):** Ryan's case at the payload level. The clock is pinned to 2026-10-09 04:30 UTC (22:30 MDT on the 8th), and the plan sheet DATE, crew markdown, crew PDF, XLSX and quote all read 2026-10-08. A winter instant checks MST (2026-01-15 06:30 UTC = 23:30 MST on the 14th → `2026-01-14`).
