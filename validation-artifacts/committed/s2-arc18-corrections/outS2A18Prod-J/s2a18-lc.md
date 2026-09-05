# s2a18 live check — PRODUCTION
UTC: 2026-09-05T06:43:06.109Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"eb06add42e32ce1497d7053167d114ca090405db"}
git rev-parse origin/main: eb06add42e32ce1497d7053167d114ca090405db
**PASS** — GATE — healthz sha == origin/main — eb06add42e32ce1497d7053167d114ca090405db vs eb06add42e32ce1497d7053167d114ca090405db

ONLY_J: the gate, then browser pin → Generate → Assert → J → axe. Legs A–I and L not run.
**PASS** — J0 Generate at Lakewood settles with an ok scan — 4673 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — J0 Assert puts a correction on the wire (the precondition) — 21593 ms; [{"flag":"school_zone","action":"assert","recorded_at":"2026-09-05T06:43:17+00:00"}]
J entry: the last audit request carried siteConditionOverrides [{"flag":"school_zone","action":"assert","recorded_at":"2026-09-05T06:43:17+00:00"}]
**PASS** — J1 after a pin move the next request carries no siteConditionOverrides (key dropped) — 7284 ms; meta.lat 39.7114; siteConditionOverrides null
**PASS** — K axe after the pin move: 0 violation(s) ≤ baseline 2 — none

RESULT: ALL PASS 5/5 (+0 INFO)
