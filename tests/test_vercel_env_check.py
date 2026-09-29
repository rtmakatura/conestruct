"""The ship stops before the merge when Vercel Production lacks a variable the
site needs at runtime, or the Vercel CLI is not logged in (ship-loop ruling R29).

Three layers, each tested where it lives:
- scripts/production-env.txt, the list: every env name the site's code reads,
  and every name in .env.example, is classified, and each cite is real.
- scripts/vercel-env-check.ps1, the check: run for real in PowerShell against
  fixtures of `vercel env ls production` output, through a stand-in CLI
  (tests/fixtures/vercel-env/production-full.txt is the real listing of
  2026-09-28, after the fix; production-one-short.txt drops CLERK_SECRET_KEY,
  the outage's cause; preview-only-secret.txt scopes it Preview only, the state
  before the fix).
- scripts/ship.ps1, the wiring: read as text, like test_ship_push.py, because
  the ship_gate hook gates any run of it.  The check runs after the gh check
  and before `git merge`, and its failure says "Nothing was merged or pushed."
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "conestruct" / "site"
LIST = ROOT / "scripts" / "production-env.txt"
CHECK = ROOT / "scripts" / "vercel-env-check.ps1"
SHIP = ROOT / "scripts" / "ship.ps1"
FIXTURES = ROOT / "tests" / "fixtures" / "vercel-env"
SHELL = shutil.which("powershell") or shutil.which("pwsh")

# R29's floor, verbatim from the ruling.
R29_NAMED = {
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "GATE_ALLOWED_EMAILS",
    "GATE_BYPASS_TOKEN",
    "MODAL_RENDER_URL",
    "MODAL_RENDER_SECRET",
    "MAPBOX_TOKEN",
    "NEXT_PUBLIC_MAPBOX_TOKEN",
    "DATABASE_URL",
}

SOURCE_EXT = {".ts", ".tsx", ".js", ".mjs", ".cjs"}
SKIP_DIRS = {"node_modules", ".next", ".vercel"}


def entries() -> list[tuple[str, str, list[str]]]:
    out = []
    for raw in LIST.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        kind, name, rest = line.split(None, 2)
        cites = re.findall(r"([\w./\[\]()-]+\.\w+):(\d+)", rest.split(" -- ")[0])
        out.append((kind, name, [f"{p}:{n}" for p, n in cites]))
    return out


def required() -> set[str]:
    return {n for k, n, _ in entries() if k == "required"}


# --- the list -----------------------------------------------------------------


def test_the_list_is_well_formed() -> None:
    names = [n for _, n, _ in entries()]
    assert len(names) == len(set(names)), "a name is listed twice"
    for kind, name, cites in entries():
        assert kind in {"required", "not-required"}, kind
        assert re.fullmatch(r"[A-Z][A-Z0-9_]*", name), name
        assert cites, f"{name} has no file:line cite"


def test_r29_names_are_all_required() -> None:
    assert required() >= R29_NAMED, R29_NAMED - required()


def test_every_cite_is_real_and_one_names_the_variable() -> None:
    for _, name, cites in entries():
        hits = []
        for cite in cites:
            path, line = cite.rsplit(":", 1)
            lines = (SITE / path).read_text(encoding="utf-8").splitlines()
            assert 1 <= int(line) <= len(lines), f"{name}: {cite} is past the end of the file"
            hits.append(name in lines[int(line) - 1])
        assert any(hits), f"{name}: none of {cites} is a line containing it"


def site_env_reads() -> dict[str, str]:
    found: dict[str, str] = {}
    for p in SITE.rglob("*"):
        if p.suffix not in SOURCE_EXT or SKIP_DIRS & set(p.relative_to(SITE).parts):
            continue
        if ".test." in p.name:
            continue
        for i, ln in enumerate(p.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for m in re.finditer(r"process\.env\.([A-Z][A-Z0-9_]*)", ln):
                found.setdefault(m.group(1), f"{p.relative_to(SITE).as_posix()}:{i}")
    for i, ln in enumerate((SITE / ".env.example").read_text(encoding="utf-8").splitlines(), 1):
        m = re.match(r"([A-Z][A-Z0-9_]*)=", ln)
        if m:
            found.setdefault(m.group(1), f".env.example:{i}")
    return found


def test_every_env_name_the_site_reads_is_classified() -> None:
    # The drift guard: a branch that reads a new variable must put it on the
    # list, and a "required" one then has to exist in Production to ship.
    listed = {n for _, n, _ in entries()}
    unlisted = {n: at for n, at in site_env_reads().items() if n not in listed}
    assert not unlisted, f"add to scripts/production-env.txt: {unlisted}"


# --- the check, run for real against fixtures ------------------------------------

FAKE_CLI = r"""@echo off
echo %*>>"%FAKE_LOG%"
if "%1"=="whoami" goto whoami
if "%1"=="env" goto envls
exit /b 2
:whoami
if "%FAKE_WHOAMI_EXIT%"=="0" (echo rtmakatura& exit /b 0)
echo Error: No existing credentials found. Please run `vercel login`.
exit /b 1
:envls
if not "%FAKE_ENV_EXIT%"=="0" (echo Error: could not list environment variables& exit /b 1)
type "%FAKE_LISTING%"
exit /b 0
"""


def run_check(tmp_path: Path, listing: str | None, whoami_exit: int = 0, env_exit: int = 0):
    fake = tmp_path / "vercel.cmd"
    fake.write_text(FAKE_CLI.replace("\n", "\r\n"), encoding="ascii")
    log = tmp_path / "calls.log"
    env = dict(os.environ)
    env.update(
        FAKE_LOG=str(log),
        FAKE_WHOAMI_EXIT=str(whoami_exit),
        FAKE_ENV_EXIT=str(env_exit),
        FAKE_LISTING=str(FIXTURES / listing) if listing else str(tmp_path / "empty.txt"),
    )
    if listing is None:
        (tmp_path / "empty.txt").write_text("", encoding="utf-8")
    r = subprocess.run(
        [
            SHELL,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(CHECK),
            "-Vercel",
            str(fake),
            "-Required",
            str(LIST),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )
    calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return r.returncode, r.stdout + r.stderr, calls


needs_ps = pytest.mark.skipif(SHELL is None, reason="needs PowerShell")


@needs_ps
def test_the_real_listing_passes(tmp_path: Path) -> None:
    code, out, calls = run_check(tmp_path, "production-full.txt")
    assert code == 0, out
    assert f"all {len(required())} required" in out, out
    assert [c.split()[0] for c in calls] == ["whoami", "env"], calls
    assert calls[1].split()[:3] == ["env", "ls", "production"], calls


@needs_ps
def test_one_name_short_stops_the_ship(tmp_path: Path) -> None:
    # R29's red-proof: the fixture lists every Production row but CLERK_SECRET_KEY.
    code, out, _ = run_check(tmp_path, "production-one-short.txt")
    assert code == 1, out
    assert "CLERK_SECRET_KEY" in out, out
    assert "MISSING from Production" in out, out
    for name in required() - {"CLERK_SECRET_KEY"}:
        assert f"  {name}\n" not in out.replace("\r", ""), f"{name} wrongly reported missing"


@needs_ps
def test_a_preview_only_row_does_not_count(tmp_path: Path) -> None:
    # Tonight's actual state: the name existed, scoped Preview only.
    code, out, _ = run_check(tmp_path, "preview-only-secret.txt")
    assert code == 1, out
    assert "CLERK_SECRET_KEY" in out, out


@needs_ps
def test_not_logged_in_stops_before_listing(tmp_path: Path) -> None:
    # Logged out, the real `vercel env ls` does not fail: it starts a device
    # login (probed 2026-09-28, r29-redproof.md).  So whoami gates the listing.
    code, out, calls = run_check(tmp_path, "production-full.txt", whoami_exit=1)
    assert code == 1, out
    assert "not logged in" in out, out
    assert [c.split()[0] for c in calls] == ["whoami"], calls


@needs_ps
def test_a_failed_listing_stops_the_ship(tmp_path: Path) -> None:
    code, out, _ = run_check(tmp_path, "production-full.txt", env_exit=1)
    assert code == 1, out
    assert "vercel env ls production failed" in out, out


@needs_ps
def test_an_empty_listing_stops_the_ship(tmp_path: Path) -> None:
    code, out, _ = run_check(tmp_path, None)
    assert code == 1, out
    assert "listed no Production variables" in out, out


# --- the wiring in the ship script ------------------------------------------------


def code_lines() -> list[str]:
    lines = SHIP.read_text(encoding="utf-8").splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.strip().startswith("#")]


def index_of(lines: list[str], pattern: str) -> int:
    hits = [i for i, ln in enumerate(lines) if re.search(pattern, ln)]
    assert len(hits) == 1, f"expected one line matching {pattern!r}, got {[lines[i] for i in hits]}"
    return hits[0]


def test_the_ship_runs_the_check_after_gh_and_before_the_merge() -> None:
    lines = code_lines()
    gh = index_of(lines, r"\bgh auth status\b")
    check = index_of(lines, r"vercel-env-check\.ps1")
    merge = index_of(lines, r"^git merge\b")
    assert gh < check < merge
    after = lines[check + 1 : check + 4]
    assert any(
        "$LASTEXITCODE -ne 0" in ln and "Fail" in ln and "Nothing was merged or pushed." in ln
        for ln in after
    ), after


def test_the_ship_checks_the_list_from_the_branch_it_ships() -> None:
    # A branch that adds a required variable is checked against its own list.
    lines = code_lines()
    show = index_of(lines, r"git show .*scripts/production-env\.txt")
    assert "$Branch" in lines[show] or "$listRef" in lines[show], lines[show]
    assert show < index_of(lines, r"vercel-env-check\.ps1")
