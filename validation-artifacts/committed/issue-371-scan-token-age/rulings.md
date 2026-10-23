# #371 rulings: a site-scan token is honoured for 12 hours, and no committed file holds one

Built on #370's audit evidence `4a71429` (`issue-370-audit-lane`), which ships with this branch.

Governing rules: Rule 10 (a stale answer presented as current is a violation) and Rule 12 (the limit is a chosen number, marked CHOSEN). Ryan, 2026-10-22, on #370's findings review: an age limit, no secret rotation; the fetch scripts strip tokens, with a test.

## Rulings

- **R1 (R145 self-ruled): the limit is 12 hours, CHOSEN.** `MAX_AGE_S = 12 * 3600` (`src/api/scan_token.py`). No source sets this number. Here is the reasoning:
  - A token only has to last from a Generate to its downloads. The page keeps it only while the scenario it was issued for stands unchanged (`GeneratorShell.tsx:433-439`; any edit drops it).
  - 12 h covers a plan generated in the morning and downloaded at the end of the shift. It refuses yesterday's scan, which would print as the plan's site conditions on a new day.
  - The memo's 120 s (`MEMO_TTL_S`) isn't a model: that number is one Modal request lifetime, a cache bound, not a freshness rule. #307 exists because 120 s was too short for downloads.
  - Every committed token dates from 2026-10-22 or earlier, so all of them are refused from 2026-10-23 12:00 UTC at the latest. No secret rotation (Ryan).
  - The boundary is inclusive: exactly 12 h old is honoured, a second more is refused.
- **R2 (R145 self-ruled): the age check is `verify_current_scan`, a second function, and `verify_scan` keeps its contract.** The issue placed the check "in `verify_scan`" and also asked that the existing #307 cases stay unchanged. Those cases sign fixed dates (`2026-10-15T12:00:00+00:00`, and `"t"`), so an age check inside `verify_scan` would change them. `verify_current_scan` runs `verify_scan`, then the age check. The endpoint (`_verified_scan_token`, `render_api.py`) calls it, and it's the only call site that serves a scan. A `measured_at` with no time zone, or one that won't parse, is `ScanTokenInvalid`. A future `measured_at` is allowed: the server signed it, so a skew of a few seconds between containers isn't refused.
- **R3 (R145 self-ruled): an expired token has its own message.** It's the same 400, `site_scan_token_invalid`, and `reason` gives the age ("the scan is 13.0 h old; a token is honoured for 12 h"). The download error shows `detail.message` (`lib/download-error.ts`). For an expired token that's "This download carried a copy of the plan's site scan from more than 12 hours ago. Generate the plan again, then download it." The old message ("couldn't be verified") would misdescribe a valid token that's too old. Neither the code nor the frontend changes for any other refusal.
- **R4 (R145 self-ruled): the repo test reads the token's shape anywhere in a committed file, not only under a `site_scan_token` key.** A token is `<payload>.<mac>` in base64url, and the HMAC-SHA256 MAC is exactly 43 characters. The fetch scripts also send the token inside `site_scan.token`, so a request written to disk would carry it under another key. On the base tree it finds exactly one file, `issue-331-lsd-sign-distance/prod-d4c244f/audit.json`.

## Rule 5 prediction (before the commit of the diff)

- **Moves:**
  - A download (`/render/pdf`, `/xlsx`, `/markdown`, `/audit`) whose token's scan is more than 12 h old answers 400 `site_scan_token_invalid` with the expired message. It used to serve the old scan with `x-site-scan-source: token`.
  - A token whose signed `measured_at` doesn't parse, or has no time zone, now answers the same 400 with the general message. The server never signs one, so no live request moves.
  - `issue-331-lsd-sign-distance/prod-d4c244f/audit.json`: the `site_scan_token` key is removed. Every other key and byte stays the same (compared after a JSON load).
  - The two audit fetch scripts write `audit.json` without the token, re-serialised with `json.dumps` and no longer the raw response text. Error responses are still written as raw text.
- **Byte-identical:** every request without a token; a fresh token's download; the audit response, with or without `include_scan_token`; every refusal other than the expired one; the frontend (no change); all other committed evidence files.
- **Tests:** the 15 existing #307 cases are unchanged. New: two cases in `tests/test_scan_token_307.py` (unit boundary and bad times; through the app, 13 h → 400 and 60 s → `token` with no Overpass call) and `tests/test_no_committed_scan_tokens.py` (2 cases).

## Proof

- Red proof of the repo test: `git archive HEAD validation-artifacts/committed` (base `4a71429`) extracted to a scratch directory. `token_files` on it returns `['issue-331-lsd-sign-distance/prod-d4c244f/audit.json']`, and on the fixed tree `[]`.
- The expiry cases call `verify_current_scan`, which doesn't exist on the base, so they fail there.
- Local note: `tests/test_overspan_mirror.py::test_a_slow_overspan_lets_the_free_mirrors_in_after_its_head_start` fails on and off on this machine. It failed in the baseline run before this change loaded, and 2 of 3 times on its own. Filed as #380; this branch doesn't touch it.
