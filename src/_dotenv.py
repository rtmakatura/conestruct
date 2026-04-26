"""Minimal .env loader (no extra dependency).

Reads ``KEY=VALUE`` lines from a ``.env`` file at the project root and
populates ``os.environ`` for any key that is not already set.  Supports
shell-style ``#`` comments and surrounding single/double quotes on values.
"""

from __future__ import annotations

import os
from pathlib import Path


def load_dotenv(env_path: Path | None = None) -> None:
    if env_path is None:
        env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value
