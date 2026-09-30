"""After SHIP VERIFIED the ship fast-forwards the main checkout's local main to
origin/main -- only fast-forward, only when that checkout is clean; otherwise
one line and a skip (ship-loop ruling R59: "I never run git by hand").

scripts/sync-main-checkout.ps1 runs for real here against scratch repos: a
bare remote, a clone standing in for the main checkout, and a second clone
that pushes the "shipped" commit.  "Clean" means no modified tracked files --
untracked and ignored files (handoff.md, the prompt files) don't count, the
same rule the ship applies to its own worktree.  The ship's wiring is read
as text: the ship_gate hook gates any run of the ship itself.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SYNC = ROOT / "scripts" / "sync-main-checkout.ps1"
SHIP = ROOT / "scripts" / "ship.ps1"
SHELL = shutil.which("powershell") or shutil.which("pwsh")
needs_ps = pytest.mark.skipif(
    SHELL is None or shutil.which("git") is None, reason="needs PowerShell and git"
)


def git(cwd: Path, *args: str) -> str:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"git {' '.join(args)}: {r.stdout}{r.stderr}"
    return r.stdout.strip()


def commit(repo: Path, name: str, text: str | None = None) -> str:
    (repo / f"{name}.txt").write_text(text or name, encoding="utf-8")
    git(repo, "add", f"{name}.txt")
    git(repo, "commit", "-q", "-m", name)
    return git(repo, "rev-parse", "HEAD")


def configure(repo: Path) -> None:
    for k, v in {"user.name": "t", "user.email": "t@t", "core.autocrlf": "false"}.items():
        git(repo, "config", k, v)


@pytest.fixture
def scratch(tmp_path: Path) -> dict:
    remote = tmp_path / "remote.git"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(remote))
    pusher = tmp_path / "pusher"
    git(tmp_path, "clone", "-q", str(remote), str(pusher))
    configure(pusher)
    git(pusher, "checkout", "-q", "-b", "main")
    old = commit(pusher, "base")
    git(pusher, "push", "-q", "origin", "main")
    checkout = tmp_path / "checkout"
    git(tmp_path, "clone", "-q", str(remote), str(checkout))
    configure(checkout)
    # The ship: a new commit on origin/main the checkout hasn't seen.
    new = commit(pusher, "shipped")
    git(pusher, "push", "-q", "origin", "main")
    return {"checkout": checkout, "pusher": pusher, "old": old, "new": new}


def run_sync(checkout: Path) -> tuple[int, str]:
    r = subprocess.run(
        [SHELL, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SYNC)]
        + ["-RepoDir", str(checkout)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    return r.returncode, (r.stdout + r.stderr).replace("\r", "")


@needs_ps
def test_a_clean_checkout_is_fast_forwarded(scratch: dict) -> None:
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out
    assert git(scratch["checkout"], "rev-parse", "main") == scratch["new"]
    assert f"main checkout: {scratch['old'][:7]} -> {scratch['new'][:7]} (fast-forwarded)" in out, (
        out
    )


@needs_ps
def test_untracked_files_do_not_block_it(scratch: dict) -> None:
    (scratch["checkout"] / "handoff.md").write_text("notes", encoding="utf-8")
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out
    assert git(scratch["checkout"], "rev-parse", "main") == scratch["new"]


@needs_ps
def test_a_modified_tracked_file_skips_with_one_line(scratch: dict) -> None:
    (scratch["checkout"] / "base.txt").write_text("edited", encoding="utf-8")
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out  # never un-verifies the ship
    assert git(scratch["checkout"], "rev-parse", "main") == scratch["old"]
    lines = [ln for ln in out.splitlines() if ln.strip()]
    assert lines == ["main checkout not fast-forwarded: modified tracked files: base.txt"], out


@needs_ps
def test_another_branch_checked_out_skips(scratch: dict) -> None:
    git(scratch["checkout"], "checkout", "-q", "-b", "feature")
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out
    assert git(scratch["checkout"], "rev-parse", "main") == scratch["old"]
    assert "main checkout not fast-forwarded: on branch feature" in out, out


@needs_ps
def test_a_diverged_main_skips(scratch: dict) -> None:
    local = commit(scratch["checkout"], "local-only")
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out
    assert git(scratch["checkout"], "rev-parse", "main") == local
    assert "main checkout not fast-forwarded: not a fast-forward" in out, out


@needs_ps
def test_already_current_says_so(scratch: dict) -> None:
    run_sync(scratch["checkout"])
    code, out = run_sync(scratch["checkout"])
    assert code == 0, out
    assert f"main checkout: already at {scratch['new'][:7]}" in out, out


def test_the_ship_syncs_after_the_cleanup_inside_complete_ship() -> None:
    text = SHIP.read_text(encoding="utf-8")
    body = text[text.index("function Complete-Ship") : text.index("if ($FrontendCheckOnly)")]
    cleanup = body.index("branch-cleanup.ps1")
    sync = body.index("sync-main-checkout.ps1")
    assert cleanup < sync, "R59 runs after the cleanup"
    assert "-RepoDir $RepoDir" in body[sync : sync + 200]
