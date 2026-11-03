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


def hook(
    tmp_path: Path,
    command: str,
    transcript: str | None = None,
    cwd: Path | None = None,
    repo_refs: Path | None = None,
):
    payload = {
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {"command": command},
        "transcript_path": transcript or str(tmp_path / "missing.jsonl"),
        "cwd": str(cwd or tmp_path),
    }
    env = {**__import__("os").environ, "SHIP_GATE_LEDGER": str(tmp_path / "ledger.json")}
    if repo_refs is not None:
        env["SHIP_GATE_REPO"] = str(repo_refs)
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


def test_a_branch_ending_the_sentence_with_a_full_stop_is_the_branch(tmp_path):
    line = "result: built and verified on ship-loop-3."
    t = write_transcript(tmp_path, [assistant(line, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


def test_a_dotted_longer_branch_is_not_the_branch(tmp_path):
    line = "result: built and verified on ship-loop-3.1"
    t = write_transcript(tmp_path, [assistant(line, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 2 and "not in CC's latest result: line" in err


# --------------------------------------------------------------------------- #
# R147: `ship ready` ships every branch in the result: line, in order
# --------------------------------------------------------------------------- #

READY_REPORT = (
    "result: `alpha` and `beta-2` are verified (tip `abc1234`, base `main`); go: `ship ready`"
)


@pytest.fixture
def pushed(tmp_path: Path) -> tuple[Path, callable]:
    """A scratch repo whose origin has main, alpha and beta-2, each one commit
    ahead of the last; returns it and a function that merges a branch into
    origin/main (what a ship that worked leaves behind)."""
    r = tmp_path / "refs-repo"
    r.mkdir()
    run = lambda *a: subprocess.run(  # noqa: E731
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
        cwd=r,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    run("init", "-q", "-b", "main")
    run("commit", "-q", "--allow-empty", "-m", "init")
    run("update-ref", "refs/remotes/origin/main", "HEAD")
    for name in ("alpha", "beta-2"):
        run("commit", "-q", "--allow-empty", "-m", name)
        run("update-ref", f"refs/remotes/origin/{name}", "HEAD")

    def merge(name: str) -> None:
        run("update-ref", "refs/remotes/origin/main", f"refs/remotes/origin/{name}")
        run("update-ref", "-d", f"refs/remotes/origin/{name}")  # the cleanup deletes it

    return r, merge


def test_ship_ready_ships_the_listed_branches_in_order(tmp_path, pushed):
    refs, merge = pushed
    t = write_transcript(tmp_path, [assistant(READY_REPORT, "a1"), human("ship ready", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch beta-2", t, repo_refs=refs)
    assert code == 2 and 'next is "alpha"' in err
    code, err = hook(tmp_path, f"{SHIP} -Branch alpha", t, repo_refs=refs)
    assert code == 0, err
    merge("alpha")
    code, err = hook(tmp_path, f"{SHIP} -Branch beta-2", t, repo_refs=refs)
    assert code == 0, err
    merge("beta-2")
    code, err = hook(tmp_path, f"{SHIP} -Branch beta-2", t, repo_refs=refs)
    assert code == 2 and "used up" in err


def test_ship_ready_stops_at_the_first_failure(tmp_path, pushed):
    refs, _merge = pushed
    t = write_transcript(tmp_path, [assistant(READY_REPORT, "a1"), human("ship ready", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch alpha", t, repo_refs=refs)
    assert code == 0, err
    # alpha's run failed: origin/main never got it
    code, err = hook(tmp_path, f"{SHIP} -Branch beta-2", t, repo_refs=refs)
    assert code == 2 and "stops at the first failure" in err


def test_ship_ready_lists_only_pushed_branches(tmp_path, pushed):
    refs, _merge = pushed
    t = write_transcript(tmp_path, [assistant(READY_REPORT, "a1"), human("ship ready", "g1")])
    for name in ("main", "abc1234", "ready"):
        code, err = hook(tmp_path, f"{SHIP} -Branch {name}", t, repo_refs=refs)
        assert code == 2 and 'next is "alpha"' in err


def test_ship_ready_with_no_branch_in_the_result_line_is_refused(tmp_path, pushed):
    refs, _merge = pushed
    line = "result: nothing to ship; tip `abc1234`"
    t = write_transcript(tmp_path, [assistant(line, "a1"), human("ship ready", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch alpha", t, repo_refs=refs)
    assert code == 2 and "names no pushed branch" in err


def test_a_single_go_still_ships_one_branch(tmp_path, pushed):
    refs, _merge = pushed
    t = write_transcript(tmp_path, [assistant(READY_REPORT, "a1"), human("ship alpha", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch alpha", t, repo_refs=refs)
    assert code == 0, err
    code, err = hook(tmp_path, f"{SHIP} -Branch beta-2", t, repo_refs=refs)
    assert code == 2


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
# R158 (Ryan, 2026-11-03) as amended the same day: the mention-pass part is
# dropped -- every Bash/PowerShell command naming the script is gated as a
# ship.  Kept: a go ending in a full stop names the same branch.
# --------------------------------------------------------------------------- #

MENTIONS = [
    'grep -n "Write-Host" scripts/ship.ps1',
    "grep -rn ship.ps1 handoff.md | head -5",
    "cat .claude/worktrees/_ship/scripts/ship.ps1 | sed -n 1,40p",
    r"Get-Content scripts\ship.ps1 -TotalCount 40",
    "git log --oneline -3 -- scripts/ship.ps1",
    'echo "next: run .\\scripts\\ship.ps1 -Branch ship-loop-3 after the go"',
    "rg 'ship\\.ps1' docs",
    "python - <<'EOF'\nprint(open('scripts/ship.ps1').read()[:80])\nEOF",
    "cat > notes.md <<EOF\nShip with powershell -File scripts/ship.ps1 -Branch x.\n"
    "EOF\nwc -l notes.md",
    "$m = @'\n& .\\scripts\\ship.ps1 -Branch ship-loop-3\n'@\nSet-Content msg.txt $m",
    "python -c \"import re; print(re.findall('ship.ps1', open('handoff.md').read()))\"",
    "S=C:/x/scripts/ship.ps1; wc -l $S",
    '$S = "C:/x/scripts/ship.ps1"; Get-Content $S -TotalCount 5',
]


@pytest.mark.parametrize("command", MENTIONS)
def test_a_bash_read_grep_or_heredoc_naming_the_script_is_gated_like_a_ship(tmp_path, command):
    """R158 amendment: reads go through the Read and Grep tools, never Bash."""
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


@pytest.mark.parametrize("command", MENTIONS[:7])
def test_a_mention_with_a_valid_go_is_refused_and_keeps_the_go(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and "exactly one run" in err, err
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


@pytest.mark.parametrize(
    "tool_name, tool_input",
    [
        ("Read", {"file_path": r"C:\x\.claude\worktrees\_ship\scripts\ship.ps1"}),
        ("Grep", {"pattern": "Write-Host", "path": "scripts/ship.ps1"}),
        ("Glob", {"pattern": "**/ship.ps1"}),
    ],
)
def test_the_read_grep_and_glob_tools_pass(tmp_path, tool_name, tool_input):
    """They can't execute anything.  (The hook is registered on Bash|PowerShell
    only, so these never reach it; if one did, it still passes.)"""
    payload = {
        "hook_event_name": "PreToolUse",
        "tool_name": tool_name,
        "tool_input": tool_input,
        "transcript_path": str(tmp_path / "missing.jsonl"),
        "cwd": str(tmp_path),
    }
    r = subprocess.run(
        [sys.executable, str(HOOK)], input=json.dumps(payload), capture_output=True, text=True
    )
    assert r.returncode == 0, r.stderr


def test_the_hook_is_registered_on_bash_and_powershell_only():
    settings = Path(__file__).resolve().parents[1] / ".claude" / "settings.json"
    if not settings.exists():  # gitignored: present only in the main checkout
        pytest.skip("no .claude/settings.json in this checkout")
    hooks = json.loads(settings.read_text(encoding="utf-8"))["hooks"]["PreToolUse"]
    matchers = [h["matcher"] for h in hooks if any("ship_gate" in x["command"] for x in h["hooks"])]
    assert matchers == ["Bash|PowerShell"]


@pytest.mark.parametrize(
    "command",
    [
        "pwsh scripts/ship.ps1 ship-loop-3",
        r".\scripts\ship.ps1 -Branch ship-loop-3",
        r'& "C:\x\.claude\worktrees\_ship\scripts\ship.ps1" -Branch ship-loop-3',
        "PYTHONIOENCODING=utf-8 powershell -NoProfile "
        '-File "C:/x/scripts/ship.ps1" -Branch ship-loop-3',
        r"Set-Location C:\x; .\scripts\ship.ps1 -Branch ship-loop-3 2>&1 | Tee-Object log.txt",
        "powershell -Command \"& 'C:\\x\\scripts\\ship.ps1' -Branch ship-loop-3\"",
        'bash -c "pwsh scripts/ship.ps1 ship-loop-3"',
        r". .\scripts\ship.ps1",
        "Start-Process powershell -ArgumentList '-File','scripts/ship.ps1','-Branch','ship-loop-3'",
        'python -c "import subprocess; '
        "subprocess.run(['pwsh','scripts/ship.ps1','ship-loop-3'])\"",
    ],
)
def test_running_the_script_with_no_go_is_blocked(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err


@pytest.mark.parametrize("go", ["ship ship-loop-3.", "ship ship-loop-3"])
def test_a_go_ending_with_a_full_stop_names_the_same_branch(tmp_path, go):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human(go, "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


@pytest.mark.parametrize(
    "command",
    [
        f"{SHIP} -Branch ship-loop-3",
        f"{SHIP} -Branch ship-loop-3 2>&1",
        f"{SHIP} -Branch ship-loop-3 2>&1 | Tee-Object C:/x/ship-log.txt",
        f"$env:PYTHONIOENCODING='utf-8'; {SHIP} -Branch ship-loop-3",
        r"& 'C:\x\.claude\worktrees\_ship\scripts\ship.ps1' -Branch ship-loop-3 -Handoff",
        "powershell -File .claude/worktrees/_ship/scripts/ship.ps1 -Branch ship-loop-3",
    ],
)
def test_a_bare_run_with_the_go_ships(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, command, t)
    assert code == 0, err


@pytest.mark.parametrize(
    "command",
    [
        "pwsh scripts/ship.ps1 ship-loop-3 -DryRun",  # positional branch
        f"{SHIP} -Bra ship-loop-3",  # shortened name: PowerShell binds it, the gate can't
        f"{SHIP} -Site ship-loop-3 -Branch ship-loop-3",  # shortened -SiteUrl
        f"{SHIP} -Sh abc1234 ship-loop-3",
        f"{SHIP} -Branch ship-loop-3 -Branch ship-loop-3",
        f"{SHIP} -branch:ship-loop-3",
        f"echo -Branch ship-loop-3; {SHIP} other-branch",
        f"{SHIP} other-branch; echo -Branch ship-loop-3",
        f"{SHIP} -Branch ship-loop-3; {SHIP} -Branch ship-loop-3",
        f"{SHIP} -Branch ship-loop-3 $(whoami)",
        f"Set-Location C:\\x; {SHIP} -Branch ship-loop-3",
    ],
)
def test_anything_but_one_bare_run_is_refused_and_keeps_the_go(tmp_path, command):
    """The reviewer's point 4: the gate and PowerShell must read the same
    branch, so only full parameter names in one bare invocation count."""
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and "exactly one run" in err, err
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


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


# --------------------------------------------------------------------------- #
# R158 amendment (Ryan, 2026-11-03): the R52 resume
# --------------------------------------------------------------------------- #

SHIP_CMD = f"{SHIP} -Branch ship-loop-3"


def tool_call(uuid: str, tid: str, command: str) -> dict:
    return {
        "type": "assistant",
        "uuid": uuid,
        "message": {
            "content": [
                {"type": "tool_use", "id": tid, "name": "PowerShell", "input": {"command": command}}
            ]
        },
    }


def tool_output(uuid: str, tid: str, text: str) -> dict:
    return {
        "type": "user",
        "uuid": uuid,
        "message": {"content": [{"type": "tool_result", "tool_use_id": tid, "content": text}]},
    }


def timed_out(sha: str) -> str:
    return (
        "main is now abc1234.\nFRONTEND NOT VERIFIED\n  HEAD is " + sha + "\n"
        "  Resume (R52; re-checks, then finishes the ship and its cleanup): powershell "
        "-NoProfile -ExecutionPolicy Bypass -File C:\\x\\.claude\\worktrees\\_ship\\scripts\\"
        "ship.ps1 -Resume -Sha " + sha
    )


@pytest.fixture
def tip(tmp_path: Path) -> tuple[Path, str]:
    """A scratch repo whose origin/ship-loop-3 is one commit; returns it and the sha."""
    r = tmp_path / "tip-repo"
    r.mkdir()
    run = lambda *a: subprocess.run(  # noqa: E731
        ["git", "-c", "user.email=t@t", "-c", "user.name=t", *a],
        cwd=r,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    run("init", "-q", "-b", "main")
    run("commit", "-q", "--allow-empty", "-m", "tip")
    run("update-ref", "refs/remotes/origin/ship-loop-3", "HEAD")
    return r, run("rev-parse", "HEAD")


def _shipped(tmp_path: Path, refs: Path, output: str) -> str:
    """A session that got the go, ran the ship (spending the go), and saw
    ``output``; returns the transcript path."""
    entries = [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")]
    t = write_transcript(tmp_path, entries)
    code, err = hook(tmp_path, SHIP_CMD, t, repo_refs=refs)
    assert code == 0, err
    entries += [tool_call("a2", "t1", SHIP_CMD), tool_output("u2", "t1", output)]
    return write_transcript(tmp_path, entries)


def test_a_resume_the_ship_asked_for_is_allowed(tmp_path, tip):
    refs, sha = tip
    t = _shipped(tmp_path, refs, timed_out(sha))
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}", t, repo_refs=refs)
    assert code == 0, err


def test_a_resume_the_ship_did_not_ask_for_is_blocked(tmp_path, tip):
    refs, sha = tip
    t = _shipped(tmp_path, refs, "SHIP VERIFIED\n  Backend live at abc1234.")
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}", t, repo_refs=refs)
    assert code == 2 and "did not ask for a resume" in err


def test_a_resume_of_a_sha_that_is_not_the_branch_tip_is_blocked(tmp_path, tip):
    refs, _sha = tip
    other = "0123456789abcdef0123456789abcdef01234567"
    t = _shipped(tmp_path, refs, timed_out(other))
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {other}", t, repo_refs=refs)
    assert code == 2 and "is not the tip of" in err


def test_a_resume_with_no_ship_in_this_session_is_blocked(tmp_path, tip):
    refs, sha = tip
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}", t, repo_refs=refs)
    assert code == 2 and "none found" in err


def test_a_resume_after_a_ship_whose_go_was_never_spent_is_blocked(tmp_path, tip):
    refs, sha = tip
    entries = [
        assistant(REPORT, "a1"),
        human("ship ship-loop-3", "g1"),
        tool_call("a2", "t1", SHIP_CMD),
        tool_output("u2", "t1", timed_out(sha)),
    ]
    t = write_transcript(tmp_path, entries)  # the ledger has no entry for it
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}", t, repo_refs=refs)
    assert code == 2 and "no used go" in err


# The independent reviewer's bypasses (2026-11-03): wrapped, grouped, piped or
# hidden runs must be gated like a plain run (fail closed).
P = "C:/x/scripts/ship.ps1"
W = "C:\\x\\scripts\\ship.ps1"


@pytest.mark.parametrize(
    "command",
    [
        f"true & pwsh -File {P} -Branch ship-loop-3",
        f"grep -c x README.md & pwsh -File {P} -Branch ship-loop-3",
        f"(pwsh -File {P} -Branch ship-loop-3)",
        f"x=$(pwsh -File {P} -Branch ship-loop-3)",
        f"if true; then pwsh -File {P} -Branch ship-loop-3; fi",
        f"{{ pwsh -File {P} -Branch ship-loop-3; }}",
        f"if ($true) {{ & '{W}' -Branch ship-loop-3 }}",
        f"1 | % {{ & '{W}' -Branch ship-loop-3 }}",
        f"timeout 900 pwsh -File {P} -Branch ship-loop-3",
        f"echo ship-loop-3 | xargs pwsh -File {P} -Branch",
        f"Get-Content {P} -Raw | Invoke-Expression",
        f"cat {P} | pwsh",
        f"Start-Job -FilePath {P}",
        f"echo '<<EOF'\npwsh -File {P} -Branch ship-loop-3\nEOF",
    ],
)
def test_a_wrapped_or_hidden_run_with_no_go_is_blocked(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


@pytest.mark.parametrize(
    "command",
    [
        f"& '{W}' # -FrontendCheckOnly",
        f"& '{W}' > -FrontendCheckOnly",
        f"& '{W}' '-FrontendCheckOnly'",
    ],
)
def test_a_frontend_check_flag_in_a_comment_or_redirect_does_not_count(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


def test_the_real_frontend_check_still_needs_no_go(tmp_path):
    code, err = hook(tmp_path, f"powershell -File {P} -FrontendCheckOnly -Sha 55c9054 2>&1")
    assert code == 0, err


def test_a_resume_needs_the_last_ships_own_go_not_an_older_one(tmp_path, tip):
    refs, sha = tip
    (tmp_path / "ledger.json").write_text(json.dumps({"g0-older": "ship-loop-3"}), encoding="utf-8")
    entries = [
        assistant(REPORT, "a1"),
        human("ship ship-loop-3", "g1"),
        tool_call("a2", "t1", SHIP_CMD),
        tool_output("u2", "t1", timed_out(sha)),
    ]
    t = write_transcript(tmp_path, entries)  # g1 itself was never spent
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}", t, repo_refs=refs)
    assert code == 2 and "no used go" in err


@pytest.mark.parametrize("command", [f"$r = & '{W}' -Branch ship-loop-3", f"$r = {W} -Branch x"])
def test_assigning_a_runs_output_is_a_run(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


@pytest.mark.parametrize(
    "extra",
    [
        "; pwsh -File C:/x/scripts/ship.ps1 -Branch other",
        " -Branch other",
        " -DryRun",
        " | Invoke-Expression",
        " $(whoami)",
    ],
)
def test_a_resume_with_anything_added_is_not_a_resume(tmp_path, tip, extra):
    """Only the bare `-Resume -Sha <sha>` skips the go; anything added is a
    ship that needs a fresh one."""
    refs, sha = tip
    t = _shipped(tmp_path, refs, timed_out(sha))
    code, err = hook(tmp_path, f"{SHIP} -Resume -Sha {sha}{extra}", t, repo_refs=refs)
    assert code == 2, err


@pytest.mark.parametrize(
    "command",
    [
        f"powershell -File {P} -FrontendCheckOnly -Sha 55c9054 2>&1 | tail",
        f"powershell -File {P} -FrontendCheckOnly; pwsh -File {P} -Branch ship-loop-3",
        f"powershell -File {P} -FrontendCheckOnly -Branch ship-loop-3",
    ],
)
def test_a_frontend_check_with_anything_added_needs_the_go(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


# Round 3 reviewer, blocking: a newline ends a statement, so a bare form
# split over two lines is two commands (the first a real ship).
@pytest.mark.parametrize(
    "command",
    [
        f"powershell -File {P} -Sha abcdef1 -SiteUrl https://x.example\n-FrontendCheckOnly",
        f"powershell -File {P} -Sha abcdef1\r\n-FrontendCheckOnly",
        f"powershell -File {P} -FrontendCheckOnly | Tee-Object scripts/hooks/ship_gate.py",
    ],
)
def test_a_frontend_check_over_two_lines_or_teeing_into_code_needs_the_go(tmp_path, command):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("looks good", "h1")])
    code, err = hook(tmp_path, command, t)
    assert code == 2 and 'not exactly "ship <branch>"' in err, err


def test_a_ship_over_two_lines_is_refused_and_keeps_the_go(tmp_path):
    t = write_transcript(tmp_path, [assistant(REPORT, "a1"), human("ship ship-loop-3", "g1")])
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3\n-DryRun", t)
    assert code == 2 and "exactly one run" in err, err
    code, err = hook(tmp_path, f"{SHIP} -Branch ship-loop-3 -DryRun", t)
    assert code == 0, err


def test_a_resume_over_two_lines_is_not_a_resume(tmp_path, tip):
    refs, sha = tip
    t = _shipped(tmp_path, refs, timed_out(sha))
    code, err = hook(tmp_path, f"{SHIP} -Sha {sha}\n-Resume", t, repo_refs=refs)
    assert code == 2, err
