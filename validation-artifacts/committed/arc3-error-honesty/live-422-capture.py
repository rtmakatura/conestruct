# Arc 3 Step 2 — #184 reproduction (read-only; no DB writes).
# A: the backend's actual 422 for the issue's repro (4 lanes x 14 ft shoulder).
# B: the same scenario through the prod proxy (/api/render/audit) -> what the client receives.
import json, urllib.request, urllib.error

env = {}
with open(r"C:/Users/rtmak/Documents/traffic-control-tool/conestruct/site/.env.local") as f:
    for line in f:
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")

MODAL = env["MODAL_RENDER_URL"].rstrip("/")
SECRET = env["MODAL_RENDER_SECRET"]

scenario = {
    "kind": "shoulder",
    "meta": {"project": "", "address": "", "lat": 39.73997, "lng": -104.96632},
    "roadType": "urban_arterial",
    "speed": 35,
    "lanes": 4,
    "laneWidth": 14.0,
    "divided": False,
    "workType": "other",
    "duration": "short",
    "workLen": 1500.0,
    "night": False,
}

def post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("== A: Modal backend /render/audit direct ==")
st, body = post(f"{MODAL}/render/audit", scenario, {"authorization": f"Bearer {SECRET}"})
print("status:", st)
print("body:", body[:2000])

print("\n== B: prod proxy /api/render/audit ==")
st2, body2 = post("https://www.conestruct.com/api/render/audit", {"scenario": scenario}, {})
print("status:", st2)
print("body:", body2[:500])

print("\n== C: prod proxy retry (identical request — the Retry button's exact behavior) ==")
st3, body3 = post("https://www.conestruct.com/api/render/audit", {"scenario": scenario}, {})
print("status:", st3, "body:", body3[:200])
