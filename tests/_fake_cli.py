"""A stand-in command-line tool that runs on Windows and on CI's Ubuntu runner
(ship-loop ruling R50).

The PowerShell checks call their CLI as a native command and read
$LASTEXITCODE.  The stand-in's behaviour is one Python program; the file the
check runs is a two-line shim around it: a .cmd on Windows (as npx and gh are
there) and an executable sh script elsewhere.  A .cmd alone cannot run on
Linux, which is how tests/test_vercel_env_check.py went red in CI from
467ffaf on.
"""

from __future__ import annotations

import os
import stat
import sys
from pathlib import Path


def write_fake_cli(tmp_path: Path, name: str, program: str) -> Path:
    """Write `program` (Python source that reads sys.argv[1:]) and return the
    path of a native-command shim that runs it with every argument."""
    body = tmp_path / f"{name}_fake.py"
    body.write_text(program, encoding="utf-8")
    if os.name == "nt":
        shim = tmp_path / f"{name}.cmd"
        shim.write_text(f'@"{sys.executable}" "{body}" %*\r\n', encoding="ascii")
    else:
        shim = tmp_path / name
        shim.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{body}" "$@"\n', encoding="utf-8")
        shim.chmod(shim.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return shim
