"""scripts/preview-url.ps1 -- the preview URL, printed only when the preview
serves the branch tip (ship-loop rulings R18-R22; validation-artifacts/
committed/ship-loop/checkpoint-1.md §5).

Each case runs the real script with -DecideFromJson on recorded GitHub
deployment / commit-status payloads (the shapes measured on 7dee3db and on the
Change 2 red-proof's skipped commit 47db2be).  Exit 0 = a report line, 1 = PREVIEW
NOT VERIFIED, 3 = still waiting.  The live poll is proven in change1-redproof.md.

PowerShell only: skipped where there is none (the Ubuntu CI runners).
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "preview-url.ps1"
SHELL = shutil.which("powershell") or shutil.which("pwsh")
pytestmark = pytest.mark.skipif(SHELL is None, reason="needs PowerShell")

TIP = "7dee3db7716ce3c106345368b971117f3edd6eb8"
OLD = "fee2f775be3d79bba368571bba216fcd5efaa9fd"
URL = "https://conestruct-aidgatzw7-rtmakaturas-projects.vercel.app"
SITE_FILE = ["conestruct/site/lib/gate.ts"]


def deployed(state: str = "success", url: str | None = URL) -> list[dict]:
    status = {"state": state, "environment_url": url, "description": "Deployment has completed"}
    return [{"statuses": [status]}]


def run(tmp_path: Path, **inputs) -> subprocess.CompletedProcess[str]:
    payload = {
        "tip": TIP,
        "files": SITE_FILE,
        "deployments": [],
        "commitStatuses": [],
        "served": None,
    }
    payload.update(inputs)
    path = tmp_path / "in.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    return subprocess.run(
        [SHELL, "-NoProfile", "-File", str(SCRIPT), "-DecideFromJson", str(path)],
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_prints_the_url_when_the_bundle_carries_the_tip(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(), served=[TIP])
    assert r.returncode == 0, r.stdout + r.stderr
    assert r.stdout.strip() == (
        f"preview: {URL} -- serves 7dee3db = branch tip (checked in the bundle); frontend-only: yes"
    )


def test_refuses_a_preview_serving_an_older_sha(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(), served=[OLD])
    assert r.returncode == 3
    assert "preview: http" not in r.stdout
    assert "serves fee2f77, not the tip 7dee3db" in r.stdout


def test_refuses_a_bundle_with_no_commit_sha(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(), served=[])
    assert r.returncode == 3
    assert "preview: http" not in r.stdout


def test_waits_when_the_preview_cannot_be_read(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(), served=None)
    assert r.returncode == 3
    assert "could not be read yet" in r.stdout


def test_a_vercel_skip_says_none_and_prints_no_url(tmp_path: Path) -> None:
    # Measured on 47db2be: no deployment, newest Vercel status is the skip.
    statuses = [
        {"context": "Vercel", "state": "success", "description": "Canceled by Ignored Build Step"},
        {"context": "Vercel", "state": "pending", "description": "Vercel is deploying your app"},
    ]
    r = run(tmp_path, commitStatuses=statuses)
    assert r.returncode == 0
    assert r.stdout.startswith("preview: none -- Vercel skipped the build of 7dee3db")
    assert "http" not in r.stdout


def test_a_pending_build_waits(tmp_path: Path) -> None:
    statuses = [
        {"context": "Vercel", "state": "pending", "description": "Vercel is deploying your app"}
    ]
    r = run(tmp_path, commitStatuses=statuses)
    assert r.returncode == 3
    assert "no Preview deployment of 7dee3db yet" in r.stdout


def test_a_deployment_still_building_waits(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(state="in_progress", url=None))
    assert r.returncode == 3
    assert "is 'in_progress'" in r.stdout


def test_a_failed_build_is_not_verified(tmp_path: Path) -> None:
    r = run(tmp_path, deployments=deployed(state="failure", url=None))
    assert r.returncode == 1
    assert "PREVIEW NOT VERIFIED" in r.stdout


@pytest.mark.parametrize(
    ("files", "expected"),
    [
        (["conestruct/site/app/page.tsx"], "yes"),
        (
            ["conestruct/site/lib/gate.ts", "tests/fixtures/tiering/tiering-expectations.json"],
            "yes",
        ),
        (["scripts/gate.cjs"], "yes"),
        (["tests/fixtures/centerline/bayaud_colorado_pool.json"], "yes"),
        (["conestruct/site/lib/gate.ts", "src/api/render_api.py"], "no"),
        (["modal_app.py"], "no"),
        (["validation-artifacts/committed/ship-loop/checkpoint-1.md"], "no"),
        (["scripts/preview-url.ps1"], "no"),
        (["conestruct/sitemap.txt"], "no"),
        ([], "no"),
    ],
)
def test_frontend_only_is_yes_only_when_every_file_is_a_site_input(
    tmp_path: Path, files: list[str], expected: str
) -> None:
    r = run(tmp_path, files=files, deployments=deployed(), served=[TIP])
    assert r.returncode == 0, r.stdout + r.stderr
    assert r.stdout.strip().endswith(f"frontend-only: {expected}")


# The live path's parse of a `gh api` list body.  "[]" is what GitHub returned
# for 2401e11's Preview deployments (a skipped build); before the fix Windows
# PowerShell 5.1 read it as one item and asked GitHub for deployments//statuses.
@pytest.mark.parametrize(
    ("body", "expected"),
    [
        ("[]\n", ["items: 0"]),
        ('[{"id": 6714883653, "environment": "Preview"}]\n', ["items: 1", "id: 6714883653"]),
        ('[{"id": 1}, {"id": 2}]\n', ["items: 2", "id: 1", "id: 2"]),
    ],
)
def test_a_gh_list_body_parses_to_its_items(tmp_path: Path, body: str, expected: list[str]) -> None:
    path = tmp_path / "body.json"
    path.write_text(body, encoding="utf-8")
    r = subprocess.run(
        [SHELL, "-NoProfile", "-File", str(SCRIPT), "-ParseGhListFromFile", str(path)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert r.returncode == 0, r.stdout + r.stderr
    assert r.stdout.split() == " ".join(expected).split()
