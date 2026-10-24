"""Red-proof plugin (#383): unplug live Overpass.  Any test that reaches the
real _overpass_request_with_fallback fails at teardown."""
import pytest


@pytest.fixture(autouse=True)
def _unplugged(monkeypatch):
    from src.rules import site_detection as sd

    calls = []

    def boom(q, **_k):
        calls.append(q)
        raise RuntimeError("network unplugged (#383 red proof)")

    monkeypatch.setattr(sd, "_overpass_request_with_fallback", boom)
    yield
    assert not calls, f"reached live Overpass {len(calls)}x"
