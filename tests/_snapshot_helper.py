"""Canonical encoding for JSON snapshot files.

Lock-in: ``ensure_ascii=False, indent=2, sort_keys=True``, UTF-8, trailing ``\\n``.

Adopted after S1 (a21ef26) and G5 (0c7973c) surfaced encoding drift in
re-baselined snapshots — see issue #48 ("tooling: lock snapshot JSON
convention in shared helper"). Literal ``—`` / ``→`` / ``°`` characters are
preserved (more grep-readable than ``\\u`` escapes).

Drift is enforced by ``tests/test_snapshot_encoding.py``. Validation-artifacts
regen scripts import from this module via ``sys.path`` manipulation already in
place.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def serialize_snapshot(payload: Any) -> str:
    return json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def write_snapshot(path: Path, payload: Any) -> None:
    # newline="\n" forces LF even on Windows so core.autocrlf doesn't round-trip
    # the file into CRLF and re-trip the drift test on the next read.
    path.write_text(serialize_snapshot(payload), encoding="utf-8", newline="\n")
