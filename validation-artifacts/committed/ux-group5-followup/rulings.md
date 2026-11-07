# #450 rulings: one name for "Not checked yet", short rule-check results, phone placeholder

Ryan ruled these on 2026-11-06 (prompt `cc-prompt-ux-group5-followup.md`), on #443's open items X23, X33 and "long rule-check rows". Branch `issue-450-not-checked-yet`, built on the pending evidence branch `issue-447-prod-check` (tip `bfa7afeb`).

## Rulings (verbatim from the prompt)

1. **One name for the section (P2).** "Not checked yet" is the section's name everywhere.
   - The NEEDS YOU strip's "<P> under Pending" becomes "<P> under Not checked yet".
   - The backend sentence "See the pending-verification disclosure." becomes "See Not checked yet." on the page and in the PDF, or uses the PDF's own name for that list if the PDF has one.
   - Grep for every other "Pending" or "pending-verification" a user can read (page, PDF, spreadsheet, crew narrative), list each one, and rename it the same way. Internal names stay as they are.
2. **Rule-check rows get a short result.** In "Checked and passed", each rule-check row reads title, then a short result on one line at 1440, e.g. "Signs on both sides of one-way street: Not required · 0 left, 10 right".
   - The full sentence, the quote and the citations move into the row's opened detail as written today. Nothing is lost.
   - The short result comes from the backend as a new field, so the frontend doesn't cut sentences (Rule 3).
   - Trace each rule check and record its short result and where each piece comes from. A check whose result can't be shortened honestly keeps its sentence, and you record why.
   - Search still finds text in the detail, as #443 does for closed rows.
3. **The search placeholder fits at 390.** Below 480 px the placeholder reads "Search: taper, 6B, sidewalk". Above that, it keeps #443's wording.
4. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex. List every new string with its source, and predict churn (Rule 5) for tests that look for the old strings.

### Walk-script rule (verbatim, from #443's production check)

Send the gate header only to the Conestruct site's own origins, by matching the request host in the Playwright route. Sending it to every origin broke Clerk on #443's first two production runs, and it sends our header to other companies' servers. Fix this in the shared walk helper so every later walk inherits it, and record the change.

## Ruling 1: every user-readable "Pending" / "pending-verification", and what it becomes

Grep: `Pending|pending[- ]verification|pending ·|"pending"` over `src/` and `conestruct/site/{app,components,lib}` (tests excluded), then each hit read in context. Line numbers are the base (`bfa7afeb`).

