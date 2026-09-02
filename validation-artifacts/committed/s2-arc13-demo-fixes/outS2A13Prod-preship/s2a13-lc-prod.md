# s2-arc13 prod live checks (Refs #229)

- `2026-09-02T13:47:22.685Z` run start (UTC): 2026-09-02T13:47:22.684Z
- `2026-09-02T13:47:22.687Z` BASE: https://www.conestruct.com
- `2026-09-02T13:47:23.531Z` healthz (HTTP 200): {"status":"ok","sha":"eebe82b23125f12adf3996688d1bfdf0087f3310"}
- `2026-09-02T13:47:24.375Z` git rev-parse origin/main: eebe82b23125f12adf3996688d1bfdf0087f3310
- `2026-09-02T13:47:24.375Z` **PASS** — GATE — healthz sha == origin/main (eebe82b23125f12adf3996688d1bfdf0087f3310 vs eebe82b23125f12adf3996688d1bfdf0087f3310)
- `2026-09-02T13:47:26.928Z` **PASS** — A1. /api/render/audit serves the Lakewood control (HTTP 200)
- `2026-09-02T13:47:26.928Z` **FAIL** — A1. taper.source cites Table 6B-4 for L ("MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Shoulder closures use L/3 per Sec 6B.08 (Table 6B-3).")
- `2026-09-02T13:47:26.928Z` **PASS** — A1. taper.source cites Table 6B-3 for the L/3 ratio
- `2026-09-02T13:47:26.928Z` **FAIL** — A1. exactly one 6B-3 and one 6B-4 in the sentence
- `2026-09-02T13:47:26.929Z` **PASS** — A1. values unchanged — L 163 ft, L/3 54 ft (L_full_ft=163 L_required_ft=54)
- `2026-09-02T13:47:27.431Z` **PASS** — A2. /api/render/audit-pdf serves (HTTP 200, 6890 bytes)
- `2026-09-02T13:47:27.757Z` **FAIL** — A2. audit PDF carries the 6B-4 formula cite
- `2026-09-02T13:47:27.757Z` **PASS** — A2. audit PDF carries the 6B-3 ratio cite
- `2026-09-02T13:47:28.982Z` **FAIL** — B1. GET /landing answers a permanent redirect (301 or 308) (HTTP 200)
- `2026-09-02T13:47:28.982Z` **FAIL** — B1. Location is /sandbox (Location=)
- `2026-09-02T13:47:29.211Z` **FAIL** — B2. following the redirect lands on the sandbox (HTTP 200, title="Conestruct — MUTCD plans in seconds")
- `2026-09-02T13:47:29.211Z` **FAIL** — B2. the archived copy is not served
- `2026-09-02T13:47:29.211Z` DONE — failures: 7
