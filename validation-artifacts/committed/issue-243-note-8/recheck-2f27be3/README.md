# #243 re-check at `2f27be3` (2026-09-30)

The checkpoint (`../checkpoint.md`) was measured on 2026-09-26 at `0ddc85e`. Since then 186 files
changed on main (the coming-soon gate, the ship loop, the R37 copy pass). This dir re-runs its
probes at `2f27be3` = `main` = the prod backend `healthz` sha (read 2026-09-30 15:58Z and again
by `note8_probe.py`).

## The probes, copied forward

`../probes/` is an archive, so it isn't edited. The copies here differ from it in three ways:

- **The gate header.** `note8-sweep.cjs` goes through `scripts/gate.cjs` `applyGate`, and
  `note8_probe.py` through `scripts/gate.py` `gate_headers`. Prod `/sandbox` and `/api/*` sit behind
  the coming-soon gate now. The token came from the environment and appears in no file here
  (checked with a fixed-string grep).
- **The preview audit.** Choosing the side now fires a preview `/api/render/audit`. That answer set
  the old sweep's `auditDone` before Generate, and the first Broadway capture read the preview
  (`site_scan.status = not_run`, `not_requested`). `auditDone` is now reset before Generate is
  clicked.
- **The settle wait.** The page text is taken once GENERATING has gone (up to 90 s), not 6 s after
  the audit answers.

## Results

| Probe | Output | Against 09-26 |
|---|---|---|
| `note8-sweep.cjs`: prod `/sandbox`, 1440 px | `prod/broadway-*` (16:07Z), `prod/denver-demo-*` (16:04Z), `prod/federal-*` (16:02Z) | Broadway and the demo pin show the same rows, counts and flags |
| `note8_probe.py`: prod posts + replay at this checkout + the options + the negative case | `note8-probe.txt` | **byte-identical except the healthz line** (`diff` with timestamps stripped) |
| `churn_predict.py` | `churn-predict.txt` | **byte-identical** |
| `federal_replay.py`: #243's own pin, in-process | `federal-replay.txt` | new |
| `federal_traceback.py` | `federal-traceback.txt` | new (a side finding) |

`tests/fixtures/tiering/tiering-expectations.json` has not changed since `0ddc85e`. The six tiering
fixtures changed only in the copy pass's punctuation (em dash to colon in `rule` / `action`). No
Note 8 leaf moved.

## The side finding: #243's own repro pin 500s

- **What happens:** N Federal Blvd, 39.7342642691076, −105.02504468168067, is the pin in #243's
  body. Driven through prod `/sandbox` today it confirms no road, because the picker offered no
  candidate matching `FEDERAL` within 60 s. It then Generates as shoulder, 65 mph, rural divided.
- **What prod does:** both `/api/render/audit` and `/api/render/device-breakdown` return 502. The
  Modal log shows the backend's `/render/audit` and `/render/device-breakdown` returning 500 at
  about 17 s.
- **Reproduced locally:** the same body returned 200 once in 3.2 s (scan 3,145 ms, Note 8
  `7 left, 11 right`), then 500 on every later try (six, 17.6–20.5 s).
- **The cause** (`federal-traceback.txt`): `src/rules/site_detection.py:981`,
  `_bearing_from_elements`, does `a["lat"]` on a way-geometry entry that is `None`. That makes the
  whole render fail rather than the scan refuse.
- **Scope:** this is not #243. It is recorded here because it blocks #243's own acceptance pin on
  prod. It needs its own issue.
