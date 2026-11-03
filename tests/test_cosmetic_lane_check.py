"""scripts/cosmetic_lane_check.py -- R156's lane test, read from the diff paths
(Ryan, 2026-11-03)."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "cosmetic_lane_check.py"
_spec = importlib.util.spec_from_file_location("cosmetic_lane_check", SCRIPT)
assert _spec and _spec.loader
lane = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lane)

S = "conestruct/site/"


@pytest.mark.parametrize(
    "path",
    [
        S + "app/globals.css",
        S + "app/page.tsx",
        S + "app/sandbox/page.tsx",
        S + "app/not-found.tsx",
        S + "components/LocationPickerModal.tsx",
        S + "components/bands/WhereBand.tsx",
        S + "components/LocationPickerModal.road-pick.test.tsx",
        S + "public/landing/colfax.svg",
        S + "lib/design/tokens.ts",
        S + "lib/design/type-census.test.ts",
        S + "DESIGN-SPACING.md",
        "validation-artifacts/committed/ux-group1b-road-row/rulings.md",
        "validation-artifacts/committed/ux-group1b-road-row/crops/after-390.png",
    ],
)
def test_frontend_look_paths_are_in_the_lane(path):
    assert lane.reason_out(path) is None


@pytest.mark.parametrize(
    ("path", "why"),
    [
        ("src/api/render_api.py", "outside the frontend"),
        ("src/rendering/pdf_plan.py", "outside the frontend"),
        ("tests/test_refusal_plan_can_draw.py", "outside the frontend"),
        ("scripts/production-env.txt", "outside the frontend"),
        ("modal_app.py", "outside the frontend"),
        (".github/workflows/frontend-tests.yml", "outside the frontend"),
        (S + "app/api/render/route.ts", "an API route"),
        (S + "middleware.ts", "the middleware"),
        (S + "middleware.test.ts", "the middleware"),
        (S + "lib/gate.ts", "the gate"),
        (S + "lib/render-types.ts", "under lib/"),
        (S + "lib/scenarios/index.ts", "under lib/"),
        (S + "lib/quote-settings.ts", "under lib/"),
        (S + "lib/legal.ts", "under lib/"),
        (S + "lib/coming-soon-road.ts", "under lib/"),
        (S + "package.json", "config"),
        (S + "next.config.mjs", "config"),
        (S + "vercel.json", "config"),
        (S + "tests/gate-helper.test.ts", "config"),
        (S + "README.md", "not a page"),
    ],
)
def test_everything_else_leaves_the_lane(path, why):
    got = lane.reason_out(path)
    assert got is not None and why in got


def test_windows_separators_are_read_as_paths():
    assert lane.reason_out(S.replace("/", "\\") + "app\\api\\render\\route.ts") == "an API route"


@pytest.fixture
def repo(tmp_path: Path):
    """A scratch repo holding the two exception files; returns (path, git)."""
    d = tmp_path / "r"
    (d / S / "lib/design").mkdir(parents=True)

    def git(*a: str) -> str:
        return subprocess.run(
            ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
            cwd=d,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    (d / S / "lib/design/type-exceptions.ts").write_text(
        'export const T = { sizes: ["16px", "15px", "clamp(28px, 3vw, 36px)"] };\n',
        encoding="utf-8",
    )
    (d / S / "lib/design/ink-exceptions.ts").write_text(
        '// the #263 declaration\nexport const INK = ["#fff", "#1a1200"];\n', encoding="utf-8"
    )
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    return d, git


def _edit(d: Path, name: str, old: str, new: str) -> None:
    p = d / S / "lib/design" / name
    p.write_text(p.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")


def _run(d: Path, monkeypatch, *args: str) -> tuple[int, str]:
    monkeypatch.chdir(d)
    r = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=d,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return r.returncode, r.stdout


def test_an_existing_size_moved_between_rows_stays_in_the_lane(repo, monkeypatch):
    d, git = repo
    base = git("rev-parse", "HEAD")
    _edit(d, "type-exceptions.ts", '"16px", "15px"', '"16px", "15px", "15px" /* #436 ruling 2 */')
    _edit(d, "type-exceptions.ts", "};", '  why: "#436 ruling 2 (Ryan)" };')
    git("commit", "-qam", "row")
    code, out = _run(d, monkeypatch, "--base", base, "--head", "HEAD")
    assert code == 0 and out.startswith("IN LANE"), out


def test_a_new_type_size_leaves_the_lane(repo, monkeypatch):
    d, git = repo
    base = git("rev-parse", "HEAD")
    _edit(d, "type-exceptions.ts", '"15px"', '"15px", "13.5px"')
    git("commit", "-qam", "new size")
    code, out = _run(d, monkeypatch, "--base", base, "--head", "HEAD")
    assert code == 1 and "a new type size or hex exception: 13.5px" in out, out


def test_a_new_hex_exception_leaves_the_lane(repo, monkeypatch):
    d, git = repo
    base = git("rev-parse", "HEAD")
    _edit(d, "ink-exceptions.ts", '"#fff"', '"#fff", "#3a3a3a"')
    git("commit", "-qam", "new hex")
    code, out = _run(d, monkeypatch, "--base", base, "--head", "HEAD")
    assert code == 1 and "#3a3a3a" in out, out


def test_uncommitted_changes_count_when_no_head_is_given(repo, monkeypatch):
    d, git = repo
    base = git("rev-parse", "HEAD")
    (d / "src").mkdir()
    (d / "src/new_rule.py").write_text("X = 1\n", encoding="utf-8")
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "src/new_rule.py -- outside the frontend" in out, out


def test_files_mode_prints_in_or_out_with_the_offending_paths(tmp_path, monkeypatch):
    code, out = _run(tmp_path, monkeypatch, "--files", S + "app/globals.css")
    assert code == 0 and out.startswith("IN LANE: all 1 paths")
    code, out = _run(tmp_path, monkeypatch, "--files", S + "app/globals.css", S + "middleware.ts")
    assert code == 1 and out.startswith("OUT OF LANE: 1 of 2")
    assert "conestruct/site/middleware.ts -- the middleware" in out


# --------------------------------------------------------------------------- #
# R156 amendment (Ryan, 2026-11-03, Q1): three copy modules, string values only
# --------------------------------------------------------------------------- #

COPY_BASE = r"""import { thing } from "./thing";

