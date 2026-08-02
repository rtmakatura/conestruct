# Arc 5 evidence — #155 Greeley/Thornton reachability

Captured 2026-08-02 against the local resolver (`src/rules/boundaries.suggest`),
reading the shipped layer in `data/boundaries/` — the same files the deployed
endpoint reads.

**Pre-fix files (`prefix-*.json`)** were captured at `9efff4e` (main, the
pre-fix state) BEFORE any Arc 5 change was applied in the worktree — same
session, edits made only after the captures were written.

**Post-fix files (`*-postfix.json`)** were captured after the commit-1 changes
(SUPPORTED additions in `scripts/build_boundaries.py`, regenerated layer,
county-copy honesty fix in `src/rules/boundaries.py`).

## The four reference pins

| Pin | Coordinates | Pre-fix (false) | Post-fix |
|---|---|---|---|
| Greeley | 40.404292, -104.715863 | `null / outside_supported`, reason claims "unincorporated Weld County" — the pin is inside Greeley city limits | `greeley / inside` |
| Thornton Civic Center | 39.8680, -104.9847 | `null / outside_supported`, warning claims Conestruct "does not carry" Thornton — its record shipped in `data/jurisdictions/thornton.json` | `thornton / inside` |
| Lakewood control | 39.7113, -105.0815 | `lakewood / inside` (healthy path) | `lakewood / inside` — unchanged |
| Northglenn near-boundary control | 39.886, -104.9811 | `null / outside_supported`, near_boundary warning names Thornton at 292 ft | identical shape — Northglenn stays unsupported, jigsaw warning still names Thornton (now as a supported neighbor) |

## What the defect was

The rule records for Greeley and Thornton shipped in `data/jurisdictions/`
(#151) but the two fixed lists that make a record reachable were never
extended: `build_boundaries.py` `SUPPORTED` (6 keys) and
`JURISDICTION_OPTIONS` (`conestruct/site/lib/jurisdiction.ts`, launch-8).
The resolver could not suggest either city and the dropdown could not pick
them. The county fallback branch compounded it by asserting "unincorporated
Weld County" for a pin inside Greeley city limits — a claim the layer cannot
make (it maps metro places plus the supported set, not every municipality).

The regression guard is `tests/test_jurisdiction_reachability.py`: every
`data/jurisdictions/*.json` key must have a boundary polygon or a dropdown
entry, or sit on the explicit known-unreachable allowlist
(`westminster`, `castle_rock`, `loveland`, `el_paso` — coverage-expansion
follow-up).
