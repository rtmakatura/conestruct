"""Modal deployment of the Conestruct render FastAPI service.

Deploy:
    modal deploy modal_app.py

Required secrets (create once per Modal workspace):
    modal secret create conestruct-render-secret RENDER_API_SECRET=<long-random-string>
    modal secret create mapbox-token MAPBOX_TOKEN=<mapbox-public-token>
    modal secret create sentry-dsn SENTRY_DSN=<sentry-project-dsn>

The Mapbox token enables the page-2 aerial map on the rendered PDF
(:func:`src.rendering.plan_sheet._fetch_mapbox_aerial`).  Without it,
the renderer silently falls back to a single-page schematic.

The Sentry DSN wires unhandled exceptions to the Python project in
Sentry; the SDK init lives in :mod:`src.api.render_api`.  Without it,
Sentry stays inert and the service runs normally.

After deploy, Modal prints the public URL.  Wire that into the Next.js
side as ``MODAL_RENDER_URL`` along with the matching
``MODAL_RENDER_SECRET`` env var.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import modal


def _git_sha() -> str:
    """Capture the deployed commit SHA at deploy time (runs locally).

    ``modal deploy modal_app.py`` executes this file on the deploy
    machine, where git and the repo are present, before building the
    (immutable, git-less) runtime image.  We stamp the SHA into the
    image env here so ``/healthz`` can report which commit Modal is
    serving — making backend drift behind ``main`` detectable.

    Returns the 40-char SHA, or the honest sentinel ``"unknown"`` if the
    capture fails (git missing, not a repo).  A failed stamp must never
    crash the deploy or fabricate a SHA.
    """
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=Path(__file__).parent,
            capture_output=True,
            text=True,
            check=True,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


# Curated runtime deps — pyproject.toml carries streamlit/opencv/anthropic
# for local dev work that the render service does not need.
RENDER_DEPS = [
    "fastapi>=0.115",
    "pydantic>=2.0",
    "reportlab>=4.0",
    "openpyxl>=3.1",
    "pymupdf>=1.25",
    "pypdfium2>=4.30",
    "pillow>=11.0",
    "numpy>=2.0",
    "svgwrite>=1.4",
    "cairosvg>=2.7",
    "jinja2>=3.1",
    "pyyaml>=6.0",
    "httpx>=0.28",
    "sentry-sdk[fastapi]>=2.0",
    "jsonschema>=4.21",  # jurisdiction record validation (src/rules/jurisdiction.py)
    "shapely>=2.0",  # pin-based jurisdiction suggestion (src/rules/boundaries.py)
]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libcairo2", "fontconfig")  # cairosvg system deps
    .pip_install(*RENDER_DEPS)
    # Stamp the deployed SHA after pip_install (so that expensive layer
    # stays cached — only this trivial env layer rebuilds per deploy) but
    # BEFORE the local add: Modal requires add_local_* to be the terminal
    # layers, so no build step may follow them.  Read at runtime by /healthz.
    .env({"GIT_SHA": _git_sha()})
    .add_local_dir("src", remote_path="/root/src")
    # Jurisdiction layer: the schema + data records the rules engine loads
    # at runtime (src/rules/jurisdiction.py resolves them relative to the
    # repo root, /root in the image).  NEVER add_local_dir("data") itself —
    # data/ holds the 20GB scraped-PDF corpus; only these two paths ship.
    .add_local_file("data/jurisdiction.schema.json", "/root/data/jurisdiction.schema.json")
    .add_local_dir("data/jurisdictions", remote_path="/root/data/jurisdictions")
    # Boundary layer for pin-based jurisdiction suggestion (Endeavor B) —
    # built GeoJSON + _meta.json provenance, ~400 KB total.
    .add_local_dir("data/boundaries", remote_path="/root/data/boundaries")
)

app = modal.App("conestruct-render")


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("conestruct-render-secret"),
        modal.Secret.from_name("mapbox-token"),
        modal.Secret.from_name("sentry-dsn"),
    ],
    timeout=120,
    # Cold-start fix (#122): one container stays up around the clock so
    # no user eats the ~5.5 s cold boot on their first audit call.
    # Worst-case cost ~$6/month at Modal's published rates — inside the
    # Starter plan's $30/month included credits, which are a HARD stop
    # (no payment method on file): this raises the monthly floor.
    # enable_memory_snapshot was tried and reverted: measured cold
    # starts were 5.4–14.5 s with it vs 5.54 s without (2026-07-12),
    # because the heavy import below runs after the snapshot point.
    # The import cost itself is #137.
    min_containers=1,
    # Global spend backstop (#145 part C).  The /sandbox render proxy is
    # anonymous by design (the homepage IS the public generator), so a
    # distributed flood could otherwise scale render containers without
    # bound and drain the Starter plan's $30/month credit — a HARD stop
    # with no payment method on file — turning a cost problem into a
    # service outage for everyone, including a live sales demo.  Capping
    # concurrency bounds worst-case container-seconds regardless of how
    # many callers hit the proxy.  8 containers is comfortably above any
    # real demo burst (a handful of prospects rendering at once) yet caps
    # the drain rate low enough that a flood can't exhaust the credit in
    # minutes.  The per-IP limiter (conestruct/site/lib/rate-limit.ts,
    # part B) throttles individual callers on top of this ceiling.  A
    # daily spend alarm is NOT expressible here — set it in the Modal
    # dashboard (Settings → Usage/Billing alerts).
    max_containers=8,
)
@modal.asgi_app()
def fastapi_app():
    from src.api.render_api import app as render_app

    return render_app
