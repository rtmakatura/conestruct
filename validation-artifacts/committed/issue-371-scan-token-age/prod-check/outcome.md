# #371 production check of `1e0b0c7` (2026-10-23 03:01 UTC)

SHIP VERIFIED at `1e0b0c7` (healthz = `1e0b0c7`; frontend served `30cc023`, build skipped, no site change). `check.py` ran through `www.conestruct.com/api/render/*`; its answers are in `results.json`. It writes no token, and `tests/test_no_committed_scan_tokens.py` passes on this tree.

| Check | Token's signed scan | Answer | Expected |
|---|---|---|---|
| Fresh: F1 Generated with `include_scan_token`, then its PDF | 2026-10-23T03:01:27Z | 200, `x-site-scan-source: token`, 947,192 bytes | ✓ |
| issue-331's old token (on main until `1e0b0c7`) on F1's PDF | 2026-10-16T22:51:45Z, 148.2 h | 400 `site_scan_token_invalid`, the expired message, reason "the scan is 148.2 h old; a token is honoured for 12 h" | ✓ |
| `a408abe` F1's committed token on F1's PDF | 2026-10-22T20:55:37Z, 6.1 h | 200, `token` | ✓ inside 12 h (R1); refused from 2026-10-23T08:55:37Z |
| `a408abe` F10's committed token on F1's PDF | 2026-10-22T21:04:47Z, 6.0 h | 200, `memo` (another corridor's token is ignored, #307) | ✓ |

Result: PASS, 4/4. The 30 tokens `a408abe` committed were signed between 2026-10-22T20:55:37Z and 21:39:03Z, so every one is refused from 2026-10-23T09:39:03Z (12 h, R1).
