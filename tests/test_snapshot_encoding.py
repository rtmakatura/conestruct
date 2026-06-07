"""Drift guard for the canonical snapshot JSON encoding.

Every active snapshot in ``tests/snapshots/`` must round-trip through
``serialize_snapshot`` byte-for-byte. Re-baselining via a different
``json.dumps`` invocation fails this test loudly instead of leaking a
non-content diff into the next commit (see issue #48).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tests._snapshot_helper import serialize_snapshot

SNAPSHOT_DIR = Path("tests/snapshots")

# Archived ``_pre_*`` baselines are intentionally excluded — they are frozen
# historical artifacts kept for scoped-field diffs in future migrations and
# encode pre-canonical conventions. Don't extend ACTIVE to cover them.
ACTIVE = sorted(p for p in SNAPSHOT_DIR.glob("*.json") if "_pre_" not in p.name)


@pytest.mark.parametrize("path", ACTIVE, ids=lambda p: p.name)
def test_snapshot_canonical_encoding(path: Path) -> None:
    raw = path.read_text(encoding="utf-8")
    expected = serialize_snapshot(json.loads(raw))
    assert raw == expected, (
        f"{path.name} drifted from canonical snapshot encoding "
        "(ensure_ascii=False, indent=2, sort_keys=True, trailing \\n). "
        "Re-baseline via tests._snapshot_helper.write_snapshot()."
    )
