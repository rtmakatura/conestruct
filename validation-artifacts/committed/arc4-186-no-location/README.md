# Arc 4 verification evidence — #186 (no location, no certification)

Fourth tenant of `validation-artifacts/committed/` (tracked per the #160
ruling). Branch `issue-186-no-location`, two code commits + this
evidence.

| File | What it proves |
|---|---|
| `defect-repro-at-4f34754.test.tsx` | The Step-2 mounted defect capture, written to PASS on the defective behavior at `4f34754` (pre-arc HEAD): a fresh /sandbox mount with no picker interaction POSTs `meta.lat 0 / meta.lng 0` (the Gulf of Guinea) to both verification endpoints, the strip certifies VERIFIED · READY FOR TCS REVIEW — the product's strongest claim, about nothing — and Generate is enabled, a click flipping to the post-generate stage. HISTORICAL — run against `4f34754`, not post-arc HEAD (the fix inverts these assertions; the in-tree regression suites below are the ongoing proof). |
| `defect-repro-output.txt` | Its 2/2 PASS run output at `4f34754` (a pass = a reproduction), with the captured POST coordinates and strip verdict. |

Regression pins (in-tree):
- `conestruct/site/components/GeneratorShell.no-location.test.tsx` (#186,
  mounted — fresh load renders AWAITING LOCATION with no verdict and a
  Generate gated with the stated reason, whose click flips nothing and
  POSTs nothing; a pinned scenario behaves byte-identically to pre-#186;
  manual-entry coordinates enable both surfaces, lat alone does not;
  INVALID INPUT outranks the missing pin; `hasLocation` unit cases)
- `conestruct/site/components/StatusBar.test.tsx` (#186, component —
  the AWAITING LOCATION branch is chromeless neutral and never a verdict
  even over a clean audit; it outranks COMPUTING; inputError and refusal
  outrank it)

Frontend-only arc, deliberately: location-presence is input completeness,
not a compliance predicate (rule 3 untouched); the backend already
renders absence as absence on every coordinate surface it owns
(LOCATION "—", no aerial, corridor validation unchecked, `or None`
sentinels) and legitimately renders coordinate-less plans via the CLI.
No wire change, no deploy-order constraint. `schemas.py` change is a
comment only. The post-fix live checks follow the ship (Arc 1–3
pattern — the fresh-load state and set-location-enables flow are
trivially capturable read-only).
