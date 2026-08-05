# Arc 13 — citation tail 2: #51 (W16-2a plaque family) + #98 (federal _CITATION_* family)

Method: every citation verified by SUBJECT against the local sources.
Verified 2026-08-04/05.

Sources (identified by document, not by path — the working-copy PDFs
below are **untracked local files**, gitignored by
`validation-artifacts/*`; they are the same copies every prior arc's
evidence used, e.g. `arc12-citation-tail/arc12-citations.md` cites the
identical paths. Anyone re-verifying from a fresh clone obtains the
documents from CDOT / FHWA by the identities given; every claim in
this file carries its own printed/PDF page cite and quote so the check
is a page-open, not a search):
- **CDOT M&S Standard Plan S-630-1, issued July 01, 2026, 26 sheets**
  — local working copy `validation-artifacts/s630-1-2026.pdf`
  (S-630-1 at PDF pp. 149–174). **Sheet 7 = "Standard Sheet No. 7 of
  26" = PDF p. 155** (Case 11 "Shoulder Work - Freeway/Expressway").
- **MUTCD 11th Edition (December 2023), Part 6** — local working copy
  `validation-artifacts/ta10_flagger/mutcd_part6.pdf`. Page cites
  printed/PDF.

## #98 — the federal taper/buffer/spacing family: every subject VERIFIED-STANDS

No citation text changed. The section/table numbers were consolidated
onto `_SEC_TAPER/_SEC_BUFFER/_SEC_SPACING` + `_TBL_TAPER/_TBL_BUFFER`
(audit.py) feeding both the `_CITATION_*` panel dicts and every prose
sentence — rendered output byte-identical (see byte-compare below).

| # | Literal (panel + prose) | Claim | Verification | Disposition |
|---|---|---|---|---|
| 1 | `MUTCD § 6B.08` / `Sec 6B.08` (taper cite + source prose) | Taper length criteria live in §6B.08 | **§6B.08 "Tapers"**, printed p. 775 / PDF p. 11 | **Verified-stands** |
| 2 | `TABLE 6B-3` / `Table 6B-3` (taper footer + prose) | Taper-length table; lane = full L, shoulder = L/3 | **"Table 6B‑3. Taper Length Criteria for Temporary Traffic Control Zones"**, printed p. 775 / PDF p. 11: *"Merging Taper at least L · Shifting Taper at least 0.5 L · Shoulder Taper at least 0.33 L · One‑Lane, Two‑Way Traffic Taper 50 feet minimum, 100 feet maximum · Downstream Taper 50 feet minimum, 100 feet maximum. Note: Use Table 6B‑4 to calculate L"* — verifies the full-L lane prose, the L/3 shoulder prose, **and** the flagger 50–100 ft band + 50–100 ft downstream-taper prose in the same row set | **Verified-stands** |
| 3 | `MUTCD § 6B.06` / `Sec 6B.06` (buffer cite + source prose) | Longitudinal buffer space governed by §6B.06, length from Table 6B-2 | **§6B.06 "Activity Area"**, printed p. 773 / PDF p. 9, ¶11: *"If a longitudinal buffer space is used, the values shown in Table 6B-2 may be used to determine the length of the longitudinal buffer space."* | **Verified-stands** |
| 4 | `Table 6B-2 (stopping sight distance)` (buffer footer "STOPPING SIGHT DISTANCE" + prose) | Table 6B-2 is the SSD table | **"Table 6B‑2. Stopping Sight Distance"**, printed p. 775 / PDF p. 11; §6D.06 ¶03 (printed p. 786 / PDF p. 22) confirms by subject: *"the stopping sight distance as a function of speed"* | **Verified-stands** |
| 5 | `MUTCD § 6K.01` / `Sec 6K.01` (spacing cite + prose "speed in feet" / "2x speed") | Channelizing-device spacing ≤ 1× speed (taper) / ≤ 2× speed (tangent) | **§6K.01 "Channelizing Devices – General"**, printed p. 815 / PDF p. 51, ¶04: *"The spacing between cones, tubular markers, vertical panels, drums, and barricades should not exceed a distance in feet equal to 1 times the speed limit in mph when used for taper channelization, and should not exceed a distance in feet equal to 2 times the speed limit in mph when used for tangent channelization."* | **Verified-stands** |
| 6 | flagger sight-distance footer `TABLE 6B-2` token (audit.py:1322) | Same Table 6B-2 subject inside the §6D.06 family | Same as row 4; the `§ 6D.06` cite itself was subject-verified in the engine-removal arc (in-code comment, §6D.06 ¶03 → Table 6B-2) and is untouched — only the table token now interpolates `_TBL_BUFFER` | **Verified-stands** (token fold only) |

