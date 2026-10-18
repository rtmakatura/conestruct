# #340 production check of ecc2306 — PASS 3/3

Run 2026-10-17 against https://www.conestruct.com/api/render/audit (the site proxy, gate header from `.env.local`, never printed). Backend healthz: `ecc23062d696b60278a23b564e92d61574b74860` (`healthz.txt`); ship.ps1 reported FRONTEND CURRENT at `ecc2306`.

Each request is the shoulder audit's own committed request, posted unchanged: `validation-artifacts/committed/audit-shoulder/runs/<row>/request.json`.

## The three refusals (issue acceptance)
| Row | Input | Before (audit capture, `runs/<row>/audit.json`) | Now (`<row>.body.txt`) | Names field |
|---|---|---|---|---|
| X1 `x-speed-80` | speed 80 | `"Input should be less than or equal to 75"` | `400 {"detail":"speed: Input should be less than or equal to 75"}` | ✓ speed |
| X2 `x-speed-15` | speed 15 | `"Input should be greater than or equal to 20"` | `400 {"detail":"speed: Input should be greater than or equal to 20"}` | ✓ speed |
| X9 `x-lanes-5` | 5 lanes | `"Input should be less than or equal to 4"` | `400 {"detail":"lanes: Input should be less than or equal to 4"}` | ✓ lanes |

## Controls: other refusals carry no prefix
- `x-freeway-narrow` (a backend 400, `geometry_validation_failed`): the body passes through as before, no prefix.
- `x-i25-4x11` (a `value_error`, the drawable-width validator): no prefix. Its sentence differs from the audit capture because of #335's change (`8bbdc42`, shipped before this one), not because of #340.
