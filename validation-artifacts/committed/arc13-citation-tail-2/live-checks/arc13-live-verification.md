# Arc 13 live checks — #51 + #98 verified on production

Run 2026-08-05 at origin/main `b6d0b7f` (the arc13 evidence tip Ryan
shipped). **Run belatedly at Arc 14's GO**: the 2026-08-05 handoff
rewrite recorded these checks as already done — written from expected
flow, not confirmed fact (chat-side record error, caught by the Arc 14
session-start repo check: no `arc13-live-checks` branch, no live-checks
commit on main, no evidence directory existed). Ruling 1 of the Arc 14
GO ordered them run first, exactly as the Arc 13 GO specified.

## Scope (the Arc 13 GO's honest minimum)

One freeway shoulder plan on prod — the arc13 baseline scenario
(freeway / 65 mph / 3 lanes per direction / 1,000 ft zone, the same
numbers as `FREEWAY_SHOULDER` in `../dump_arc13_surfaces.py`), entered
through the real /sandbox form at the Lakewood control pin
(manual-supersede over detection, the #112 convention):

- **#51**: crew narrative .md plaque schedule lines render the shared
  helper's substituted values + host-sign suffixes, equal to the audit
  sign table's values.
- **#98**: taper/buffer/spacing cite chips + one source prose string
  unchanged vs the committed arc13 baseline dumps.

## Build gate

healthz `b6d0b7f` == `git rev-parse origin/main` == served bundle sha
scanned from `/_next/static` chunks — clean on every run, no
propagation pause needed.

## Results — 9/9 PASS (final run 14:12–14:13 UTC)

| # | Assertion | Result |
|---|---|---|
| gate | healthz == origin/main == served bundle | PASS (`b6d0b7f`) |
| 1a | taper cite chip "MUTCD § 6B.08" + footer "TABLE 6B-3" | PASS |
| 1b | buffer cite chip "MUTCD § 6B.06" | PASS |
| 1c | spacing cite chip "MUTCD § 6K.01" | PASS |
| 1d | taper source prose (audit PDF surface) byte-equal to the committed `after-98.json` baseline string | PASS |
| 1e | audit sign table renders "NEXT 1,862 FT (under W21-5aR at A)" + "NEXT 1 MILE (under second W21-5aR)" | PASS |
| 2a | narrative row `\| W16-2a \| NEXT 1,862 FT (under upstream W21-5aR) \| 1,000 ft upstream \|` == committed baseline row | PASS |
| 2b | narrative row `\| W7-3a \| NEXT 1 MILE (under downstream W21-5aR) \| 750 ft upstream \|` == committed baseline row | PASS |
| 2c | cross-surface: narrative plaque VALUES equal the audit sign table's (suffixes differ by design) | PASS |

## Harness iteration record (honest trail — two early FAILs were
harness defects, not product defects)

1. **Collapsed accordion rows**: the first run scanned only the
   as-opened trail; the sign table (row 04) and most expanded bodies
   were collapsed, failing 1e/2c. A blanket expand-all then *collapsed*
   the default-open taper row (accordion toggle), failing 1a. Fix: scan
   the UNION of page text — captured as-opened plus after each row
   click — sound because every assertion is a positive contains-check
   (the scan-hygiene rule's "a guard that can't fail is vacuous"
   inverse: nothing here asserts absence).
2. **Source-prose surface**: the web trail deliberately renders section
   `source` prose only for geometry/approaches (`AuditTrail.tsx`); the
   taper/buffer/spacing source sentences reach the user through the
   **audit PDF** ("↓ Audit PDF" → `audit_blocks.py` renders
   `Source: {taper.source}`). 1d was re-pointed at that surface —
   testing where the string actually serves (Rule 11), not where the
   harness first looked. The served PDF's extracted text contains the
   baseline sentence verbatim:
   `MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Shoulder closures use L/3 per Sec 6B.08 (Table 6B-3).`

Scope notes: lane width stayed at the form's 12 ft default (the
drawable-width fallback never fired at this pin/scenario); the plaque
values and every asserted string are lane-width-independent (shoulder
taper L/3 uses shoulder width; stations use A + taper + buffer).
Detection at the Lakewood pin resolves to South Wadsworth Boulevard;
road type / speed / lanes were then set manually to the baseline
scenario — the audit reflects the entered params, which is the
operator flow, not a bypass.

## Artifacts

- `arc13-live-check.js` — the harness (read-only; no accounts, no
  saves)
- `out13/assertions-raw.md` — timestamped assertion log (final run)
- `out13/page-text.txt` — union trail text scanned
- `out13/served-freeway-narrative.md` — the .md served by the real
  Download button
- `out13/served-audit.pdf` + `served-audit-pdf-text.txt` — the served
  audit PDF and its extracted text
- `out13/01-freeway-audit-trail.png`, `out13/02-advance-sign-table.png`
  — screenshots (sign table expanded in 02)
