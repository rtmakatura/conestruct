# Arc 14 — the four authorized dispatches (#169 + #170 post-merge proof)

Run 2026-08-05 after Ryan's ship, at main = healthz = `7e13bb6` (the
infra tip rebased onto the arc13 evidence `c4fb75b`; gate verified
before dispatching). The `gh workflow run` exception is Ruling 2 of
the Arc 14 GO — exactly these four, recorded here; all other `gh`
writes stay read-only as standing.

| # | Dispatch | Run | Conclusion | Annotations |
|---|---|---|---|---|
| 1 | modal-deploy-check, `healthz_url_override=https://127.0.0.1:1` | 31018571748 | **failure** — required | 2, both the run's own loud failure (the `##[error]` below + "Process completed with exit code 1") — no deprecation warning |
| 2 | modal-deploy-check, clean | 31018656982 | **success** | **ZERO** |
| 3 | python-tests | 31018670240 | **success** | **ZERO** |
| 4 | frontend-tests | 31018673383 | **success** | **ZERO** |

## Dispatch 1 — the Rule-10 live proof (red on dead host)

Probe step log (verbatim):

```
Using workflow_dispatch override URL: https://127.0.0.1:1
Attempt 1/3: could not reach https://127.0.0.1:1/healthz (fetch: TypeError).
Attempt 2/3: could not reach https://127.0.0.1:1/healthz (fetch: TypeError).
Attempt 3/3: could not reach https://127.0.0.1:1/healthz (fetch: TypeError).
##[error]Modal /healthz unreachable at https://127.0.0.1:1 after 3 attempts (network/timeout/DNS). Cannot verify the deployed backend — investigate the backend or the MODAL_RENDER_URL variable.
```

The #168 message text, exit-1 behavior, and 3-attempt/10-s cadence all
preserved through the extraction. Step conclusions: probe **failure**,
"Determine whether a backend deploy is owed" **skipped**, "Reconcile
modal-deploy-needed issue" **skipped** — the reconcile step is gated on
`steps.served.outputs.reachable == 'true'`, so the red run cannot open
a stray `modal-deploy-needed` issue by construction (the GO's noted
possibility did not and cannot occur on this path; no stray issue
exists). Cosmetic note, stated not discovered: the per-attempt line
reads `(fetch: TypeError)` here — Node's fetch wraps a TLS/refused
failure without a populated `cause.code`, so the log shows the error
name; the `::error::` taxonomy line is unaffected.

## Dispatch 2 — the full green path end-to-end at the new pins

```
Served SHA: 7e13bb6c61cae5bb10a46bcbb93c249a894e6df5
No backend-affecting changes between served (7e13bb6...) and HEAD (7e13bb6...) — backend is current.
Backend is current; no open reminders to close.
```

Probe (node script) → owed-step (unchanged yml) → reconcile
(github-script@v9.0.0) all ran green, with `actions/checkout@v7.0.1`
visible in the step list — the bumped pins executing, not just merged.

## #170 acceptance closed

Before (annotations-before.md): every run of all three action-using
workflows carried the Node-20 deprecation warning. After: **zero
annotations** on runs 2/3/4 (checked via
`gh api .../check-runs/<job>/annotations` — the same probe that
reproduced the defect proves its absence). `vercel-deploy.yml` was
never in scope (no actions).
