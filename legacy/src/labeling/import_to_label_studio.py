"""
Import TCP sheet images into a Label Studio project.

Uploads PNG images directly to Label Studio and creates tasks for each one.

Prerequisites:
    1. Label Studio running locally:  uv run label-studio start
    2. API key from http://localhost:8080/user/account  (Personal Access Token)
    3. Pass --api-key

Usage:
    python -m src.labeling.import_to_label_studio \
        --api-key YOUR_KEY \
        --project-title "WSDOT Typical TCPs v1" \
        --image-dir data/processed/wsdot_typicals
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

DEFAULT_IMAGE_DIR = Path("data/processed/tcp_sheets")
CONFIG_PATH = Path("configs/label_studio_config.xml")
DEFAULT_LS_URL = "http://localhost:8080"
DEFAULT_PROJECT_TITLE = "TCP Symbol Detection"


def load_labeling_config(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def resolve_token(base_url: str, token: str) -> str:
    """If *token* is a JWT refresh token, exchange it for an access token.

    Label Studio's UI shows the refresh token on the Account page, but the
    API requires a short-lived access token obtained via /api/token/refresh/.
    """
    test = httpx.get(
        f"{base_url}/api/current-user/whoami",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10.0,
    )
    if test.status_code == 200:
        return token

    resp = httpx.post(
        f"{base_url}/api/token/refresh/",
        json={"refresh": token},
        timeout=10.0,
    )
    if resp.status_code == 200:
        access_token = resp.json()["access"]
        logger.info("Exchanged refresh token for access token")
        return access_token

    raise SystemExit(
        f"Could not authenticate with Label Studio at {base_url}.\n"
        f"  Token auth: {test.status_code}\n"
        f"  Refresh exchange: {resp.status_code} {resp.text}\n"
        "Check that Label Studio is running and the token is correct."
    )


def collect_images(
    image_dir: Path,
    confidence: str | None,
) -> list[tuple[Path, dict | None]]:
    """Collect PNG images, optionally filtered by confidence from sidecar JSON."""
    images = []
    for png in sorted(image_dir.glob("*.png")):
        meta_path = png.with_suffix(".json")
        meta = None
        if meta_path.exists():
            meta = json.loads(meta_path.read_text(encoding="utf-8"))

        if confidence and meta:
            if meta.get("confidence", "").upper() != confidence.upper():
                continue
        elif confidence and not meta:
            continue

        images.append((png, meta))

    return images


def create_project(client: httpx.Client, config: str, title: str) -> int:
    """Create a Label Studio project, return its ID."""
    resp = client.post(
        "/api/projects/",
        json={
            "title": title,
            "description": "Bounding box annotation for traffic control symbols on TCP sheets.",
            "label_config": config,
        },
    )
    resp.raise_for_status()
    project_id = resp.json()["id"]
    logger.info("Created project '%s' (id=%d)", title, project_id)
    return project_id


def import_images(
    client: httpx.Client,
    project_id: int,
    images: list[tuple[Path, dict | None]],
) -> int:
    """Upload images to the project via the file import API."""
    imported = 0
    for png_path, _meta in images:
        abs_path = png_path.resolve()
        with open(abs_path, "rb") as f:
            resp = client.post(
                f"/api/projects/{project_id}/import",
                files={"file": (png_path.name, f, "image/png")},
            )
        resp.raise_for_status()
        imported += 1
        if imported % 20 == 0 or imported == len(images):
            logger.info("  imported %d / %d", imported, len(images))

    return imported


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import TCP sheet images into Label Studio.",
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="Label Studio personal access token",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_LS_URL,
        help=f"Label Studio URL (default: {DEFAULT_LS_URL})",
    )
    parser.add_argument(
        "--image-dir",
        type=Path,
        default=DEFAULT_IMAGE_DIR,
        help=f"Directory of TCP sheet PNGs (default: {DEFAULT_IMAGE_DIR})",
    )
    parser.add_argument(
        "--confidence",
        choices=["HIGH", "MEDIUM"],
        default=None,
        help="Only import images with this confidence level (default: all)",
    )
    parser.add_argument(
        "--project-title",
        default=DEFAULT_PROJECT_TITLE,
        help=f"Label Studio project name (default: {DEFAULT_PROJECT_TITLE})",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=CONFIG_PATH,
        help=f"Label Studio config XML (default: {CONFIG_PATH})",
    )
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )

    config_xml = load_labeling_config(args.config)
    images = collect_images(args.image_dir, args.confidence)
    if not images:
        logger.warning("No images found in %s (confidence=%s)", args.image_dir, args.confidence)
        sys.exit(1)

    logger.info("Found %d images to import", len(images))

    access_token = resolve_token(args.url, args.api_key)
    client = httpx.Client(
        base_url=args.url,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=60.0,
    )

    project_id = create_project(client, config_xml, args.project_title)
    count = import_images(client, project_id, images)

    print(f"\nImported {count} images into project {project_id}")
    print(f"Open Label Studio: {args.url}/projects/{project_id}")


if __name__ == "__main__":
    main()
