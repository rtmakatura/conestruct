"""The ship stops before the merge unless both CI workflows are green on the
exact commit being shipped (ship-loop ruling R50).

CI had been red on main since 55c9054 (Frontend tests) and 467ffaf (Python
tests) while every ship went out, because nothing read it.  Two layers:

- scripts/ci-check.ps1, the check: run for real in PowerShell through a
  stand-in gh (tests/_fake_cli.py) that answers `gh run list` from fixtures.
  python-green.json, frontend-green.json and python-red.json are real
  `gh run list --commit <sha> --json ...` answers (7ea649d, fee2f77 and
  884081c); python-running.json and python-green-then-red.json are the red
  one edited: still running, and a newer red run after an older green one.
- scripts/ship.ps1, the wiring: read as text, like test_vercel_env_check.py,
  because the ship_gate hook gates any run of it.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from tests._fake_cli import write_fake_cli

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / "scripts" / "ci-check.ps1"
SHIP = ROOT / "scripts" / "ship.ps1"
FIXTURES = ROOT / "tests" / "fixtures" / "ci-runs"
SHELL = shutil.which("powershell") or shutil.which("pwsh")
SHA = "884081c87e7c699dc4cea61c46e6bd8acd5b2af4"

# The stand-in gh: logs its arguments; `run list --workflow <file>` prints the
# fixture named for that workflow (FAKE_PYTHON / FAKE_FRONTEND, "" = no runs).
FAKE_GH = r"""
import os, sys
args = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a", encoding="utf-8") as log:
    log.write(" ".join(args) + "\n")
if os.environ.get("FAKE_GH_EXIT", "0") != "0":
    print("HTTP 401: Bad credentials (https://api.github.com/graphql)")
    sys.exit(1)
if args[:2] != ["run", "list"]:
    sys.exit(2)
