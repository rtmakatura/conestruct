"""#368 — W20-1 stays 1,000 ft upstream of the last W3-5 on Case 11 plans.

Freeway Case 11 reduced-speed shoulder plans kept W20-1 at Case 11's
5,200 ft (#360 Q1) while each W3-5 step moved 530 ft farther out, so two
or more steps put W20-1 under Table 6B-1's freeway 1,000 ft (p. 773) and
four put it downstream of a W3-5.  Ruling R1 (option (b)): W20-1 =
max(5,200, last W3-5 + 1,000 ft) from the taper start.

Rule 11: the audit off ``/render/audit``, page 1 off ``/render/pdf`` and
the crew sheet off ``/render/markdown``, all through the real API.
"""

from __future__ import annotations

import re

import pytest
from fastapi.testclient import TestClient

from ._harness import _common
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)

# (posted, work-zone speed, W3-5 steps, W20-1 from the taper start)
_PAIRS = [
    (75, 60, 1, 5200),  # one step: Case 11's 5,200 ft already clears 1,000 ft
    (75, 45, 2, 5560),
    (75, 40, 3, 6090),
    (75, 20, 4, 6620),
    (70, 20, 4, 6620),
]
_IDS = [f"{s}-{wz}" for s, wz, _, _ in _PAIRS]


def _distance(text: str) -> int:
    return int(text.split()[0].replace(",", ""))


@pytest.mark.parametrize(("speed", "wz", "steps", "w20_1"), _PAIRS, ids=_IDS)
@pytest.mark.parametrize("divided", [True, False], ids=["divided", "undivided"])
def test_w20_1_is_first_and_clears_the_last_w3_5(
    speed: int,
    wz: int,
    steps: int,
    w20_1: int,
    divided: bool,
    api: TestClient,  # noqa: F811
) -> None:
    body = {**_common(speed, wz), "divided": divided}
    audit = _post(api, "/render/audit", body).json()
    rows = audit["sections"]["advance"]["sign_table"]
    furthest = next(r for r in rows if r["Position"] == "Furthest (Case 11)")
    assert furthest["Code"] == "W20-1"
    assert _distance(furthest["Distance from Taper (ft)"]) == w20_1
    # W20-1 is the farthest advance sign (MUTCD 11th Ed. §6H.02 ¶02).
    # Rows placed by another sign ("NEXT TO ...") carry no distance.
    distances = [r["Distance from Taper (ft)"] for r in rows]
    assert max(_distance(d) for d in distances if d[0].isdigit()) == w20_1
    assert audit["plan_flags"]["validation_warnings"] == 0

    crew = _post(api, "/render/markdown", body).text
    assert f"| W20-1 | ROAD WORK AHEAD | {w20_1:,} ft upstream |" in crew
    # The crew sheet gives each W3-5 from R2-10 (taper + 3,500 ft); the
    # farthest sits 530 ft per step out, and W20-1 at least 1,000 ft past it.
    found = re.findall(r"\| W3-5\(\d+\) \| [^|]+ \| ([\d,]+) ft", crew)
    w3_5 = [int(m.replace(",", "")) for m in found]
    assert len(w3_5) == steps
    assert w20_1 - (3500 + max(w3_5)) >= 1000


@pytest.mark.parametrize(
    ("speed", "wz", "w20_1"), [(75, 40, 6090), (75, 20, 6620)], ids=["75-40", "75-20"]
)
def test_page1_prints_the_moved_w20_1(
    speed: int,
    wz: int,
    w20_1: int,
    api: TestClient,  # noqa: F811
) -> None:
    body = {**_common(speed, wz), "workLen": 1000}
    page1 = " ".join(_pdf_text(_post(api, "/render/pdf", body).content)[0].split())
    assert f"W20-1 ROAD WORK AHEAD {w20_1} ft" in page1
