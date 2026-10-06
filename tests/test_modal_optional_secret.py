"""#292 R102 — the Overspan secret is attached only when it exists.

``modal_app._optional_secrets`` decides, at ``modal deploy`` time, whether
the ``overspan-api-key`` Modal secret rides the function.  With no secret
the deploy carries exactly today's three secrets (byte-identical).  It only
looks when ship.ps1 deploys (``CONESTRUCT_SHIP_DEPLOY=1``): importing
modal_app elsewhere (tests, CI, the container itself) makes no Modal call.
"""

from __future__ import annotations

from typing import Any

import modal
import pytest

import modal_app


class _Secret:
    def __init__(self, exists: bool) -> None:
        self.exists = exists
        self.hydrated = False

    def hydrate(self) -> _Secret:
        self.hydrated = True
        if not self.exists:
            raise modal.exception.NotFoundError("Secret 'overspan-api-key' not found")
        return self


def _lookup(monkeypatch: pytest.MonkeyPatch, exists: bool) -> list[str]:
    asked: list[str] = []

    def from_name(name: str, *_a: Any, **_k: Any) -> _Secret:
        asked.append(name)
        return _Secret(exists)

    monkeypatch.setattr(modal.Secret, "from_name", staticmethod(from_name))
    return asked


def test_outside_a_ship_deploy_nothing_is_looked_up(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CONESTRUCT_SHIP_DEPLOY", raising=False)
    asked = _lookup(monkeypatch, exists=True)
    assert modal_app._optional_secrets() == []
    assert asked == []


def test_a_ship_deploy_with_no_secret_attaches_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONESTRUCT_SHIP_DEPLOY", "1")
    asked = _lookup(monkeypatch, exists=False)
    assert modal_app._optional_secrets() == []
    assert asked == ["overspan-api-key"]


def test_a_ship_deploy_with_the_secret_attaches_it(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONESTRUCT_SHIP_DEPLOY", "1")
    _lookup(monkeypatch, exists=True)
    secrets = modal_app._optional_secrets()
    assert len(secrets) == 1 and secrets[0].hydrated
