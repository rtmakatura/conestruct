"""
TxDOT Plans Online scraper.

Downloads PDF plan sets from TxDOT's public FTP directory listings at
https://ftp.dot.state.tx.us/pub/txdot-info/Pre-Letting%20Responses/

Usage:
    python -m src.scraping.txdot --max-projects 100 --max-gb 25
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import logging
import re
import sqlite3
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import unquote, urljoin

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FTP_BASE = "https://ftp.dot.state.tx.us/pub/txdot-info/Pre-Letting%20Responses/"

# Districts to scrape and their known subfolder structures.
# Pattern A: {District}/Construction Projects/{Year}/{MM Month YYYY}/{Project}/
# Pattern B: {District}/{Month YYYY}/  (PDFs directly inside)
# We handle both by recursively crawling directories until we find PDFs.
DISTRICTS = [
    "Austin District",
    "Beaumont District",
    "Bryan District",
    "Dallas District",
    "El Paso District",
    "Fort Worth District",
    "Houston District",
    "Lufkin District",
    "San Antonio District",
    "Tyler District",
]

REQUEST_DELAY_SECONDS = 2.0
USER_AGENT = "traffic-control-tool/0.1 " "(research scraper; contact: rtmakatura1@gmail.com)"

DATA_DIR = Path("data/raw/txdot")
DB_PATH = Path("data/raw/txdot/scraper.db")
MANIFEST_PATH = Path("data/raw/txdot/manifest.csv")

# Only download PDFs — skip .xlsx, .msg, .docx, etc.
PDF_SUFFIX = ".pdf"

# Max directory recursion depth to prevent infinite loops
MAX_DEPTH = 8


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ScrapedFile:
    url: str
    district: str
    letting_date: str  # e.g. "2026-04"
    project_id: str
    filename: str
    size_bytes: int
    download_timestamp: str
    local_path: str
    sha256: str


# ---------------------------------------------------------------------------
# Database (resumability)
# ---------------------------------------------------------------------------


def init_db(db_path: Path) -> sqlite3.Connection:
    """Create or open the tracking database."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS downloads (
            url TEXT PRIMARY KEY,
            district TEXT,
            letting_date TEXT,
            project_id TEXT,
            filename TEXT,
            size_bytes INTEGER,
            download_timestamp TEXT,
            local_path TEXT,
            sha256 TEXT,
            status TEXT DEFAULT 'complete'
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS crawled_dirs (
            url TEXT PRIMARY KEY,
            crawled_at TEXT
        )
    """)
    conn.commit()
    return conn


def is_downloaded(conn: sqlite3.Connection, url: str) -> bool:
    row = conn.execute("SELECT 1 FROM downloads WHERE url = ?", (url,)).fetchone()
    return row is not None


def record_download(conn: sqlite3.Connection, f: ScrapedFile) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO downloads
            (url, district, letting_date, project_id, filename,
             size_bytes, download_timestamp, local_path, sha256, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete')
        """,
        (
            f.url,
            f.district,
            f.letting_date,
            f.project_id,
            f.filename,
            f.size_bytes,
            f.download_timestamp,
            f.local_path,
            f.sha256,
        ),
    )
    conn.commit()


def is_dir_crawled(conn: sqlite3.Connection, url: str) -> bool:
    row = conn.execute("SELECT 1 FROM crawled_dirs WHERE url = ?", (url,)).fetchone()
    return row is not None


def mark_dir_crawled(conn: sqlite3.Connection, url: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO crawled_dirs (url, crawled_at) VALUES (?, ?)",
        (url, datetime.now(UTC).isoformat()),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# CSV manifest
# ---------------------------------------------------------------------------


def init_manifest(path: Path) -> None:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                [
                    "url",
                    "district",
                    "letting_date",
                    "project_id",
                    "filename",
                    "size_bytes",
                    "download_timestamp",
                    "local_path",
                    "sha256",
                ]
            )


def append_manifest(path: Path, f: ScrapedFile) -> None:
    with open(path, "a", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(
            [
                f.url,
                f.district,
                f.letting_date,
                f.project_id,
                f.filename,
                f.size_bytes,
                f.download_timestamp,
                f.local_path,
                f.sha256,
            ]
        )


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def make_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(30.0, read=120.0),
        follow_redirects=True,
        verify=False,  # TxDOT FTP server has certificate issues
    )