// The hero copy (R33).
export const HERO = {
  title: "Plans for the work you mark",
  note: 'It won\'t promise approval.',
  steps: [`Mark the work`, `Take the plan`],
};
export const greet = (n: number) => `Hello ${n}`;
"""


@pytest.fixture
def copy_repo(tmp_path: Path):
    d = tmp_path / "c"
    (d / S / "lib").mkdir(parents=True)

    def git(*a: str) -> str:
        return subprocess.run(
            ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
            cwd=d,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    for name in ("public-copy.ts", "legal.ts"):
        (d / S / "lib" / name).write_text(COPY_BASE, encoding="utf-8")
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    return d, git


def _rewrite(d: Path, name: str, old: str, new: str) -> None:
    f = d / S / "lib" / name
    text = f.read_text(encoding="utf-8")
    assert old in text, old
    f.write_text(text.replace(old, new), encoding="utf-8")


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('"Plans for the work you mark"', '"A plan for the work you mark"'),
        (r"'It won\'t promise approval.'", r"'It won\'t promise a permit.'"),
        ("`Take the plan`", "`Take the drawing`"),
        (  # the formatter rewraps a longer string: whitespace only
            'title: "Plans for the work you mark",',
            'title:\n    "Plans for the work you mark, drawn to the manual, every line sourced",',
        ),
    ],
)
def test_a_string_values_only_copy_edit_is_in_the_lane(copy_repo, monkeypatch, old, new):
    d, git = copy_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "public-copy.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)  # the working tree
    assert code == 0 and out.startswith("IN LANE"), out
    git("commit", "-qam", "copy")
    code, out = _run(d, monkeypatch, "--base", base, "--head", "HEAD")
    assert code == 0 and out.startswith("IN LANE"), out


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('import { thing } from "./thing";', 'import { thing, other } from "./thing";'),
        ("export const HERO = {", "export const HERO: Hero = {"),
        ("export const greet", "export const greeting"),
        ("`Hello ${n}`", "`Hello ${n + 1}`"),
        ("`Hello ${n}`", "`Hi ${n}`"),  # a template with ${...} is code
        ("steps: [`Mark the work`, `Take the plan`]", "steps: [`Mark the work`]"),
        ("// The hero copy (R33).", "// The hero copy (R34)."),
    ],
)
def test_a_copy_edit_beyond_string_values_leaves_the_lane(copy_repo, monkeypatch, old, new):
    d, git = copy_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "public-copy.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "changes more than string values" in out, out


def test_legal_copy_stays_out_even_for_a_string_edit(copy_repo, monkeypatch):
    d, git = copy_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "legal.ts", '"Plans for the work you mark"', '"Plans, not advice"')
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "lib/legal.ts -- under lib/" in out, out


def test_a_copy_module_with_no_diff_to_read_is_out(tmp_path, monkeypatch):
    code, out = _run(tmp_path, monkeypatch, "--files", S + "lib/landing.ts")
    assert code == 1 and "needs a diff (--base)" in out, out


# The independent reviewer's cases (2026-11-03): only prose in a value
# position is a "string value"; every other string is code.
LOGIC_BASE = r"""import { HERO } from "./a";
type Mode = "x" | "y";
const KEYS = { "title": "Plans for the work you mark" };
export const LEAD = "Mark the work, take the plan.";
const re = /'/g;
let n = 1;
const label = (k: string) => (k === "on" ? `on ${`deep ${k}`}` : "y");
window.addEventListener("scrollend", () => scrollTo({ top: 0, behavior: "auto" }));
"""


@pytest.fixture
def logic_repo(tmp_path: Path):
    d = tmp_path / "l"
    (d / S / "lib").mkdir(parents=True)

    def git(*a: str) -> str:
        return subprocess.run(
            ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
            cwd=d,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    (d / S / "lib" / "landing.ts").write_text(LOGIC_BASE, encoding="utf-8")
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    return d, git


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('from "./a"', 'from "./b"'),  # an import path
        ('"x" | "y"', '"x" | "z"'),  # a string-literal type
        ('k === "on"', 'k === "off"'),  # a comparison
        ('{ "title":', '{ "name":'),  # a quoted key
        ("let n = 1;", "let n = 2;"),  # code after a regex holding a quote
        ('`on ${`deep ${k}`}` : "y"', "`on ${`deep ${k}`}` : y"),  # code after a nested template
        ('addEventListener("scrollend"', 'addEventListener("scroll"'),  # a call argument
        ('behavior: "auto"', 'behavior: "smooth"'),  # a value, but not prose
    ],
)
def test_a_string_that_is_code_is_not_a_copy_value(logic_repo, monkeypatch, old, new):
    d, git = logic_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "changes more than string values" in out, out


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('"Mark the work, take the plan."', '"Mark the work. Take the plan."'),  # a const
        ('"Plans for the work you mark"', '"A plan for the work you mark"'),  # an object value
    ],
)
def test_prose_in_a_value_position_is_a_copy_value(logic_repo, monkeypatch, old, new):
    d, git = logic_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 0 and out.startswith("IN LANE"), out


def test_a_renamed_file_is_checked_under_both_names(copy_repo, monkeypatch):
    d, git = copy_repo
    base = git("rev-parse", "HEAD")
    (d / S / "components").mkdir()
    git("mv", S + "lib/legal.ts", S + "components/legal-text.ts")
    git("commit", "-qm", "move")
    code, out = _run(d, monkeypatch, "--base", base, "--head", "HEAD")
    assert code == 1 and "lib/legal.ts -- under lib/" in out, out


# Ryan, 2026-11-03: "A string counts as copy only if it has two words
# separated by a space, or it is a whole const value. One-word edits run the
# full process."  (The reviewer's NAV_KEYS case: key names are logic.)
WORDS_BASE = r"""const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", " ", "Space"]);
export const CTA = { label: "Download", hint: "Get the plan" };
export const TAB = "Download";
let mode = "Download";
const d = new Date();
const k = typeof x in y;
"""


@pytest.fixture
def words_repo(tmp_path: Path):
    d = tmp_path / "w"
    (d / S / "lib").mkdir(parents=True)

    def git(*a: str) -> str:
        return subprocess.run(
            ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
            cwd=d,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    (d / S / "lib" / "landing.ts").write_text(WORDS_BASE, encoding="utf-8")
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    return d, git


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('"ArrowUp", "ArrowDown"', '"Tab", "Enter"'),  # key names in a Set: logic
        ('" ", "Space"', '"Escape", "Space"'),
        ('label: "Download"', 'label: "Get"'),  # a one-word object value
        ('let mode = "Download"', 'let mode = "Get"'),  # one word, not a const
        ("new Date()", "newDate()"),  # words must not run together
        ("typeof x in y", "typeof x iny"),
    ],
)
def test_a_one_word_string_or_a_joined_word_leaves_the_lane(words_repo, monkeypatch, old, new):
    d, git = words_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "changes more than string values" in out, out


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('hint: "Get the plan"', 'hint: "Take the plan"'),  # two words, a value
        ('export const TAB = "Download"', 'export const TAB = "Get"'),  # a whole const value
    ],
)
def test_two_words_or_a_whole_const_value_is_copy(words_repo, monkeypatch, old, new):
    d, git = words_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 0 and out.startswith("IN LANE"), out


def test_a_path_with_spaces_is_one_path(copy_repo, monkeypatch):
    d, git = copy_repo
    base = git("rev-parse", "HEAD")
    (d / S / "public").mkdir()
    (d / S / "public" / "hero crop.png").write_bytes(b"x")
    (d / "notes about it.md").write_text("x", encoding="utf-8")
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "notes about it.md -- outside" in out, out
    assert "hero crop.png" not in out, out


@pytest.mark.parametrize(
    ("path", "out"),
    [
        (".github/workflows/ci.yml", True),  # its dot is part of the name
        ("./" + S + "components/hero.tsx", False),
        ("././" + S + "app/page.tsx", False),
    ],
)
def test_a_leading_dot_slash_is_a_prefix_not_characters(path, out):
    assert (lane.reason_out(path) is not None) is out


# Round 3 reviewer, non-blocking 4-6: no `;` carry-over, ASI newlines, and a
# const inside a function is logic.
ASI_BASE = r"""const a = "x"
foo = "Download"
export function f(x) {
  const m = "strict"
  return x
}
let i = 0
i
++i
"""


@pytest.fixture
def asi_repo(tmp_path: Path):
    d = tmp_path / "s"
    (d / S / "lib").mkdir(parents=True)

    def git(*a: str) -> str:
        return subprocess.run(
            ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
            cwd=d,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

    git("init", "-q", "-b", "main")
    (d / S / "lib" / "landing.ts").write_text(ASI_BASE, encoding="utf-8")
    git("add", "-A")
    git("commit", "-q", "-m", "base")
    return d, git


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('foo = "Download"', 'foo = "Upload"'),  # an assignment after a line with no `;`
        ('const m = "strict"', 'const m = "loose"'),  # a const inside a function
        ("  return x", "  return\n    x"),  # ASI: returns undefined
        ("i\n++i", "i++\ni"),  # ASI: a different statement
    ],
)
def test_logic_without_semicolons_leaves_the_lane(asi_repo, monkeypatch, old, new):
    d, git = asi_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", old, new)
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 1 and "changes more than string values" in out, out


def test_a_module_const_without_a_semicolon_is_still_copy(asi_repo, monkeypatch):
    d, git = asi_repo
    base = git("rev-parse", "HEAD")
    _rewrite(d, "landing.ts", 'const a = "x"', 'const a = "y"')
    code, out = _run(d, monkeypatch, "--base", base)
    assert code == 0 and out.startswith("IN LANE"), out
