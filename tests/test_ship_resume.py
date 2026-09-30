"""A slow Vercel doesn't leave a ship half-done (ship-loop ruling R52).

On 2026-09-30 the ship of 2f27be3 waited 10 minutes for the production
frontend, gave up seconds before Vercel's build landed, and stopped before
its branch cleanup.  Now the wait is 20 minutes, and a timeout prints one
resume command: `ship.ps1 -Resume -Sha <sha>` re-checks the backend and the
frontend and then finishes the ship (SHIP VERIFIED and the cleanup).  CC
runs it itself.

scripts/ship.ps1 is read as text, like test_ship_push.py and
test_branch_cleanup.py's wiring tests: the ship_gate hook gates any run of it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHIP = ROOT / "scripts" / "ship.ps1"


def code_lines() -> list[str]:
    lines = SHIP.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def index_of(lines: list[str], pattern: str) -> int:
    hits = [i for i, ln in enumerate(lines) if re.search(pattern, ln)]
    assert len(hits) == 1, f"expected one line matching {pattern!r}, got {[lines[i] for i in hits]}"
    return hits[0]


def test_the_frontend_wait_is_twenty_minutes() -> None:
    lines = code_lines()
    assert (
        lines[index_of(lines, r"\[int\]\$FrontendTimeoutMin\s*=")]
        == "[int]$FrontendTimeoutMin = 20,"
    )


def test_a_timeout_prints_the_resume_command_before_it_stops() -> None:
    lines = code_lines()
    at = index_of(lines, r'"FRONTEND NOT VERIFIED"')
    tail = lines[at : at + 6]
    resume = [ln for ln in tail if "-Resume -Sha $head" in ln]
    assert len(resume) == 1, tail
    # A full, runnable command: main's copy in the ship worktree.
    assert "-File $(Join-Path $ShipDir 'scripts\\ship.ps1')" in resume[0], resume[0]
    # Not in the read-only -FrontendCheckOnly mode, which has no ship to finish.
    assert resume[0].startswith("if (-not $FrontendCheckOnly)"), resume[0]
    assert tail.index(resume[0]) < tail.index("exit 1"), tail


def test_the_hand_over_passes_resume_on() -> None:
    lines = code_lines()
    line = lines[index_of(lines, r"\$handArgs \+= @\(\"-Resume\"")]
    assert line == 'if ($Resume) { $handArgs += @("-Resume", "-Sha", $Sha) }', line
    assert index_of(lines, r"\$handArgs = @\(") < lines.index(line)


def test_resume_moves_nothing_and_finishes_only_the_ship_it_names() -> None:
    lines = code_lines()
    start = index_of(lines, r"^if \(\$Resume\) \{$")
    end = start + lines[start:].index("exit 0")
    block = lines[start : end + 1]
    # Before anything that moves: gh, the merge, the push, the deploy.
    for moving in (
        r"\bgh auth status\b",
        r"^git merge\b",
        r"push origin HEAD:main",
        r"& \$modal deploy",
    ):
        assert start < index_of(lines, moving), moving
    body = "\n".join(block)
    for forbidden in ("git merge", "git push", "push origin", "deploy", "--force"):
        assert forbidden not in body, forbidden
    # main must still be the sha it names, else it stops before any cleanup.
    guard = next(i for i, ln in enumerate(block) if "$want -ne $head" in ln)
    assert "Fail" in block[guard] and "Nothing was verified or cleaned up." in block[guard], block[
        guard
    ]
    # The backend is re-checked, then the frontend, then the verdict + cleanup.
    health = next(i for i, ln in enumerate(block) if "Invoke-RestMethod -Uri $HealthUrl" in ln)
    stop = next(i for i, ln in enumerate(block) if "$liveSha -ne $head" in ln)
    finish = next(i for i, ln in enumerate(block) if ln.startswith("Complete-Ship"))
    assert guard < health < stop < finish, block
    assert "Fail" in block[stop], block[stop]
    assert "Test-Frontend $SiteUrl $head $ShipDir $FrontendTimeoutMin" in block[finish], block[
        finish
    ]


def test_one_verdict_and_one_cleanup_shared_by_a_ship_and_a_resume() -> None:
    lines = code_lines()
    fn = index_of(lines, r"^function Complete-Ship\(\$head, \$frontend\) \{$")
    verified = index_of(lines, r'^Write-Host "SHIP VERIFIED"')
    cleanup = index_of(lines, r"branch-cleanup\.ps1")
    assert fn < verified < cleanup
    calls = [ln for ln in lines if ln.startswith("Complete-Ship ")]
    assert calls == [
        "Complete-Ship $head (Test-Frontend $SiteUrl $head $ShipDir $FrontendTimeoutMin)",
        "Complete-Ship $head $frontend",
    ], calls
    # The full ship reaches it only after the backend verdict and step 7.
    assert index_of(lines, r'"SHIP NOT VERIFIED"') < lines.index("Complete-Ship $head $frontend")
    assert index_of(lines, r"^\$frontend = Test-Frontend") < lines.index(
        "Complete-Ship $head $frontend"
    )
