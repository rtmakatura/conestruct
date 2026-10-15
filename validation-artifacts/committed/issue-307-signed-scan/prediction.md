# Rule 5 prediction: issue-307-signed-scan (written before any code)

Base: `issue-202-quote-settings` at `11443c3a` (stacked).

## Backend

- **New `src/api/scan_token.py`:** `sign_scan(entry) -> str` and `verify_scan(token) -> entry`, the latter raising `ScanTokenInvalid`. HMAC-SHA256 with the key derived from `RENDER_API_SECRET`.
- **`src/api/site_scan.py`:**
  - `SiteScanRequest.token: str | None = None`.
  - `SiteScanResult` gains `source` (`"scan"`, `"memo"`, `"token"` or `None`) and `memo_entry` (the signed tuple, on an ok scan).
  - `run_site_scan(..., token_entry=None)`: a matching key is served from the entry before the memo or Overpass, as a memo hit.
- **`src/api/schemas.py`:** `include_scan_token: bool = False` on the scenario mixin, beside `include_breakdown`.
- **`src/api/render_api.py`:**
  - `_placements_for` verifies a carried token first (invalid → 400 `site_scan_token_invalid`) and passes its entry to the scan.
  - `/render/audit` with `include_scan_token` adds `site_scan_token` when the scan answered.
  - `_ensure_scenario_enabled` refuses `include_scan_token` off `/render/audit`, as it does `include_breakdown`.
  - A middleware sets `x-site-scan-source` from a per-request holder.

**Unchanged without the opt-ins:** every existing response body, so no snapshot or fixture moves. The only always-present change is the header, and it's absent when no scan was requested (every corpus case).

## Frontend

- `lib/scenarios/types.ts` / `site-scan.ts`: `site_scan.token?: string`; `withScanToken(scenario, token)`.
- `GeneratorShell.tsx`:
  - the audit body adds `include_scan_token: true` beside `include_breakdown`;
  - the response's `site_scan_token` is kept with the scenario it answered for (it never enters `AuditResponse`);
  - `downloadScenario` is `wireScenario` plus the token when the stamp matches;
  - the public download modes (cards, quote) and the zip take `downloadScenario`.
- `lib/render-proxy.ts` passes `x-site-scan-source` through on the file responses.

## Tests

- **Python:**
  - sign/verify round trip;
  - a tampered token is refused;
  - a token from another secret is refused;
  - `run_site_scan` with a matching token makes no Overpass call and reports `source == "token"`;
  - a mismatched key scans;
  - `/render/pdf` with a bad token → 400 `site_scan_token_invalid`;
  - `/render/audit` with `include_scan_token` returns a token that a following `/render/pdf` serves from (`x-site-scan-source: token`);
  - `include_scan_token` off the audit → 400.
- **Site:**
  - the audit request carries `include_scan_token`;
  - a download POST carries `site_scan.token` after the audit answered;
  - the proxy passes the header.
- Suites green, counts up by the new cases.

## Prod proof (R151: 20 of 20)

On prod after the ship, through the gate: Generate (audit with `include_scan_token`) for 5 Denver pins, then 4 downloads each at +0, +30, +90 and +150 s, one of each kind: pdf, xlsx, crew-pdf, quote. That's 20 downloads, carrying the token as the site does. Each must answer 200 with `x-site-scan-source: token`. Then one tampered token → 400 `site_scan_token_invalid`. Plus one browser run on `/sandbox`: Generate, then a card download's request carries the token and its response header reads `token`.
