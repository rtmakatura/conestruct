"""scripts/hooks/ship_gate.py -- the PreToolUse guard for CC-run ships
(ship-loop rulings R4, R10-R12; validation-artifacts/committed/ship-loop/).

Each case runs the real hook as a subprocess with the hook JSON on stdin,
the way Claude Code runs it, against a synthetic transcript and a scratch
git repo.  Exit 0 = allowed, exit 2 = blocked.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

HOOK = Path(__file__).resolve().parents[1] / "scripts" / "hooks" / "ship_gate.py"
SHIP = r"powershell -NoProfile -File C:\x\.claude\worktrees\_ship\scripts\ship.ps1"
REPORT = (
    "result: `ship-loop-3` is built and verified; "
    "ship with `.\\scripts\\ship.ps1 -Branch ship-loop-3`."
)


def human(text: str, uuid: str) -> dict:
    return {"type": "user", "uuid": uuid, "message": {"role": "user", "content": text}}


def assistant(text: str, uuid: str) -> dict:
    return {
        "type": "assistant",
        "uuid": uuid,
        "message": {"content": [{"type": "text", "text": text}]},
    }


def tool_result(uuid: str) -> dict:
    return {
        "type": "user",
        "uuid": uuid,
        "message": {"content": [{"type": "tool_result", "content": "ok"}]},
    }


def write_transcript(tmp: Path, entries: list[dict]) -> str:
    p = tmp / "transcript.jsonl"
    p.write_text("\n".join(json.dumps(e) for e in entries) + "\n", encoding="utf-8")
    return str(p)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A scratch repo with `main` and `feature`; returns its path, on `feature`."""
    r = tmp_path / "repo"
    r.mkdir()
    run = lambda *a: subprocess.run(["git", *a], cwd=r, check=True, capture_output=True)  # noqa: E731
    run("init", "-q", "-b", "main")
    run("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init")
    run("checkout", "-q", "-b", "feature")
    return r


