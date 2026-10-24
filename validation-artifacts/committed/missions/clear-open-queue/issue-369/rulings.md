# #369 rulings: the band aerial's content-type names its bytes

Issue: https://github.com/rtmakatura/conestruct/issues/369. Branch
`issue-369-aerial-content-type`, stacked on
`issue-380-overspan-tick-tolerance` (`418a16e`). Mission tracking
issue #387.

## R1 (R145 self-ruled): sniff the bytes, don't trust a header
`render_corridor_map` (`src/api/render_api.py:1833`) now takes the media
type from the image's own signature via
`static_aerial.image_media_type` (`src/rendering/static_aerial.py:259`):
`89 50 4E 47 0D 0A 1A 0A` is `image/png`, `FF D8 FF` is `image/jpeg`.
The issue offered Mapbox's `content-type` or a sniff; the sniff wins
because the header is then a fact about the bytes actually served, it
needs no second return value from the fetch, and the existing
`httpx.get` stubs need no header. The issue's "fall back to image/jpeg
for the satellite style" is not taken: a guessed label is the bug this
issue fixes (Rule 10), so see R2.

## R2 (R145 self-ruled): bytes that are neither are refused
A 200 from Mapbox whose bytes are neither PNG nor JPEG answers 502
`{"status": "unavailable", "message": "the aerial image was not a PNG
or JPEG"}`, the same status and shape as a failed fetch, which the site
proxy already relays (`conestruct/site/lib/render-proxy.ts:405`) and the
band already reads a 502 as unavailable
(`conestruct/site/lib/corridor-aerial.ts:53`). Honest refusal beats silent
substitution (Rule 10). The message is new wording, inside existing
rules.

## R3 (R145 self-ruled): `fetch_png` is renamed `fetch_image`
As the issue proposes. The docstring says the image comes back as Mapbox
encodes it (JPEG for `STYLE`). Two test stubs patch the function by
name (`tests/test_corner_extension_geometry.py:137`,
`tests/test_no_crossing_marked.py:56`); both now patch `fetch_image` and
return a full PNG signature, since the route now reads the signature
(`b"png"` and `b"\x89PNG-test"` were not PNG signatures).
Three committed probe scripts also patch `fetch_png`:
`validation-artifacts/committed/issue-315-stale-left/probes/stale_left_probe.py:35`,
`validation-artifacts/committed/issue-317-316/probes/no_crossing_probe.py:35`
and `validation-artifacts/committed/issue-366-corner-geometry/sweep.py:42`.
They are past evidence for their own issues and are left unedited; after
the rename they can no longer be re-run as they are.

## R5 (R145 self-ruled): the route docstring follows the change
Folded in under the R154 fold test (same file, a few lines, no ruling).
The `render_corridor_map` docstring said "the laid-out corridor as a
PNG"; it now says the route sends Mapbox's image as it comes (PNG or
JPEG; the satellite style is JPEG), labelled by its bytes' signature, and
its 502 list adds the bytes that were neither a PNG nor a JPEG.

## R4 (R145 self-ruled): the proxy's own fallback is filed, not folded
`conestruct/site/lib/render-proxy.ts:418` still sets `image/png` when a
200 carries no `content-type`. It never fires (the backend always sets
one), and this branch touches no `conestruct/site/` file, so it fails the
R154 fold test. Filed as #390
(https://github.com/rtmakatura/conestruct/issues/390).

## Rule 5 churn (predicted before the diff, measured after)
Prediction: on production every 200 from `POST /render/corridor-map`
changes its `content-type` from `image/png` to `image/jpeg` (Mapbox
serves satellite-streets-v12 as JPEG); a PNG would still say
`image/png`. The image bytes, the status codes of every existing path,
the Static Images URL and query, and `cache-control` stay
byte-identical. One new path: non-image bytes answer 502 (was 200
`image/png`). PDF page 2 fetches its aerial separately
(`plan_sheet._fetch_mapbox_aerial`) and is untouched. No
`conestruct/site/` change. In tests: two stubs renamed, one existing
assertion (`content-type == "image/png"` with a PNG stub) unchanged,
three new tests.

Measured: `git diff --stat` on tracked files: 5 files,
`src/api/render_api.py`, `src/rendering/static_aerial.py`,
`tests/test_corner_extension_geometry.py`, `tests/test_corridor_map.py`,
`tests/test_no_crossing_marked.py` (83 insertions, 10 deletions, with
R5's docstring). Full suite, the diff-verifier's run (`pytest -q -rf`):
`3572 passed, 2 skipped` (3574 collected; base 3571, so +3, the three
new tests). An earlier run of mine gave `1 failed, 3571 passed, 2
skipped`, the one failure being
`tests/test_ci_check.py::test_still_running_at_the_limit_stops_and_says_how_long`,
which passed in the verifier's run: timing-flaky, not a hard fail, and
untouched by this branch; see `failing-tests.md` and #391. After my full
run, `ruff format` rewrapped one stub line in
`tests/test_no_crossing_marked.py`; that file re-run: `18 passed`. After
R5: `tests/test_corridor_map.py` `22 passed`; ruff check, ruff format
--check and mypy are clean. Matches the prediction.

## Evidence
- Red proof: the branch's `tests/test_corridor_map.py` run against
  `git archive 418a16e`: `3 failed`.
  `test_the_header_names_the_bytes_mapbox_sent[pin]` and `[laid_out]`
  fail `assert 'image/png' == 'image/jpeg'`;
  `test_bytes_that_are_no_image_are_refused_not_relabelled` fails with
  `JSONDecodeError` (the base answered the HTML bytes as a 200 image).
  On the branch all three pass.
- Payload level (Rule 11): the tests read the served response's
  `content-type` and bytes through the FastAPI `TestClient`, with
  `httpx.get` stubbed to return a real 4x4 JPEG made by Pillow (no
  Mapbox call).
- Base suite count: `3569 passed, 2 skipped` at `418a16e`, from
  `../issue-380/rulings.md`. This item's own baseline run was stopped
  part-way (files were edited while it ran), so it is not cited.
