# Arc 2 verification evidence — stale-as-current (#197 + #185 #183 #187 #192 #196 + #189-3)

Second tenant of `validation-artifacts/committed/` (tracked per the #160
ruling). Branch `issue-197-stale-as-current`, nine commits, idiom in
`conestruct/site/lib/answer-stamp.ts`.

| File | What it proves |
|---|---|
| `defect-repro-at-cb0472e.test.tsx` | The Step-2 mounted-DOM defect captures, written to PASS on the defective behavior at `cb0472e` (pre-arc HEAD): #187 stale cited numbers + live Audit PDF under a declined line, #192 total death + COMPUTING masking a settled refusal, #196 CTA re-enable in the re-fetch window + second refusal pointing at an unmounted row, #183 download href pinned to the DB row while the POSTed scenario carries the edit, and the OutputCards error sticking. HISTORICAL — run against `cb0472e`, not against post-arc HEAD (the fixes invert these assertions; the in-tree regression suites below are the ongoing proof). |
| `defect-repro-at-cb0472e-output.txt` | Its 5/5 PASS run output at `cb0472e` (a pass = a reproduction). |
| `quote-live-capture.py` | #185 evidence generator against the deployed backend (reads `MODAL_RENDER_URL`/`SECRET` from `conestruct/site/.env.local`; read-only, no DB writes). One trace: breakdown @ overhead 10% (what the stale screen keeps rendering), quote XLSX bytes @ overhead 20% (what download produces after the edit), correct recompute, and the #135 rounded-sum checks. |
| `quote-live-captures.txt` | Its output, run 2026-08-01 @ healthz `cb0472e` (pre-rounding build): screen total **$1,794.43** under an "overhead 10%" header vs XLSX **TOTAL ESTIMATE 1957.56** — a **$163.13** screen/file disagreement on the bid surface; raw float `1794.4299999999998` confirming no cents-rounding at computation (the #135 fix in this arc lands at its deploy). |
| `payload-capture-189-3.mts` | #189-3 evidence generator: pre-fix handler order (relays survive a settled-null save under new coordinates) vs post-fix `clearDetectionRelays`. Rerun: `npx -y tsx payload-capture-189-3.mts`. |
| `payload-captures-189-3.txt` | Its output: pre-fix wire payload carries `detectedLanesTotal: 5` (E Colfax 2+2+1) under the Cheesman Park pin with `confirmedRoad: null`; post-fix payload carries no relay field at all. |

Regression pins (in-tree):
- `conestruct/site/lib/answer-stamp.test.ts` (#197 identity contract)
- `conestruct/site/components/OutputCards.test.tsx` — "download errors carry their input identity" (#197 instance, mounted)
- `tests/test_quote_rounding.py` (#185/#135, drift-demonstrating backend fixture)
- `conestruct/site/components/QuotePanel.invalidation.test.tsx` (#185, mounted through PricingCard)
- `conestruct/site/components/GeneratorShell.saved-dirty.test.tsx` (#183, mounted + PlanSaveButton contract)
- `conestruct/site/components/AuditTrail.declined-stale.test.tsx` (#187, mounted pin-move-to-refusal)
- `conestruct/site/components/GeneratorShell.regenerate-mounted.test.tsx` (#192, mounted + StatusBar precedence units)
- `conestruct/site/components/GeneratorShell.confirm-window.test.tsx` (#196, mounted)
- `conestruct/site/components/GeneratorShell.picker-reapply.test.tsx` "#189-3" cases + `lib/scenarios/clear-detection-relays.test.ts` (#189-3, payload + unit)

`live-checks/` — post-deploy live-site verification: headless-Chromium
run against the production sandbox at build `217a641` (frontend bundle +
backend healthz + git all agree), 30/30 assertions passed, read-only,
including the cent-exact screen/XLSX agreement for #185. #183 blocked
(needs a saved DB row — Ryan decides on seeding). See
`live-checks/transcript.md`.
