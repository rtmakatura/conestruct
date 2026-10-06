#!/usr/bin/env python3
"""ship_gate: the PreToolUse guard for CC-run ships (ship-loop rulings R4, R10-R14,
validation-artifacts/committed/ship-loop/rulings.md).

Registered on the Bash and PowerShell tools.  Reads the hook JSON on stdin
({tool_name, tool_input: {command}, transcript_path, cwd, ...}).
Exit 0 = allow.  Exit 2 = block; the reason goes to stderr, which CC sees.

1. A command that runs ship.ps1 (other than the read-only -FrontendCheckOnly)
   is allowed only when ALL hold (R4, R11):
     - the latest human message in the transcript is exactly `ship <branch>`;
     - it comes after CC's most recent message containing a `result:` line,
       and <branch> appears in that result: line as a whole token;
     - the command's -Branch is <branch>;
     - that go has not been used (a ledger records each go's message uuid on
       its first use: one go = one branch = one run; -DryRun counts);
     - R77: the session's own working directory is not inside <branch>'s
       checkout, nor anywhere under .claude/worktrees/ except _ship (by
       path, so a folder git can't read is covered too).  The cleanup after
       the ship removes worktrees, and Windows can't delete a folder a live
       session sits in.  A refusal here doesn't spend the go.
2. Anything else that moves main, force-pushes any branch, or deletes a
   remote branch is blocked, whatever the go (R10):
     - git push to main (main, HEAD:main, x:refs/heads/main, --all, --mirror),
       or a bare `git push` / `git push <remote>` while the cwd is on main;
     - git push --force / -f / --force-with-lease / --force-if-includes, or a
       `+refspec`;
     - git push --delete / -d / a `:branch` refspec;
     - git merge / pull / rebase / reset / cherry-pick / revert / am while the
       cwd is on main;
     - git branch -f|-M|-C|-D ... main, update-ref refs/heads/main,
       checkout -B main, switch -C main, fetch ...:main;
     - gh pr merge; gh api writes to git/refs.
   Ordinary pushes of arc branches stay allowed.

What it cannot see, stated: git run from inside another script file (other
than ship.ps1, which is gated as a whole), or a command assembled at run time
from variables.

It FAILS CLOSED: any internal error blocks a command that mentions git, gh
or ship.ps1.  (verdict_hook.py fails open by design; a guard must not.)
Commands that mention none of them are never blocked.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

GO = re.compile(r"^ship\s+([A-Za-z0-9._/-]+)$")
SHIP = re.compile(r"ship\.ps1", re.IGNORECASE)
RELEVANT = re.compile(r"\bgit\b|\bgh\b|ship\.ps1", re.IGNORECASE)
NOT_HUMAN = ("<local-command", "<command-name>", "<command-message>", "<local-command-caveat>")
SYSTEM_REMINDER = re.compile(r"<system-reminder>[\s\S]*?</system-reminder>")


class Block(Exception):
    pass


# --------------------------------------------------------------------------- #
# The transcript
# --------------------------------------------------------------------------- #


def _entries(transcript_path: str):
    with open(transcript_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def human_text(entry: dict) -> str | None:
    """The text of a message Ryan typed, or None for anything else."""
    if entry.get("type") != "user" or entry.get("isMeta") or entry.get("isSidechain"):
        return None
    content = entry.get("message", {}).get("content")
    if not isinstance(content, str):
        return None  # tool results arrive as lists
    text = SYSTEM_REMINDER.sub("", content).strip()
    if not text or text.startswith(NOT_HUMAN):
        return None
    return text


def result_line(entry: dict) -> str | None:
    """The result: line of an assistant message, if it has one."""
    if entry.get("type") != "assistant" or entry.get("isSidechain"):
        return None
    for block in entry.get("message", {}).get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            for line in (block.get("text") or "").splitlines():
                if line.startswith("result:"):
                    return line
    return None


def find_go(transcript_path: str) -> tuple[str, str, str]:
    """(branch, go uuid, the result: line) or Block with the reason."""
    last_human: tuple[int, str, str] | None = None
    last_result: tuple[int, str] | None = None
    for i, e in enumerate(_entries(transcript_path)):
        t = human_text(e)
        if t is not None:
            last_human = (i, t, e.get("uuid") or f"line-{i}")
        r = result_line(e)
        if r is not None:
            last_result = (i, r)
    if last_human is None:
        raise Block("no message from Ryan in the transcript")
    i_h, text, uuid = last_human
    m = GO.match(text)
    if not m:
        raise Block(f'the latest message is not exactly "ship <branch>" (it is: {text[:80]!r})')
    branch = m.group(1)
    if last_result is None:
        raise Block("CC has no report with a result: line to name the branch")
    i_r, line = last_result
    if i_h < i_r:
        raise Block("the go comes before CC's latest result: line; a go counts only after it")
    if not re.search(rf"(?<![\w./-]){re.escape(branch)}(?![\w./-])", line):
        raise Block(f'branch "{branch}" is not in CC\'s latest result: line: {line[:160]!r}')
    return branch, uuid, line


# --------------------------------------------------------------------------- #
# The ledger of used gos
# --------------------------------------------------------------------------- #


def ledger_path() -> Path:
    env = os.environ.get("SHIP_GATE_LEDGER")
    if env:
        return Path(env)
    here = Path(__file__).resolve().parent
    r = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        cwd=here,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        raise Block("cannot locate the repo for the ledger")
    return Path(r.stdout.strip()).parent / ".claude" / "ship-gate-ledger.json"


def consume(uuid: str, branch: str) -> None:
    p = ledger_path()
    used = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    if uuid in used:
        raise Block(f'this go ("ship {branch}") was already used; one go = one run')
    used[uuid] = branch
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(used, indent=2), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Commands
# --------------------------------------------------------------------------- #


def segments(command: str) -> list[list[str]]:
    """Split on ; && || | and newlines, then into tokens (quotes respected)."""
    out = []
    for seg in re.split(r"\|\||&&|[;|\n]", command):
        toks = [a or b or c for a, b, c in re.findall(r'"([^"]*)"|\'([^\']*)\'|(\S+)', seg)]
        if toks:
            out.append(toks)
    return out


def git_call(toks: list[str]) -> tuple[str, list[str], str | None] | None:
    """(subcommand, args, the -C dir or None) when this segment runs git;
    skips `-c k=v`."""
    for i, t in enumerate(toks):
        base = t.replace("\\", "/").rsplit("/", 1)[-1].lower().lstrip("&")
        if base in ("git", "git.exe"):
            rest = toks[i + 1 :]
            j = 0
            cdir: str | None = None
            while j < len(rest) and rest[j].startswith("-"):
                if rest[j] == "-C" and j + 1 < len(rest):
                    cdir = rest[j + 1] if cdir is None else os.path.join(cdir, rest[j + 1])
                j += 2 if rest[j] in ("-c", "-C") else 1
            if j < len(rest):
                return rest[j], rest[j + 1 :], cdir
            return None
    return None


CD_COMMANDS = ("cd", "set-location", "sl", "chdir", "pushd")


def _as_path(path: str) -> str:
    """A Git Bash path (/c/Users/...) as the Windows path it names (C:/Users/...)."""
    m = re.match(r"^/([a-zA-Z])(/.*)?$", path)
    if m and os.name == "nt":
        return f"{m.group(1).upper()}:{m.group(2) or '/'}"
    return os.path.expanduser(path)


def _resolve(base: str | None, path: str) -> str:
    p = _as_path(path)
    return p if os.path.isabs(p) or base is None else os.path.join(base, p)


def current_branch(cwd: str | None) -> str:
    r = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=cwd or None,
        capture_output=True,
        text=True,
    )
    return r.stdout.strip() if r.returncode == 0 else ""


def arc_worktree_of(path: str) -> str | None:
    """R77: the <name> when ``path`` lies under ``.claude/worktrees/<name>``
    and <name> isn't ``_ship``; else None.  By path alone, so it holds where
    git can't read a branch (a stale folder reads as the main checkout)."""
    parts = [x.lower() for x in re.split(r"[\\/]+", _as_path(path)) if x]
    for i in range(len(parts) - 2):
        if parts[i] == ".claude" and parts[i + 1] == "worktrees" and parts[i + 2] != "_ship":
            return parts[i + 2]
    return None


