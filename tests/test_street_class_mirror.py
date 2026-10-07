"""R110 Q1 -- the frontend's street-class table is a MIRROR of the backend's.

``src/rules/street_class.py`` owns the tag -> class mapping (the backend
recomputes every guess and refuses a stale one).  The frontend keeps a
copy only to prefill the field before Generate; if the two drift, every
prefilled class the copy disagrees on would come back as a 400.  This
reads the TS source the way ``test_site_adjustment_detail_mirror.py`` does
and holds the two tables equal, entry for entry.
"""

from __future__ import annotations

import re
from pathlib import Path

from src.rules.street_class import STREET_CLASS_BY_HIGHWAY

_TS = (
    Path(__file__).resolve().parent.parent
    / "conestruct"
    / "site"
    / "lib"
    / "road-detection"
    / "classify.ts"
)


def _ts_table() -> dict[str, str]:
    text = _TS.read_text(encoding="utf-8")
    m = re.search(
        r"const STREET_CLASS_BY_HIGHWAY: Record<string, StreetClass> = \{(.*?)\};",
        text,
        re.S,
    )
    assert m, "STREET_CLASS_BY_HIGHWAY not found in classify.ts"
    return dict(re.findall(r"(\w+):\s*\"(\w+)\"", m.group(1)))


def test_the_frontend_table_mirrors_the_backend_table() -> None:
    assert _ts_table() == STREET_CLASS_BY_HIGHWAY
