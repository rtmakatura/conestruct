"""Regenerate the frontend jurisdiction demo fixtures from the REAL data files.

phase1-backend-spec §1.4: the design package's demo corpus is miscast and
must never be ported.  This script replaces it — every fixture below is the
real ``evaluate()`` output for a real jurisdiction record, under the
approved demo casting:

    context bar  -> castle_rock       delta panel -> greeley + englewood
    hours cards  -> loveland, thornton, greeley, castle_rock
    permit FYI   -> el_paso           chips       -> westminster + e470
    trust        -> parker

Run from the repo root (venv active):

    python scripts/regen_jurisdiction_demo_fixtures.py

Output: conestruct/site/components/__fixtures__/jurisdiction-demo.json
Re-run whenever data/jurisdictions/*.json changes.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from src.rules.jurisdiction import (  # noqa: E402
    PlanContext,
    WorkSchedule,
    evaluate,
    load_jurisdiction,
)

OUT = REPO_ROOT / "conestruct" / "site" / "components" / "__fixtures__" / "jurisdiction-demo.json"

# One representative plan context per demo surface: an arterial daytime
# lane closure, single work day, 8:00 AM-3:00 PM — chosen because it
# exercises the Loveland ban-window meter (8:00 start is 0.5 h inside
# the 7:00-8:30 ban) and the Greeley/Englewood arrow-board deltas.
DEMO_CONTEXT = PlanContext(
    street_class="arterial",
    closures=frozenset({"lane"}),
    night=False,
    schedule=WorkSchedule(
        date_mode="single",
        work_date=date(2026, 7, 22),
        start_time=8.0,
        end_time=15.0,
    ),
)

CASTING = {
    "context_bar": ["castle_rock"],
    "delta_panel": ["greeley", "englewood"],
    "hours_cards": ["loveland", "thornton", "greeley", "castle_rock"],
    "permit_fyi": ["el_paso"],
    "chips": ["westminster", "e470"],
    "trust": ["parker"],
}


def main() -> None:
    keys = sorted({k for ks in CASTING.values() for k in ks})
    fixtures = {key: evaluate(load_jurisdiction(key), DEMO_CONTEXT) for key in keys}
    payload = {
        "_meta": {
            "generated_by": "scripts/regen_jurisdiction_demo_fixtures.py",
            "source": "data/jurisdictions/*.json (the real corpus records)",
            "casting": CASTING,
            "context": {
                "street_class": "arterial",
                "closure": "lane",
                "night": False,
                "schedule": {
                    "date_mode": "single",
                    "work_date": "2026-07-22",
                    "start_time": 8.0,
                    "end_time": 15.0,
                },
            },
        },
        "jurisdictions": fixtures,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {OUT.relative_to(REPO_ROOT)} ({len(keys)} jurisdictions)")


if __name__ == "__main__":
    main()
