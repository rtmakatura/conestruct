"""#307 (R151): a signed copy of a Generate's site scan, for its downloads.

A download used to build its plan through a fresh ``run_site_scan``; on a
container whose memo hadn't seen the corridor in the last 120 s it scanned
again (14 of 20 follow-ups on prod ``4c52c49``) and could refuse beside a
plan that answered.  The Generate's audit now hands back exactly what the
memo stores for its scan -- ``(key, buckets, measured_at, duration_ms)``
-- signed, and each download sends it back.  The server verifies the
signature and, when the download's own corridor key matches, serves the
scan from it like a memo hit: the same answer as the plan on screen, on
any container, at any delay.

The signature is HMAC-SHA256 with a key derived from the render service's
existing ``RENDER_API_SECRET`` (domain-separated, so the bearer secret is
never used as a MAC key directly).  A client can carry a token; it cannot
make or alter one.  Format: ``<payload>.<mac>``, both base64url without
padding; the payload is zlib-compressed JSON.

#371: a token is honoured for :data:`MAX_AGE_S` after its scan was
measured (``verify_current_scan``); an older one is refused, never served
as a current answer (Rule 10).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import zlib
from datetime import UTC, datetime
from typing import Any

TOKEN_VERSION = 1
_DOMAIN = b"conestruct site-scan token v1"
_SECRET_VAR = "RENDER_API_SECRET"

# CHOSEN (#371 R1): a token only has to last from a Generate to its
# downloads, and the page drops it on any edit.  12 h covers a morning
# Generate downloaded at the end of the shift and refuses yesterday's scan.
MAX_AGE_S = 12 * 3600


class ScanTokenInvalid(ValueError):
    """The token's signature, encoding or shape didn't check out."""


class ScanTokenExpired(ScanTokenInvalid):
    """The token checks out, but its scan is older than :data:`MAX_AGE_S`."""


def _mac_key() -> bytes:
    secret = os.environ.get(_SECRET_VAR, "")
    if not secret:
        # The render service fails closed without the secret anyway
        # (bearer auth); a token can be neither made nor checked.
        raise ScanTokenInvalid("the render secret is not configured")
    return hashlib.sha256(_DOMAIN + secret.encode("utf-8")).digest()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def sign_scan(key: str, buckets: dict[str, Any], measured_at: str, duration_ms: int) -> str:
    """The token for one scan answer (the memo's own tuple)."""
    payload = json.dumps(
        {
            "v": TOKEN_VERSION,
            "key": key,
            "buckets": buckets,
            "measured_at": measured_at,
            "duration_ms": duration_ms,
        },
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    body = _b64(zlib.compress(payload, 9))
    mac = hmac.new(_mac_key(), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64(mac)}"


def verify_scan(token: str) -> dict[str, Any]:
    """The signed entry, or ``ScanTokenInvalid``.  The signature is checked
    before anything in the payload is decoded or trusted."""
    try:
        body, mac = token.split(".")
        given = _unb64(mac)
        # A non-ASCII body is malformed, never a 500 (UnicodeEncodeError is
        # a ValueError, caught here with the rest).
        body_bytes = body.encode("ascii")
    except (ValueError, TypeError) as exc:
        raise ScanTokenInvalid("malformed token") from exc
    expected = hmac.new(_mac_key(), body_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(given, expected):
        raise ScanTokenInvalid("signature does not match")
    try:
        entry = json.loads(zlib.decompress(_unb64(body)))
    except (ValueError, zlib.error) as exc:
        raise ScanTokenInvalid("undecodable payload") from exc
    if (
        not isinstance(entry, dict)
        or entry.get("v") != TOKEN_VERSION
        or not isinstance(entry.get("key"), str)
        or not isinstance(entry.get("buckets"), dict)
        or not isinstance(entry.get("measured_at"), str)
        or not isinstance(entry.get("duration_ms"), int)
    ):
        raise ScanTokenInvalid("unexpected payload shape")
    return entry


def verify_current_scan(token: str, now: datetime | None = None) -> dict[str, Any]:
    """``verify_scan``, then the age limit (#371): the entry, or
    ``ScanTokenExpired`` when its scan was measured more than
    :data:`MAX_AGE_S` before ``now``.  This is the check a request that
    serves the scan uses."""
    entry = verify_scan(token)
    try:
        measured = datetime.fromisoformat(entry["measured_at"])
    except ValueError as exc:
        raise ScanTokenInvalid("undecodable measured_at") from exc
    if measured.tzinfo is None:
        raise ScanTokenInvalid("measured_at has no time zone")
    age_s = ((now or datetime.now(UTC)) - measured).total_seconds()
    if age_s > MAX_AGE_S:
        raise ScanTokenExpired(
            f"the scan is {age_s / 3600:.1f} h old; a token is honoured for {MAX_AGE_S // 3600} h"
        )
    return entry
