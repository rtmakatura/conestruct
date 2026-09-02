# s2-arc13 prod live checks (Refs #229)

- `2026-09-02T14:05:25.853Z` run start (UTC): 2026-09-02T14:05:25.853Z
- `2026-09-02T14:05:25.856Z` BASE: https://www.conestruct.com
- `2026-09-02T14:05:26.252Z` healthz (HTTP 200): {"status":"ok","sha":"d7a9edeb70fc9675a29b1a9fdb9facd260ed3aff"}
- `2026-09-02T14:05:27.105Z` git rev-parse origin/main: d7a9edeb70fc9675a29b1a9fdb9facd260ed3aff
- `2026-09-02T14:05:27.105Z` **PASS** — GATE — healthz sha == origin/main (d7a9edeb70fc9675a29b1a9fdb9facd260ed3aff vs d7a9edeb70fc9675a29b1a9fdb9facd260ed3aff)
- `2026-09-02T14:05:28.136Z` **PASS** — A1. /api/render/audit serves the Lakewood control (HTTP 200)
- `2026-09-02T14:05:28.136Z` **PASS** — A1. taper.source cites Table 6B-4 for L ("MUTCD 11th Ed. Sec 6B.08, Table 6B-4 (taper length L). Shoulder closures use L/3 per Sec 6B.08 (Table 6B-3).")
- `2026-09-02T14:05:28.136Z` **PASS** — A1. taper.source cites Table 6B-3 for the L/3 ratio
- `2026-09-02T14:05:28.136Z` **PASS** — A1. exactly one 6B-3 and one 6B-4 in the sentence
- `2026-09-02T14:05:28.136Z` **PASS** — A1. values unchanged — L 163 ft, L/3 54 ft (L_full_ft=163 L_required_ft=54)
- `2026-09-02T14:05:28.723Z` **PASS** — A2. /api/render/audit-pdf serves (HTTP 200, 6915 bytes)
- `2026-09-02T14:05:29.043Z` **PASS** — A2. audit PDF carries the 6B-4 formula cite
- `2026-09-02T14:05:29.043Z` **PASS** — A2. audit PDF carries the 6B-3 ratio cite
- `2026-09-02T14:05:29.271Z` **PASS** — B1. GET /landing answers a permanent redirect (301 or 308) (HTTP 308)
- `2026-09-02T14:05:29.271Z` **PASS** — B1. Location is /sandbox (Location=/sandbox)
- `2026-09-02T14:05:29.640Z` **PASS** — B2. following the redirect lands on the sandbox (HTTP 200, title="Sandbox · Conestruct")
- `2026-09-02T14:05:29.640Z` **PASS** — B2. the archived copy is not served
- `2026-09-02T14:05:29.640Z` ALL PASS
