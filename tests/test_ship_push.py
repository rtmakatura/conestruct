"""scripts/ship.ps1's push goes through gh only, and a gh login check stops the
ship before the merge (ship-loop ruling R27).

ship.ps1 merges, pushes and deploys, and the ship_gate hook gates any run of it,
so no test runs it.  These read its text: the one push line is the ruled form,
and the gh check (gh on PATH, then `gh auth status` failing into Fail) comes
before `git merge`.  What those lines DO -- the gh-only push succeeds with no
Git Credential Manager prompt, and a logged-out gh fails the check -- is proven
on the same commands in validation-artifacts/committed/ship-loop/r26-r27-redproof.md.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

SHELL = shutil.which("powershell") or shutil.which("pwsh")
SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "ship.ps1"
HELPER = "!gh auth git-credential"
PUSH = f'git -c credential.helper= -c "credential.helper={HELPER}" push origin HEAD:main'


def code_lines() -> list[str]:
    lines = SCRIPT.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def index_of(lines: list[str], pattern: str) -> int:
    hits = [i for i, ln in enumerate(lines) if re.search(pattern, ln)]
    assert len(hits) == 1, f"expected one line matching {pattern!r}, got {[lines[i] for i in hits]}"
    return hits[0]


def test_the_one_push_is_the_gh_only_form() -> None:
    # R56: the push's output is captured as plain lines (see below), so the
    # command sits on the right of the assignment, unchanged.
    lines = code_lines()
    pushes = [ln for ln in lines if re.search(r"\bgit\b.*\spush\s", ln)]
    assert pushes == [f'$pushOut = {PUSH} 2>&1 | ForEach-Object {{ "$_" }}']


# R56: a successful push printed a red NativeCommandError block whenever the
# ship ran with its output captured (the handoff at `& powershell @handArgs`
# re-raised git's stderr progress).  The mechanism, on a stand-in native
# command that writes to stderr and exits 0, run the way CC runs a ship: the
# handoff's child Windows PowerShell, under `*>&1 | Out-String`.
_STAND_IN = 'cmd /c "echo To https://example.invalid/repo.git 1>&2 & exit 0"'
_CHILD = {
    "bare": f"$ErrorActionPreference = 'Continue'\n{_STAND_IN}\nexit $LASTEXITCODE\n",
    "captured": (
        "$ErrorActionPreference = 'Continue'\n"
        f'$out = {_STAND_IN} 2>&1 | ForEach-Object {{ "$_" }}\n'
        '$out | ForEach-Object { Write-Host "  $_" }\n'
        "exit $LASTEXITCODE\n"
    ),
}


@pytest.mark.skipif(
    shutil.which("powershell") is None or shutil.which("cmd") is None,
    reason="needs Windows PowerShell 5.1 (the ship's shell)",
)
@pytest.mark.parametrize("form", ["bare", "captured"])
def test_captured_push_output_prints_clean(form: str, tmp_path: Path) -> None:
    child = tmp_path / "child.ps1"
    child.write_text(_CHILD[form], encoding="utf-8")
    run = (
        f"& powershell -NoProfile -ExecutionPolicy Bypass -File '{child}' *>&1 "
        "| Out-String -Width 300; exit $LASTEXITCODE"
    )
    r = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", run],
        capture_output=True,
        text=True,
        timeout=120,
    )
    out = r.stdout + r.stderr
    assert r.returncode == 0, out
    assert "To https://example.invalid/repo.git" in out
    if form == "bare":
        assert "NativeCommandError" in out, out  # the red block R56 removes
    else:
        assert "NativeCommandError" not in out, out


@pytest.mark.skipif(SHELL is None, reason="needs PowerShell")
def test_the_script_parses() -> None:
    # PowerShell's parser only -- nothing in the script runs.
    parse = (
        "$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile("
        f"'{SCRIPT}', [ref]$null, [ref]$e); $e | ForEach-Object {{ $_.ToString() }}; exit $e.Count"
    )
    r = subprocess.run(
        [SHELL, "-NoProfile", "-Command", parse], capture_output=True, text=True, timeout=120
    )
    assert r.returncode == 0, r.stdout + r.stderr


def test_a_gh_login_check_fails_the_ship_before_the_merge() -> None:
    lines = code_lines()
    on_path = index_of(lines, r"Get-Command gh\b")
    status = index_of(lines, r"\bgh auth status\b")
    merge = index_of(lines, r"^git merge\b")
    push = index_of(lines, re.escape(PUSH))
    assert on_path < status < merge < push
    # Each check ends the run: a Fail on the missing gh, and on a nonzero exit.
    assert "Fail" in lines[on_path] or "Fail" in lines[on_path + 1]
    after = lines[status + 1 : status + 4]
    assert any("$LASTEXITCODE -ne 0" in ln and "Fail" in ln for ln in after), after
