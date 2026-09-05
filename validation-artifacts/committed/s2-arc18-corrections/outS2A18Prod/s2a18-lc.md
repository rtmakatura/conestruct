# s2a18 live check — PRODUCTION
UTC: 2026-09-05T06:12:46.453Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"6ad83c02593bc8edac81d2de9e48456431356a71"}
git rev-parse origin/main: 6ad83c02593bc8edac81d2de9e48456431356a71
**PASS** — GATE — healthz sha == origin/main — 6ad83c02593bc8edac81d2de9e48456431356a71 vs 6ad83c02593bc8edac81d2de9e48456431356a71

**PASS** — A1 baseline scanned audit answers ok — HTTP 200, 11654 ms, status=ok, detected: bike_facilities,intersections,sidewalks
**PASS** — A2 the baseline detects sidewalks and fires the sidewalk adjustment — flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}; fired adjacent_intersection,bicycle_facility,pedestrian_facility
**PASS** — A3 no corrections on the wire ⇒ none disclosed, no pending item — pending kinds ["intersection_layout_not_generated"]
**PASS** — A4 the baseline device list carries R9-9 SIDEWALK CLOSED — HTTP 200, R9-9 true
INFO — A #243 boundary — the Note 8 check reads pass=false on the baseline (divided road): "Required: True. Signs placed: 6 left, 10 right."
**PASS** — B1 the dismissed audit answers ok — HTTP 200, 1234 ms
**PASS** — B2 the correction is applied with the scan's verdict and ONE backend sentence — applied, scan_detected true: "Operator dismissed the scan's pedestrian sidewalks: fenced off. The plan is built to the correction — verify it in the field or on imagery before deploying."
**PASS** — B3 pedestrian_facility leaves the flags and its record no longer fires while the scan still says detected — flags {"adjacent_intersection":true,"bicycle_facility":true}; fired adjacent_intersection,bicycle_facility
**PASS** — B4 ONE pending item carries the sentence verbatim (the #177 shape) — 1 item(s); pending 1 → 2
**PASS** — B5 pending = baseline + 1 — 1 → 2
**PASS** — B6 is_clean is false with an operator override pending
**PASS** — B7 the dismissed plan's device list has no R9-9 — the backend re-generated — HTTP 200
**PASS** — C1 the asserted audit answers ok — HTTP 200, 1540 ms
**PASS** — C2 the assert is applied with the scan's verdict (none) and the backend sentence — "Operator asserted school zone — the scan found none along the corridor. The plan is built to the correction — verify it in the field or on imagery before deploying."
**PASS** — C3 school_zone joins the flags and its record fires — fired adjacent_intersection,bicycle_facility,pedestrian_facility,school_zone
**PASS** — C4 pending = baseline + 1 — 1 → 2
**PASS** — C5 the asserted plan's device list carries S1-1 SCHOOL — HTTP 200
INFO — C #243 boundary — Note 8 on the asserted plan reads pass=false: "Required: True. Signs placed: 7 left, 11 right." (expected on this divided road; not this arc's defect)
**PASS** — D1 asserting the detected sidewalk is moot — disclosed, never dropped — "Operator assertion of pedestrian sidewalks is moot — the scan detected it; the assertion changes nothing."
**PASS** — D2 a moot correction changes nothing: records as the baseline, no pending item — fired adjacent_intersection,bicycle_facility,pedestrian_facility
**PASS** — E1 a dismiss without a reason is the honest 400 with the code and the recovery field — HTTP 400: Dismissing pedestrian sidewalks needs a reason (fenced, removed, not in work zone, other).
**PASS** — F1 the dismissed plan's audit PDF renders — HTTP 200, 9264 B, 11516 ms
**PASS** — F2 the Site Conditions table's Result cell names the dismissal and the body carries the lead — dismissed true, lead true
**PASS** — F3 the audit-PDF cover line equals the classifier line over the served dismissed audit — cover "1 change · 1 needs attention · 14 checked · 2 pending · reference" vs served "1 change · 1 needs attention · 14 checked · 2 pending · reference"
**PASS** — G1 the dismissed plan's sheet + narrative render (200) — sheet HTTP 200 2798 ms · md HTTP 200 475 ms
**PASS** — G2 the sheet's notes box carries the CORRECTED BY OPERATOR line before the DRAFT trailer
**PASS** — G3 the narrative's ## Site Conditions block carries the sentence verbatim
**PASS** — H1 Generate at Lakewood settles with an ok scan — 5741 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — H2 pre-correction: the on-screen ledger equals the classifier over the served audit — 2 changes · 1 needs attention · 13 checked · 1 pending · reference
**PASS** — H3 the strip shows "Site conditions — scanned" with the sidewalk row — Site conditions — scannedAdjacent at-grade intersection — detected · 19 found · nearest 34.1 ft from anchor · unnamed at 39.7038, -105.0816 [advance_warning @ 2
**PASS** — H4 the confirm stays disabled until a reason is chosen
**PASS** — H5 the next audit request carries the dismiss marker (reason fenced) — [{"flag":"pedestrian_facility","action":"dismiss","reason":"fenced","recorded_at":"2026-09-05T06:13:35+00:00"}]
**PASS** — H6 the plan re-generates and settles — 24058 ms — VERIFIED · 3 plan flags ▸REVIEW FLAGS
**PASS** — H7 the on-screen ledger equals the classifier over the browser's own served corrected audit — screen "1 change · 1 needs attention · 14 checked · 2 pending · reference" vs classifier "1 change · 1 needs attention · 14 checked · 2 pending · reference"
**PASS** — H8 the row is the × record with the backend sentence and Undo — sys-event dismissed site-correction :: ×Operator dismissed the scan's pedestrian sidewalks: fenced off. The plan is built to the correction — verify it in the field or on imagery before deploying.Undo
**PASS** — H9 section 03 shows the dismissed ✓ row with the sentence
**PASS** — H10 pending = pre-correction + 1 on the browser's own audits — 1 → 2
**PASS** — H11 after Undo the next request's meta is byte-identical to the pre-dismiss request's meta — 1241 ms
**PASS** — H12 the ledger returns to its pre-dismiss line — screen "2 changes · 1 needs attention · 13 checked · 1 pending · reference" vs "2 changes · 1 needs attention · 13 checked · 1 pending · reference"
**PASS** — I1 Assert writes the assert marker and re-generates — 6685 ms; [{"flag":"school_zone","action":"assert","recorded_at":"2026-09-05T06:14:02+00:00"}]
**PASS** — I2 the row is the ✓ record with the backend sentence — sys-event confirmed site-correction :: ✓Operator asserted school zone — the scan found none along the corridor. The plan is built to the correction — verify it in the field or on imagery before deploy
**PASS** — I3 section 03's changed row carries the sentence, tag OPERATOR
INFO — I #243 boundary — Note 8 reads pass=false with the asserted school zone: "Required: True. Signs placed: 8 left, 12 right." (expected on this divided road; not this arc's defect)
**FAIL** — J1 after a pin move the next request carries no siteConditionOverrides (key dropped) — 12577 ms; meta.lat 39.7114
**PASS** — K axe dismissed: 1 violation(s) ≤ baseline 2 — color-contrast .opacity-80,.mb-2.text-\[11px\].text-\[color\:var\(--ink-on-
**PASS** — K axe asserted: 1 violation(s) ≤ baseline 2 — color-contrast .opacity-80,.mb-2.text-\[11px\].text-\[color\:var\(--ink-on-
INFO — L saved-plan reload carries the corrections — proven at test level (GeneratorShell.picker-reapply seeds meta.siteConditionOverrides through initialScenario, the saved-plan path); the sandbox has no save
SIZE — baseline audit 11733 B; dismissed audit 12020 B; dismissed audit PDF 9264 B

RESULT: FAILURES 43/44 (+4 INFO)
