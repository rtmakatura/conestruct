# Arc 14 — Node 20 deprecation annotations, BEFORE state (#170)

Captured 2026-08-05 via `gh api repos/rtmakatura/conestruct/check-runs/<job>/annotations`
from the latest run of each workflow at main `b6d0b7f`. The issue cites
runs #494/#495 (2026-07-26); the warning is still live on today's runs
— reproduced, not assumed.

| Workflow | Run (databaseId) | Job | Annotation |
|---|---|---|---|
| Modal deploy check | 31009363794 (schedule, 2026-08-05T13:15Z) | 92317245115 | warning: "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: **actions/checkout@v4, actions/github-script@v7**. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/" |
| Frontend tests | 30979276441 (push, 2026-08-05T05:48Z) | 92220018977 | warning: same text, naming **actions/checkout@v4, actions/setup-node@v4** |
| Python tests | 30979276440 (push, 2026-08-05T05:48Z) | 92220018973 | warning: same text, naming **actions/checkout@v4, astral-sh/setup-uv@v5** |
| Vercel deploy | 30979276466 (push, 2026-08-05T05:48Z) | 92220018877 | **no annotations** — the workflow uses no actions (one curl step); out of #170's scope |

AFTER state (zero annotations expected on all three touched workflows)
is captured post-merge via the four authorized dispatches — recorded in
the follow-up evidence (`dispatch-record.md`), since it cannot exist
before the merged workflows run.
