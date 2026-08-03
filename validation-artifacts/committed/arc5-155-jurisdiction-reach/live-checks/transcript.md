# Arc 5 live-site verification — #155 + #156 (production, headless)

Run 2026-08-03T02:29Z (UTC; 2026-08-02 evening local) against
`https://www.conestruct.com/sandbox`, Playwright headless Chromium.
Read-only: no accounts, no DB writes, no plan saves. Generate clicks are
the sandbox's client-side stage flip; markdown fetches hit the stateless
`/api/render/markdown` proxy.

## Build gate

| Surface | SHA |
|---|---|
| `git rev-parse origin/main` | `75827effe23ec7d1d50c72ef59e68b0680eba458` |
| Modal `/healthz` | `75827effe23ec7d1d50c72ef59e68b0680eba458` |
| Served Vercel bundle (`/_next/static` chunk scan) | `75827effe23ec7d1d50c72ef59e68b0680eba458` |

Gate PASSED — all three equal. (The ~2-min raw-key label fallback window
was long past; check 5 confirms proper labels.)

## Results — 27/27 PASS, 0 failures

**#155 — reachability.**
- **Check 1, Greeley pin (40.404292, -104.715863):** suggest slot offers
  "Pin suggests: Greeley" with a Confirm Greeley button; reason is the
  inside-municipal-limits sentence with the TIGER source — the
  pre-fix "unincorporated Weld County" falsehood appears nowhere on the
  page. Confirm lands `jurisdiction_key` (select shows `greeley`) and
  the section renders the record ("Greeley · city · calls this plan a
  MHT, the ROW public space"), not the baseline line.
  Screenshots: `01a-greeley-suggested.png`, `01b-greeley-confirmed.png`.
- **Check 2, Thornton pin (39.8680, -104.9847):** same shape — suggested,
  confirmable, record renders ("Thornton · city · calls this plan a TCP,
  the ROW right-of-way"); no "does not carry" falsehood.
  Screenshot: `02-thornton-confirmed.png`.
- **Check 3, Lakewood control (39.7113, -105.0815):** unchanged healthy
  path — suggests Lakewood, inside, Confirm offered.
  Screenshot: `03-lakewood-control.png`.
- **Check 4, Northglenn near-boundary (39.886, -104.9811):** jigsaw
  warning fires naming Thornton at **292 ft** (exactly the recorded
  distance); Northglenn correctly unsupported; NO Confirm button
  rendered and the select stays empty with the baseline line —
  suggest-never-set observable at the surface.
  Screenshot: `04-northglenn-jigsaw.png`.
- **Check 5, dropdown:** Greeley and Thornton present with proper labels
  (`{"value":"greeley","label":"Greeley"}`,
  `{"value":"thornton","label":"Thornton"}`) — not raw keys. Full
  option list logged in `assertions-raw.md`.
  Screenshot: `05-dropdown.png`.
- **Check 6, county-copy honesty (Arapahoe pocket 39.5790, -104.8600 —
  outside every mapped place):** reason reads "Pin is in Arapahoe
  County, outside the municipal boundaries Conestruct maps"; warning
  reads "outside the mapped municipal boundaries"; the word
  "unincorporated" appears nowhere in the slot. (Arvada/Broomfield are
  in the unsupported *place* layer and would exercise the city message,
  not the county branch — the pocket pin is the county-branch pin.)
  Screenshot: `06-county-copy.png`.

**#156 — narrative header.**
- **Check 7, Greeley confirmed → crew narrative:** captured through the
  page's own download POST (the "Download .md" click's request payload,
  replayed byte-identical via in-page fetch because the download
  stream's body is not readable from the response hook). Header renders
  `- **Jurisdiction:** Greeley`; CDOT nowhere in the header.
  Capture: `07-greeley-narrative.md`; screenshot `07-greeley-generated.png`.
- **Check 8, null-key control (quiet Denver pin, suggestion offered but
  NOT confirmed):** select stays empty; header renders
  `- **Jurisdiction:** CDOT` (honest baseline).
  Capture: `08-nullkey-narrative.md`; screenshot `08-nullkey-generated.png`.

## Run notes

- Two runs. The first run's checks 7b/8c FAILED spuriously: the
  narrative capture read the download response body via
  `waitForResponse`, which returns an empty body for download streams —
  both captured files were 0 bytes ("header missing"). The capture was
  rewritten to intercept the page's own POST payload and replay it
  in-page; the second run (this one) passed 27/27. No production
  behavior differed between runs — the first run's 7a/7c and 8a/8b
  passed, and every #155 assertion passed identically in both.
- Full timestamped assertion log: `assertions-raw.md`.
- Script: `arc5-live-checks.js` (run with
  `EXPECTED_SHA=$(git rev-parse origin/main) node arc5-live-checks.js`).
