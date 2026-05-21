# Contributing

## Pre-commit hooks

This repo uses [pre-commit](https://pre-commit.com/) to enforce lint and format checks on every commit. The hooks cover both the Python backend and the Next.js frontend.

### First-time setup

After cloning, install the hooks once:

```bash
uv sync
uv run pre-commit install
```

The second command writes `.git/hooks/pre-commit` so the configured hooks run on every `git commit`. **`pre-commit install` is required, not optional.** The `.pre-commit-config.yaml` file alone does nothing — without `pre-commit install`, git has no idea the hooks exist and commits go through unchecked. We rely on the honor system here: there is no server-side CI running these checks yet, so an un-installed local setup means broken code can land on `main`.

For the frontend hooks to work, you also need Node + npm installed and the frontend dependencies installed:

```bash
cd conestruct/site && npm install
```

### What runs on commit

| Hook | Scope | Action |
|---|---|---|
| `ruff` | `*.py` | Lint with `--fix` (auto-corrects fixable issues) |
| `ruff-format` | `*.py` | Format Python code |
| `eslint-frontend` | `conestruct/site/**/*.{ts,tsx,js,jsx}` | Lint with `--fix` |
| `typecheck-frontend` | `conestruct/site/**/*.{ts,tsx}` | `tsc --noEmit` |

The two frontend hooks are filtered to only fire when files under `conestruct/site/` are staged. Backend-only commits don't pay the ~10s frontend check overhead.

### Behavior on auto-format

If `ruff` or `eslint` auto-fixes a file, the commit is **blocked** so you can review the changes. Re-stage the fixed file and commit again:

```bash
git add <files>
git commit
```

### Behavior on failure

When a hook fails, pre-commit prints the hook name and the tool output. Read the message, fix the issue, re-stage, and retry the commit.

### Emergency bypass

You can skip the hooks with `--no-verify`:

```bash
git commit --no-verify -m "..."
```

**Use this sparingly.** Until we have server-side CI, bypassing hooks means the code is not verified at all. Reserve `--no-verify` for genuine emergencies (e.g., shipping a hotfix while a hook is misconfigured) and fix the underlying issue immediately after.
