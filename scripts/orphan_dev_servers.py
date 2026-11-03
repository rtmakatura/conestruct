#!/usr/bin/env python3
"""orphan_dev_servers: list, and with --kill stop, the `next dev` servers left
running from this repo or its worktrees.  (R159, Ryan 2026-11-03)

R159, word for word: "/start lists node processes running next dev from this
repo or its worktrees, kills any not started by this session by process tree,
and reports what it killed. Session end still kills the session's own server
by process tree."

/start runs it before any work, so every match is an orphan except the PIDs
passed with --keep (a server this session started earlier).  A process
matches only when its command line names `next dev` (or Next's dev server
entry) AND a path inside the repo root, the worktrees included; a dev server
from any other project is never touched.  Kills use `taskkill /PID <pid> /T
/F` (the process tree) on Windows, SIGTERM to the process group elsewhere.

usage:  python scripts/orphan_dev_servers.py [--kill] [--keep PID ...] [--root DIR]
Prints one line per match and a summary.  Exit 0 always, unless listing the
processes fails (exit 2).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

DEV = re.compile(
    r"next(?:\.cmd)?[\"']?\s+dev\b|next[\\/]dist[\\/]bin[\\/]next[\"']?\s+dev\b"
    r"|next[\\/]dist[\\/]server[\\/]lib[\\/]start-server\.js|npm(?:\.cmd)?[\"']?\s+run\s+dev\b",
    re.IGNORECASE,
)


def _norm(path: str) -> str:
    """One spelling for C:\\x, C:/x and Git Bash's /c/x, lower-cased."""
    p = path.replace("\\", "/")
    p = re.sub(r"(^|[\s\"'=])/([a-zA-Z])/", r"\1\2:/", p)  # anywhere in a command line
    return p.rstrip("/").lower()


def select_orphans(procs: list[dict], root: str, keep: set[int]) -> list[dict]:
    """The dev servers from this repo (or its worktrees) not in ``keep``.
    ``procs`` items: {"pid": int, "ppid": int, "cmd": str}.  A child whose
    parent is also selected is left out: killing the parent's tree ends it."""
    r = _norm(root)
    hits = [
        p
        for p in procs
        if p.get("cmd")
        and DEV.search(p["cmd"])
        and r in _norm(p["cmd"])
        and p["pid"] not in keep
        and p.get("ppid") not in keep
    ]
    pids = {p["pid"] for p in hits}
    return [p for p in hits if p.get("ppid") not in pids]


def list_processes() -> list[dict]:
    if os.name == "nt":
        ps = (
            "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | "
            "Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"
        )
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", ps],
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        ).stdout
        data = json.loads(out or "[]")
        data = data if isinstance(data, list) else [data]
        return [
            {"pid": d["ProcessId"], "ppid": d["ParentProcessId"], "cmd": d["CommandLine"]}
            for d in data
        ]
    out = subprocess.run(
        ["ps", "-eo", "pid=,ppid=,args="], capture_output=True, text=True, check=True
    ).stdout
    procs = []
    for line in out.splitlines():
        parts = line.split(None, 2)
        if len(parts) == 3:
            procs.append({"pid": int(parts[0]), "ppid": int(parts[1]), "cmd": parts[2]})
    return procs


def kill_tree(pid: int) -> str:
    if sys.platform == "win32":
        r = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True
        )
        return "killed" if r.returncode == 0 else f"kill failed: {(r.stderr or r.stdout).strip()}"
    try:
        os.killpg(os.getpgid(pid), signal.SIGTERM)
        return "killed"
    except OSError as e:
        return f"kill failed: {e}"


def repo_root() -> str:
    """The main checkout's root, so a run from a worktree still covers every
    worktree (they live under <root>/.claude/worktrees/)."""
    common = subprocess.run(
        ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()
    return str(Path(common).parent)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--kill", action="store_true")
    ap.add_argument("--keep", type=int, nargs="*", default=[])
    ap.add_argument("--root")
    a = ap.parse_args(argv)
    root = a.root or repo_root()
    try:
        procs = list_processes()
    except (subprocess.CalledProcessError, json.JSONDecodeError, OSError) as e:
        print(f"ERROR: could not list processes: {e}")
        return 2
    found = select_orphans(procs, root, set(a.keep))
    if not found:
        print(f"no orphan next dev servers under {root}")
        return 0
    for p in found:
        status = kill_tree(p["pid"]) if a.kill else "found (not killed; pass --kill)"
        print(f"PID {p['pid']} {status}: {p['cmd'][:160]}")
    verb = "killed" if a.kill else "found"
    print(f"{len(found)} orphan next dev server(s) {verb} under {root}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
