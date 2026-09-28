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
