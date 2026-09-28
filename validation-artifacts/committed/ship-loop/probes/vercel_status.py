"""Wait for Vercel's verdict on a pushed sha, read-only (gh api GET).

  .venv/Scripts/python.exe vercel_status.py <sha> [<sha> ...]

For each sha: poll the commit statuses (context "Vercel") every 20 s until
none is pending, up to 15 min, then print every status event (time, state,
description) and the Preview deployment's URL if one exists.  A skipped
build is whatever Vercel reports for an Ignored Build Step exit 0; this
script records it verbatim rather than assuming its words.
"""

import json
import subprocess
import sys
import time

REPO = "rtmakatura/conestruct"


def gh(path):
    out = subprocess.run(["gh", "api", path], capture_output=True, text=True, encoding="utf-8").stdout
    return json.loads(out or "[]")


def full(sha):
    return subprocess.run(["git", "rev-parse", sha], capture_output=True, text=True).stdout.strip()


for arg in sys.argv[1:]:
    sha = full(arg)
    deadline = time.time() + 15 * 60
    while True:
        st = sorted(gh(f"repos/{REPO}/commits/{sha}/statuses?per_page=50"), key=lambda s: s["created_at"])
        st = [s for s in st if s["context"] == "Vercel"]
        latest = {}
        for s in st:
            latest[s["target_url"]] = s
        if st and all(s["state"] != "pending" for s in latest.values()):
            break
        if time.time() > deadline:
            print(f"{arg}: TIMEOUT waiting for Vercel (statuses so far: {len(st)})")
            break
        time.sleep(20)
    print(f"== {arg} ({sha})")
    for s in st:
        print(f"   {s['created_at']}  {s['state']:<8} {s['description']}")
    for d in gh(f"repos/{REPO}/deployments?sha={sha}"):
        ds = gh(f"repos/{REPO}/deployments/{d['id']}/statuses")
        url = ds[0].get("environment_url") if ds else None
        print(f"   deployment {d['environment']}: {ds[0]['state'] if ds else '?'} {url or ''}")
    sys.stdout.flush()
