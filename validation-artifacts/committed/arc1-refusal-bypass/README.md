# Arc 1 verification evidence — refusal-bypass / picker integrity (#181 + #189 + #190)

First tenant of `validation-artifacts/committed/` (tracked per the #160
ruling, 2026-07-30; the `.gitignore` carve-out lands with this arc).

| File | What it proves |
|---|---|
| `payload-capture.mts` | Evidence generator. Drives the REAL frontend modules (`applyClassification`, `carryMeta`, `carryAcrossKinds`, `applyOverridesToScenario`) in component-handler order and prints the wire payload before/after each triggering event, with the frontend gate-mirror verdicts. Rerun from this directory: `npx -y tsx payload-capture.mts`. |
| `payload-captures.txt` | Its committed output: #181 pre-fix payload loses all four lane relays on a kind switch (A2) and re-arms them post-fix (A3); #189's mid-flight save payload never receives relays; #190's no-change re-save reverts a manual speed edit pre-fix. |
| `live-backend-transcript.md` | The end-to-end proof against the deployed backend (`1513fbc`, healthz-verified): the bypass payload → HTTP 200 (plan generates); the relays-intact control and the post-fix payload → HTTP 400 (the #86 refusal). Same road, opposite outcomes by click order — closed by this arc. |

Regression pins (in-tree):
- `conestruct/site/components/GeneratorShell.kind-switch.test.tsx` (#181, payload-level)
- `conestruct/site/components/LocationPickerModal.state-contract.test.tsx` — "in-flight detection gates Save" (#189, mounted)
- `conestruct/site/components/GeneratorShell.picker-reapply.test.tsx` — "#190" cases (payload-level)
- `conestruct/site/lib/scenarios/carry-across-kinds.test.ts` (#181 carry unit)
