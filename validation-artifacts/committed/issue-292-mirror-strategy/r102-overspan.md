# R102: Overspan as an optional first-choice mirror

R102 is quoted verbatim in `rulings.md`. In short: build the framework, with Overspan asked first only when an `OVERSPAN_API_KEY` Modal secret exists. With no key, behaviour is byte-identical, and that has to be proved. The free mirrors stay as the fallback, and the key goes into the R29 check as optional. Overspan is earmarked, not live: Linear CON-39, revisited every two weeks.

## What Overspan is (read 2026-10-06; it wasn't in the repo before)

Overspan is a hosted, keyed Overpass API running the open-source Overpass software, read from https://overspan.dev/ and https://overspan.dev/docs:
- **Endpoint:** `https://api.overspan.dev/api/interpreter`.
- **Request format:** Overpass QL by POST, `data=...`. That's the form `_mirror_post` already sends.
- **The key** is accepted three ways: a path segment, `?key=`, or `Authorization: Bearer <key>`. The docs recommend headers over a key in the URL, which risks exposure in logs.
- **Limits:** tiered, hard caps, with a 429 carrying `Retry-After`. Indie: 60/min, 2 concurrent, 60 s max timeout.
- **Default timeout:** a query without `[timeout:]` gets 25 s. Ours all set `[timeout:10]` (`site_detection.py`).

## The build (branch `issue-292-overspan`)

- **`src/rules/site_detection.py`:**
  - New constants: `OVERSPAN_URL`, `OVERSPAN_KEY_ENV = "OVERSPAN_API_KEY"`, and `OVERSPAN_HEAD_START_S = 4.0`, which is **CHOSEN** (Rule 12): #292's windows put a healthy free answer at a 2.2–11.6 s median.
  - `_race` tries `_race_overspan_first` only when the key is set and Overspan isn't in a 429 cool-down. Otherwise it runs exactly as before.
  - **How the first-choice race works:**
    - Overspan is asked alone for the head start, and its valid answer wins.
    - If it fails (any status, remark or invalid answer; a 429 also starts its R73 cool-down), the free mirrors are asked at once.
    - If it's still out when the head start ends, the free mirrors join the race and the first valid answer wins.
    - It uses the same hard deadline (R71), cancellation and refusal text as `_race`.
- **The key** rides `Authorization: Bearer` on Overspan's requests only, added in `_mirror_post`. The URL holds no key, so refusal text and the audit's `mirror` never print it (tested).
- **`modal_app.py`:** `_optional_secrets()` attaches the `overspan-api-key` secret only if it exists, and only during a ship deploy (`CONESTRUCT_SHIP_DEPLOY=1`). Importing the module elsewhere (tests, CI, the container) makes no Modal call. With no secret, the deploy carries exactly today's three secrets.
- **`scripts/ship.ps1`:**
  - The R29 step gains an optional line, read from `modal secret list --json`: "Modal secret overspan-api-key absent -- scans use the free mirrors only (as before). Not required", or "present". It never stops a ship.
  - The deploy step sets `CONESTRUCT_SHIP_DEPLOY=1` around `modal deploy`.
- **The R29 list (`scripts/production-env.txt`) is unchanged.** It's the Vercel list: `vercel-env-check.ps1` reads Vercel's Production rows and only the `required` lines, and Overspan's key is a Modal secret the site never reads. So "the R29 env check as optional" is met in ship.ps1's R29 step. A `not-required` line in the Vercel list would claim a Vercel variable that doesn't exist. **Flagged for Ryan,** in case he meant the list itself.

## Proof: no key is byte-identical

- `tests/test_overspan_mirror.py::test_no_key_asks_exactly_todays_mirrors_with_todays_headers` records every request the real `_mirror_post` sends, by patching only the httpx client. With no key it sees the two free mirrors, `data={"data": query}` and `{"User-Agent": USER_AGENT}`, nothing else.
- It and the whole existing race suite (`tests/test_site_detection.py`) were run against `a748a7b`'s `site_detection.py` and against this branch's. Both gave `52 passed`.
- `tests/test_modal_optional_secret.py`: outside a ship deploy nothing is looked up; a ship deploy with no secret attaches nothing.
- Live check on the real Modal account (read-only): `overspan-api-key` lookup raises `NotFoundError`, and the ship.ps1 snippet prints "absent; names: sentry-dsn,mapbox-token,conestruct-render-secret".

## With a key (red first, then green)

`tests/test_overspan_mirror.py` checks four things:
- Overspan is asked first, with a Bearer header and no key in the URL.
- A failure (429) sends the free mirrors out at once, without the key.
- A slow Overspan lets them in after the head start.
- The key never reaches a refusal.

Before the build, 4 of these 5 tests failed and only the no-key test passed. It's the identity guard, and passes on both.

## Rule 5 churn

- **No key (today's prod):** none. Same requests, same deploy, same output. ship.ps1 prints one more line.
- **With a key** (not live until CON-39 decides):
  - scans go to Overspan first;
  - the audit's `mirror` can read `https://api.overspan.dev/api/interpreter`;
  - refusal text can name it.
- **The prediction:** written with the build, not committed before it. The no-key half was predicted by the ruling itself.

## The acceptance windows (the numbers the #292 comment cites)

`probes/accept-summary.txt`, from `probes/summarize_accept.py` over `probes/out/window-accept-*.jsonl` (committed here; they were untracked):

| Window | Refused | Median scan |
|---|---|---|
| Morning (2026-10-05 15:15Z) | 1/10 | 11.6 s |
| Midday (18:07Z) | 1/10 | 8.1 s |
| Evening (2026-10-06 01:07Z) | 0/10 | 2.2 s |
| **Overall** | **2/30** | 5.9 s |

Both refusals had the same shape: "scan budget exceeded (20 s); overpass-api.de: 504 Gateway Timeout" (colorado-blvd in the morning, federal at midday). 2 of 30 is 1 in 15, so the bar of ≤ 1 in 20 is missed. Prod was `a5b4e12` throughout.
