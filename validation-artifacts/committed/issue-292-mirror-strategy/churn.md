# issue-292-mirror-strategy — churn, predicted against actual (Rule 5)

The prediction is `checkpoint.md` §4, written at `88eea3c` before Ryan ruled. R69's validity
clause (as corrected by R74) and R73's cool-down came after it, so the tests they add are new
claims, not churn.

## What the build changes (behaviour, deliberately)

- **Both live mirrors are asked at once** (R69, as corrected by R74). The first answer that is
  valid (HTTP 200, JSON, no `remark`) and still has content after #304's cleaning wins, and the
  other request is cancelled. #304's checks clean; they don't disqualify. `_emptied_by_cleaning`
  reads the cleaning's own predicates (null points skipped, road ways outside the `around:` circle
  and scan elements beyond the boxes' margin dropped) and changes nothing. The cleaning itself
  stays downstream. A genuinely empty answer counts; only one cleaned down to nothing loses.
- **The first build (`17f7276`) had R69 as first worded:** any null point or out-of-box element
  disqualified the answer. On the Federal pin that made fr's answer always lose. R74 corrected
  it; this rebuild replaces that check.
- **Kumi is gone** (R70). `OVERPASS_MIRRORS` is `overpass-api.de`, `overpass.openstreetmap.fr`.
- **The budget is a hard deadline** (R71). Every request still open when it passes is cancelled.
  `PER_MIRROR_READ_S` (7 s) is retired; `PER_MIRROR_CONNECT_S` (3 s) stays.
- **429 is honoured** (R73). The mirror is left alone for its `Retry-After`, else
  `RATE_LIMIT_COOLDOWN_S` = 60 s (CHOSEN). Nothing is retried. The User-Agent, already
  `conestruct-traffic-control-tool/0.2 (+https://conestruct.com; hello@conestruct.com)`, is
  unchanged.
- **A 400 no longer stops the other mirror.** It's that mirror's refusal; the other's answer stays
  in play. (#256 ruling j had already made 429 behave this way; R69 extends it to every failure.)
- **One TLS context per container** (`_tls_context`). Not in the checkpoint: the first test run
  showed a fresh `httpx.AsyncClient` spends 0.25 s loading the CA bundle (dev PC, httpx 0.28.1),
  out of the deadline. The old `httpx.post` paid it per mirror.

## Wire

- No new field. `site_scan.mirror` names the winner, or the last mirror heard from on a refusal.
- A refusal's `error` lists every mirror's reason, in mirror order: `"<de>: 504 Gateway Timeout;
  <fr>: overpass remark: …"`. A deadline refusal is `"scan budget exceeded (20 s)"` followed by any
  mirror that failed before it. Predicted ("lists both mirrors' failures"): matched.

## Tests: predicted against actual

| Test | Predicted | Actual |
|---|---|---|
| `test_point_scan_4xx_hard_stops_the_mirror_list` | moves | renamed `…_4xx_from_every_mirror_is_an_honest_refusal`: both asked, one request each |
| `test_429_on_the_first_mirror_still_reaches_a_later_clean_one` | moves | keyed on the URL, both asked |
| `test_budgeted_chain_reaches_the_third_mirror` | moves | replaced by `test_a_stalled_mirror_never_costs_the_other_mirrors_answer` (either mirror stalled) |
| `test_validate_budget_exceeded_reports_check_unavailable` | moves | real 1 s deadline, both requests cancelled |
| `test_generic_details_append_safe_on_every_bucket` | "if its stub counts calls" | **did not move** (it doesn't) |
| the 7 `test_site_scan_ingenerate.py` tests | move | all 7 moved: the `_mirror_post` seam; the budget test renamed `…_cuts_off_every_mirror`; the every-mirror remark refusal names both remarks; a clean empty answer shows both mirrors asked |
| `test_per_mirror_cap_constants_are_the_ruled_values` | **not predicted** | renamed `test_mirror_constants_are_the_ruled_values`: two mirrors, no read cap, 60 s cool-down |
| `test_audit_endpoint.py::test_audit_completes_with_check_unavailable_when_overpass_stalls` | **not predicted** | real deadline (budget patched to 1 s), both requests cancelled |
| the 4 `httpx.post` fixtures in `test_site_detection.py` (`stub_overpass`, `_down`, `_4xx`, `_429`) and the 9 tests through them | **not predicted** (the checkpoint said only tests stubbing `_overpass_request_with_fallback` whole were untouched, and missed those stubbing the transport) | moved to the `_mirror_post` seam; test bodies unchanged |
| `tests/corpus/conftest.py` network guard | **not predicted** | also blocks `site_detection._mirror_post`: the race's `AsyncClient` instance method wasn't covered by the module-level patch |
| `tests/conftest.py` | **not predicted** | an autouse fixture clears the cool-down state, so one test's 429 can't decide another's race |

**Misses:** three test sites and two conftests, all from one blind spot. The checkpoint counted
the tests that stub the function whole but not the ones that stub the transport under it.

**New tests (R69/R71/R73/R74 claims, not churn):** 14 in `test_site_detection.py` and 1 in
`test_site_scan_null_geometry.py`. They cover:
- a stalled mirror never costs the other's answer, whichever one stalls;
- the deadline is hard, against a trickling read;
- a deadline refusal still names a mirror that failed first;
- both failing names both;
- an answer with null points still wins when it has content (R74);
- an answer cleaned to nothing loses to the other mirror's (R74);
- answers cleaned to nothing by both are an honest refusal;
- `_emptied_by_cleaning` against each kind of element, and an empty answer counts;
- a corridor scan takes a genuinely empty answer over one cleaned to nothing;
- `Retry-After` honoured, then the mirror skipped;
- the 60 s default (R75);
- every mirror cooling down refuses without a request;
- the User-Agent names Conestruct and a contact;
- a 400 from one mirror leaves the other in play;
- **R74's Federal proof** (`test_the_real_fallback_capture_wins_the_race_and_matches_the_primary`):
  - the real #304 captures go through the real race;
  - fr's answer, with way 42125193 and its null points, arrives first and wins;
  - cleaning drops exactly that one road way;
  - the audit equals the one where the primary's capture wins, apart from `mirror` and
    `response_bytes`.
  Proven red against the first build's check: `17f7276`'s `_answer_problem` swapped in for
  `_emptied_by_cleaning` fails the test at `mirror == fr`, because the primary won.

**Probes (R76):**
- `build_queries.py` and `measure_window.py` add the Federal pin, sent as its captured body.
  - The regenerated `out/queries.json` keeps the 9 pins' queries byte-identical.
  - Its Federal query equals #304's `federal-folded-query.txt`.
- `measure_window.py` refuses an `accept-*` window while prod still serves `ccb5042`.
- `summarize_accept.py` prints the refusal rate and median scan time per window.

**Full suite:** 2483 passed, 2 skipped (the two V1.1 TA-10 deferrals).
