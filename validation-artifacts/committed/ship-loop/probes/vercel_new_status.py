"""Wait for a NEW Vercel status on a sha after a given UTC time (read-only).

  .venv/Scripts/python.exe vercel_new_status.py <sha> <since-iso-utc> [minutes]

Used when a branch is pushed at a sha that already has deployments (a new
branch at an existing commit): prints every Vercel status created after
<since>, waiting until one is final or the time runs out.
"""

import json
import subprocess
import sys
import time

REPO = "rtmakatura/conestruct"
sha, since = sys.argv[1], sys.argv[2]
minutes = float(sys.argv[3]) if len(sys.argv) > 3 else 6
full = subprocess.run(["git", "rev-parse", sha], capture_output=True, text=True).stdout.strip()
deadline = time.time() + minutes * 60
while True:
    out = subprocess.run(["gh", "api", f"repos/{REPO}/commits/{full}/statuses?per_page=100"],
                         capture_output=True, text=True, encoding="utf-8").stdout
    new = sorted((s for s in json.loads(out or "[]") if s["context"] == "Vercel" and s["created_at"] > since),
                 key=lambda s: s["created_at"])
    final = {}
    for s in new:
        final[s["target_url"]] = s
    if new and all(s["state"] != "pending" for s in final.values()):
        break
    if time.time() > deadline:
        break
    time.sleep(20)
print(f"== {sha}: Vercel statuses after {since} ({len(new)})")
for s in new:
    print(f"   {s['created_at']}  {s['state']:<8} {s['description']}  {s['target_url']}")
if not new:
    print(f"   none within {minutes:g} min")
