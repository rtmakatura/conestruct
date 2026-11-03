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
        (S + "lib/public-copy.ts", "under lib/"),
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