wf = args[args.index("--workflow") + 1]
fixture = os.environ["FAKE_PYTHON" if wf == "python-tests.yml" else "FAKE_FRONTEND"]
sys.stdout.write(open(fixture, encoding="utf-8").read() if fixture else "[]\n")
"""


def run_check(tmp_path: Path, python: str | None, frontend: str | None, gh_exit: int = 0):
    fake = write_fake_cli(tmp_path, "gh", FAKE_GH)
    log = tmp_path / "calls.log"
    env = dict(os.environ)
    env.update(
        FAKE_LOG=str(log),
        FAKE_GH_EXIT=str(gh_exit),
        FAKE_PYTHON=str(FIXTURES / python) if python else "",
        FAKE_FRONTEND=str(FIXTURES / frontend) if frontend else "",
    )
    r = subprocess.run(
        [SHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(CHECK)]
        + ["-Sha", SHA, "-Ref", "ship/some-branch", "-Gh", str(fake)],
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )
    calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return r.returncode, (r.stdout + r.stderr).replace("\r", ""), calls


needs_ps = pytest.mark.skipif(SHELL is None, reason="needs PowerShell")


def test_the_fixtures_are_what_they_say() -> None:
    def runs(name: str) -> list[dict]:
        return json.loads((FIXTURES / name).read_text(encoding="utf-8"))

    assert [r["conclusion"] for r in runs("python-green.json")] == ["success"]
    assert [r["conclusion"] for r in runs("frontend-green.json")] == ["success"]
    assert [r["conclusion"] for r in runs("python-red.json")] == ["failure"]
    assert [r["status"] for r in runs("python-running.json")] == ["in_progress"]
    two = runs("python-green-then-red.json")
    newest = max(two, key=lambda r: r["createdAt"])
    assert newest["conclusion"] == "failure"
    assert {r["conclusion"] for r in two} == {"success", "failure"}


@needs_ps
def test_both_green_passes(tmp_path: Path) -> None:
    code, out, calls = run_check(tmp_path, "python-green.json", "frontend-green.json")
    assert code == 0, out
    assert "CI green on 884081c" in out, out
    # It asks about this exact commit, one workflow at a time.
    assert len(calls) == 2, calls
    for wf, call in zip(["python-tests.yml", "frontend-tests.yml"], calls, strict=True):
        assert call.split()[:2] == ["run", "list"], call
        assert f"--workflow {wf}" in call, call
        assert f"--commit {SHA}" in call, call


@needs_ps
def test_a_red_workflow_stops_the_ship_and_is_named(tmp_path: Path) -> None:
    # R50's red-proof: 884081c's real Python tests run, failed.
    code, out, _ = run_check(tmp_path, "python-red.json", "frontend-green.json")
    assert code == 1, out
    assert "CI CHECK FAILED: Python tests failed on 884081c" in out, out
    assert "actions/runs/36627688461" in out, out
    assert "Frontend tests failed" not in out, out


@needs_ps
def test_a_missing_run_stops_the_ship(tmp_path: Path) -> None:
    code, out, _ = run_check(tmp_path, "python-green.json", None)
    assert code == 1, out
    assert "CI CHECK FAILED: Frontend tests has no run on 884081c" in out, out
    # It says how to get one.
    assert "gh workflow run frontend-tests.yml --ref ship/some-branch" in out, out


@needs_ps
def test_a_run_still_going_stops_the_ship(tmp_path: Path) -> None:
    code, out, _ = run_check(tmp_path, "python-running.json", "frontend-green.json")
    assert code == 1, out
    assert "CI CHECK FAILED: Python tests is still running on 884081c" in out, out


@needs_ps
def test_the_newest_run_decides(tmp_path: Path) -> None:
    # An older green run doesn't cover a newer red one on the same commit.
    code, out, _ = run_check(tmp_path, "python-green-then-red.json", "frontend-green.json")
    assert code == 1, out
    assert "Python tests failed on 884081c" in out, out
    assert "actions/runs/36627700002" in out, out


@needs_ps
def test_both_bad_names_both(tmp_path: Path) -> None:
    code, out, _ = run_check(tmp_path, "python-red.json", None)
    assert code == 1, out
    assert "Python tests failed" in out and "Frontend tests has no run" in out, out


@needs_ps
def test_gh_failing_stops_the_ship(tmp_path: Path) -> None:
    # Fails closed: no answer from GitHub is not a green answer.
    code, out, _ = run_check(tmp_path, "python-green.json", "frontend-green.json", gh_exit=1)
    assert code == 1, out
    assert "CI CHECK FAILED" in out, out
    assert "Bad credentials" in out, out


@needs_ps
def test_a_stand_in_that_cannot_run_stops_the_ship(tmp_path: Path) -> None:
    r = subprocess.run(
        [SHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(CHECK)]
        + ["-Sha", SHA, "-Gh", str(tmp_path / "no-such-gh")],
        capture_output=True,
        text=True,
        timeout=120,
    )
    out = r.stdout + r.stderr
    assert r.returncode == 1, out
    assert "CI CHECK FAILED" in out, out


# --- the wiring in the ship script ------------------------------------------------


def code_lines() -> list[str]:
    lines = SHIP.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def index_of(lines: list[str], pattern: str) -> int:
    hits = [i for i, ln in enumerate(lines) if re.search(pattern, ln)]
    assert len(hits) == 1, f"expected one line matching {pattern!r}, got {[lines[i] for i in hits]}"
    return hits[0]


def test_the_ship_checks_ci_after_the_env_check_and_before_the_merge() -> None:
    lines = code_lines()
    env = index_of(lines, r"vercel-env-check\.ps1")
    ci = index_of(lines, r"ci-check\.ps1")
    merge = index_of(lines, r"^git merge\b")
    assert env < ci < merge
    after = lines[ci + 1 : ci + 4]
    assert any(
        "$LASTEXITCODE -ne 0" in ln and "Fail" in ln and "Nothing was merged or pushed." in ln
        for ln in after
    ), after


def test_the_ship_checks_the_tip_of_the_branch_it_ships() -> None:
    # The sha checked is the pushed branch tip that the fast-forward makes main.
    lines = code_lines()
    tip = index_of(lines, r"\$ciSha\s*=")
    assert "git rev-parse" in lines[tip] and "$listRef" in lines[tip], lines[tip]
    ci = lines[index_of(lines, r"ci-check\.ps1")]
    assert "-Sha $ciSha" in ci, ci
    assert tip < index_of(lines, r"ci-check\.ps1")


def test_the_ship_names_the_failing_workflow_when_it_stops() -> None:
    lines = code_lines()
    ci = index_of(lines, r"ci-check\.ps1")
    stop = next(ln for ln in lines[ci + 1 : ci + 4] if "Nothing was merged or pushed." in ln)
    assert "$ciFailed" in stop, stop


def test_ci_runs_on_every_branch_push() -> None:
    # A branch tip needs runs of its own before its ship go, not only main.
    for wf in ("python-tests.yml", "frontend-tests.yml"):
        text = (ROOT / ".github" / "workflows" / wf).read_text(encoding="utf-8")
        push = re.search(r"push:\s*\n\s*branches:\s*\[([^\]]*)\]", text)
        assert push and push.group(1).strip() in {'"**"', "'**'"}, (wf, push and push.group(0))
        assert "workflow_dispatch:" in text, wf
