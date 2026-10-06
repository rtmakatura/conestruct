"""#292 R102 — Overspan as an optional first-choice mirror.

Overspan (https://overspan.dev, hosted Overpass) is earmarked, not live
(Linear CON-39).  The framework: with an ``OVERSPAN_API_KEY`` in the
environment (a Modal secret), Overspan is asked first, with the key in an
``Authorization: Bearer`` header and never in the URL (the URL is printed
in refusal text and the audit's ``mirror``).  The free mirrors stay as the
fallback.  With no key, behaviour is byte-identical to today: the same
requests, to the same mirrors, with the same headers.

Tested on the ``_mirror_post`` seam (the wire) and through
``_overpass_request_with_fallback`` (the race every scan uses).
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import pytest

from src.rules import site_detection

KEY = "sk-test-0123456789"
OVERSPAN = "https://api.overspan.dev/api/interpreter"
FREE = site_detection.OVERPASS_MIRRORS


class _Resp:
    def __init__(self, payload: dict[str, Any], status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.reason_phrase = "OK" if status_code == 200 else "ERR"
        self.content = json.dumps(payload).encode()
        self.headers: dict[str, str] = {}

    def json(self) -> dict[str, Any]:
        return self._payload


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OVERSPAN_API_KEY", raising=False)
    site_detection._RATE_LIMITED_UNTIL.clear()


class _Wire:
    """Records every request the real ``_mirror_post`` would send."""

    def __init__(self, answer: Any) -> None:
        self.calls: list[tuple[str, dict[str, Any], dict[str, str], float]] = []
        self._answer = answer
        self._t0 = time.monotonic()

    async def post(
        self, url: str, data: Any = None, headers: Any = None, timeout: Any = None
    ) -> Any:
        self.calls.append((url, dict(data), dict(headers), time.monotonic() - self._t0))
        return await self._answer(url)


@pytest.fixture
def wire(monkeypatch: pytest.MonkeyPatch):
    """Patch the httpx client the race opens, so the real ``_mirror_post``
    (headers and all) runs and its requests are recorded."""

    def install(answer: Any) -> _Wire:
        w = _Wire(answer)

        class _Client:
            def __init__(self, *_a: Any, **_k: Any) -> None:
                pass

            async def __aenter__(self) -> _Client:
                return self

            async def __aexit__(self, *_a: Any) -> None:
                return None

            post = staticmethod(w.post)

        monkeypatch.setattr(site_detection.httpx, "AsyncClient", _Client)
        return w

    return install


async def _ok(_url: str) -> Any:
    return _Resp({"elements": []})


def test_no_key_asks_exactly_todays_mirrors_with_todays_headers(wire: Any) -> None:
    """Byte-identical with no key: the free mirrors, at once, User-Agent only."""
    w = wire(_ok)
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", 5.0, meta)
    assert (payload, error) == ({"elements": []}, None)
    assert [c[0] for c in w.calls] == list(FREE)
    for _url, data, headers, _t in w.calls:
        assert data == {"data": "[out:json];"}
        assert headers == {"User-Agent": site_detection.USER_AGENT}
    assert meta["mirror"] == FREE[0]


def test_with_a_key_overspan_is_asked_first_with_a_bearer_header(
    wire: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OVERSPAN_API_KEY", KEY)
    w = wire(_ok)
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", 5.0, meta)
    assert (payload, error) == ({"elements": []}, None)
    # Overspan answered inside its head start, so no free mirror was asked.
    assert [c[0] for c in w.calls] == [OVERSPAN]
    url, data, headers, _t = w.calls[0]
    assert headers == {"User-Agent": site_detection.USER_AGENT, "Authorization": f"Bearer {KEY}"}
    assert KEY not in url
    assert meta["mirror"] == OVERSPAN


def test_an_overspan_failure_falls_back_to_the_free_mirrors_at_once(
    wire: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OVERSPAN_API_KEY", KEY)

    async def answer(url: str) -> Any:
        return _Resp({"error": "quota"}, 429) if url == OVERSPAN else _Resp({"elements": []})

    w = wire(answer)
    started = time.monotonic()
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", 5.0)
    assert (payload, error) == ({"elements": []}, None)
    assert [c[0] for c in w.calls][0] == OVERSPAN
    assert set(c[0] for c in w.calls[1:]) == set(FREE)
    # The free mirrors went out as soon as Overspan failed, not after the head start.
    assert time.monotonic() - started < site_detection.OVERSPAN_HEAD_START_S
    # The free mirrors never see the key.
    for _url, _d, headers, _t in w.calls[1:]:
        assert "Authorization" not in headers


def test_a_slow_overspan_lets_the_free_mirrors_in_after_its_head_start(
    wire: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("OVERSPAN_API_KEY", KEY)
    monkeypatch.setattr(site_detection, "OVERSPAN_HEAD_START_S", 0.3)

    async def answer(url: str) -> Any:
        if url == OVERSPAN:
            await asyncio.sleep(30)
        return _Resp({"elements": [{"id": 1}]})

    w = wire(answer)
    meta: dict[str, Any] = {}
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", 5.0, meta)
    assert error is None and payload == {"elements": [{"id": 1}]}
    free_starts = [t for url, _d, _h, t in w.calls if url != OVERSPAN]
    assert len(free_starts) == 2 and min(free_starts) >= 0.3
    assert meta["mirror"] in FREE


def test_the_key_never_reaches_a_refusal(wire: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OVERSPAN_API_KEY", KEY)

    async def answer(_url: str) -> Any:
        return _Resp({}, 504)

    wire(answer)
    payload, error = site_detection._overpass_request_with_fallback("[out:json];", 5.0)
    assert payload is None
    assert OVERSPAN in error and KEY not in error
