# #395 production check (2026-10-25, main c431ceb)

- PASS: healthz `{"status":"ok","sha":"c431cebe9047597ca1acd3a7911a47b0c3ff52d3"}`; the ship run reported FRONTEND CURRENT (www built at c431ceb).
- PASS: the backend's JSON answers name their own type, so the proxy has a header to pass on: POST /jurisdiction/suggest (E Colfax 39.73997, -104.96632) on Modal answered `HTTP/1.1 200 OK`, `Content-Type: application/json`.
- N/A (gated): the same call through www `/api/jurisdiction/suggest` answered 401 at the site gate (`GATE_BYPASS_TOKEN` in `.env.local` no longer matches production; flagged in handoff.md). How the proxy passes the header on, with and without one, is covered only by `lib/render-proxy.json-content-type.test.ts` (12 tests, CI green on c431ceb).
