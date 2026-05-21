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

import modal

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
]

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libcairo2", "fontconfig")  # cairosvg system deps
    .pip_install(*RENDER_DEPS)
    .add_local_dir("src", remote_path="/root/src")
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
)
@modal.asgi_app()
def fastapi_app():
    from src.api.render_api import app as render_app

    return render_app
