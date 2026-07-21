# BLOCKED — jurisdiction facts not encodable from the research corpus

Per the build ground rules: a value the spec or schema wants that is absent from
`docs/research/02-JURISDICTION-DATA.md` / `05-COVERAGE-MATRIX.md` is left ABSENT
in the data file and logged here. Nothing below was guessed or defaulted.

## `urban_high_speed_breakpoint_mph` (spec §3.4a calls it "required per-jurisdiction")

The corpus documents FIVE agency determinations:
**cdot = 45** (S-630-1 Key table) · **englewood = 35** (TC-1 sign-spacing table) ·
**littleton = 35** (template <35 mph key) · **lakewood = 35** (its own typical
sheets: A=100' ≤30 mph, A=350' ≥35 mph — AUTHORED 2026-07-20, Ryan ruling:
its omission from §2.7 was a spec error; it is in the approved launch 8) ·
**aurora = 35** (spacing Table 1: 0–30→100, 35–40→350 — identical placement
to Englewood's; F19 pattern). Aurora's record is authored in the
remaining-rows pass and carries 35.

Absent — no read source states the agency's urban speed-category determination:
`loveland, parker, castle_rock, greeley, westminster, thornton, el_paso,
centennial, denver, e470`. (Most are geometry-silent jurisdictions where MUTCD
Table 6B-1 applies with the breakpoint delegated to the agency and never
published. e470 is a freeway facility — the urban rows may simply not apply.)

**Engine fallback rule (Ryan ruling, 2026-07-20):** when a jurisdiction has no
documented breakpoint, the engine uses the CDOT determination (40/45) via the
governing chain, and any UI/output labels it "per CDOT baseline" — never as the
city's own rule.

## `classification_map_url`

Spec §1.1 #12: Castle Rock and Greeley publish classification maps. Both maps
are confirmed to exist (Castle Rock "Roadway Functional Classification map";
Greeley "Street Classification Map") but **neither URL was captured in the
corpus**. Both files carry `classification_map_url: null` until the URLs are
fetched. (All other 11 files: no map known to exist → null is correct.)

## Fee gaps

- **centennial**: fee amounts live on a separate Fee Schedule never captured
  (Q-CEN-3). `fees.model = "unpublished"`.
- **denver**: rate-table unit basis (per-LF vs per-SF) is not recorded in the
  corpus — items carry amounts with no `per` and an explanatory note. The 2024
  schedule is the newest read; 2025/2026 schedules almost certainly exist
  (staleness risk flagged in the file).
- **loveland**: entire 2026 fee column is a council-packet DRAFT
  (adopted-presumed; confirm adoption — optional phone item, 970-962-2524).
- **el_paso**: fee worksheet is undated; every El Paso figure is provisional
  (T2 row — official snippets, documents not read in full). Note: provisional
  on El Paso means THIN EVIDENCE (source not read end-to-end), not draft-status
  — distinct from Loveland, where provisional means an unadopted DRAFT column.
- **westminster**: $15.29/SF street cut effective 2022-06-28 — stale risk; TCP
  review fee line items never located.
- **thornton**: "$50 processing + computed closure fee" from an undated handout
  — provisional.
- **cdot**: permit fees never researched (axis NC) — `fees.model = "unpublished"`.

## Geometry gaps

- **greeley**: geometry lives in the COG MHT/Barricade Manual — dead link (404),
  upload wanted. `geometry.status = "not_located"`.
- **castle_rock**: 10-ft lane / 2-ft device clearance rest on T2 extracts of the
  Standard Special Provisions (document not read in full) — provisional.

## Insurance / bond gaps

- **parker**: auto and umbrella minimums blank on the Town's sample COI (GL and
  WC captured); sample carries an events-context provenance flag.
- **e470**: insurance limits "published on the Authority's website" — not
  captured; bond amounts set per-permit by the Authority.
- **littleton**: bond/insurance amounts for licensure not published.

## Preserved conflicts rendered conservative (decided, not blocked — listed for review)

- parker hours 9:00–3:30 (RDCCM) vs 8:30–3:00 (2025 Overview) → 9:00–3:30 per
  the adopted manual (spec §1.4 casting keeps this the demo conflict block).
- thornton TC-permit lead 10 business days (ROW page) vs 2/5 days (handout) → 10.
- englewood TCS shall (TC-1 T04, adopted into EMC 11-7-25) vs should (Standards)
  → required; arterial reopen 3:00 (TC-1) vs 3:30 (EMC) → 3:00; overnight
  excavation prohibition (ROW Guide) vs flashing-barricade provision (Standards)
  → prohibition, barricades only under written Engineer exception.
- littleton min lane 10 ft (LEDS) vs 12 ft (flagger templates) → 10 general,
  12 on flagger configurations.
- e470 afternoon peak 3–7 PM (2025 Manual) vs 3–6 PM (SPPO) → Manual governs.

## HARD GATE — print pipeline before wave 2 (Ryan ruling, 2026-07-20)

**Spec §4 (on-sheet device summary + conflict footnote on the PDF, and §4.3
killing the hard-coded W20-1/flagger-station quantities) is REQUIRED before
Castle Rock, Loveland, or Thornton ever ship.** Those jurisdictions legally
require the device summary on the plan sheet itself (LCUASS 6.1.B.1 device
summary on the sheet; Castle Rock device count/type on the TCP; Thornton's
stipulation checklist). **Wave 2 cannot start without it.** Deferring §4 was
accepted for the launch-8 wave only.

## Lakewood residuals (authored 2026-07-20)

- Device-spacing taper/tangent ambiguity (Q-LKWD-1) and the multi-lane
  no-fee-list ambiguity (Q-LKWD-6): preserved in the record, phone-only
  (Transportation Engineering 303-987-7980).
- Plan-review turnaround: genuinely not published (NL) — the 24-hour figure
  in the record is an INSPECTION notice, never a submittal lead.
- Surety amount: unpublished, set per permit (blank form field).
- All typical-sheet geometry is provisional-on-date (sheets undated, keyed
  to pre-2003 MUTCD numbering).

## Baseline residual (spec §3.4)

- FHWA **Revision 1 to the MUTCD 11th Edition (Dec 2025)** vs Part 6: likely
  nil; **verify before ship** (the corpus's one standing baseline flag).
