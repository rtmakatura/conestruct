# Rule 5 outcome: issue-307-signed-scan (pre-ship; the prod proof is appended after the ship)

Prediction: `prediction.md`, committed in `607b0773` before any code. Base: `11443c3a`.

## Predicted and found

| Predicted | Outcome |
|---|---|
| `src/api/scan_token.py`: `sign_scan` / `verify_scan`, HMAC-SHA256 keyed off `RENDER_API_SECRET` | as predicted; key `sha256(b"conestruct site-scan token v1" + secret)`; payload zlib JSON, base64url |
| `SiteScanRequest.token`; `SiteScanResult.source` / `memo_entry`; a matching token served like a memo hit | `src/api/site_scan.py`. Pinned: `memo_hit` true, flags and `measured_at` equal to the Generate's |
| `_placements_for` verifies first: invalid → 400 `site_scan_token_invalid`; other corridor → scan | pinned: tampered token → 400 with "Generate the plan again"; `workLen` 1500 with a 1000 token → scanned (one Overpass call) |
| `/render/audit` + `include_scan_token` → `site_scan_token`; refused elsewhere | pinned: absent without the opt-in; `/render/pdf` with it → 400 |
| `x-site-scan-source` header via a per-request holder | pinned: `scan` on the Generate; `token` on pdf, xlsx, markdown, crew-pdf, audit-pdf and quote with the memo cleared and **0 Overpass calls**; absent when no scan was requested |
| bodies byte-identical without the opt-ins; no snapshot moves | no snapshot or fixture file changed; Python suite 2868 passed, 2 skipped (2854 + 14 new) |
| frontend: the audit asks for the token; `downloadScenario` carries it to the cards, the quote and the zip; the audit never carries one; the proxy relays the header | pinned in `GeneratorShell.scan-token.test.tsx` (3), `site-scan.token.test.ts` (2), `render-proxy.scan-source.test.ts` (2) |
| mypy stays at 0 | `Success: no issues found in 49 source files` |
| site suite green, +new cases | 2303 passed (2296 + 7); `tsc` 0 errors |

## Not predicted

- **Two tests pinned shapes this arc extends:**
  - `GeneratorShell.input-gating.test.tsx` pins the audit body exactly. It now includes `include_scan_token: true` beside #306's `include_breakdown`.
  - `tests/test_r117_jurisdiction_raised.py` calls `render_api._audit_build` directly and unpacked three values. It now unpacks four, since `_audit_build` returns the scan result too, so `/render/audit` can sign it.
- **A token-served scan doesn't seed the receiving container's memo.** The memo write is skipped on any hit, and the token is the download's own copy, so there's nothing to share.

## Verifier REPAIR (cycle 1), fixed

`verify_scan` encoded the token's body to ASCII outside its `try`, so a non-ASCII token (`é.AAAA`) raised `UnicodeEncodeError` before the MAC check. That reached the client as a 500 instead of the 400 `site_scan_token_invalid`. The verifier reproduced it. The encode now sits inside the malformed-token guard. Pinned: `é.AAAA` and `<body>.é` are `ScanTokenInvalid`, and `/render/pdf` with `é.AAAA` returns 400 `site_scan_token_invalid` (`test_a_non_ascii_token_is_the_same_honest_400`). Python suite +1: 2869 passed, 2 skipped.

Also noted by the verifier: `prediction.md` wrote `sign_scan(entry)`, while the code's signature is `sign_scan(key, buckets, measured_at, duration_ms)` (the entry's four parts).
