# plan-date-denver — the rulings this arc is built under

**Issue:** none (Ryan: "Small separate fix (light, its own branch)"). Ships before #300.
**Base:** `11c81b4` = `main` = prod `/healthz` (2026-10-08, after the #313 ship).

## Ryan, 2026-10-08 (session prompt, verbatim)

> #313 verified on prod and closed. Two things:
> 1. Start #300's build on issue-300-left-side-oneway-r2, restacked onto 11c81b4 (no force push), per R119.
> 2. Small separate fix (light, its own branch): the plan sheet's DATE reads 2026-10-09 on a plan generated 2026-10-08 at 22:30 MDT. It's using the server's UTC date. Stamp the date in America/Denver (or the jurisdiction's local time). Check every surface that prints a date (PDF title block, crew sheet, XLSX, audit). Ship it before #300.

Item 2 is this arc. It supersedes the clock half of #268's ruling ("ONE format, the plan sheet's `YYYY-MM-DD`, read from the UTC clock, zone omitted"; `tests/test_generated_stamp.py:4-6`): the one format and the one producer stay; the date becomes Denver's.

## The zone, and why one zone

America/Denver, CHOSEN between Ryan's two options. Every jurisdiction record in `data/jurisdictions/` is in Colorado (castle_rock, cdot, centennial, denver, e470, el_paso, englewood, greeley, lakewood, littleton, loveland, parker, thornton, westminster), and Colorado is one zone, so "the jurisdiction's local time" is America/Denver for every plan the tool can make. No record carries a zone field. When a non-Colorado record is added, the stamp's zone becomes a jurisdiction field; until then a per-jurisdiction lookup would compute one answer from 14 inputs.
