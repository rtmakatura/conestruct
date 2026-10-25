"""Pytest configuration — make the project root importable as ``src.*``."""

from __future__ import annotations

import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any

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


@pytest.fixture(autouse=True)
def _overpass_unplugged(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """#389: no test reaches live Overpass.  The guard sits on the wire
    itself, ``httpx.AsyncClient.send`` for an Overpass mirror's URL, so a
    test that stubs the scan chain, a mirror (``_mirror_post``) or the
    client (``site_detection.httpx.AsyncClient``) never meets it, and a
    test that forgets its stub fails at once instead of only when the live
    scan is slow (#383).  Every other request (Starlette's in-process
    ``TestClient`` among them) passes through untouched."""
    import httpx

    from src.rules import site_detection

    overpass = {*site_detection.OVERPASS_MIRRORS, site_detection.OVERSPAN_URL}
    real_send = httpx.AsyncClient.send
    reached: list[str] = []

    async def _guarded_send(self: httpx.AsyncClient, request: httpx.Request, **kwargs: Any) -> Any:
        url = str(request.url.copy_with(query=None))
        if url in overpass:
            reached.append(url)
            # Not an httpx.HTTPError, so the race can't file it as one
            # mirror's failure and fall back to another.
            raise RuntimeError(
                f"#389: this test reached live Overpass ({url}); stub the scan "
                "(tests/_worst_case_scan.py) or _mirror_post"
            )
        return await real_send(self, request, **kwargs)

    monkeypatch.setattr(httpx.AsyncClient, "send", _guarded_send)
    yield
    if reached:
        pytest.fail(f"#389: reached live Overpass {len(reached)}x: {sorted(set(reached))}")