| # | Where a user reads it | File:line (base) | Old text | New text |
|---|---|---|---|---|
| P1 | NEEDS YOU strip, page | `conestruct/site/components/StatusBar.tsx:279` | `<P> under Pending` | `<P> under Not checked yet` |
| P2 | Site row action, page ("Intersection within work zone") | `src/rules/site_adjustments.py:184`, mirror `conestruct/site/components/AuditTrail.tsx:109` | `... isn't generated. See the pending-verification disclosure.` | `... isn't generated. See Not checked yet.` |
| P3 | Site row action, page ("Adjacent interchange") | `src/rules/site_adjustments.py:218`, mirror `conestruct/site/components/AuditTrail.tsx:118` | same sentence | `... isn't generated. See Not checked yet.` |
| P4 | Audit PDF, Site Adjustments table (P2/P3's `action`, `audit_blocks.py:524`) | follows P2/P3 | same sentence | `See Not checked yet.` |
| P5 | Audit PDF heading of the list | `src/rendering/audit_blocks.py:754` | `Pending Verification` | `Not checked yet` |
| P6 | Audit PDF, the list's first line | `src/rendering/audit_blocks.py:761` | `N reference(s) pending verification.` | `N reference(s) not checked yet.` |
| P7 | Audit PDF cover (page 1), the ledger line | `src/rendering/tier_ledger.py:186`, mirror `conestruct/site/lib/tiering.ts:375` | `... · N pending · reference` | `... · N not checked yet · reference` |
| P8 | "Not checked yet" row title on a wire without `items[]` (pre-items fallback), page | `conestruct/site/components/AuditTrail.tsx:1143` | `N reference(s) pending` | `N reference(s) not checked yet` |

Spreadsheet (`src/rendering` xlsx writers) and crew narrative (`src/narrative/`): grep finds no user-readable "pending" in either; the crew narrative doesn't print the site action sentence. Nothing to rename there.

### Hits read and left as they are

- **X1 (R145 self-ruled): "pending" as a step's state is a different word, not the section's name.** `GeneratorFormPrimitives.tsx:62` "◌ Pending: set a location first", the rail and band state word "pending" (`lib/scenarios/rail.ts:205`, `move-ledger.ts:147…241`, `band-facts.ts:488`, `GenerateBand.tsx` "◌ Generate · pending"). Each says a setup step hasn't been reached yet; none names the list of references to check. Renaming them "Not checked yet" would say something false (a step isn't a check). Ruling 1 applies P2 ("one voice per fact") to the section's name, so it covers the names of that section only. Left as they are.
- **X2 (R145 self-ruled): the dead `(TODO` scrubber keeps its words.** `src/api/audit.py:2483,2488,2596` ("CDOT S-630-1 case reference: verification pending", "case # is pending verification against…") fire only when a case label contains `(TODO`. No producer in `src/` writes one (grep `"(TODO"`: only the scrubber's own checks), so no user can read them. Left byte-identical; renaming would churn its tests for text nobody sees.
- **X3: internal names stay.** `pending_verification`, tier `"pending"`, `SectionId "pending"`, row ids `pending-N` / `hours-pending`, the tier fact reason "pending verification" (`lib/tiering.ts:304`; `reason` is never rendered), CSS classes (`st-pending`, `sev-pending`), `ItemSpec.cite: "PENDING"` (the pending row never draws `cite`), comments.

## Ruling 2: the rule checks in "Checked and passed", traced

The "RULE CHECKS" group (`lib/reference-sections.tsx:438-501`). New wire field: `short_result` (string) on each `sections.colorado.checks[]` and `sections.colorado.info_items[]` entry (`src/api/audit.py`), and on the site-adjustment records that can land in this group (`src/rules/site_adjustments.py`, passed through verbatim by `audit.py:2874`). The frontend prints it as the row's result and moves the full sentence into the opened detail; it never cuts a sentence (Rule 3). Field absent or empty (an older wire): the row's result stays the full sentence, as today (Rule 10).

| Row (title source) | Short result (backend, new) | Pieces and where they come from | Full sentence, now in the detail |
|---|---|---|---|
| Signs on both sides of one-way street / divided highway (`audit.py` `both_sides["label"]`) | `Not required · {L} left, {R} right` (one shoulder closed); `Required · {L} left, {R} right` or `Not required · {L} left, {R} right` (by `both_sides_required`); `… right counted` when Note 8 leaves signs out | `both_sides_required`, `one_shoulder_closed`, `sign_left`, `sign_right`, `not_counted` (`audit.py:1322-1334`) | `both_sides_detail` (`audit.py:1335-1351`) |
| G20-5P Work Zone signs every 2,640 ft | `{required} required · {placed} placed` | `plaques_required`, `plaques_right` (`audit.py:1363-1371`) | `Zone length: … Required: … Placed: …` |
| Speed reduction <= 15 mph per sign installation | `No reduction · {speed} mph throughout`; reduced: `{speed} → {wz} mph · {required} required · {placed} placed` | `speed`, `wz_speed`, `n_signs_required`, `n_w3_5_placed` (`audit.py:1396-1416`) | the `detail` of the same branch |
| Flagger station lighting {W}W @ {H} ft | `Not applicable · no flaggers`; `Not required · daytime`; night: `Required at night · 0 placed` | `n_flaggers`, `params.is_night` (`audit.py:1446-1491`) | the `detail` of the same branch |
| AADT threshold for mobile operations (info row) | `Not applicable · not a mobile operation` | constant branch (`audit.py:1493-1501`) | `Not applicable (not a mobile operation).` |
| Intersection within work zone (site row, `SITE_ADJUSTMENT_DETAIL.label`) | `No devices added · cross-street layout not generated` (repair round 1; was `No devices added`) | `devices_added: 0` of the record, and the gap the sentence names ("the cross-street approach layout isn't generated") | the record's `action` (frontend mirror `AuditTrail.tsx:109`), then the scan evidence as today |
| Adjacent interchange (highway ramps) (site row) | `No devices added · ramp layout not generated` (repair round 1; was `No devices added`) | `devices_added: 0`, and the gap the sentence names ("the per-ramp interchange layout isn't generated") | the record's `action` (mirror `AuditTrail.tsx:118`), then the evidence |
| Driveways present (site row) | `Keep access gaps · no devices across driveways` (repair round 1; was `Advisory only`) | the crew directive the sentence gives ("Maintain access gaps … Do not place devices across driveway entrances") | the frontend mirror's action, then the evidence |
| Limited sight distance (site row, only when no sign moved) | `No signs moved · Engineer sets locations · add signs where sight is blocked` (repair round 1, was `No signs moved`; repair round 2 split the two subjects: the Engineer sets locations (Note 10), the reader adds signs (Note 25)) | `moved == 0` (`site_adjustments.py:126-133`), and `LIMITED_SIGHT_ENGINEER_NOTE`'s two directives (S-630-1 Sheet 2 Notes 10 and 25, `site_adjustments.py:59-62`) | the record's `action` (moved text + engineer note), then the evidence |

Rows that already read short and keep their result (no sentence to move):

| Row | Result today | Why it stays |
|---|---|---|
| A jurisdiction rule the plan already meets (`deltasMet`) | `required by {jurisdiction} · the plan already places it` (`delta-words.ts:44`) | Frontend words over the backend's `raised`; already one clause. The rule's quote is already in the detail. |
| Site corridor validation | `checked against OSM, no warnings` | One clause. |
| A scanned condition not found / dismissed | `none along the corridor` / `dismissed by operator` | One clause. |
| Cross-street approaches (unsignalized) | `{n} legs · {side}-side work` | Already short (`AuditTrail.tsx:868`). |
| Fines Double envelope (not applicable) | `NOT APPLICABLE` | Already short. |
| Work hours (inside) | `inside the window` | Already short. |

No rule check had to keep its sentence for want of an honest short form. Amended in repair round 1 (the independent reviewer's FAIL): the first short results for the four site rows ("No devices added", "Advisory only", "No signs moved") dropped the caveat or the crew directive, so a ✓ row read like a clean pass (Rule 10). Each now carries it: the gap for intersection and interchange, the directive for driveways, and the Engineer note's two directives for sight distance. All four still fit a short form, so none keeps its sentence.

## Ruling 4: every new string and its source

| String | Where | Source |
|---|---|---|
| `under Not checked yet` | strip | Ruling 1, first bullet |
| `See Not checked yet.` | site action, page and PDF | Ruling 1, second bullet |
| `Not checked yet` (PDF heading) | audit PDF | Ruling 1 (the section's name), X4/X5 |
| `reference(s) not checked yet.` / `reference(s) not checked yet` | audit PDF / pre-items row | Ruling 1, third bullet (P6, P8) |
| `not checked yet · reference` | audit PDF cover ledger line | Ruling 1, third bullet (P7) |
| `Not required · {L} left, {R} right` and the other short results in the table above | rule-check rows | Ruling 2 (Ryan's example sets the form); each value from the backend fields named in the table |
| `Search: taper, 6B, sidewalk` | search placeholder ≤480 | Ruling 3, verbatim |

No new CSS size, colour or hex: the short result uses the row's existing `.rr-result` span, and the detail sentence uses the existing `.tr-help` paragraph. No new control, so no new target to size.

## R145 calls (self-ruled)

- **X1, X2, X3:** above.
- **X4: "See Not checked yet." in the PDF too.** The PDF's list was headed "Pending Verification" (P5). Ruling 1 renames that heading to the section's name, so the PDF's own name for the list is now "Not checked yet", and the sentence reads the same on the page and in the PDF.
- **X5: the PDF heading keeps its sentence case.** "Not checked yet", the page's name, letter for letter; the neighbouring heading "Acknowledged by the operator" is sentence case too.
- **X6: a failing rule check keeps its sentence as the result.** Ruling 2 names "Checked and passed". A failing Colorado check sits in section 3's RULE CHECKS with `--fail` ink, and its sentence says what's missing, which is the thing to read. It's unchanged; the backend still sends `short_result` on it so the wire contract is one rule ("every check and info item carries one").
- **X7: `short_result` only on the four site records that can be a passed row.** A record lands in "Checked and passed" only with no device added or moved (the filters at `tier-sources.ts:188` and `:191`): adjacent intersection, adjacent interchange, driveways, and limited sight distance with no sign moved. The ▲ records (pedestrian, bicycle, school, a sight-distance move) stay in section 3 with their sentence and get no field, so their wire stays byte-identical.
- **X8: the separator is " · ".** Ryan's example uses it; the rest of the reference rows use it (`delta-words.ts`, approaches, fines).
- **X9: the 480 query is the repo's `(max-width: 480px)`.** "Below 480 px" is read as the repo's ≤480 breakpoint, the one every other narrow rule in `globals.css` uses (lines 633, 1382, 1463, 2355, 2374), so the placeholder flips with the rest of the phone layout. The server render and the first client render use #443's wording; the short one follows on mount below 480 (`useSyncExternalStore`, no hydration mismatch).
- **X10: the recorded tiering fixtures stay byte-identical.** `tests/fixtures/tiering/*.json` are captured wires from before the field; they now exercise the Rule 10 path (no `short_result`, the sentence stays the result). A new mounted test adds the field to a copy and checks the short path.
- **X11: the walk helper.** `scripts/gate.cjs` already limited the header to requests whose origin is the site's (`isSiteRequest`, origin = scheme + host + port, the apex excluded and pinned). The fault on #443 was that the walk scripts never used it: each copied `walk.mjs` forward and put the header in `extraHTTPHeaders`, which rides every request. The fix in the shared helper: `newGatedContext(browser, site, options)` builds the Playwright context and installs the site-only route in one call, and refuses an `options.extraHTTPHeaders` that carries the gate header, so a copied-forward walk can't send it everywhere through the helper. `isSiteRequest` now reads the request's host (and scheme) explicitly, as the ruling words it; same predicate. This branch's walk uses `newGatedContext`, and the helper's header comment says every walk goes through it. `scripts/gate.py` (fetch-only, header per URL) is untouched.
- **X11, amended after the first local walk: redirect hops.** The first walk with `newGatedContext` recorded the header on `*.clerk.accounts.dev`. Cause: `route.continue({ headers })` keeps the added header on every redirect hop, and Playwright never shows the hops to the route. `/sandbox` 307s to Clerk's handshake, so the token rode to Clerk anyway, and this is very likely what #443's production runs hit too. A first try fulfilled each 3xx back to the browser (`maxRedirects: 0`). That stopped the leak but the browser then followed the hops itself, outside the route, so the site's own hop back (`/sandbox?__clerk_handshake…`) arrived without the header and the gate sent it to `/` (probe: four 307s, then the landing page). Final fix in the shared helper (`fetchGated`): the route walks the redirect chain itself, one `route.fetch({ maxRedirects: 0 })` per hop, adds the header on a hop only when that hop's host is the site's (`isSiteRequest`), and fulfils the browser with the final answer. Cookies set on the way land in the context's jar. Probe after it: `/sandbox` answers 200 (`route.fulfill` serves at the original URL, so the URL alone proves nothing); the proof is that the walk then rendered the generator and generated a plan at both widths. After a 301/302/303 the next hop is a GET with an empty body (repair round 1). Pinned in `tests/gate-helper.test.ts`: a site → Clerk → site → site chain sends the header on the three site hops and not on Clerk's.
- **X12: the local walk runs `next dev` with a walk-only `GATE_BYPASS_TOKEN`.** The token in `conestruct/site/.env.local` contains a `$`, and Next's dotenv expansion rewrites it on a local server, so no copy of the real token passes the local gate (curl with it: 401). The walk sets `GATE_BYPASS_TOKEN=walk-450-local-gate` for `next dev` and for the walk. The env var takes precedence over `.env.local`, so the real secret never enters the walk. Production (Vercel env, not dotenv) is unaffected.

## Open point for Ryan

- **Driveways short result drops "advisory only".** Repair round 1 gave the driveways row "Keep access gaps · no devices across driveways", which carries the crew directive. It doesn't carry the page copy's "(advisory only)" (`AuditTrail.tsx` `SITE_ADJUSTMENT_DETAIL.driveways_present.action`); the opened detail still does. No repair cycle was left to change it. Recommended if you want it on the head: "Advisory · keep access gaps, no devices across driveways". Otherwise it stays as it is.
