"""scripts/orphan_dev_servers.py -- R159's selection: only `next dev` servers
whose command line points inside this repo or its worktrees."""

from __future__ import annotations

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "orphan_dev_servers.py"
_spec = importlib.util.spec_from_file_location("orphan_dev_servers", SCRIPT)
assert _spec and _spec.loader
o = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(o)

ROOT = r"C:\Users\rtmak\Documents\traffic-control-tool"
SITE = ROOT + r"\conestruct\site"
WT = ROOT + r"\.claude\worktrees\ux-group1b\conestruct\site"


def p(pid: int, cmd: str, ppid: int = 1) -> dict:
    return {"pid": pid, "ppid": ppid, "cmd": cmd}


def test_dev_servers_in_the_repo_and_its_worktrees_are_orphans():
    procs = [
        p(10, rf'"C:\Program Files\nodejs\node.exe" {SITE}\node_modules\next\dist\bin\next dev'),
        p(11, rf"node {WT}\node_modules\next\dist\bin\next dev -p 3436"),
        p(12, "cmd /c npx next dev -p 3001", ppid=1),  # no repo path: left alone
    ]
    got = [x["pid"] for x in o.select_orphans(procs, ROOT, set())]
    assert got == [10, 11]


def test_other_projects_and_other_node_work_are_never_touched():
    procs = [
        p(20, r"node C:\Users\rtmak\Documents\picklr-ladder\node_modules\next\dist\bin\next dev"),
        p(21, rf"node {SITE}\node_modules\vitest\vitest.mjs run"),
        p(22, rf"node {SITE}\node_modules\next\dist\bin\next build"),
        p(23, rf"node {SITE}\node_modules\typescript\bin\tsc --noEmit"),
    ]
    assert o.select_orphans(procs, ROOT, set()) == []


def test_a_server_this_session_started_is_kept_with_its_children():
    procs = [
        p(30, rf"node {WT}\node_modules\next\dist\bin\next dev -p 3436"),
        p(31, rf"node {WT}\node_modules\next\dist\server\lib\start-server.js", ppid=30),
    ]
    assert o.select_orphans(procs, ROOT, {30}) == []


def test_a_child_of_a_selected_server_is_left_to_its_parents_tree_kill():
    procs = [
        p(40, rf"node {SITE}\node_modules\next\dist\bin\next dev"),
        p(41, rf"node {SITE}\node_modules\next\dist\server\lib\start-server.js", ppid=40),
        p(42, rf"node {WT}\node_modules\next\dist\server\lib\start-server.js", ppid=999),
    ]
    assert [x["pid"] for x in o.select_orphans(procs, ROOT, set())] == [40, 42]


def test_git_bash_and_forward_slash_spellings_match_the_root():
    procs = [
        p(
            50,
            "node /c/Users/rtmak/Documents/traffic-control-tool/conestruct/site/"
            "node_modules/.bin/next dev",
        ),
        p(
            51,
            "npm.cmd run dev --prefix "
            "C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site",
        ),
    ]
    assert [x["pid"] for x in o.select_orphans(procs, ROOT, set())] == [50, 51]


# R159 amendment (Ryan, 2026-11-03): kill only when the parent is gone.


def test_a_dev_server_whose_parent_is_alive_is_listed_not_killed():
    procs = [
        p(60, r"C:\Program Files\Git\bin\bash.exe -c npx next dev"),  # another session's shell
        p(61, rf"node {WT}\node_modules\next\dist\bin\next dev -p 3436", ppid=60),
        p(62, rf"node {SITE}\node_modules\next\dist\bin\next dev", ppid=4040),  # parent gone
    ]
    assert [x["pid"] for x in o.select_orphans(procs, ROOT, set())] == [62]
    assert [x["pid"] for x in o.select_parented(procs, ROOT, set())] == [61]


def test_a_parent_with_an_unreadable_command_line_still_counts_as_alive():
    procs = [
        {"pid": 70, "ppid": 4, "cmd": None},
        p(71, rf"node {SITE}\node_modules\next\dist\bin\next dev", ppid=70),
    ]
    assert o.select_orphans(procs, ROOT, set()) == []
    assert [x["pid"] for x in o.select_parented(procs, ROOT, set())] == [71]


def test_a_sibling_folder_sharing_the_repo_name_is_not_the_repo():
    """The reviewer's point: the root matches as a whole path, not a prefix."""
    procs = [
        p(50, rf"node {ROOT}-old\conestruct\site\node_modules\next\dist\bin\next dev"),
        p(51, rf"node {ROOT}2\node_modules\next\dist\bin\next dev"),
        p(52, rf'node "{SITE}\node_modules\next\dist\bin\next" dev'),
    ]
    assert [x["pid"] for x in o.select_orphans(procs, ROOT, set())] == [52]
