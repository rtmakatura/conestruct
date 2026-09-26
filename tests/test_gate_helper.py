"""scripts/gate.py -- the Python probes' bypass header (coming-soon-gate
R1.4, C-Q7).  Same contract as scripts/gate.cjs (pinned in
conestruct/site/tests/gate-helper.test.ts)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SPEC = importlib.util.spec_from_file_location(
    "scripts_gate", Path(__file__).resolve().parents[1] / "scripts" / "gate.py"
)
assert _SPEC and _SPEC.loader
gate = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(gate)

PROD = "https://www.conestruct.com/api/render/corridor-geometry"


def test_sends_the_token_when_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("GATE_BYPASS_TOKEN", "py-test-token")
    assert gate.gate_headers(PROD) == {"x-conestruct-gate": "py-test-token"}


def test_fails_loudly_on_production_without_the_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GATE_BYPASS_TOKEN", raising=False)
    with pytest.raises(SystemExit, match="GATE_BYPASS_TOKEN is not set"):
        gate.gate_headers(PROD)
    with pytest.raises(SystemExit):
        gate.gate_headers("https://conestruct.com/")


def test_local_server_without_the_token_gets_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GATE_BYPASS_TOKEN", raising=False)
    assert gate.gate_headers("http://localhost:3000/api/geocode") == {}


def test_a_look_alike_host_is_not_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GATE_BYPASS_TOKEN", raising=False)
    assert gate.gate_headers("https://conestruct.com.evil.example/") == {}