def fetch_directory_listing(client: httpx.Client, url: str) -> list[tuple[str, bool]]:
    """Parse an Apache directory listing. Returns list of (url, is_directory)."""
    time.sleep(REQUEST_DELAY_SECONDS)
    resp = client.get(url)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    entries = []
    for link in soup.find_all("a"):
        href = link.get("href", "")
        # Skip sorting links and parent directory
        if href.startswith("?") or "Parent Directory" in link.get_text():
            continue
        # Skip the base path self-reference
        if href.startswith("/pub/"):
            continue

        full_url = urljoin(url, href)
        is_dir = href.endswith("/")
        entries.append((full_url, is_dir))

    return entries


# ---------------------------------------------------------------------------
# Letting date + project ID extraction
# ---------------------------------------------------------------------------

# Matches: "April 2026", "02 February2025", "06 June 2025", "February 2026"
_MONTH_PATTERN = re.compile(
    r"(?:\d{2}\s+)?"
    r"(January|February|March|April|May|June|July|August|September|"
    r"October|November|December)\s*(\d{4})",
    re.IGNORECASE,
)

# CSJ pattern: digits-digits-digits (e.g., 3510-05-047, 0683-05-017)
_CSJ_PATTERN = re.compile(r"\d{4}-\d{2}-\d{3}")


def extract_letting_date(url: str) -> str:
    """Try to extract a YYYY-MM letting date from the URL path."""
    decoded = unquote(url)
    months = {
        "january": "01",
        "february": "02",
        "march": "03",
        "april": "04",
        "may": "05",
        "june": "06",
        "july": "07",
        "august": "08",
        "september": "09",
        "october": "10",
        "november": "11",
        "december": "12",
    }
    m = _MONTH_PATTERN.search(decoded)
    if m:
        month_str = m.group(1).lower()
        year = m.group(2)
        return f"{year}-{months[month_str]}"

    # Try year-only from path like /2025/ or /2026/
    year_match = re.search(r"/(\d{4})/", decoded)
    if year_match:
        return f"{year_match.group(1)}-00"

    return "unknown"


def extract_project_id(url: str) -> str:
    """Extract a CSJ-based project ID from the URL, or use the folder name."""
    decoded = unquote(url)
    csj = _CSJ_PATTERN.search(decoded)
    if csj:
        return csj.group(0)

    # Fall back to the innermost directory name
    parts = decoded.rstrip("/").split("/")
    for part in reversed(parts):
        if part and part not in ("Construction Projects", "Maintenance Projects"):
            return part

    return "unknown"


# ---------------------------------------------------------------------------
# Download logic
# ---------------------------------------------------------------------------


def download_pdf(
    client: httpx.Client,
    url: str,
    local_path: Path,
) -> tuple[int, str]:
    """Download a PDF file. Returns (size_bytes, sha256)."""
    time.sleep(REQUEST_DELAY_SECONDS)
    local_path.parent.mkdir(parents=True, exist_ok=True)

    hasher = hashlib.sha256()
    size = 0

    with client.stream("GET", url) as resp:
        resp.raise_for_status()
        with open(local_path, "wb") as f:
            for chunk in resp.iter_bytes(chunk_size=65536):
                f.write(chunk)
                hasher.update(chunk)
                size += len(chunk)

    return size, hasher.hexdigest()


# ---------------------------------------------------------------------------
# Recursive crawler
# ---------------------------------------------------------------------------


