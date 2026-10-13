"""#286 build: add the new display fields to the recorded wire fixtures, and nothing else.

The recordings (``tests/fixtures/tiering/*.json``, the site's
``components/__fixtures__/audit-shoulder-full.json``) are historical: a
recompute on today's code differs from them in leaves this branch never
touched (``../../issue-243-note-8/rerecord/rerecord_note8.py`` says the
same).  So each new field is DERIVED from the recording's own values, by the
derivation the backend now runs, and added; no existing key is touched.
That derivation equals the panel's old one (``AuditTrail.tsx`` at
``3fdf074``) and the backend's new one on all 78 regenerated snapshots
(524 strings, 0 mismatches; ``outcome.md``).

    python rerecord_286.py          write the fields
    python rerecord_286.py --check  fail if any fixture lacks them or disagrees
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[4]
FIXTURES = sorted((ROOT / "tests/fixtures/tiering").glob("*.json"))
FIXTURES = [p for p in FIXTURES if p.name != "tiering-expectations.json"]
FIXTURES.append(ROOT / "conestruct/site/components/__fixtures__/audit-shoulder-full.json")

# src/api/audit.py _CITATION_ADVANCE (verified: citations.md).
CITATION_ADVANCE = {
    "cite": "MUTCD TABLE 6B-1",
    "footer": "MUTCD § 6H.02 · TABLE 6B-1 · ADVANCE WARNING SIGN SPACING",
}


def js(n: Any) -> str:
    """JavaScript String(n), which the panel used: 200.0 -> "200"."""
    if isinstance(n, float) and n.is_integer():
        return str(int(n))
    return str(n)


def times(s: str) -> str:
    return s.replace(" x ", " × ")


def audit_of(doc: dict[str, Any]) -> dict[str, Any]:
    return doc.get("audit", doc)


def derived(a: dict[str, Any]) -> dict[str, dict[str, Any]]:
    s, m = a["sections"], a["summary"]
    t, sp, ad = s["taper"], s["spacing"], s["advance"]
    shoulder = t["closure_type"] == "shoulder"
    out: dict[str, dict[str, Any]] = {
        "taper": {
            "result_text": f"{'L/3' if shoulder else 'L'} = {js(m['taper_length_ft'])} ft",
            "formula_text": [times(t["L_calc_text"])]
            + ([times(t["L_third_calc_text"])] if shoulder else []),
        },
        "buffer": {"result_text": f"B = {js(m['buffer_space_ft'])} ft"},
        "spacing": {
            "result_text": (
                f"{sp['n_taper_drums_required'] + sp['n_tangent_cones_required']} devices · "
                f"{js(m['device_spacing_taper_ft'])}/{js(m['device_spacing_tangent_ft'])} ft o.c."
            ),
            "formula_text": [sp["taper_count_text"], sp["tangent_count_text"]]
            + ([sp["downstream_count_text"]] if sp.get("downstream_count_text") else []),
        },
        "advance": {
            "result_text": f"{len(ad['sign_table'])} signs",
            "citation": CITATION_ADVANCE,
        },
    }
    fl = s.get("flagger") or {}
    if "sight_distance_ft" in fl:
        out["flagger"] = {
            "sight_distance_result_text": f"{fl['sight_distance_ft']} ft",
            "sight_distance_formula_text": [
                f"SSD @ {sp['speed_mph']} mph = {fl['sight_distance_ft']} ft"
            ],
        }
    return out


def file_format(raw: str, doc: Any) -> dict[str, Any]:
    """The json.dumps arguments that reproduce this file byte for byte, so the
    rewrite is the added keys and nothing else (the recordings use 2-space,
    1-space ASCII-escaped and compact layouts)."""
    body = raw.replace("\r\n", "\n")
    for indent in (2, 1, 4, None):
        for separators in (None, (",", ":")):
            for ascii_only in (False, True):
                for trail in ("\n", ""):
                    kw = {"indent": indent, "ensure_ascii": ascii_only, "separators": separators}
                    if json.dumps(doc, **kw) + trail == body:
                        return {**kw, "trail": trail}
    raise SystemExit("no json.dumps layout reproduces the file; refusing to rewrite it")


def main() -> int:
    check = "--check" in sys.argv
    bad = 0
    for path in FIXTURES:
        with path.open(encoding="utf-8", newline="") as fh:
            raw = fh.read()
        doc = json.loads(raw)
        fmt = file_format(raw, doc)
        a = audit_of(doc)
        added = []
        for section, fields in derived(a).items():
            for key, value in fields.items():
                have = a["sections"][section].get(key)
                if have == value:
                    continue
                if check or have is not None:
                    print(f"{path.name}: sections.{section}.{key} is {have!r}, wants {value!r}")
                    bad += 1
                    continue
                a["sections"][section][key] = value
                added.append(f"{section}.{key}")
        if added and not check:
            nl = "\r\n" if "\r\n" in raw else "\n"
            trail = fmt.pop("trail")
            text = json.dumps(doc, **fmt) + trail
            path.write_text(text.replace("\n", nl), encoding="utf-8", newline="")
            print(f"{path.relative_to(ROOT).as_posix()}: added {', '.join(added)}")
    if check:
        print("check: " + ("FAILED" if bad else f"all {len(FIXTURES)} fixtures carry the fields"))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
