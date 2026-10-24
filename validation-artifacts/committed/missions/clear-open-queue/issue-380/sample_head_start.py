"""#380 red proof: run the slow-overspan race N times, the way the test
does, and count how often the earliest free-mirror start misses the old
exact bound (>= 0.3) and the new bound (>= 0.3 - monotonic resolution).

Run from the worktree root: uv run python <this file> [N]
"""

from __future__ import annotations

import asyncio
import sys
import time
from typing import Any

import pytest

sys.path.insert(0, ".")
from src.rules import site_detection  # noqa: E402
from tests import test_overspan_mirror as t  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 50
RES = time.get_clock_info("monotonic").resolution


async def answer(url: str) -> Any:
    if url == t.OVERSPAN:
        await asyncio.sleep(30)
    return t._Resp({"elements": [{"id": 1}]})


mins: list[float] = []
for _ in range(N):
    mp = pytest.MonkeyPatch()
    try:
        mp.setenv("OVERSPAN_API_KEY", t.KEY)
        mp.setattr(site_detection, "OVERSPAN_HEAD_START_S", 0.3)
        site_detection._RATE_LIMITED_UNTIL.clear()
        w = t._Wire(answer)

        class _Client:
            def __init__(self, *_a: Any, **_k: Any) -> None:
                pass

            async def __aenter__(self) -> Any:
                return self

            async def __aexit__(self, *_a: Any) -> None:
                return None

            post = staticmethod(w.post)

        mp.setattr(site_detection.httpx, "AsyncClient", _Client)
        site_detection._overpass_request_with_fallback("[out:json];", 5.0, {})
        mins.append(min(c[3] for c in w.calls if c[0] != t.OVERSPAN))
    finally:
        mp.undo()

old = sum(m < 0.3 for m in mins)
new = sum(m < 0.3 - RES for m in mins)
print(f"monotonic resolution {RES} s; N={N}")
print(f"min free start: lowest {min(mins):.4f} s, highest {max(mins):.4f} s")
print(f"misses old bound (>= 0.3): {old}/{N}")
print(f"misses new bound (>= 0.3 - resolution): {new}/{N}")
