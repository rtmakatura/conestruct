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
  copy      lib/public-copy.ts, lib/coming-soon-copy.ts and lib/landing.ts
            (R156 amendment, Ryan 2026-11-03: "Allow lib/public-copy.ts,
            lib/coming-soon-copy.ts and lib/landing.ts by name. An edit to
            them is in the lane only if it changes string values and nothing
            else; if it touches imports, types, exports or logic it's OUT.
            lib/legal.ts stays out.")  Checked by masking each copy value
            (a whole const value, or a string of two or more words in an
            object value, an array element or an initializer; see
            mask_strings) in the base and the new file: the rest must be
            identical but for whitespace.  Import paths, type
            literals, comparisons, call arguments, keys, comments, regexes and
            ${...} templates count as code.
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
# R156 amendment (Ryan, 2026-11-03, Q1): these three copy modules are in the
# lane, but only for an edit that changes string values and nothing else.
COPY_FILES = ("lib/public-copy.ts", "lib/coming-soon-copy.ts", "lib/landing.ts")
SITE_CONFIG = re.compile(
    r"^(package(-lock)?\.json|next\.config\.\w+|tsconfig\.json|vercel\.json|vercel-ignore\.sh"
    r"|tailwind\.config\.\w+|postcss\.config\.\w+|vitest\.config\.\w+|drizzle\.config\.\w+"
    r"|sentry\.\w+\.config\.\w+|instrumentation\.\w+|\.env.*)$"
)


def _rel(path: str) -> str:
    """Forward slashes, without leading `./` prefixes (a prefix, not the
    characters: `.github/` keeps its dot)."""
    p = path.replace("\\", "/")
    while p.startswith("./"):
        p = p[2:]
    return p


def reason_out(path: str) -> str | None:
    """None when this path may change inside the lane, else why not."""
    p = _rel(path)
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
    if s in COPY_FILES:
        return None  # by path; check() then requires a string-values-only edit
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


_STMT_WORDS = ("const", "let", "var", "type", "interface", "import", "function", "class")
# Ryan, 2026-11-03: "A string counts as copy only if it has two words
# separated by a space, or it is a whole const value. One-word edits run the
# full process."
_TWO_WORDS = re.compile(r"[^\W_]+ [^\W_]+")
_ASI_WORDS = {"return", "throw", "break", "continue", "yield"}
_REGEX_AFTER = set("(,=:[!&|?{};+-*%<>~^")
_REGEX_AFTER_WORDS = {"return", "typeof", "case", "in", "of", "delete", "void", "throw", "new"}


def _skip_string(text: str, i: int) -> int:
    """End (exclusive) of the '...' or "..." literal starting at i."""
    q, j, n = text[i], i + 1, len(text)
    while j < n and text[j] != q:
        j += 2 if text[j] == "\\" else 1
    return min(j + 1, n)


def _skip_template(text: str, i: int) -> int:
    """End (exclusive) of the `...` literal at i, through nested ${...}."""
    j, n = i + 1, len(text)
    while j < n:
        c = text[j]
        if c == "\\":
            j += 2
        elif c == "`":
            return j + 1
        elif text.startswith("${", j):
            j, depth = j + 2, 1
            while j < n and depth:
                d = text[j]
                if d in "'\"":
                    j = _skip_string(text, j)
                    continue
                if d == "`":
                    j = _skip_template(text, j)
                    continue
                depth += {"{": 1, "}": -1}.get(d, 0)
                j += 1
        else:
            j += 1
    return n


def _lex(text: str) -> list[tuple[str, str]]:
    """(kind, text) tokens: ws, cmt, str, tmpl, re, word, p."""
    toks: list[tuple[str, str]] = []
    i, n = 0, len(text)

    def prev_sig() -> tuple[str, str] | None:
        for k in range(len(toks) - 1, -1, -1):
            if toks[k][0] not in ("ws", "cmt"):
                return toks[k]
        return None

    while i < n:
        c = text[i]
        if c.isspace():
            j = i
            while j < n and text[j].isspace():
                j += 1
            toks.append(("ws", text[i:j]))
        elif text.startswith("//", i):
            j = text.find("\n", i)
            j = n if j == -1 else j
            toks.append(("cmt", text[i:j]))
        elif text.startswith("/*", i):
            j = text.find("*/", i + 2)
            j = n if j == -1 else j + 2
            toks.append(("cmt", text[i:j]))
        elif c in "'\"":
            j = _skip_string(text, i)
            toks.append(("str", text[i:j]))
        elif c == "`":
            j = _skip_template(text, i)
            toks.append(("tmpl", text[i:j]))
        elif c == "/":
            p = prev_sig()
            if (
                p is None
                or (p[0] == "p" and p[1] in _REGEX_AFTER)
                or (p[0] == "word" and p[1] in _REGEX_AFTER_WORDS)
            ):
                j, in_class = i + 1, False
                while j < n and text[j] != "\n":
                    d = text[j]
                    if d == "\\":
                        j += 2
                        continue
                    if d == "[":
                        in_class = True
                    elif d == "]":
                        in_class = False
                    elif d == "/" and not in_class:
                        break
                    j += 1
                j += 1
                while j < n and (text[j].isalnum() or text[j] == "_"):
                    j += 1
                toks.append(("re", text[i:j]))
            else:
                j = i + 1
                toks.append(("p", c))
        elif c.isalnum() or c in "_$":
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$"):
                j += 1
            toks.append(("word", text[i:j]))
        else:
            j = i + 1
            toks.append(("p", c))
        i = j
    return toks


def mask_strings(text: str) -> str:
    """The code with each copy value replaced by a placeholder and whitespace
    removed (one space kept between two words), so two versions compare equal
    exactly when only copy values (or formatting) differ.  A copy value is a
    string literal (or a template without ${...}) that is either the whole
    initializer of a module-level `const <name> =`, or has two words
    separated by a space AND sits in
    a value position: an object property value (`key: "..."`), an array
    element, or the whole initializer of a let/var (Ryan, 2026-11-03).  A
    one-word string anywhere else (`"ArrowUp"`, `"Download"`) stays code, so
    editing it leaves the lane.  Everything else stays verbatim: import paths, type
    literals (anything inside a `type` / `interface` declaration or a const's
    annotation), comparisons, call arguments, keys, regexes and comments."""
    toks = _lex(text)
    sig = [k for k, t in enumerate(toks) if t[0] not in ("ws", "cmt")]
    stack: list[tuple[str, bool]] = []  # (bracket, is_type)
    stmt_kw, stmt_depth, seen_eq = "", 0, False
    masked: set[int] = set()
    for n, k in enumerate(sig):
        kind, t = toks[k]
        prev = toks[sig[n - 1]] if n else None
        nxt = toks[sig[n + 1]] if n + 1 < len(sig) else None
        in_type = bool(stack) and stack[-1][1]
        starts = prev is None or prev[1] in (";", "}", "{", "export")
        if kind == "word" and starts and t in _STMT_WORDS:
            stmt_kw, stmt_depth, seen_eq = t, len(stack), False
        if kind == "p":
            if t == ";" and len(stack) == stmt_depth:
                stmt_kw = ""
            elif t == "=" and len(stack) == stmt_depth and (nxt is None or nxt[1] not in "=>"):
                seen_eq = True
            elif t in "{[(":
                typed = in_type or (
                    len(stack) == stmt_depth
                    and (
                        stmt_kw in ("type", "interface")
                        or (stmt_kw in ("const", "let", "var") and not seen_eq)
                    )
                )
                br = t
                if (
                    t == "["
                    and prev is not None
                    and (prev[0] in ("word", "str") or prev[1] in ")]")
                ):
                    br = "idx"
                stack.append((br, typed))
            elif t in "}])" and stack:
                stack.pop()
                if t == "}" and len(stack) < stmt_depth:
                    stmt_kw = ""
            continue
        if kind not in ("str", "tmpl") or in_type:
            continue
        body = t[1:-1]
        if kind == "tmpl" and "${" in t:
            continue
        top = stack[-1][0] if stack else ""
        object_value = (
            prev is not None
            and prev[1] == ":"
            and top == "{"
            and (nxt is None or nxt[1] in (",", "}"))
        )
        array_item = (
            prev is not None
            and prev[1] in ("[", ",")
            and top == "["
            and (nxt is None or nxt[1] in (",", "]"))
        )
        # `const|let|var <name> = "..."`, read from the tokens themselves, so
        # a statement keyword can't carry over into a later line without `;`.
        initializer = (
            prev is not None
            and prev[1] == "="
            and n >= 3
            and toks[sig[n - 2]][0] == "word"
            and toks[sig[n - 3]][1] in ("const", "let", "var")
            and toks[sig[n - 3]][1] == stmt_kw
            and len(stack) == stmt_depth
            and (
                nxt is None
                or nxt[1] in (";",)
                or "\n" in "".join(x[1] for x in toks[k + 1 : sig[n + 1]])
            )
        )
        # A module-level const only: a const inside a function is logic.
        whole_const = initializer and stmt_kw == "const" and not stack
        two_words = bool(_TWO_WORDS.search(body)) and (object_value or array_item or initializer)
        if whole_const or two_words:
            masked.add(k)
    out = []
    for k, (kind, t) in enumerate(toks):
        if kind == "ws":
            # One separator between two word tokens, so `new Date` and
            # `newDate` (or `a in b` and `ain b`) don't compare equal.
            before = toks[k - 1] if k else None
            after = toks[k + 1] if k + 1 < len(toks) else None
            # A newline where automatic semicolon insertion reads it as the
            # end of a statement (after return/throw/break/continue/yield,
            # or before ++/--) is code: `return x` is not `return\nx`.
            ahead = "".join(x[1] for x in toks[k + 1 : k + 3])
            if "\n" in t and (
                (before and before[1] in _ASI_WORDS) or ahead.startswith(("++", "--"))
            ):
                out.append("\n")
            elif before and after and before[0] == "word" and after[0] == "word":
                out.append(" ")
            continue
        out.append(f"{t[0]}S{t[0]}" if k in masked else t)
    return "".join(out)


def copy_edit_problem(base: str | None, head: str | None, path: str) -> str | None:
    """None when the edit to a COPY_FILES module changes string values only."""
    if base is None:
        return "a copy module: a string-values-only edit needs a diff (--base) to check"
    try:
        before = _git("show", f"{base}:{path}")
    except RuntimeError:
        return "a new copy module (in the lane only as an edit to an existing one)"
    if head:
        try:
            after = _git("show", f"{head}:{path}")
        except RuntimeError:
            return "the copy module is deleted"
    else:
        try:
            root = _git("rev-parse", "--show-toplevel").strip()
            with open(f"{root}/{path}", encoding="utf-8") as f:
                after = f.read()
        except OSError:
            return "the copy module is deleted"
    if mask_strings(before) != mask_strings(after):
        return (
            "a copy module edit that changes more than string values "
            "(imports, types, exports, logic or comments)"
        )
    return None


def check(
    paths: list[str], base: str | None = None, head: str | None = None
) -> list[tuple[str, str]]:
    out = []
    for p in sorted(set(paths)):
        why = reason_out(p)
        rel = _rel(p)
        if why:
            out.append((p, why))
        elif rel.startswith(SITE) and rel[len(SITE) :] in COPY_FILES:
            problem = copy_edit_problem(base, head, rel)
            if problem:
                out.append((p, problem))
        elif base and p.replace("\\", "/").endswith(EXCEPTION_FILES):
            vals = new_exception_values(base, head, p)
            if vals:
                out.append((p, f"a new type size or hex exception: {', '.join(vals)}"))
    return out


def changed_paths(base: str, head: str | None) -> list[str]:
    # -z: NUL-separated and unquoted, so a path with spaces stays one path.
    def z(*args: str) -> list[str]:
        return [p for p in _git(*args).split("\0") if p]

    if head:
        return z("diff", "--name-only", "-z", "--no-renames", base, head)
    tracked = z("diff", "--name-only", "-z", "--no-renames", base)  # committed + working tree
    untracked = z("ls-files", "-z", "--others", "--exclude-standard")
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
