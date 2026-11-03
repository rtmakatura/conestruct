#!/usr/bin/env python3
"""cosmetic_lane_check: is a change in the cosmetic lane?  (R156, Ryan 2026-11-03)

R156's scope, word for word: "A change is in the lane only if its diff
touches no backend file, no API route, no middleware or gate, nothing under
lib/ except lib/design/, no wire field, no scenario/audit/pricing/MUTCD
logic, no PDF content, and needs no new type size or hex exception. CC checks
this from the diff paths before pushing and states the result on the first
line of its report. If any file falls outside, the change leaves the lane and
runs the full process."

Read from the paths, mechanically:
  in lane   conestruct/site/app/** (but not app/api/**), components/**,
            public/**, lib/design/**, DESIGN-*.md; and the round's own
            rulings and crops under validation-artifacts/committed/**
  out       everything else: the backend (src/, tests/, data/, scripts/,
            modal_app.py, ...), app/api/** (API routes), middleware.*,
            lib/gate.ts and every other lib/ path (wire types, scenario,
            audit and pricing logic live there), and the site's build and
            dependency config (package*.json, next/tsconfig/vercel/tailwind/
            postcss/vitest config, sentry, instrumentation, db/).
  and       a change to lib/design/type-exceptions.ts or
            lib/design/ink-exceptions.ts that adds a px size or a hex value
            the base file doesn't already hold ("a new type size or hex
            exception").
The wire-field and logic clauses are covered by path: a wire field or a
scenario/audit/pricing/MUTCD rule can't change without a lib/, app/api/ or
backend file changing.  What a path can't show (logic written inline in a
component) is the independent reviewer's to catch, as R156 step 6 says.

usage:  python scripts/cosmetic_lane_check.py [--base REF] [--head REF]
        python scripts/cosmetic_lane_check.py --files PATH [PATH ...]
Default range: merge-base(origin/main, HEAD)..HEAD plus uncommitted changes.
Prints "IN LANE" or "OUT OF LANE" and each offending path with its reason.
Exit 0 = in lane, 1 = out of lane, 2 = error.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys

SITE = "conestruct/site/"
EXCEPTION_FILES = ("lib/design/type-exceptions.ts", "lib/design/ink-exceptions.ts")
# A declared value is a whole quoted string: "15px", "clamp(28px, 3vw, 36px)",
# "#fff".  "#436 ruling 2 ..." is an issue reference, not a colour.
VALUE = re.compile(r"""(?<=["'`])(?:\d+(?:\.\d+)?px|clamp\([^"'`]*\)|#[0-9a-fA-F]{3,8})(?=["'`])""")
SITE_CONFIG = re.compile(
    r"^(package(-lock)?\.json|next\.config\.\w+|tsconfig\.json|vercel\.json|vercel-ignore\.sh"
    r"|tailwind\.config\.\w+|postcss\.config\.\w+|vitest\.config\.\w+|drizzle\.config\.\w+"
    r"|sentry\.\w+\.config\.\w+|instrumentation\.\w+|\.env.*)$"
)


def reason_out(path: str) -> str | None:
    """None when this path may change inside the lane, else why not."""
    p = path.replace("\\", "/").lstrip("./")
    if p.startswith("validation-artifacts/committed/"):
        return None  # the round's rulings.md and crops
    if not p.startswith(SITE):
        return "outside the frontend (backend, tests, scripts or repo config)"
    s = p[len(SITE) :]
    if s.startswith("app/api/"):
        return "an API route"
    if re.match(r"^middleware(\.test)?\.\w+$", s):
        return "the middleware"
    if s.startswith("lib/design/"):
        return None
    if s == "lib/gate.ts" or s.startswith("lib/gate"):
        return "the gate"
    if s.startswith("lib/"):
        return "under lib/ (only lib/design/ is in the lane)"
    if SITE_CONFIG.match(s) or s.startswith(("db/", "tests/")):
        return "site build, dependency or data config"
    if s.startswith(("app/", "components/", "public/")):
        return None
    if re.match(r"^DESIGN-[A-Z-]+\.md$", s):
        return None
    return "not a page, component, style, asset or lib/design file"


def _git(*args: str) -> str:
    r = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def _code(text: str) -> str:
    """The text without // and /* */ comments, where "#436" is an issue
    number, not a colour."""
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return "\n".join(re.sub(r"(^|\s)//.*$", "", ln) for ln in text.splitlines())


def new_exception_values(base: str, head: str | None, path: str) -> list[str]:
    """px sizes or hex values the change adds to an exception file that the
    base file doesn't already hold (comments ignored on both sides)."""
    rng = [base, head] if head else [base]
    diff = _git("diff", "-U0", *rng, "--", path)
    added = "\n".join(
        ln[1:] for ln in diff.splitlines() if ln.startswith("+") and not ln.startswith("+++")
    )
    try:
        before = _git("show", f"{base}:{path}")
    except RuntimeError:
        before = ""
    known = set(VALUE.findall(_code(before)))
    return sorted({v for v in VALUE.findall(_code(added)) if v not in known})


def check(
    paths: list[str], base: str | None = None, head: str | None = None
) -> list[tuple[str, str]]:
    out = []
    for p in sorted(set(paths)):
        why = reason_out(p)
        if why:
            out.append((p, why))
        elif base and p.replace("\\", "/").endswith(EXCEPTION_FILES):
            vals = new_exception_values(base, head, p)
            if vals:
                out.append((p, f"a new type size or hex exception: {', '.join(vals)}"))
    return out


def changed_paths(base: str, head: str | None) -> list[str]:
    if head:
        return _git("diff", "--name-only", base, head).split()
    tracked = _git("diff", "--name-only", base).split()  # committed + working tree
    untracked = _git("ls-files", "--others", "--exclude-standard").split()
    return tracked + untracked


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base")
    ap.add_argument("--head")
    ap.add_argument("--files", nargs="+")
    a = ap.parse_args(argv)
    try:
        if a.files:
            paths, base, head = a.files, None, None
        else:
            base = a.base or _git("merge-base", "origin/main", "HEAD").strip()
            head = a.head
            paths = changed_paths(base, head)
        bad = check(paths, base, head)
    except RuntimeError as e:
        print(f"ERROR: {e}")
        return 2
    if not paths:
        print("IN LANE (no changed paths)")
        return 0
    if bad:
        print(f"OUT OF LANE: {len(bad)} of {len(set(paths))} paths fall outside")
        for p, why in bad:
            print(f"  {p} -- {why}")
        return 1
    print(f"IN LANE: all {len(set(paths))} paths are frontend look-only")
    return 0


if __name__ == "__main__":
    sys.exit(main())