def _is_main_ref(ref: str) -> bool:
    return ref in ("main", "refs/heads/main")


def check_git(sub: str, args: list[str], cwd: str | None) -> None:
    flags = [a for a in args if a.startswith("-")]
    positional = [a for a in args if not a.startswith("-")]
    if sub == "push":
        if any(
            f in ("--force", "-f", "--force-with-lease", "--force-if-includes")
            or f.startswith("--force-with-lease=")
            for f in flags
        ):
            raise Block("a force push (any branch) is blocked")
        if any(f in ("--delete", "-d") for f in flags):
            raise Block("deleting a remote branch is blocked")
        if any(f in ("--all", "--mirror") for f in flags):
            raise Block("git push --all / --mirror can move main; blocked")
        refspecs = positional[1:]
        for spec in refspecs:
            if spec.startswith("+"):
                raise Block(f"a forced refspec ({spec}) is blocked")
            if spec.startswith(":"):
                raise Block(f"deleting a remote branch ({spec}) is blocked")
            dst = spec.split(":", 1)[1] if ":" in spec else spec
            if _is_main_ref(dst) or (
                ":" not in spec and spec in ("HEAD",) and current_branch(cwd) == "main"
            ):
                raise Block(f"pushing to main ({spec}) is blocked; only ship.ps1 moves main")
        if not refspecs and current_branch(cwd) in ("main", "", "HEAD"):
            raise Block("a bare git push from main (or an unknown branch) is blocked")
        return
    if sub in ("merge", "pull", "rebase", "reset", "cherry-pick", "revert", "am"):
        # R68: `cwd` is the directory this git call runs in (see decide),
        # so the branch judged is the branch being changed.
        branch = current_branch(cwd)
        if branch == "main":
            raise Block(f"git {sub} on main is blocked; only ship.ps1 moves main")
        if branch == "":
            raise Block(f"git {sub}: cannot read the branch at {cwd}; blocked (fail closed)")
        return
    if (
        sub == "branch"
        and any(f in ("-f", "--force", "-M", "-C", "-D", "-m", "-c", "-d") for f in flags)
        and any(_is_main_ref(p) for p in positional)
    ):
        raise Block("moving, renaming or deleting the main branch is blocked")
    if sub == "update-ref" and any(_is_main_ref(p) for p in positional):
        raise Block("git update-ref on main is blocked")
    if (
        sub in ("checkout", "switch")
        and any(f in ("-B", "-C", "--force-create") for f in flags)
        and any(_is_main_ref(p) for p in positional)
    ):
        raise Block(f"git {sub} -B/-C main is blocked")
    if sub == "fetch" and any(
        ":" in p and _is_main_ref(p.split(":", 1)[1].lstrip("+")) for p in positional
    ):
        raise Block("fetching into main is blocked")


