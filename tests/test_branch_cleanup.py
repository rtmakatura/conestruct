"""After SHIP VERIFIED the ship deletes every branch already in the new main,
on origin and locally, with its worktree; nothing unmerged is touched, and
unmerged throwaway red-proof branches are listed for Ryan (ship-loop rulings
R31, R32).

scripts/branch-cleanup.ps1 runs for real here, against a scratch remote: a bare
repo in tmp_path, a clone standing in for the main checkout, and worktrees
under its .claude/worktrees -- one holding a node_modules junction into a
directory outside the worktree, as the real worktrees do.  The ship's wiring is
read as text (like test_ship_push.py): the ship_gate hook gates any run of it.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CLEANUP = ROOT / "scripts" / "branch-cleanup.ps1"
SHIP = ROOT / "scripts" / "ship.ps1"
SHELL = shutil.which("powershell") or shutil.which("pwsh")
needs_ps = pytest.mark.skipif(
    SHELL is None or shutil.which("git") is None, reason="needs PowerShell and git"
)


def git(cwd: Path, *args: str) -> str:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, f"git {' '.join(args)}: {r.stdout}{r.stderr}"
    return r.stdout.strip()


def commit(repo: Path, name: str) -> str:
    (repo / f"{name}.txt").write_text(name, encoding="utf-8")
    git(repo, "add", f"{name}.txt")
    git(repo, "commit", "-q", "-m", name)
    return git(repo, "rev-parse", "HEAD")


def remote_branches(repo: Path) -> set[str]:
    out = git(repo, "ls-remote", "--heads", "origin")
    return {ln.split("refs/heads/")[1] for ln in out.splitlines() if ln}


def local_branches(repo: Path) -> set[str]:
    return set(git(repo, "for-each-ref", "--format=%(refname:short)", "refs/heads").splitlines())


@pytest.fixture
def scratch(tmp_path: Path) -> dict:
    remote = tmp_path / "remote.git"
    repo = tmp_path / "repo"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(remote))
    git(tmp_path, "clone", "-q", str(remote), str(repo))
    for k, v in {"user.name": "t", "user.email": "t@t", "core.autocrlf": "false"}.items():
        git(repo, "config", k, v)
    git(repo, "checkout", "-q", "-b", "main")
    commit(repo, "base")
    s: dict = {"repo": repo, "remote": remote, "tmp": tmp_path}

    # merged-a, and stacked-b on top of it; main fast-forwards to stacked-b.
    git(repo, "checkout", "-q", "-b", "merged-a")
    s["a"] = commit(repo, "a1")
    git(repo, "checkout", "-q", "-b", "stacked-b")
    s["b"] = commit(repo, "b1")
    git(repo, "checkout", "-q", "main")
    git(repo, "merge", "-q", "--ff-only", "stacked-b")
    s["main"] = git(repo, "rev-parse", "HEAD")

    # Unmerged work, an unmerged and a merged throwaway, and merged branches
    # whose local side must survive: dirty worktree, locked worktree, and a
    # local branch with a commit that never reached origin.
    for name, base in [
        ("unmerged-c", "main"),
        ("old-redproof", "main"),
        ("done-redproof", s["a"]),
        ("dirty-d", s["a"]),
        ("locked-e", s["a"]),
        ("ahead-f", s["a"]),
    ]:
        git(repo, "branch", name, base)
    for name in ["unmerged-c", "old-redproof"]:
        git(repo, "checkout", "-q", name)
        s[name] = commit(repo, name)
    git(repo, "checkout", "-q", "main")
    git(
        repo,
        "push",
        "-q",
        "origin",
        "main",
        "merged-a",
        "stacked-b",
        "unmerged-c",
        "old-redproof",
        "done-redproof",
        "dirty-d",
        "locked-e",
        "ahead-f",
    )
    git(repo, "checkout", "-q", "ahead-f")
    s["ahead-f"] = commit(repo, "f1")  # local only
    git(repo, "checkout", "-q", "main")

    wt = repo / ".claude" / "worktrees"
    s["wt"] = wt
    git(repo, "worktree", "add", "-q", str(wt / "merged-a"), "merged-a")
    git(repo, "worktree", "add", "-q", "--detach", str(wt / "_ship"), "main")
    git(repo, "worktree", "add", "-q", str(wt / "dirty-d"), "dirty-d")
    (wt / "dirty-d" / "a1.txt").write_text("uncommitted edit", encoding="utf-8")
    git(repo, "worktree", "add", "-q", str(wt / "locked-e"), "locked-e")
    git(repo, "worktree", "lock", "--reason", "a live session", str(wt / "locked-e"))
    git(repo, "worktree", "add", "-q", str(wt / "unmerged-c"), "unmerged-c")

    # The real worktrees hold a node_modules junction into the main checkout.
    # Removing the worktree must remove the link, never what it points at.
    outside = tmp_path / "outside-node_modules"
    outside.mkdir()
    (outside / "sentinel.txt").write_text("keep me", encoding="utf-8")
    s["sentinel"] = outside / "sentinel.txt"
    # Ignored, as node_modules is in the real repo, so the worktree reads clean.
    (tmp_path / "exclude").write_text("node_modules\n", encoding="utf-8")
    git(repo, "config", "core.excludesFile", str(tmp_path / "exclude"))
    subprocess.run(
        ["cmd", "/c", "mklink", "/J", str(wt / "merged-a" / "node_modules"), str(outside)],
        check=True,
        capture_output=True,
    )
    return s


def run_cleanup(s: dict):
    r = subprocess.run(
        [
            SHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(CLEANUP),
            "-RepoDir",
            str(s["repo"]),
            "-Main",
            s["main"],
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    return r.returncode, (r.stdout + r.stderr).replace("\r", "")


@needs_ps
def test_merged_branches_go_unmerged_stay_ship_untouched(scratch: dict) -> None:
    s = scratch
    ship_head = git(s["wt"] / "_ship", "rev-parse", "HEAD")
    code, out = run_cleanup(s)
    assert code == 0, out

    # origin: everything already in main is gone; unmerged work and main stay.
    assert remote_branches(s["repo"]) == {"main", "unmerged-c", "old-redproof"}, out
    # Each deletion is printed with its sha, so any branch can be restored.
    for name, sha in [("merged-a", s["a"]), ("stacked-b", s["main"]), ("done-redproof", s["a"])]:
        assert f"deleted origin/{name} at {sha}" in out, out

    # Local: merged branches whose worktree could go are gone; the rest stay.
    assert local_branches(s["repo"]) == {
        "main",
        "unmerged-c",
        "old-redproof",
        "dirty-d",
        "locked-e",
        "ahead-f",
    }, out
    assert f"deleted local merged-a at {s['a']}" in out, out
    assert not (s["wt"] / "merged-a").exists(), out

    # The junction was unlinked, not followed.
    assert s["sentinel"].read_text(encoding="utf-8") == "keep me"

    # _ship, the dirty, locked and unmerged worktrees are untouched.
    assert git(s["wt"] / "_ship", "rev-parse", "HEAD") == ship_head
    assert (s["wt"] / "dirty-d" / "a1.txt").read_text(encoding="utf-8") == "uncommitted edit"
    assert (s["wt"] / "locked-e").exists() and (s["wt"] / "unmerged-c").exists()
    assert git(s["repo"], "rev-parse", "ahead-f") == s["ahead-f"]


@needs_ps
def test_what_it_would_not_touch_is_left_for_ryan(scratch: dict) -> None:
    s = scratch
    code, out = run_cleanup(s)
    assert code == 0, out
    left = out.split("Left for Ryan:", 1)[1]
    assert f"old-redproof at {s['old-redproof']}" in left, left  # R32
    for name in ["dirty-d", "locked-e", "ahead-f"]:
        assert name in left, left
    # Ordinary unmerged work is neither touched nor nagged about.
    assert "unmerged-c" not in out, out


@needs_ps
def test_a_second_run_deletes_nothing(scratch: dict) -> None:
    s = scratch
    run_cleanup(s)
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "deleted" not in out, out
    assert remote_branches(s["repo"]) == {"main", "unmerged-c", "old-redproof"}


# --- R44: branches whose work reached main by another route -----------------------


@pytest.fixture
def picked(scratch: dict) -> dict:
    """Add branches whose commits were cherry-picked into main's history
    rather than merged: their tips are not ancestors of main, so R31 alone
    never deletes them (ship-loop ruling R44)."""
    s = scratch
    repo = s["repo"]
    base = git(repo, "rev-parse", f"{s['a']}~1")
    # picked-g: a copy of main's two commits (a1, b1), cherry-picked onto the
    # base.  Every commit is patch-equivalent to one in main.
    git(repo, "checkout", "-q", "-b", "picked-g", base)
    git(repo, "cherry-pick", s["a"], s["b"])
    s["picked-g"] = git(repo, "rev-parse", "HEAD")
    # extra-h: the same copy plus one commit main lacks.
    git(repo, "checkout", "-q", "-b", "extra-h", s["picked-g"])
    s["extra-h"] = commit(repo, "h1")
    # picked-locked: a copy whose worktree a live session holds.
    git(repo, "checkout", "-q", "-b", "picked-locked", base)
    git(repo, "cherry-pick", s["a"])
    s["picked-locked"] = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-q", "main")
    git(repo, "push", "-q", "origin", "picked-g", "extra-h", "picked-locked")
    git(repo, "worktree", "add", "-q", str(s["wt"] / "picked-locked"), "picked-locked")
    git(repo, "worktree", "lock", "--reason", "a live session", str(s["wt"] / "picked-locked"))
    return s


@needs_ps
def test_a_cherry_picked_copy_goes(picked: dict) -> None:
    s = picked
    cherry = git(s["repo"], "cherry", s["main"], s["picked-g"]).splitlines()
    assert cherry and all(ln.startswith("- ") for ln in cherry), cherry  # the premise
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "picked-g" not in remote_branches(s["repo"]), out
    assert "picked-g" not in local_branches(s["repo"]), out
    assert f"deleted origin/picked-g at {s['picked-g']}" in out, out
    assert f"(restore: git push origin {s['picked-g']}:refs/heads/picked-g)" in out, out
    assert f"deleted local picked-g at {s['picked-g']}" in out, out


@needs_ps
def test_one_commit_main_lacks_keeps_the_branch(picked: dict) -> None:
    s = picked
    cherry = git(s["repo"], "cherry", s["main"], s["extra-h"]).splitlines()
    assert sum(ln.startswith("+ ") for ln in cherry) == 1, cherry  # the premise
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "extra-h" in remote_branches(s["repo"]), out
    assert git(s["repo"], "rev-parse", "extra-h") == s["extra-h"]
    # Ordinary unmerged work: neither touched nor listed.
    assert "extra-h" not in out, out


@needs_ps
def test_a_superseded_branch_keeps_the_r31_safety_rules(picked: dict) -> None:
    s = picked
    code, out = run_cleanup(s)
    assert code == 0, out
    assert f"deleted origin/picked-locked at {s['picked-locked']}" in out, out
    left = out.split("Left for Ryan:", 1)[1]
    assert "picked-locked -- worktree" in left and "is locked" in left, left
    assert (s["wt"] / "picked-locked").exists()
    assert git(s["repo"], "rev-parse", "picked-locked") == s["picked-locked"]


@needs_ps
def test_the_r31_cases_are_unchanged_with_superseded_branches_present(picked: dict) -> None:
    s = picked
    code, out = run_cleanup(s)
    assert code == 0, out
    assert remote_branches(s["repo"]) == {"main", "unmerged-c", "old-redproof", "extra-h"}, out
    assert s["sentinel"].read_text(encoding="utf-8") == "keep me"


# --- R46: branches a restack says it carries -----------------------------------------


@pytest.fixture
def listed(scratch: dict) -> dict:
    """A restacked branch reached main carrying a scripts/superseded.txt that
    names the branches whose work it carries (ship-loop ruling R46).  Their
    commits need not match main by ancestry or by patch (a conflict
    resolution changes the patch), so only the list can retire them."""
    s = scratch
    repo = s["repo"]
    base = git(repo, "rev-parse", f"{s['a']}~1")
    for name in ["rebuilt-x", "moved-y", "locked-z"]:
        git(repo, "checkout", "-q", "-b", name, base)
        s[name] = commit(repo, name)  # work git cherry cannot match in main
    git(repo, "checkout", "-q", "main")
    git(repo, "push", "-q", "origin", "rebuilt-x", "moved-y", "locked-z")
    # moved-y gains a commit after it was listed.
    git(repo, "checkout", "-q", "moved-y")
    s["moved-y-now"] = commit(repo, "y2")
    git(repo, "push", "-q", "origin", "moved-y")
    git(repo, "checkout", "-q", "main")
    git(repo, "worktree", "add", "-q", str(s["wt"] / "locked-z"), "locked-z")
    git(repo, "worktree", "lock", "--reason", "a live session", str(s["wt"] / "locked-z"))
    # The list, committed on main by the restacked branch.
    (repo / "scripts").mkdir(exist_ok=True)
    (repo / "scripts" / "superseded.txt").write_text(
        "# branches whose work a restacked branch carries (R46)\n"
        f"rebuilt-x {s['rebuilt-x']} -- carried by restack-1\n"
        f"moved-y {s['moved-y']} -- carried by restack-1\n"
        f"locked-z {s['locked-z']} -- carried by restack-1\n"
        f"gone-w {'0' * 40} -- carried by an older restack; already deleted\n"
        f"main {s['main']} -- never deleted, whatever a list says\n",
        encoding="utf-8",
    )
    git(repo, "add", "scripts/superseded.txt")
    git(repo, "commit", "-q", "-m", "restack-1 lists what it carries")
    git(repo, "push", "-q", "origin", "main")
    s["main"] = git(repo, "rev-parse", "HEAD")
    return s


@needs_ps
def test_a_listed_branch_goes_though_git_cherry_cannot_match_it(listed: dict) -> None:
    s = listed
    cherry = git(s["repo"], "cherry", s["main"], s["rebuilt-x"]).splitlines()
    assert cherry and all(ln.startswith("+ ") for ln in cherry), cherry  # the premise
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "rebuilt-x" not in remote_branches(s["repo"]), out
    assert "rebuilt-x" not in local_branches(s["repo"]), out
    assert f"deleted origin/rebuilt-x at {s['rebuilt-x']}" in out, out
    assert f"(restore: git push origin {s['rebuilt-x']}:refs/heads/rebuilt-x)" in out, out
    assert f"deleted local rebuilt-x at {s['rebuilt-x']}" in out, out


@needs_ps
def test_a_listed_branch_that_moved_since_the_listing_is_kept_and_listed(listed: dict) -> None:
    s = listed
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "moved-y" in remote_branches(s["repo"]), out
    assert git(s["repo"], "rev-parse", "origin/moved-y") == s["moved-y-now"]
    left = out.split("Left for Ryan:", 1)[1]
    assert "moved-y" in left and "moved since it was listed" in left, left


@needs_ps
def test_a_listed_branch_keeps_the_r31_safety_rules(listed: dict) -> None:
    s = listed
    code, out = run_cleanup(s)
    assert code == 0, out
    assert f"deleted origin/locked-z at {s['locked-z']}" in out, out
    left = out.split("Left for Ryan:", 1)[1]
    assert "locked-z -- worktree" in left and "is locked" in left, left
    assert (s["wt"] / "locked-z").exists()
    # main is never deleted, whatever the list says; a branch already gone is skipped.
    assert "main" in remote_branches(s["repo"]), out
    assert "deleted origin/main" not in out, out
    assert "FAILED" not in out, out


@needs_ps
def test_a_second_run_with_the_list_deletes_nothing(listed: dict) -> None:
    s = listed
    run_cleanup(s)
    code, out = run_cleanup(s)
    assert code == 0, out
    assert "deleted" not in out, out


# --- the wiring --------------------------------------------------------------------


def code_lines(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def test_cleanup_runs_only_after_ship_verified() -> None:
    lines = code_lines(SHIP)
    verified = [
        i for i, ln in enumerate(lines) if ln == 'Write-Host "SHIP VERIFIED" -ForegroundColor Green'
    ]
    cleanup = [i for i, ln in enumerate(lines) if "branch-cleanup.ps1" in ln]
    assert len(verified) == 1 and len(cleanup) == 1, (verified, cleanup)
    assert verified[0] < cleanup[0]
    # Both NOT VERIFIED verdicts end the run before it.
    for msg in ('"SHIP NOT VERIFIED"', '"FRONTEND NOT VERIFIED"'):
        at = [i for i, ln in enumerate(lines) if msg in ln]
        assert len(at) == 1, msg
        tail = lines[at[0] : at[0] + 6]
        assert any(ln == "exit 1" for ln in tail), tail


def test_cleanup_pushes_through_gh_only_and_never_forces_a_worktree() -> None:
    lines = code_lines(CLEANUP)
    pushes = [ln for ln in lines if re.search(r"\bpush\b", ln) and ln.startswith("git")]
    assert pushes, "no push found"
    for ln in pushes:
        assert '-c credential.helper= -c "credential.helper=!gh auth git-credential"' in ln, ln
        assert "--force-with-lease=" in ln, ln
    removes = [ln for ln in lines if "worktree remove" in ln]
    assert removes and all(not re.search(r"\s(--force|-f)\b", ln) for ln in removes), removes
