"""CI validation for the jurisdiction data layer (phase1-backend-spec §2, §5.1).

Three guarantees:
1. Every data/jurisdictions/*.json validates against data/jurisdiction.schema.json.
2. Every record that states a jurisdiction fact carries a source object
   (enforced structurally by the schema; re-asserted here by a tree walk so a
   schema regression cannot silently drop the requirement).
3. Every fact whose source.status is "conflict" has a conflict block on the
   record itself or on an enclosing record (hours windows resolve at hours.conflict).
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "data" / "jurisdiction.schema.json"
DATA_DIR = REPO_ROOT / "data" / "jurisdictions"

FACT_SECTIONS = [
    "deltas",
    "personnel",
    "devices",
    "hazards",
    "meters",
    "leads",
    "notices",
]


def _load_schema():
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return json.load(f)


def _jurisdiction_files():
    return sorted(DATA_DIR.glob("*.json"))


def test_data_dir_exists_and_nonempty():
    assert DATA_DIR.is_dir(), "data/jurisdictions/ missing"
    assert _jurisdiction_files(), "no jurisdiction data files found"


@pytest.mark.parametrize("path", _jurisdiction_files(), ids=lambda p: p.stem)
def test_validates_against_schema(path):
    validator = Draft202012Validator(_load_schema())
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    errors = sorted(validator.iter_errors(record), key=lambda e: list(e.absolute_path))
    assert not errors, "\n".join(
        f"{'/'.join(str(p) for p in e.absolute_path)}: {e.message}" for e in errors
    )


@pytest.mark.parametrize("path", _jurisdiction_files(), ids=lambda p: p.stem)
def test_key_matches_filename(path):
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    assert record["key"] == path.stem


@pytest.mark.parametrize("path", _jurisdiction_files(), ids=lambda p: p.stem)
def test_every_fact_record_has_source(path):
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    missing = []
    for section in FACT_SECTIONS:
        for i, item in enumerate(record.get(section, [])):
            if "source" not in item:
                missing.append(f"{section}[{i}]")
    for i, window in enumerate(record.get("hours", {}).get("windows", [])):
        if "source" not in window:
            missing.append(f"hours.windows[{i}]")
    for i, item in enumerate(record.get("fees", {}).get("items", [])):
        if "source" not in item:
            missing.append(f"fees.items[{i}]")
    assert not missing, f"records missing source: {missing}"


def _conflict_status_without_block(node, ancestors_have_conflict=False, path=""):
    """Yield paths of facts marked source.status=conflict with no conflict block in scope."""
    if isinstance(node, dict):
        has_conflict = ancestors_have_conflict or bool(node.get("conflict"))
        source = node.get("source")
        if isinstance(source, dict) and source.get("status") == "conflict" and not has_conflict:
            yield path
        for k, v in node.items():
            yield from _conflict_status_without_block(v, has_conflict, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from _conflict_status_without_block(v, ancestors_have_conflict, f"{path}[{i}]")


@pytest.mark.parametrize("path", _jurisdiction_files(), ids=lambda p: p.stem)
def test_conflict_facts_have_conflict_blocks(path):
    with open(path, encoding="utf-8") as f:
        record = json.load(f)
    bad = list(_conflict_status_without_block(record))
    assert not bad, f"conflict-status facts lacking a conflict block: {bad}"
