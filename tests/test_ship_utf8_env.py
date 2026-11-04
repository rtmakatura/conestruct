"""The ship sets Python's output encoding itself.

On 2026-11-04 the ship of 6231697 died at `modal deploy` on "'charmap' codec
can't encode character '✓'": the shell that ran it had no
PYTHONIOENCODING, so Python fell back to the Windows code page.  ship.ps1 now
sets PYTHONIOENCODING=utf-8 for its own process before any step runs, so every
child (modal deploy, the hand-over copy, the helper scripts) inherits it and no
ship depends on the shell or the machine's settings.

scripts/ship.ps1 is read as text, like test_ship_resume.py: the ship_gate hook
gates any run of it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHIP = ROOT / "scripts" / "ship.ps1"


def code_lines() -> list[str]:
    lines = SHIP.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def test_pythonioencoding_is_set_once_to_utf8() -> None:
    hits = [ln for ln in code_lines() if "PYTHONIOENCODING" in ln]
    assert hits == ['$env:PYTHONIOENCODING = "utf-8"']


def test_it_is_set_before_any_command_runs() -> None:
    lines = code_lines()
    env_at = lines.index('$env:PYTHONIOENCODING = "utf-8"')
    # Right after the param block's error preference, before the first
    # function, the hand-over and modal deploy.
    assert lines[env_at - 1] == '$ErrorActionPreference = "Stop"'
    first_call = next(
        i for i, ln in enumerate(lines) if re.match(r"(function |& |\$\w+\s*=\s*&)", ln)
    )
    assert env_at < first_call
    deploy_at = next(i for i, ln in enumerate(lines) if "deploy modal_app.py" in ln)
    assert env_at < deploy_at


def test_it_is_process_scope_not_machine_scope() -> None:
    text = SHIP.read_text(encoding="utf-8")
    assert "SetEnvironmentVariable" not in text
    assert not re.search(r"\bsetx\b", text)
