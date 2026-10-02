"""Pytest configuration — make the project root importable as ``src.*``."""

from __future__ import annotations

import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_mirror_cooldowns() -> None:
    """#292 (R73): a 429 leaves that mirror alone for a while, in
    module state.  Every test starts with no mirror cooling down, so one
    test's 429 never decides another test's race."""
    from src.rules import site_detection

    site_detection._RATE_LIMITED_UNTIL.clear()