class Scraper:
    def __init__(
        self,
        max_projects: int,
        max_gb: float,
        districts: list[str] | None = None,
    ):
        self.max_projects = max_projects
        self.max_bytes = int(max_gb * 1_073_741_824)
        self.districts = districts or DISTRICTS
        self.total_bytes = 0
        self.total_projects = 0
        self.conn = init_db(DB_PATH)
        self.client = make_client()

        init_manifest(MANIFEST_PATH)
        self._count_existing()

    def _count_existing(self) -> None:
        """Resume: count what we already have."""
        row = self.conn.execute(
            "SELECT COUNT(DISTINCT project_id), COALESCE(SUM(size_bytes), 0) FROM downloads"
        ).fetchone()
        self.total_projects = row[0]
        self.total_bytes = row[1]
        if self.total_projects > 0:
            logger.info(
                "Resuming: %d projects, %.2f GB already downloaded",
                self.total_projects,
                self.total_bytes / 1_073_741_824,
            )

    def _at_limit(self) -> bool:
        if self.total_projects >= self.max_projects:
            logger.info("Reached max_projects limit (%d)", self.max_projects)
            return True
        if self.total_bytes >= self.max_bytes:
            logger.info("Reached max_gb limit (%.2f GB)", self.total_bytes / 1_073_741_824)
            return True
        return False

    def run(self) -> None:
        logger.info(
            "Starting scraper: max_projects=%d, max_gb=%.1f, districts=%d",
            self.max_projects,
            self.max_bytes / 1_073_741_824,
            len(self.districts),
        )

        for district in self.districts:
            if self._at_limit():
                break
            district_url = urljoin(FTP_BASE, district.replace(" ", "%20") + "/")
            logger.info("Crawling district: %s", district)
            self._crawl_directory(district_url, district, depth=0)

        logger.info(
            "Done. %d projects, %.2f GB downloaded.",
            self.total_projects,
            self.total_bytes / 1_073_741_824,
        )
        self.client.close()
        self.conn.close()

    def _crawl_directory(
        self,
        url: str,
        district: str,
        depth: int,
    ) -> None:
        if self._at_limit() or depth > MAX_DEPTH:
            return

        try:
            entries = fetch_directory_listing(self.client, url)
        except httpx.HTTPError as e:
            logger.warning("Failed to list %s: %s", url, e)
            return

        # Separate PDFs and subdirectories
        pdfs = [
            (u, is_dir) for u, is_dir in entries if not is_dir and u.lower().endswith(PDF_SUFFIX)
        ]
        subdirs = [(u, is_dir) for u, is_dir in entries if is_dir]

        # Download PDFs in this directory
        if pdfs:
            letting_date = extract_letting_date(url)
            project_id = extract_project_id(url)

            for pdf_url, _ in pdfs:
                if self._at_limit():
                    return
                self._download_one(pdf_url, district, letting_date, project_id)

        # Recurse into subdirectories
        for subdir_url, _ in subdirs:
            if self._at_limit():
                return
            self._crawl_directory(subdir_url, district, depth + 1)

    def _download_one(
        self,
        url: str,
        district: str,
        letting_date: str,
        project_id: str,
    ) -> None:
        if is_downloaded(self.conn, url):
            logger.debug("Already downloaded: %s", url)
            return

        filename = unquote(url.split("/")[-1])

        # Build local path: data/raw/txdot/{letting_date}/{project_id}/{filename}
        safe_project = re.sub(r'[<>:"|?*]', "_", project_id)
        safe_filename = re.sub(r'[<>:"|?*]', "_", filename)
        local_path = DATA_DIR / letting_date / safe_project / safe_filename

        logger.info("Downloading: %s -> %s", filename, local_path)

        try:
            size_bytes, sha256 = download_pdf(self.client, url, local_path)
        except httpx.HTTPError as e:
            logger.warning("Download failed for %s: %s", url, e)
            return

        record = ScrapedFile(
            url=url,
            district=district,
            letting_date=letting_date,
            project_id=project_id,
            filename=filename,
            size_bytes=size_bytes,
            download_timestamp=datetime.now(UTC).isoformat(),
            local_path=str(local_path),
            sha256=sha256,
        )

        record_download(self.conn, record)
        append_manifest(MANIFEST_PATH, record)

        self.total_bytes += size_bytes
        # Count distinct projects
        row = self.conn.execute("SELECT COUNT(DISTINCT project_id) FROM downloads").fetchone()
        self.total_projects = row[0]

        logger.info(
            "  -> %s, %.2f MB (total: %d projects, %.2f GB)",
            sha256[:12],
            size_bytes / 1_048_576,
            self.total_projects,
            self.total_bytes / 1_073_741_824,
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download TxDOT plan PDFs from Plans Online FTP server.",
    )
    parser.add_argument(
        "--max-projects",
        type=int,
        default=100,
        help="Maximum number of distinct projects to download (default: 100)",
    )
    parser.add_argument(
        "--max-gb",
        type=float,
        default=25.0,
        help="Maximum total download size in GB (default: 25.0)",
    )
    parser.add_argument(
        "--districts",
        nargs="*",
        default=None,
        help="Districts to scrape (default: all configured districts)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        handlers=[logging.StreamHandler(sys.stderr)],
    )
    # Suppress noisy httpx/httpcore debug logs
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    scraper = Scraper(
        max_projects=args.max_projects,
        max_gb=args.max_gb,
        districts=args.districts,
    )
    scraper.run()


if __name__ == "__main__":
    main()
