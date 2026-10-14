"""#297 step 1: give the recorded tiering fixtures their deltas' stable keys.

    python addkeys297.py

Each fixture's ``jurisdiction.applied_deltas`` was recorded before deltas
carried a ``key``.  For each one, find its source delta in
``data/jurisdictions/<key>.json`` (the recorded chip is the record plus the
evaluator's ``status`` / ``raised`` / ``device_label``) and add
``jurisdiction.delta_key(...)`` of that record, then rewrite the shared
``tiering-expectations.json`` ids ``jur:delta:<i>`` to ``jur:delta:<key>``.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from src.rules.jurisdiction import delta_key  # noqa: E402

FIX = ROOT / "tests" / "fixtures" / "tiering"
DATA = ROOT / "data" / "jurisdictions"
ADDED = {"status", "raised", "device_label", "key"}

def indent_of(text: str) -> int:
    """The file's own indent (the second line's leading spaces), kept on write."""
    second = text.splitlines()[1]
    return len(second) - len(second.lstrip(" "))


renames: dict[str, dict[str, str]] = {}
for path in sorted(FIX.glob("*.json")):
    if path.name == "tiering-expectations.json":
        continue
    raw = path.read_text(encoding="utf-8")
    doc = json.loads(raw)
    jur = doc.get("jurisdiction")
    if not jur or not jur.get("applied_deltas"):
        continue
    record = json.loads((DATA / f"{jur['key']}.json").read_text(encoding="utf-8"))
    source = record["deltas"]
    names = {}
    for i, chip in enumerate(jur["applied_deltas"]):
        bare = {k: v for k, v in chip.items() if k not in ADDED}
        match = [d for d in source if d == bare]
        assert len(match) == 1, f"{path.name} delta {i}: {len(match)} source matches"
        chip["key"] = delta_key(jur["key"], match[0])
        names[f"jur:delta:{i}"] = f"jur:delta:{chip['key']}"
    # Keep the file's own escaping (some were recorded with \uXXXX escapes)
    # and its own ending (some have no final newline).
    path.write_text(
        json.dumps(doc, indent=indent_of(raw), ensure_ascii="\\u00" in raw)
        + ("\n" if raw.endswith("\n") else ""),
        encoding="utf-8",
    )
    renames[path.stem] = names
    print(path.name, names)

# The expectations file is hand-formatted, so it is edited as text: each
# case's own block, its delta ids only.
exp_path = FIX / "tiering-expectations.json"
text = exp_path.read_text(encoding="utf-8")
cases = [c for c in json.loads(text) if not c.startswith("_")]
starts = sorted((text.index(f'\n  "{c}": {{'), c) for c in cases)
pieces, cursor = [], 0
for n, (at, case) in enumerate(starts):
    end = starts[n + 1][0] if n + 1 < len(starts) else len(text)
    pieces.append(text[cursor:at])
    block = text[at:end]
    for old, new in renames.get(case, {}).items():
        block = block.replace(f'"{old}"', f'"{new}"')
    pieces.append(block)
    cursor = end
text = "".join(pieces) + text[cursor:]
note = "moves jur:delta:0 changed -> checked."
text = text.replace(
    note,
    note + " #297 (2026-10-14): delta ids are the backend's stable keys"
    " (jur:delta:<jurisdiction>:<10 hex>), added to the recordings by"
    " validation-artifacts/committed/issue-297-acknowledge/addkeys297.py.",
    1,
)
json.loads(text)
exp_path.write_text(text, encoding="utf-8")
print("expectations rewritten for", sorted(renames))
