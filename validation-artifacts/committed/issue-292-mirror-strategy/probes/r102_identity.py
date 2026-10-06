"""R102 identity proof: the no-key wire test, and the whole existing race
suite, against a748a7b's site_detection.py and against this branch's."""
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\rtmak\Documents\traffic-control-tool\.claude\worktrees\issue-292-overspan")
F = ROOT / "src/rules/site_detection.py"
SAVE = Path(r"C:\Users\rtmak\.claude\jobs\a6024b0c\tmp\site_detection.branch.py")
CMD = ("uv run --frozen --extra dev python -m pytest -q -p no:cacheprovider --color=no "
       "tests/test_site_detection.py tests/test_overspan_mirror.py::test_no_key_asks_exactly_todays_mirrors_with_todays_headers")
out_lines = []


def run(tag: str) -> None:
    r = subprocess.run(CMD, cwd=ROOT, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    last = [l for l in (r.stdout + r.stderr).splitlines() if re.search(r"passed|failed", l)]
    out_lines.append(f"{tag}: {last[-1] if last else '(no result line)'}")


shutil.copy(F, SAVE)
try:
    F.write_bytes(subprocess.run(["git", "show", "a748a7b:src/rules/site_detection.py"], cwd=ROOT,
                                 capture_output=True, check=True).stdout)
    run("a748a7b site_detection.py")
finally:
    shutil.copy(SAVE, F)
run("issue-292-overspan site_detection.py")
Path(r"C:\Users\rtmak\.claude\jobs\a6024b0c\tmp\identity_r102.txt").write_text("\n".join(out_lines) + "\n", encoding="utf-8")
print("\n".join(out_lines).encode("ascii", "replace").decode())
