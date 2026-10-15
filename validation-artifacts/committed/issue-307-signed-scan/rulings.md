# issue-307-signed-scan: the rulings this arc is built under

**Issue:** #307, "Downloads re-run the site scan: a PDF, XLSX, crew sheet or quote can refuse on its own beside a plan that answered".

## R151 (Ryan, 2026-10-15), verbatim

> Ryan's answers (2026-10-15), R151:
> 1. #204: (a) saved plans stay off on prod until a lawyer reviews /terms and /privacy.
> 2. #202: (a), with a guard: the migration is additive only (new nullable column; nothing dropped, renamed or rewritten). Put the exact SQL in your report before the ship. If it needs anything beyond an additive change, stop and ask.
> 3. Saved-plan prod checks: (b) local and mounted tests only for now. Revisit when #204 turns saved plans on.
> 4. #242: (a) one line in the nav. Unslop rules for the copy.
> 5. #28: (a) close as not planned, with the reason.
> 6. #205: (a) the four cities stay unreachable until 02-JURISDICTION-DATA.md exists.
> 7. #128: (a) parked.
> 8. #146: (a) parked.
> 9. #307: (a) downloads send back a signed copy of Generate's scan. The server verifies the signature and refuses honestly if it's invalid. Prove 20 of 20 downloads on prod with no re-scan.
> Build #202, #242 and #307 in your order, close or park the rest with a comment each, and give a backticked result: line for "ship ready".

The measurement behind it: `validation-artifacts/committed/issue-307-download-rescan/measurement.md` (14 of 20 follow-ups re-scanned on prod `4c52c49`).

## R145 self-ruled (2026-10-15)

1. **What's signed is what the memo holds.** The scan memo stores `(buckets, measured_at, duration_ms)` under a key hashed from the corridor inputs (`_memo_key`), so the signed copy is exactly that tuple plus its key. A download whose own computed key matches is served from it, the way a memo hit is served (`memo_hit: true`), with no Overpass request. The plan is built from the same scan answer as the plan on screen, on any container, at any delay.
2. **The signature.** HMAC-SHA256 over the encoded payload, with a key derived from the render service's existing `RENDER_API_SECRET` (domain-separated: `sha256("conestruct site-scan token v1" + secret)`). No new secret, and a client can't forge one. The payload is compressed JSON, base64url-encoded.
3. **Invalid vs. not this scenario.**
   - **Invalid signature or malformed token:** an honest 400, `site_scan_token_invalid`, with a message naming the fix (Generate again).
   - **Valid token for a different corridor** (the scenario changed since the Generate): ignored, and the request scans as it does today. That request is for a different plan, so the Generate's scan isn't its answer.
4. **The opt-in shape, as #306's `include_breakdown`.** The Generate's audit sends `include_scan_token: true` and gets `site_scan_token` back only when its scan answered (status ok). It's accepted only on `/render/audit`. Without it every response is byte-identical: no snapshot moves.
5. **Where the token travels.** The shell keeps it stamped with the scenario the audit answered for. Only the download requests carry it (the five cards, the quote, the zip). The audit's own request never does, so a token arriving can't trigger another audit.
6. **The proof's signal.** Every render response gets an `x-site-scan-source` header (`token`, `memo`, `scan` or absent when no scan was requested). It's set from the scan result through a per-request holder, and the Next proxy passes it through. A download's body doesn't change.
