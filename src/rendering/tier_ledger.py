"""s2-arc7 (Refs #220) — the tier ledger, backend edition.

The audit PDF's cover carries the same triage summary line the screen's
section 03 leads with, computed here from the audit projection plus the
(optionally) evaluated jurisdiction block — statuses the backend already
emits, never a new predicate (rule 3).

This module MIRRORS ``conestruct/site/lib/tiering.ts`` (the ruled
status→tier mapping, s2-arc7 GO flags a–k).  Both implementations are
pinned to the same committed expectation file
(``tests/fixtures/tiering/tiering-expectations.json``); either drifting
breaks its own suite against that one pin.  The frontend-only
``audit:unavailable`` fact is excluded by construction — the PDF renders
from a successful projection only.
"""

from __future__ import annotations

from typing import Any

TIERS = ("changed", "attention", "checked", "pending", "reference")


def tier_facts(
    projection: dict[str, Any] | None,
    jurisdiction: dict[str, Any] | None,
) -> dict[str, str]:
    """fact id → tier, same ids and rules as assignTiers (tiering.ts)."""
    facts: dict[str, str] = {}

    if jurisdiction is not None:
        for i, d in enumerate(jurisdiction.get("applied_deltas", [])):
            fid = f"jur:delta:{i}"
            if d.get("status") in ("conditional", "unknown"):
                facts[fid] = "attention"
            elif d.get("severity") == "admin":
                facts[fid] = "reference"
            else:
                facts[fid] = "changed"
        chips = jurisdiction.get("chips", {})
        for i in range(len(chips.get("personnel", []))):
            facts[f"jur:personnel:{i}"] = "attention"
        for i in range(len(chips.get("device", []))):
            facts[f"jur:device:{i}"] = "attention"
        # Standing hazard meters describe the jurisdiction, not this
        # plan — reference regardless of status (ruled flag c).
        for i in range(len(chips.get("hazard", []))):
            facts[f"jur:hazard:{i}"] = "reference"
        hs = jurisdiction.get("hours_eval", {}).get("status")
        facts["jur:hours"] = (
            "attention" if hs == "outside" else "checked" if hs == "inside" else "pending"
        )

    if projection is not None:
        sections = projection.get("sections", {})
        for key in ("taper", "buffer", "spacing", "advance"):
            if sections.get(key) is not None:
                facts[f"audit:{key}"] = "checked"
        if sections.get("case") is not None:
            facts["audit:case"] = "checked"
        colorado = sections.get("colorado") or {}
        for i, c in enumerate(colorado.get("checks", [])):
            facts[f"audit:colorado:check:{i}"] = "checked" if c.get("pass") else "attention"
        for i in range(len(colorado.get("info_items", []))):
            facts[f"audit:colorado:info:{i}"] = "checked"
        flagger = sections.get("flagger") or {}
        if isinstance(flagger.get("sight_distance_ft"), (int, float)) and not isinstance(
            flagger.get("sight_distance_ft"), bool
        ):
            facts["audit:flagger_ssd"] = "checked"
        for r in sections.get("site_adjustments") or []:
            moved = r.get("devices_added", 0) > 0 or (r.get("devices_modified") or 0) > 0
            facts[f"audit:site:{r.get('flag')}"] = "changed" if moved else "checked"
        corridor = sections.get("corridor_validation") or {}
        if corridor.get("checked") is True:
            warnings = corridor.get("warnings") or []
            if warnings:
                for i in range(len(warnings)):
                    facts[f"audit:corridor:warning:{i}"] = "attention"
            else:
                # Ruled flag h: the silent pass becomes a named pass.
                facts["audit:corridor:clean"] = "checked"
        geo = sections.get("geometry_validation") or {}
        for i in range(len(geo.get("violations") or [])):
            facts[f"audit:geometry:{i}"] = "attention"
        fd = sections.get("fines_double")
        if fd is not None:
            facts["audit:fines_double"] = "changed" if fd.get("applicable") is True else "checked"
        approaches = sections.get("approaches")
        if approaches is not None:
            any_signal = any(a.get("signalized") is True for a in approaches.get("approaches", []))
            facts["audit:approaches"] = "attention" if any_signal else "checked"
        pending = projection.get("pending_verification") or {}
        items = pending.get("items")
        if items:
            for i in range(len(items)):
                facts[f"audit:pending:{i}"] = "pending"
        elif pending.get("count", 0) > 0:
            facts["audit:pending:0"] = "pending"

    return facts


def tier_ledger(
    projection: dict[str, Any] | None,
    jurisdiction: dict[str, Any] | None,
) -> dict[str, int]:
    """The four counted tokens (reference is uncounted by ruling)."""
    counts = {"changed": 0, "attention": 0, "checked": 0, "pending": 0}
    for tier in tier_facts(projection, jurisdiction).values():
        if tier != "reference":
            counts[tier] += 1
    return counts


def ledger_line(counts: dict[str, int]) -> str:
    """Byte-identical to tiering.ts ``ledgerLine`` — the cross-surface
    test asserts the PDF cover carries exactly the screen's words."""
    changed = counts["changed"]
    return (
        f"{changed} change{'' if changed == 1 else 's'} · "
        f"{counts['attention']} needs attention · "
        f"{counts['checked']} checked · "
        f"{counts['pending']} pending · reference"
    )
