# s2a18 live check — LOCAL
UTC: 2026-09-05T03:51:46.313Z
BASE: http://localhost:3000
healthz (HTTP 200): {"status":"ok","sha":"unknown"}
git rev-parse HEAD: 59e9e9a8c5d4130312a696d120e233165c94029b — local mode: the served build is this working tree (next dev + uvicorn at http://127.0.0.1:8765/healthz), not a deploy.

**PASS** — A1 baseline scanned audit answers ok — HTTP 200, 5689 ms, status=ok, detected: bike_facilities,intersections,sidewalks
**PASS** — A2 the baseline detects sidewalks and fires the sidewalk adjustment — flags {"adjacent_intersection":true,"pedestrian_facility":true,"bicycle_facility":true}; fired adjacent_intersection,bicycle_facility,pedestrian_facility
**PASS** — A3 no corrections on the wire ⇒ none disclosed, no pending item — pending kinds ["intersection_layout_not_generated"]
**FAIL** — A4 the baseline device list carries R9-9 SIDEWALK CLOSED — HTTP 200, R9-9 false
INFO — A #243 boundary — the Note 8 check reads pass=false on the baseline (divided road): "Required: True. Signs placed: 6 left, 10 right."
**PASS** — B1 the dismissed audit answers ok — HTTP 200, 1150 ms
**PASS** — B2 the correction is applied with the scan's verdict and ONE backend sentence — applied, scan_detected true: "Operator dismissed the scan's pedestrian sidewalks: fenced off. The plan is built to the correction — verify it in the field or on imagery before deploying."
**PASS** — B3 pedestrian_facility leaves the flags and its record no longer fires while the scan still says detected — flags {"adjacent_intersection":true,"bicycle_facility":true}; fired adjacent_intersection,bicycle_facility
**PASS** — B4 ONE pending item carries the sentence verbatim (the #177 shape) — 1 item(s); pending 1 → 2
**PASS** — B5 pending = baseline + 1 — 1 → 2
**PASS** — B6 is_clean is false with an operator override pending
**PASS** — B7 the dismissed plan's device list has no R9-9 — the backend re-generated — HTTP 200
**PASS** — C1 the asserted audit answers ok — HTTP 200, 1044 ms
**PASS** — C2 the assert is applied with the scan's verdict (none) and the backend sentence — "Operator asserted school zone — the scan found none along the corridor. The plan is built to the correction — verify it in the field or on imagery before deploying."
**PASS** — C3 school_zone joins the flags and its record fires — fired adjacent_intersection,bicycle_facility,pedestrian_facility,school_zone
**PASS** — C4 pending = baseline + 1 — 1 → 2
**FAIL** — C5 the asserted plan's device list carries S1-1 SCHOOL — HTTP 200
INFO — C #243 boundary — Note 8 on the asserted plan reads pass=false: "Required: True. Signs placed: 7 left, 11 right." (expected on this divided road; not this arc's defect)
**PASS** — D1 asserting the detected sidewalk is moot — disclosed, never dropped — "Operator assertion of pedestrian sidewalks is moot — the scan detected it; the assertion changes nothing."
**PASS** — D2 a moot correction changes nothing: records as the baseline, no pending item — fired adjacent_intersection,bicycle_facility,pedestrian_facility
**PASS** — E1 a dismiss without a reason is the honest 400 with the code and the recovery field — HTTP 400: Dismissing pedestrian sidewalks needs a reason (fenced, removed, not in work zone, other).
**PASS** — F1 the dismissed plan's audit PDF renders — HTTP 200, 9264 B, 2824 ms
**PASS** — F2 the Site Conditions table's Result cell names the dismissal and the body carries the lead — dismissed true, lead true
SCRIPT ERROR: Error: Command failed: "C:\Users\rtmak\Documents\traffic-control-tool\.venv\Scripts\python.exe" -c "import json,sys;from src.rendering.tier_ledger import tier_ledger,ledger_line;a=json.load(open(sys.argv[1],encoding='utf-8'));print(ledger_line(tier_ledger(a,None)))" "outS2A18Local\B-dismissed-audit.json"
Traceback (most recent call last):
  File "<string>", line 1, in <module>
    import json,sys;from src.rendering.tier_ledger import tier_ledger,ledger_line;a=json.load(open(sys.argv[1],encoding='utf-8'));print(ledger_line(tier_ledger(a,None)))
                                                                                              ~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'outS2A18Local\\B-dismissed-audit.json'

    at genericNodeError (node:internal/errors:984:15)
    at wrappedFn (node:internal/errors:538:14)
    at checkExecSyncError (node:child_process:890:11)
    at execSync (node:child_process:962:15)
    at ledgerLineOf (C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts\committed\s2-arc18-corrections\s2a18-lc-prod.js:141:10)
    at C:\Users\rtmak\Documents\traffic-control-tool\validation-artifacts\committed\s2-arc18-corrections\s2a18-lc-prod.js:351:22
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