def check_gh(toks: list[str]) -> None:
    for i, t in enumerate(toks):
        if t.replace("\\", "/").rsplit("/", 1)[-1].lower() in ("gh", "gh.exe"):
            rest = [x.lower() for x in toks[i + 1 :]]
            if rest[:2] == ["pr", "merge"]:
                raise Block("gh pr merge is blocked; only ship.ps1 moves main")
            if rest[:1] == ["api"]:
                method = next(
                    (rest[k + 1] for k, x in enumerate(rest[:-1]) if x in ("-x", "--method")), "get"
                )
                if method != "get" and any("git/refs" in x or "/merges" in x for x in rest):
                    raise Block("gh api writes to refs or merges are blocked")
            return


def ship_branch_arg(command: str) -> str | None:
    m = re.search(r"-Branch[:\s]+[\"']?([A-Za-z0-9._/-]+)", command)
    return m.group(1) if m else None


def decide(payload: dict) -> None:
    command = (payload.get("tool_input") or {}).get("command") or ""
    if not RELEVANT.search(command):
        return
    cwd = payload.get("cwd")
    if SHIP.search(command):
        if re.search(r"-FrontendCheckOnly\b", command) and not re.search(r"-Branch\b", command):
            return  # read-only
        branch, uuid, _line = find_go(payload.get("transcript_path") or "")
        arg = ship_branch_arg(command)
        if arg != branch:
            raise Block(f'the go names "{branch}" but the command ships "{arg}"')
        # R77: the SESSION's cwd, never one moved by a cd inside the command:
        # a `Set-Location` there moves only that command's shell, and the
        # #292 ship (2026-10-04) failed its worktree removal exactly so.
        if cwd and (arc_worktree_of(cwd) is not None or current_branch(cwd) == branch):
            raise Block(
                f"this session's working directory ({cwd}) is inside {branch!r}'s worktree or "
                "under .claude/worktrees/, which the cleanup after the ship removes from; Windows "
                "can't delete a folder a live session sits in.  Leave it first: a session that "
                "entered the worktree with EnterWorktree runs ExitWorktree (action keep), which "
                "returns it to where it started; any other session moves to the main checkout "
                "(cd there).  Then run the ship again.  The go is not spent (R95)."
            )
        consume(uuid, branch)
        return
    # R68: each git call is judged in the directory it runs in -- the
    # session's cwd, moved by any earlier `cd` / `Set-Location` in the same
    # command, then by the call's own `-C` -- so a rebase in an arc's
    # worktree isn't refused because the session sits in the main checkout,
    # and a `-C <main checkout>` isn't let through because it doesn't.
    here = cwd
    for toks in segments(command):
        if toks[0].lower() in CD_COMMANDS and len(toks) > 1:
            here = _resolve(here, toks[1])
            continue
        call = git_call(toks)
        if call:
            sub, args, cdir = call
            check_git(sub, args, _resolve(here, cdir) if cdir else here)
        check_gh(toks)


def main() -> int:
    raw = sys.stdin.read()
    payload: dict = {}
    try:
        payload = json.loads(raw) if raw.strip() else {}
        decide(payload)
        return 0
    except Block as b:
        sys.stderr.write(f"BLOCKED by ship_gate: {b}\n")
        return 2
    except Exception as e:  # noqa: BLE001 -- fail closed on anything relevant
        command = (
            ((payload.get("tool_input") or {}).get("command") or "")
            if isinstance(payload, dict)
            else raw
        )
        if RELEVANT.search(command or raw):
            sys.stderr.write(f"BLOCKED by ship_gate (internal error, failing closed): {e}\n")
            return 2
        return 0


if __name__ == "__main__":
    sys.exit(main())