### Scan-hygiene note (the defect-#17 lesson paying off)

A first ASCII scan for `Table 6B-3` returned **zero hits** across the
whole Part 6 PDF — the caption uses a **non-breaking hyphen (U+2011)**:
`Table 6B‑3`. Caught before any claim was drafted (the arc's standing
rule: negative claims get a second, looser scan). Recorded so future
scans of this PDF match `6B[-‑]3`. Not counted as a citation defect —
no claim was made on the false negative; counter stays at **17**.

## #51 — W16-2a / W7-3a plaque family

### Configuration: VERIFIED-STANDS against Sheet 7 Case 11

S-630-1 (July 2026) **Sheet 7, Case 11 "Shoulder Work -
Freeway/Expressway"** (PDF p. 155) draws, in order: the upstream
W21-5aR ("RIGHT SHOULDER CLOSED") with **W16-2a directly beneath it**,
a second W21-5aR with **W7-3a(X) beneath it**, then W5-1 — exactly the
G1 structure the layout generator emits, `validate_layout` checks, the
audit sign table rows carry ("under W21-5aR at A" / "under second
W21-5aR"), and the crew narrative schedule renders ("under upstream /
downstream W21-5aR").

### Plaque distance value: MARKED-CHOSEN with stated semantics (Rule 12)

The sheet parameterizes the plaque distance — `W7-3a(X)`, and the
W16-2a value is likewise undimensioned — and **defines no formula for
X**. The shared helper computes:

- **W16-2a** `NEXT {station − work_zone_length:,} FT` = the distance
  from the host W21-5aR to the work-zone upstream edge
  (= A + taper + buffer in the station frame) — a **chosen**
  interpretation of "NEXT XXX FT".
- **W7-3a** `NEXT {max(1, round(wz_len/5280))} MILE(S)` — the
  deterministic V1 default, floored at 1 mile.

MUTCD Part 6's warning-sign figure (printed p. 801 / PDF p. 37) defers
plaque application to **Chapter 2C**, which is outside the locally held
Part 6 PDF — so no held source defines the distance semantics either.
Per the GO: recorded as **marked-chosen with stated semantics**, not
dressed as a regulation. The choice is now stated in one place
(`substitute_sign_description`, sign_codes.py) and both rendering
surfaces derive from it.

### Naming adjacency (recorded, not absorbed)

The 11th-Ed federal plaque code on the same figure (printed p. 801) is
**W16-2P** — S-630-1 Sheet 7 itself prints **"W16-2a"**, which is what
the codebase renders. The code follows its governing CDOT sheet; the
federal-vs-CDOT sign-code naming question is the same class as the
G20-1 item flagged in `arc12-citation-tail/arc12-citations.md` and
stays with it for a dedicated look. No literal changed.

### Migration record (Surface B)

`crew_narrative.py` (was :415-430) no longer recomputes either plaque
value; it calls `substitute_sign_description` — the same call
`audit.py` sign_table makes — and appends its host-sign suffixes. The
new cross-surface test
(`test_crew_narrative_plaque_values_equal_shared_helper_and_audit`)
pins narrative row value == audit row value, value-agnostically. The
station derivation (`wz_len + buffer + L + A`) remains in both callers
by design — it is the *plaque value* computation that #51 names, and
`wz_len == params.work_zone_length_ft` (crew_narrative.py:291) makes
the old and new expressions arithmetically identical.

## Byte-compare (zero-churn proof for both commits)

`dump_arc13_surfaces.py` (this directory) dumps `/render/audit` for the
Arc 12 six-scenario matrix **+ a freeway shoulder scenario** (the only
kind rendering the G1 plaque rows — exercises #51's surface and every
#98 taper/buffer/spacing prose branch) **and** the freeway crew
narrative from `/render/markdown`:

- `before.json` / `before-freeway-narrative.md` — HEAD before commit 1
- `after-51.json` / `-freeway-narrative.md` — after the #51 migration: **byte-identical**
- `after-98.json` / `-freeway-narrative.md` — after the #98 consolidation: **byte-identical**

Full backend suite after both commits: **1844 passed, 2 skipped, zero
snapshot churn** (the GO's bar: any snapshot delta would have been a
REPAIR signal, none appeared).
