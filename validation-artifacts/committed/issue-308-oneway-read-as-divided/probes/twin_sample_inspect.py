import json, math, time, urllib.request

UA = {"User-Agent": "conestruct-investigation/1.0 (issue #308)"}
P = str(__import__("pathlib").Path(__file__).with_name("twin_sample.json"))
rows = json.load(open(P, encoding="utf-8"))
for r in rows:
    if r.get("expected") == "one_way_street" and r.get("twin_way"):
        for wid in (r["way"], r["twin_way"]):
            req = urllib.request.Request(f"https://api.openstreetmap.org/api/0.6/way/{wid}/full.json", headers=UA)
            d = json.load(urllib.request.urlopen(req, timeout=60))
            time.sleep(0.7)
            w = [e for e in d["elements"] if e["type"] == "way"][0]
            n = {e["id"]: (e["lat"], e["lon"]) for e in d["elements"] if e["type"] == "node"}
            pts = [n[i] for i in w["nodes"]]
            L = sum(math.hypot((b[1] - a[1]) * 85640, (b[0] - a[0]) * 111320) for a, b in zip(pts, pts[1:]))
            t = w["tags"]
            keys = ("highway", "name", "oneway", "lanes", "bridge", "dual_carriageway")
            print(r["name"], wid, f"len={L:.0f}m", {k: t.get(k) for k in keys},
                  "ends", [tuple(round(x, 5) for x in pts[0]), tuple(round(x, 5) for x in pts[-1])])
        print()
