# Arc 14 — action pin bumps (#170), Rule-12 provenance

Every target version verified at source on 2026-08-05: latest release
tag via `gh api repos/<action>/releases/latest`, declared runtime via
that tag's `action.yml` (`runs.using`). Version-bump-only; no workflow
logic changes; `vercel-deploy.yml` untouched (uses no actions — its
latest run carries zero annotations).

| Pin (before) | After | Runtime evidence | Intervening breaking changes vs our usage |
|---|---|---|---|
| `actions/checkout@v4` (modal-deploy-check, python-tests, frontend-tests) | `@v7.0.1` | v7.0.1 `action.yml`: `using: node24` (node24 since v5.0.0 — its release notes: "Update actions checkout to use node 24") | v6.0.0: "Persist creds to a separate file" — nothing in this repo consumes the credential file location. v7.0.0: "block checking out fork pr for pull_request_target and workflow_run" — our triggers are schedule/push/workflow_dispatch. Our inputs (`fetch-depth: 0` on modal-deploy-check; defaults elsewhere) unaffected. |
| `actions/github-script@v7` (modal-deploy-check) | `@v9.0.0` | v9.0.0 `action.yml`: `using: node24` | v9.0.0 breaking: `require('@actions/github')` fails; `getOctokit` becomes an injected parameter. Our reconcile script uses only the injected `github.rest.issues.*` + `context.repo` — neither pattern present. |
| `actions/setup-node@v4` (frontend-tests) | `@v7.0.0` | v7.0.0 `action.yml`: `using: 'node24'` (node24 since v5.0.0) | v5.0.0: automatic package-manager cache detection — moot, we set `cache: npm` explicitly. v6.0.0 limits auto-caching to npm — same. v7.0.0: ESM migration + new cache outputs — no input/behavior change for our usage. `node-version: 20` (the APP runtime it installs) is deliberately untouched — different subject from #170's action-runtime scope; Node 20 app-runtime EOL flagged to Ryan as a separate candidate issue. |
| `astral-sh/setup-uv@v5` (python-tests) | `@v9.0.0` — **exact tag, mandatory** | v9.0.0 `action.yml`: `using: "node24"` (node24 only since v7.0.0 — v6 was still node20: v7 notes, "switching from node20 to node24") | v6.0.0: venv activation now opt-in (`activate-environment`) — we never relied on it (`uv sync` + `uv run`). v7.0.0: removes deprecated `server-url` input — unused. v8.0.0: **stops publishing major/minor tags** ("You won't be able to use `@v8`"), so `@v9` does not exist — the exact tag is a requirement, not a style choice (noted in the workflow file). v9.0.0: `prune-cache` default flips to false — cache-config-only; our bare usage sets no cache inputs. |

CI before/after (Rule 5): triggers, steps, schedules, permissions,
gating (none — no branch protection exists) all identical. Run-visible
deltas only: the deprecation annotation disappears; the probe step's
log lines come from node instead of inline bash (#169, same `::error::`
messages). No new secrets, no new permissions, CI gains no deploy
ability.