def hook(tmp_path: Path, command: str, transcript: str | None = None, cwd: Path | None = None):
    payload = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "transcript_path": transcript or str(tmp_path / "missing.jsonl"),
        "cwd": str(cwd or tmp_path),
    }
    env = {**__import__("os").environ, "SHIP_GATE_LEDGER": str(tmp_path / "ledger.json")}
    r = subprocess.run(
        [sys.executable, str(HOOK)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        env=env,
    )
    return r.returncode, r.stderr


# --------------------------------------------------------------------------- #
# The go (R4, R11, R12)
# --------------------------------------------------------------------------- #


def test_valid_go_allows_one_run_and_refuses_the_reused_go(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 2 and "already used" in err


def test_no_go_is_refused(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 2 and 'not exactly "ship <branch>"' in err


def test_a_branch_not_in_the_last_result_line_is_refused(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship other-branch", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch other-branch -DryRun", t)
    assert code == 2 and "not in CC's latest result: line" in err


def test_a_prefix_of_the_reported_branch_is_not_the_branch(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop -DryRun", t)
    assert code == 2 and "not in CC's latest result: line" in err


def test_only_the_latest_result_line_counts(tmp_path):
    older = "result: `old-branch` ready; ship with `.\\scripts\\ship.ps1 -Branch old-branch`."
    t = write_transcript(
        tmp_path, [assistant(older, "a0"), assistant(REPORT, "a1"), human("ship old-branch", "g1")]
    )
    code, err = hook(tmp_path, f"{SHIP} -Branch old-branch -DryRun", t)
    assert code == 2


def test_a_go_before_the_latest_result_line_is_refused(tmp_path):
    t = write_transcript(tmp_path, [human("ship ship-loop-3", "g1"), assistant(REPORT, "a1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 2


def test_a_go_with_extra_words_is_refused(tmp_path):
    t = write_transcript(
        tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3 please", "g1")]
    )
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", t)
    assert code == 2


def test_the_command_must_ship_the_branch_the_go_names(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch something-else", t)
    assert code == 2 and "the go names" in err


def test_tool_results_local_commands_and_reminders_do_not_hide_the_go(tmp_path):
    t = write_transcript(
        tmp_path,
        [
            assistant(REPORT, "a1"),
            human("ship ship-loop-3\n<system-reminder>background note</system-reminder>", "g1"),
            tool_result("t1"),
            human("<command-name>/copy</command-name>", "c1"),
            human("<local-command-stdout>Copied</local-command-stdout>", "c2"),
        ],
    )
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


def test_a_later_message_replaces_the_go(tmp_path):
    t = write_transcript(
        tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1"), human("wait", "h2")]
    )
    code, _ = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 2


def test_the_read_only_frontend_check_needs_no_go(tmp_path):
    code, err = hook(tmp_path, f"{SHIP} -FrontendCheckOnly -Sha 55c9054")
    assert code == 0, err


def test_an_unreadable_transcript_fails_closed(tmp_path):
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", str(tmp_path / "nope.jsonl"))
    assert code == 2 and "failing closed" in err


# --------------------------------------------------------------------------- #
# Anything that moves main, force pushes, remote deletes (R10)
# --------------------------------------------------------------------------- #

BLOCKED_ANYWHERE = [
    "git push origin main",
    "git push origin HEAD:main",
    "git push origin abc123:refs/heads/main",
    'git -c credential.helper= -c "credential.helper=!gh auth git-credential" '
    "push origin HEAD:main",
    "cd /c/x && git push origin main",
    "git push --force origin feature",
    "git push -f origin feature",
    "git push --force-with-lease origin feature",
    "git push origin +feature",
    "git push origin --delete feature",
    "git push -d origin feature",
    "git push origin :feature",
    "git push --all origin",
    "git push --mirror origin",
    "git branch -f main abc123",
    "git update-ref refs/heads/main abc123",
    "git checkout -B main origin/feature",
    "git switch -C main",
    "git fetch origin feature:main",
    "gh pr merge 12 --merge",
    "gh api -X DELETE repos/o/r/git/refs/heads/feature",
    "gh api --method PATCH repos/o/r/git/refs/heads/main -f sha=abc",
]


@pytest.mark.parametrize("command", BLOCKED_ANYWHERE)
def test_blocked_whatever_the_branch(tmp_path, repo, command):
    code, err = hook(tmp_path, command, cwd=repo)
    assert code == 2, f"{command!r} was allowed"
    assert "BLOCKED by ship_gate" in err


@pytest.mark.parametrize(
    "command",
    [
        "git push",
        "git push origin",
        "git merge feature",
        "git pull",
        "git reset --hard HEAD~1",
        "git rebase feature",
        "git cherry-pick abc123",
    ],
)
def test_blocked_on_main(tmp_path, repo, command):
    subprocess.run(["git", "checkout", "-q", "main"], cwd=repo, check=True)
    code, err = hook(tmp_path, command, cwd=repo)
    assert code == 2, f"{command!r} on main was allowed"


ALLOWED = [
    "git push origin feature",
    "git push -u origin feature",
    'git -c credential.helper= -c "credential.helper=!gh auth git-credential" '
    "push -u origin ship-loop-3",
    "git push origin abc123:refs/heads/some-arc",
    "git push",  # on feature
    "git merge --ff-only origin/main",  # on feature
    "git rebase origin/main",  # on feature
    "git status --short",
    "git log --oneline -3 origin/main",
    "gh api repos/o/r/deployments?sha=abc",
    "gh issue view 243",
    "ls -la && echo main",
    "npx vitest run",
]


@pytest.mark.parametrize("command", ALLOWED)
def test_ordinary_work_is_allowed(tmp_path, repo, command):
    code, err = hook(tmp_path, command, cwd=repo)
    assert code == 0, f"{command!r} was blocked: {err}"


# --------------------------------------------------------------------------- #
# R68 (#306): rebase / cherry-pick are judged by the branch being CHANGED --
# the directory the git call runs in (`git -C <dir>`, or an earlier
# `cd <dir>` / `Set-Location <dir>` in the same command) -- never by the
# session's working directory.  Anything that moves main is still blocked.
# --------------------------------------------------------------------------- #


@pytest.fixture
def two_checkouts(tmp_path: Path) -> tuple[Path, Path]:
    """A main checkout on `main` and a worktree on `feature`, as the real repo
    has (the session sits in the first; arcs run in the second)."""
    main = tmp_path / "main-checkout"
    main.mkdir()
    run = lambda *a, cwd=main: subprocess.run(  # noqa: E731
        ["git", *a], cwd=cwd, check=True, capture_output=True
    )
    run("init", "-q", "-b", "main")
    run("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init")
    wt = tmp_path / "wt-feature"
    run("worktree", "add", "-q", "-b", "feature", str(wt))
    return main, wt


@pytest.mark.parametrize(
    "template",
    [
        'git -C "{wt}" rebase 0123abc',
        'git -C "{wt}" cherry-pick 0123abc',
        'cd "{wt}" && git rebase 0123abc',
        'cd "{wt}" && git cherry-pick 0123abc',
        'Set-Location "{wt}"; git cherry-pick 0123abc',
    ],
)
def test_a_feature_branch_changed_from_a_session_on_main_is_allowed(
    tmp_path, two_checkouts, template
):
    main, wt = two_checkouts
    code, err = hook(tmp_path, template.format(wt=wt.as_posix()), cwd=main)
    assert code == 0, err


@pytest.mark.parametrize(
    "template",
    [
        'git -C "{main}" rebase 0123abc',
        'git -C "{main}" cherry-pick 0123abc',
        'cd "{main}" && git rebase 0123abc',
        'cd "{main}" && git merge feature',
        'Set-Location "{main}"; git cherry-pick 0123abc',
    ],
)
def test_main_changed_from_a_session_on_a_feature_branch_is_blocked(
    tmp_path, two_checkouts, template
):
    main, wt = two_checkouts
    code, err = hook(tmp_path, template.format(main=main.as_posix()), cwd=wt)
    assert code == 2, err
    assert "on main is blocked" in err


def test_a_git_bash_path_is_read_as_the_windows_path(tmp_path, two_checkouts):
    """`cd /c/Users/...` (Git Bash) names the same directory as C:/Users/..."""
    main, wt = two_checkouts
    posix = wt.as_posix()
    if len(posix) > 2 and posix[1] == ":":
        posix = "/" + posix[0].lower() + posix[2:]
    code, err = hook(tmp_path, f'cd "{posix}" && git rebase 0123abc', cwd=main)
    assert code == 0, err


def test_an_unreadable_target_fails_closed(tmp_path, two_checkouts):
    main, _wt = two_checkouts
    code, err = hook(tmp_path, f'git -C "{(tmp_path / "nowhere").as_posix()}" rebase x', cwd=main)
    assert code == 2, err


# --------------------------------------------------------------------------- #
# R77: never ship from inside the branch's own worktree.  The cleanup after
# the ship can't remove a folder this session sits in (the #292 ship,
# 2026-10-04: "Permission denied"), and a `Set-Location` inside the command
# doesn't move the session, so the hook judges the session's own cwd.
# --------------------------------------------------------------------------- #


@pytest.fixture
def arc_worktrees(tmp_path: Path) -> tuple[Path, Path, Path]:
    """The main checkout on `main`, the shipped branch's worktree and another
    arc's, under .claude/worktrees/ as the real repo lays them out."""
    main = tmp_path / "main-checkout"
    main.mkdir()
    run = lambda *a: subprocess.run(["git", *a], cwd=main, check=True, capture_output=True)  # noqa: E731
    run("init", "-q", "-b", "main")
    run("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init")
    shipped = main / ".claude" / "worktrees" / "ship-loop-3"
    other = main / ".claude" / "worktrees" / "other-arc"
    run("worktree", "add", "-q", "-b", "ship-loop-3", str(shipped))
    run("worktree", "add", "-q", "-b", "other-arc", str(other))
    (shipped / "sub" / "dir").mkdir(parents=True)
    return main, shipped, other


def _go(tmp_path: Path) -> str:
    return write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])


@pytest.mark.parametrize("where", ["top", "subdir"])
def test_a_ship_from_inside_the_branch_worktree_is_refused_and_keeps_the_go(
    tmp_path, arc_worktrees, where
):
    main, shipped, _other = arc_worktrees
    t = _go(tmp_path)
    cwd = shipped if where == "top" else shipped / "sub" / "dir"
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", t, cwd=cwd)
    assert code == 2, err
    assert "worktree" in err and "main checkout" in err
    # The refusal didn't spend the go: from the main checkout it runs.
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", t, cwd=main)
    assert code == 0, err


def test_a_set_location_inside_the_command_does_not_move_the_session(tmp_path, arc_worktrees):
    """The #292 shape: the command moved its own shell to the main checkout,
    the session stayed in the worktree, and the removal failed."""
    main, shipped, _other = arc_worktrees
    command = f'Set-Location "{main.as_posix()}"; {SHIP} -Branch ship-loop-3'
    code, err = hook(tmp_path, command, _go(tmp_path), cwd=shipped)
    assert code == 2, err


@pytest.mark.parametrize("where", ["other-arc", "stale-folder", "stale-subdir"])
def test_a_ship_from_anywhere_under_the_worktrees_folder_is_refused(tmp_path, arc_worktrees, where):
    """R77, extended (2026-10-04): anywhere under .claude/worktrees/ except
    _ship is refused, whichever branch it holds, and even where git can't
    read the branch: a stale folder like the empty one the #292 ship left
    reads as the main checkout's `main`."""
    main, _shipped, other = arc_worktrees
    stale = main / ".claude" / "worktrees" / "issue-292"
    (stale / "deep").mkdir(parents=True)
    cwd = {"other-arc": other, "stale-folder": stale, "stale-subdir": stale / "deep"}[where]
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", _go(tmp_path), cwd=cwd)
    assert code == 2, err
    assert ".claude/worktrees" in err and "main checkout" in err


@pytest.mark.parametrize("where", ["main", "_ship", "main-subdir"])
def test_a_ship_from_the_main_checkout_or_the_ship_worktree_is_allowed(
    tmp_path, arc_worktrees, where
):
    main, _shipped, _other = arc_worktrees
    ship_wt = main / ".claude" / "worktrees" / "_ship"
    ship_wt.mkdir(parents=True)
    (main / "scripts").mkdir()
    cwd = {"main": main, "_ship": ship_wt, "main-subdir": main / "scripts"}[where]
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3", _go(tmp_path), cwd=cwd)
    assert code == 0, err


# R95 (2026-10-06): the #308 ship's cleanup hit "Permission denied" again.
# R77 was never live -- the hook runs from the _ship worktree, which
# ship.ps1 resets to main, and R77 sat on an unshipped branch -- and its
# message said to cd, which a worktree-isolated session can't do.


def test_the_308_shape_is_refused_and_says_how_to_leave(tmp_path, arc_worktrees):
    """The session sat in .claude/worktrees/oneway-read-as-divided, a folder
    named unlike the branch it held and shipped."""
    main, _shipped, _other = arc_worktrees
    folder = main / ".claude" / "worktrees" / "oneway-read-as-divided"
    subprocess.run(
        ["git", "worktree", "add", "-q", "-b", "issue-308-oneway-read-as-divided", str(folder)],
        cwd=main,
        check=True,
        capture_output=True,
    )
    report = REPORT.replace("ship-loop-3", "issue-308-oneway-read-as-divided")
    t = write_transcript(
        tmp_path, [assistant(report, "a1"), human("ship issue-308-oneway-read-as-divided", "g1")]
    )
    code, err = hook(tmp_path, f"{SHIP} -Branch issue-308-oneway-read-as-divided", t, cwd=folder)
    assert code == 2, err
    assert "ExitWorktree" in err
