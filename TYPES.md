# Type checking

This project uses static type checking on both sides of the stack to catch
type-related bugs before they ship.

## TypeScript (frontend — `conestruct/site/`)

- `tsconfig.json` has `"strict": true` (umbrella flag — enables `noImplicitAny`,
  `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
  `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`,
  `useUnknownInCatchVariables`).
- `tsc --noEmit` runs as a pre-commit hook (`typecheck-frontend` in
  `.pre-commit-config.yaml`) on any `.ts`/`.tsx` change.
- Zero `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` and zero `: any` /
  `as any` in active code.

**Run locally:** `npm --prefix conestruct/site run typecheck`

The frontend type story is fully enforced. New code should not introduce
escape hatches; if a typing problem feels unavoidable, prefer narrowing or
type guards over `any`.

## Python (backend — `src/`)

Mypy is configured in `pyproject.toml` under `[tool.mypy]`. The approach is
**non-strict baseline globally, strict opt-in per module** — clean modules get
full strict checking; modules with existing debt run on the non-strict default
and are tracked for cleanup.

**Run locally:** `uv run mypy` (uses `files = ["src"]` from the config)

### Modules under strict checking

The following 8 modules are listed in `[[tool.mypy.overrides]]` with the
strict-mode flags enabled:

- `src.rules.spacing`
- `src.rules.devices`
- `src.rules.corridor`
- `src.rules.validators`
- `src.rules.tables`
- `src.rules.sign_codes`
- `src.rules.site_adjustments`
- `src.rules.night_adjustments`

These are the rules-engine core — the MUTCD-formula math, device taxonomy,
spacing tables, and validators. Wrong types here have direct safety
implications, so they get the tightest checking.

### Why not pre-commit for mypy?

Mypy on `src/` takes ~2-5 seconds cold. Pre-commit already runs ruff
(sub-second) plus ESLint and tsc on the frontend (cumulative 5-15 seconds on
Windows). Stacking another multi-second check on every commit makes pre-commit
painful enough that people start using `--no-verify`.

**Mypy is manual / future server-side CI only.** Run it before pushing if
you've changed Python code. When server-side CI exists, mypy joins it there.

### Ratchet rule

The project has a non-strict baseline of **35 known errors in 6 files**
(measured 2026-05-25). New code should not increase this baseline.

When you add code to or touch a strict-listed module, your changes must keep
the module strict-clean. When you clean up a not-yet-strict module, add it to
the strict override list in `pyproject.toml`.

### Why per-flag instead of `strict = true`?

`strict = true` inside `[[tool.mypy.overrides]]` applies the strict-mode flags
globally in mypy 1.x and 2.x, not per-module. The config expands the relevant
flags individually so the override is genuinely module-scoped:

- `disallow_untyped_defs`
- `disallow_incomplete_defs`
- `disallow_untyped_calls`
- `disallow_untyped_decorators`
- `disallow_any_generics`
- `no_implicit_optional`
- `warn_return_any`
- `warn_unreachable`
- `strict_equality`
- `extra_checks`

`warn_redundant_casts` and `warn_unused_ignores` are global-only flags (mypy
rejects them in per-module overrides), so they're set in the top-level
`[tool.mypy]` section and apply project-wide.
