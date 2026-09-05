"""s2-arc19 local run — a stand-in Overpass mirror for a network outage.

Serves tests/fixtures/site_scan/lakewood_overpass.json (the recorded live
payload of 2026-09-03 for the Lakewood corridor) to every POST, so the
local backend's scan runs its real code path over a real payload while
both public mirrors are unreachable from this machine.  Local evidence
only; the prod run scans live.
"""
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

PAYLOAD = (Path(sys.argv[1]) / "tests" / "fixtures" / "site_scan" / "lakewood_overpass.json").read_bytes()
json.loads(PAYLOAD)  # valid


class H(BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        self.rfile.read(int(self.headers.get("Content-Length", "0") or 0))
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(PAYLOAD)))
        self.end_headers()
        self.wfile.write(PAYLOAD)

    def log_message(self, fmt, *args):  # quiet
        sys.stderr.write("overpass-mock: " + (fmt % args) + "\n")


HTTPServer(("127.0.0.1", 8766), H).serve_forever()
