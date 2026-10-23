"""#371: no committed evidence file carries a signed site-scan token.

A token is ``<payload>.<mac>`` (``src/api/scan_token.py``): base64url
without padding, and the MAC is HMAC-SHA256, so its half is exactly 43
characters.  The check reads that shape anywhere in a file, not only
under a ``site_scan_token`` key, so a token copied into a request, a log
or a note is caught too.  The audit fetch scripts strip the token before
writing (``audit-lane/fetch.py``, ``audit-shoulder/fetch.py``).
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

COMMITTED = Path(__file__).resolve().parents[1] / "validation-artifacts" / "committed"

# A payload of 20+ characters, a dot, then a 43-character MAC with no
# base64url character on either side.
TOKEN_SHAPE = re.compile(
    rb"(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{43}(?![A-Za-z0-9_.-])"
)


def token_files(root: Path) -> list[str]:
    """Every file under ``root`` holding a token-shaped string."""
    return sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and TOKEN_SHAPE.search(p.read_bytes())
    )


def test_no_committed_file_holds_a_signed_scan_token() -> None:
    assert COMMITTED.is_dir()
    assert token_files(COMMITTED) == []


def test_the_check_catches_a_real_token(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from src.api import scan_token as st

    monkeypatch.setenv("RENDER_API_SECRET", "test-secret-do-not-deploy")
    tok = st.sign_scan(
        "k1", {"sidewalks": {"detected": True, "count": 2}}, "2026-10-22T00:00:00+00:00", 1
    )
    (tmp_path / "audit.json").write_text(f'{{"site_scan_token":"{tok}"}}', "utf-8")
    (tmp_path / "request.json").write_text(f'{{"site_scan": {{"token": "{tok}"}}}}', "utf-8")
    (tmp_path / "clean.json").write_text(
        '{"sha": "4a71429e", "url": "https://example.com/a.b"}', "utf-8"
    )
    assert token_files(tmp_path) == ["audit.json", "request.json"]
