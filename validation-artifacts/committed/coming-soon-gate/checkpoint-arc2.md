# Arc 2 — the coming-soon page (B+, "The Plan Sheet") + email sign-up · 📋 checkpoint (investigate only)

*Written 2026-09-26 on branch `coming-soon-page` off `main` @ `ada8818` (Arc 1 shipped). No product code. Rulings cited by number from `rulings.md` (R5a, R9–R11 appended verbatim at `628e320`, with the four `design/*.dc.html` files, byte-identical to the copies Ryan placed in the main checkout). Site paths are relative to `conestruct/site/`.*

## 0. Blockers and corrections (read first)
- **B1 — No email provider exists (R6 stop condition).** No mail package in `package.json`, no send code in `app/`, `lib/`, `src/`, no mail env var in `.env.example`; `vercel.json` has no integrations. `recordSignup()` cannot email ryan@conestruct.com without adding one. **Ruling Q1 below; the form does not get built until it is answered.**
- **B2 — The rate limiter cannot fail closed today.** `lib/rate-limit.ts:14-34` is "FAIL-OPEN by design" (#145): env unset → off (`:82-88`), constructor throws → off (`:90-99`), `state.kind !== "on"` → allow (`:151`), catch → allow (`:157-160`). No option exists. Needs `UPSTASH_REDIS_REST_URL` / `_TOKEN` (`:38-39`) — **not in `.env.example` or `.env.local`; whether they are set in Vercel prod is unknown from the repo** (D5 draft issue 1 asks the same). With a fail-closed limiter and Upstash unset in prod, **every sign-up returns 503**. Ship precondition, Q2.
- **B3 — Sentry may capture the address.** All three configs set `sendDefaultPii: false` but `beforeSend` strips only auth/cookie headers (`sentry.server.config.ts:10-21`); the installed SDK (`@sentry/nextjs` 10.53.1) defaults `maxRequestBodySize: 'medium'` for incoming Node request bodies (`node_modules/@sentry/node-core/build/cjs/integrations/http/httpServerIntegration.js:34`). Whether that attaches under Next on Vercel is **unverified**. D6 ("the address is used for nothing else") therefore needs `event.request.data` dropped in `beforeSend` (server + edge) — in the build, tested. No analytics anywhere (no Vercel Analytics, PostHog, gtag).
- **B4 — The design's hero drawing names a plan type the product does not offer.** "LANE CLOSURE · MULTILANE, ONE DIRECTION" is `lane_closure_divided` (`src/api/audit.py:1543`), which is **not enabled**: `ENABLED_SCENARIOS = {"shoulder", "flagger_lane_closure", "near_intersection"}` (`src/api/render_api.py:113-115`). And its device placement differs from the product (§4). Q5.
- **B5 — Four of the page's claims are false today** (§3): nearest-intersection naming, "at your rates", "210 ft N of W 38th Ave", and two chips (`§6N.16`, `Fig. 6P-22`). Proposed honest wording in §3; Q6.
- **Correction — "the product's no-motion rule" has no written text.** DESIGN-PRINCIPLES.md, FLOW.md and CLAUDE.md never state it; it exists by reference (`components/WorkingBand.tsx:14-15` "the 2 px track above the row is the only motion"; `globals.css:3681-3682`). The only enforcing test is band-scoped (`lib/design/tokens.test.ts:143-155`). R10 is recorded as a deviation in §8, and the new motion CSS must sit **after** `.workbench .wb-row {` in `globals.css` — that test locates the band's reduced-motion block with `lastIndexOf(…, css.indexOf(".workbench .wb-row {"))`, so an earlier block breaks it.
- **Correction — R11 vs Arc 1's report.** Arc 1's report asked for Clerk Restricted + Allowlist; R11 records what was actually done (Invite-only, three hand-made users, no allowlist). Nothing in the code depends on the dashboard (C-E1's last sentence), so no code change follows.
- **Note — the canonical Rules text is not in the repo** (`/CLAUDE.md` is gitignored, `.gitignore:79`, and its rules are marked one-line summaries). Rules 5/10/12/13 are cited from those summaries.

## 1. The design authority, read
`design/PlanSheet.dc.html` (1440 × 2840) and `design/PlanSheetPhone.dc.html` (390 × 3700): plain HTML + inline styles + a `DCLogic` state script (animate / zoneColours toggles, `sent` state). **Reference, not source** — rebuilt in `components/` with workbench tokens.

Structure (desktop line refs):
- Plus-grid background pattern (`:39-45`), nav 52 px: wordmark · How it works · Sources · Get notified (`:47-52`). Phone nav: wordmark · Get notified only (`Phone:50-53`).
- The sheet (`:55-157`): crop marks, header strip "SHEET · Coming soon · colorado · mutcd 2023 · cdot s-630-1", the drawing (400 px) with legend + blue callout, then a 2-column lower sheet: step line, 62 px wordmark, body line, two anchor links | title block (PROJECT / STATUS / STANDARD / REGION / OUTPUT) + h1 "Want to know when it opens?" + form (email, company optional, Notify me) with a reserved 160 px (phone 240 px) state box + the promise line.
- 01 How a plan is made (3 cards with line drawings), 02 What you hand over (4), 03 Every dimension has a source (h2 + body + 7 chips), 04 Who it's for (2), closing band "Built in Colorado · Get notified ↑", footer.
- Form states drawn: idle and sent only. Submitting, invalid and failed are not drawn (§6 proposes them).

## 2. Token map (every colour, Rule 13 / P11)
Workbench block: `app/globals.css:747-962`.

| Design value | Token | Def | Used for | Fit |
|---|---|---|---|---|
| `#14202e` | `--canvas` | :818 | page ground; input ground; sent box | yes (input: see §5 Q8) |
| `#16232f` | `--canvas-tint` | :826 | nav, footer | yes |
| `#101c29` | `--da-ground` | :810 | cards, 02 strip, close band | yes |
| `rgba(16,28,41,.72)` | **no token** | — | the sheet's ground (grid shows through) | = `--da-ground` at 72%. **Propose** `--da-ground-rgb: 16 28 41` (precedent `--ws-surface-rgb`, :863) and `rgb(var(--da-ground-rgb) / .72)` |
| `#1c2b3b` | **no token** | — | plus-grid stroke | **Finding.** Nearest `--pri-off` #1d2c3c (wrong role). **Propose** `--sheet-grid: #1c2b3b`, role "decorative plus-grid behind the public sheet", declared decorative (P9's exemption must be labelled). Alternative: drop the grid |
| `#223345` | `--da-hair` | :811 | title-block cell rules, card-drawing base rules, sheet header rule | yes (not `--rule-soft` #223244) |
| `#2c3e53` | `--rule` | :827 | every 1 px border | yes |
| `#243447` | `--paper` | :834 | SVG work box fill | acceptable |
| `#3a4d66` | `--paper-line` | :836 | road edges, crop marks, box strokes | acceptable |
| `#2e4058` | `--paper-line-soft` | :837 | lane line dash, card doc lines | acceptable |
| `#eaf0f7` | `--ink` | :840 | headings, `.sec`, `.lab`, `.tbv`, chips, wordmark, devices | yes |
| `#c8d1dd` | `--ink-on-dark` | :853 | body, sign strokes | yes |
| `#93a0b0` | `--ink-on-dark-faint` | :854 | `.step`, `.prov`, nav items, footer, placeholder, SVG captions | yes (what `tr-step`/`tr-prov` use) |
| `#34a9e8` | `--act` | :875 | links, primary ground, nav "Get notified" | yes |
| `#56bcf2` | `--act-bright` | :876 | link/primary hover, focus ring | yes. **But also the SVG callout leader/dot and 01's pin/bracket — `--act` family is "INTERACTIVE only" (:866-868).** Q7 |
| `#0c1622` | `--on-act` | :879 | primary text | yes |
| `#ff8a2e` | `--dim` | :881 | wordmark period | precedent `Wordmark.tsx:15` |
| `#FFD166 #F3722C #FF7A00 #1EC8A5 #8A8A8A` | `ZONE_COLOR` (`lib/corridor-zones.ts:31-37`) | — | zone bands + legend swatches | **exact match, all five** (R9). Imported, never re-typed; the file has no imports, so client-safe (`LocationPickerModal.tsx` already imports it) |
| grey fallback `#3a4d66 #56718f #7a93b0 #aebbcc #2e4058` | — | — | the canvas's "if Ryan reverses R9" palette | **not built** (R9 approved colours). `#56718f`, `#7a93b0` have no token and would need them only on reversal |

Colour census: new 6-digit hex literals in `components/`/`lib/`/`app/` fail `lib/design/ink-literals.test.ts` unless declared; the plan has **none in TSX** (two new tokens live on `.workbench` in `globals.css`, which the census exempts). `INK_RESERVED` (`#3fd3a8`, `#e0a63c`) untouched.

Legend words: `ZONE_LABEL` (`corridor-zones.ts:39-45`) is "Advance warning / Taper / Buffer / Work zone / Downstream" — the design's five words, same order as the product's own legend (`components/bands/BandAerial.tsx:48, 220-230`). **Import `ZONE_LABEL` too** (one voice, P2); the design's lowercase becomes the product's sentence case.

## 3. Verify-before-building (Rule 10/12)

### 02 — "What you hand over" vs the shipped cards (`components/OutputCards.tsx`)
| Design item | Shipped | Verdict | Proposed |
|---|---|---|---|
| The plan sheet (for the bid) | "Plan sheet" PDF, 11×17 (:208); p.2 on the chosen road's aerial (`src/rendering/static_aerial.py:1-8`) | TRUE | keep |
| The count and the quote — "at your rates" | "Device list" XLSX (:216) + "Pricing quote" XLSX (`QuotePanel.tsx:640-648`). User sets labour rates, overhead, profit, days, miles (`QuotePanel.tsx:306-381`, `lib/quote-settings.ts:1-12`); **device daily rates are built in** (`src/export/quote_generator.py:38-58`, `# TODO: replace placeholder rates` :54-55) | **PARTLY** | "Every device the plan calls for, and an estimate at your labour rates and markup." |
| The audit (for the reviewer) — "the source behind every dimension" | "Audit trail" PDF, EVERY CHECK CITED (:236) | PARTLY (assumed widths uncited, see C) | "Every check the system ran, and the MUTCD or CDOT source behind each taper, buffer and spacing." |
| The crew sheet | "Crew instructions" PDF + MD, SETUP + TAKEDOWN (:224) | TRUE | keep |

### 03 — chips, by subject (citation counter stays **19** only if every chip is an existing product string)
| Chip | Product emits it | Subject | Verdict |
|---|---|---|---|
| MUTCD 2023 · Table 6B-1 | `src/api/audit.py:846, 850` | advance sign spacing A/B/C (`src/rules/tables.py:93`, p.773) | keep |
| §6B.06 | `audit.py:90, 107-108`; `components/AuditTrail.tsx:35-36` | buffer space | keep |
| Table 6B-3 | `audit.py:92, 104, 317` | taper length criteria | keep |
| CDOT S-630-1 · Sheet 10 | `audit.py:1144, 1150`; `plan_sheet.py:3240` | Case 18 advance signing (near-intersection plans) | keep |
| §6N.12 | `audit.py:1150, 1465, 1884` | scope/duties; the repo itself says it assigns no distances (`src/rules/site_detection.py:435-439`) | **drop** (not a dimension source) |
| §6N.16 | `audit.py:1902` only, in a pending item for work the product does **not** do (`site_adjustments.py:136` "No devices added") | — | **drop** |
| Fig. 6P-22 | code comments only (`layout.py:1535`, `render_api.py:110`); users see "TA-22" | — | **drop** |
| *(offer)* Table 6B-4 · §6K.01 | `audit.py:93-100, 111-112` | taper L formula; device spacing | add, if Ryan wants the row to stay at seven |

Citation counter stays **19**: every kept or added chip is a string the product already emits (convention `s2-arc13-demo-fixes/p775-verification.md:35`, `issue-289-band-stack/checkpoint.md:673`). The chips render as text, not links.

### 03 — "When the system can't source a value, it says so instead of guessing" — **PARTLY**
- For: pending-verification items (`audit.py:1812-1824, 1853, 1878, 1896, 1926, 1954`), the geometry refusal reason (`lib/corridor-geometry.ts:106-110`), curvature disclosed (`site_detection.py:363`).
- Against: shoulder width assumed 10/8 ft by kind, no flag (`src/api/schemas.py:1068-1086`); lane width hardcoded 12 (`lib/road-detection/classify.ts:302`) and then labelled "OSM detection" (`components/bands/HandoffNotes.tsx:106`) — **a Rule 10 defect in the product; draft issue proposed (§10)**; device rates built in.
- Also "Every taper, buffer and spacing **on the sheet** carries its citation": the PDF prints "BUFFER = N ft (NTS)" uncited (`plan_sheet.py:1766`); citations live in the audit.
- **Proposed:** "Every taper, buffer and spacing in the plan's audit carries its citation — the MUTCD 2023 section, table or figure, or the CDOT S-630-1 sheet it came from — so the person who reviews the plan can check it in one step. Where a value needs a person, the plan flags it rather than hiding it."

### 01 — step claims
- Step 1 "An address, a cross-street pair, or a pin" TRUE (`WhereBand.tsx:432, 444-445`; `LocationPickerModal.tsx:1722, 1776-1793`). "finds the road" TRUE. **"names the nearest intersection" FALSE** — no producer (`lib/scenarios/band-facts.ts:144-149`, `move-ledger.ts:19-23`). **Proposed:** "The system finds the road, its direction and who owns it." ("Found the spot" row, `move-ledger.ts:83-129`; jurisdiction via `/api/jurisdiction/suggest`.) "the way an 811 ticket describes it" — FLOW.md's framing; keep.
- Step 2 TRUE throughout (kind chips start unselected, "Kind of work — confirm below", `move-ledger.ts:202`; speed/lanes prefilled, `classify.ts:207`, `auto-apply.ts:8`).
- Step 3 "the drawing, the device count" TRUE; "flagged first" TRUE (`TieredReference.tsx:110`); "everything that passed one click away" TRUE (`GeneratorShell.tsx:2357`); **"a price" PARTLY** — a collapsed "expand to configure & preview" row labelled "FYI · contractor estimate" (`PricingCard.tsx:34, 57-62`). **Proposed:** "The drawing and the device count, with a contractor estimate one click away — anything that needs a person flagged first, everything that passed one click away."

### 01 — sample strings in the card drawings
"work starts here · 210 ft N of W 38th Ave" — **not produced** (the §5a target, no producer). "lane closure · 300 ft · confirmed" — not the product's format (`band-facts.ts:163-176`: `road · [at X St] · 300 ft · <kind label>`; no "confirmed", and "lane closure" is not a kind label, `lib/scenarios/index.ts:244-276`). **Proposed: non-numeric labels** — "work starts here" and "the work · its length · its side"; card drawings carry `aria-hidden` (decorative) as drawn.

### Hero line and title block
- Design body line adds "Mark where the work is and Conestruct lays out the rest" to Arc 1's `PUBLIC_LINE` (`lib/public-copy.ts:8-9`) — TRUE (work-start pin model). "every dimension cited" is the product's own claim (`GenerateBand.tsx:82`, `MathSection.tsx:185`) but PARTLY true (assumed widths). **Proposed body line (one voice, P2 — metadata keeps `PUBLIC_LINE`, or both change together):** "Traffic control plans for Colorado work zones. Mark where the work is and Conestruct lays out the rest — every taper, buffer and spacing cited to MUTCD 2023 or CDOT, every plan a draft for a licensed professional to review." Q6.
- Title block STANDARD "MUTCD 2023 · CDOT S-630-1" TRUE (all three live kinds are S-630-1); OUTPUT "Draft plans for licensed review" TRUE (`GeneratorShell.tsx:2409`); REGION Colorado, STATUS Coming soon, PROJECT Conestruct — no claims.
- 04 matches FLOW.md §1 (`FLOW.md:7-9`); "The estimator building a quote" slightly overstates FLOW's "a draft or a point of reference for a quote" — **proposed** "The estimator pricing a job". "Built in Colorado" — Ryan's to confirm (already in `AppFooter.tsx:38` since before Arc 1).

## 4. The drawing vs how the product lays out a lane closure
Product: `generate_lane_closure_divided` (`src/generation/layout.py:882-1199`); the live multilane kind `near_intersection` (`:1402`, S-630-1 Case 18) uses the same right-lane train.

| Element | Product | Design | Verdict |
|---|---|---|---|
| Closed lane | right lane (`:919, :1439`); work side at the bottom of the sheet (`plan_sheet.py:274-276`) | lower lane, traffic → right | match |
| Advance signs | 3 at A/B/C (`:939-955`); divided mirrors both sides (`:948-972`), undivided one side (`:1447-1448`) | 3, one side | match for undivided |
| Merging taper | drums edge → lane line over L (`:974-990`) + arrow board (`:992-1001`) | edge → lane line | match (arrow board optional at illustration level) |
| **Buffer** | **"intentionally empty"** (`:1003`) | **two devices at x=820, 862** (`PlanSheet.dc.html:90`; phone `:78`) | **differs** |
| **Work area** | **cones along the lane line, full length** (`:1028-1042`) | **none** | **differs** |
| Downstream taper | 50 ft/lane, lane line → edge (`src/rules/spacing.py:128-137`, `:1044-1058`) | 3 devices lane line → edge | match (not to scale) |
| END ROAD WORK | G20-2 100 ft past (`:1060-1078`) | absent | optional |
| Zone order & words | `CORRIDOR_ZONES`; `ZONE_LABEL` | same five, same order | match |

**Verdict: DIFFERS on two points.** Fix: empty the buffer; add devices along the lane line across the work zone, continuing into the downstream taper. Label: replace "LANE CLOSURE · MULTILANE, ONE DIRECTION" (an unoffered kind, B4) — Q5.

## 5. Decisions to table (recommendation first)
- **Q1 — email provider (R6, B1).** (a) **Resend — recommended.** One package (`resend`), env `RESEND_API_KEY` (+ `WAITLIST_TO`, `WAITLIST_FROM`), sender `waitlist@conestruct.com` verified by SPF/DKIM/DMARC records at GoDaddy; free tier covers this. (b) Postmark — same shape, stricter sender approval. (c) Nodemailer + SMTP on the conestruct.com mailbox (Google Workspace? — unknown here) with an app password; no new vendor, but a mailbox password in Vercel env. (d) No email: write to Neon (already the DB) and Ryan reads a table — contradicts R6 as ruled. Until verified DNS exists, Resend's `onboarding@resend.dev` sender delivers only to the account owner — usable for the first test if the account is ryan@conestruct.com. `recordSignup()` is the one function either way (R6). **The address goes to the provider and Ryan's inbox, nothing else (D6) — `/privacy` names the provider (§7).**
- **Q2 — fail-closed limiter (B2).** Recommend an optional 4th arg `rateLimitOr429(req, "waitlist", 5, { failClosed: true })` → 503 `{"error":"unavailable"}` on off/throw paths; the 13 existing three-arg callers are byte-identical in behaviour. 5/min/IP. **Ship precondition: Ryan confirms `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set in Vercel prod** (else every sign-up 503s — honest, but the form is dead). Alternative: in-memory fallback — rejected, per-instance on serverless, not a limit.
- **Q3 — /api/waitlist in the public set.** One entry added to `PUBLIC_EXACT` (`lib/gate.ts:16`), comments at `gate.ts:12-15` and `middleware.ts:18-19` updated to cite this arc; `middleware.test.ts` gains one `PUBLIC` row (`{ path: "/api/waitlist", method: "POST", file: "app/api/waitlist/route.ts" }`, beside `:112`) and near-miss `GATED_API` rows `/api/waitlistx`, `/api/waitlist/extra` (precedent `:162-163`). **POST only**; other methods 405 from the handler. Recommend yes (the prompt names it).
- **Q4 — "sent (+ undo)".** The email to Ryan is already sent when "sent" shows; undo cannot unsend it. Recommend: "Use a different address" reopens the form **prefilled**; the next send carries `replaces: <previous>` and Ryan's email says "replaces x@y". Honest (the record stays, P15), no withdrawal endpoint. Alternative: a withdraw POST — an unauthenticated "remove this address" call anyone could fire; rejected.
- **Q5 — the hero drawing's label and devices (B4, §4).** Recommend keep the drawing (it is the live near-intersection kind's approach train), fix the two device differences, and relabel **"ILLUSTRATION · RIGHT LANE CLOSED"** (no kind name; true of the product's right-lane train); keep "not to scale" and the legend's "illustration · a real plan is drawn on the road you pick". Alternative: redraw as a shoulder closure (the most-used live kind) — new drawing work, Ryan's canvas.
- **Q6 — the copy changes of §3** (02's two lines, 03's sentence + chips, 01's step 1/3 lines and card labels, the hero line, 04's estimator title). Recommend all as proposed. And: does `PUBLIC_LINE` (metadata, Arc 1) become the new hero line? Recommend **yes** — one voice (P2); `layout.tsx` metadata follows.
- **Q7 — the drawing's blue.** `--act-bright` is interactive-only (:866-868); the callout and 01's pin are decorative. Recommend **`--ink`** for the callout leader/dot and the pin/bracket (nothing on the drawing is clickable; blue would read as a link). Alternative: keep blue and record a role exception.
- **Q8 — control conformance (P11).** Primary: reuse `.workbench .pri` (min-height 56, hover `--act-bright`, `globals.css:3227-3251`) — it matches the design at both widths (the 48 px phone drop is `.a-pri`'s, rule 163, not `.pri`'s). Its focus ring is `--act`, the design draws `--act-bright`: **recommend the site's `.pri` ring** (consistency over the canvas). Inputs: no 56 px field exists (`.a-fld` 44 px on `--canvas-tint`, :4677-4690). Recommend the design's 56 px height on `.a-fld`'s colours (`--canvas-tint` ground, `--act` focus border, `--fld-invalid` invalid border) as a new `.cs-fld` class. Footer: reuse `AppFooter` as is (it adds "Output requires TCS review", which the design lacks — keep; removing it is a separate question).
- **Q9 — the plus-grid and the sheet's translucent ground.** Recommend the two tokens in §2 (`--sheet-grid`, `--da-ground-rgb`), grid declared decorative. Alternative: drop the grid, sheet on solid `--da-ground`.
- **Q10 — two primary-styled controls (P18).** The design styles both "Notify me" and the closing band's "Get notified ↑" as `.pri`. P18 allows one primary per screen. Recommend the closing link as a secondary (outlined, `--act` border and text, same 56 px) — it is navigation to the form, not the action. Alternative: keep as drawn and record a P18 deviation.

## 6. Form states (P1 reserved space; P8/P16 one busy signal; P9 symbol + word; Rule 10)
The state box has one fixed height at each width (desktop 160, phone 240 as drawn); the promise line below it never moves. Measured per state in the browser leg.
| State | Shows | Notes |
|---|---|---|
| idle | email (label "Work email"), company (optional), Notify me | honeypot field off-screen, `tabIndex=-1`, `autocomplete="off"`, `aria-hidden` |
| submitting | the primary disabled (`--pri-off`/`--pri-off-ink`) reading "Sending…"; inputs read-only | the one busy signal; no spinner (P16) |
| sent | "✓ Sent. We'll email you once, when Conestruct opens." + "Use a different address" (Q4) | **only after the server's 200**; focus moves to the sentence (`role="status"`) |
| invalid | "× Enter an email address, like you@company.com" under the field, border `--fld-invalid`, `aria-invalid` + `aria-describedby` | client check first; server 400 renders the same |
| failed | "⚠ Not sent — nothing was recorded. Try again in a minute." (+ 429: "Too many tries — wait a minute.") | never "sent" without the server; 503 (limiter off) and 5xx both land here |
Glyph meanings checked against the vocabulary table at build (P9); if ✓ × ⚠ carry other meanings there, words stand alone and the glyph row is raised.

`POST /api/waitlist` (Node runtime, precedent `app/api/render/device-breakdown/route.ts:10-33`): fail-closed limit → **real body cap** (read `req.text()` with a 2 KB limit — `content-length` alone lets chunked bodies through, the pattern every current handler uses) → JSON parse → honeypot filled → 200 `{ok:true}` and **nothing recorded** (bots learn nothing) → validate (email: one `@`, a dot in the domain, ≤254 chars, no whitespace/control chars; company ≤120, control chars stripped) → `recordSignup({email, company, replaces})` → 200. Errors JSON `{"error": …}`, no echo of the address, **no `console.*` of the body or address**, Sentry `beforeSend` drops `request.data` (B3).

## 7. `/privacy` — text for Ryan to rule (the form does not ship without it, D6)
Add as a new item under "In the interim, the following holds:" (`app/privacy/page.tsx:26`), and give Privacy its own `PRIVACY_VERSION = "2026-09-26"` in `lib/legal.ts` — **not** a `TERMS_VERSION` bump, which stamps accepted terms (`app/api/me/route.ts:23`, `app/api/plans/route.ts:39,45`) and would make every user re-accept.

> **The coming-soon sign-up.** If you leave your email address (and, if you like, your company) on the coming-soon page, it is sent to the Conestruct team's inbox through our email provider, [Resend], so we can email you once when Conestruct opens. It is not added to a mailing list, shared with anyone else, or sold. Your IP address is used for about a minute to limit repeated sign-ups and is not kept with your address. To have your address deleted, email ryan@conestruct.com.

(The provider's name fills in from Q1. The existing "data is shared only with service providers required to operate the service" line stays true.)

## 8. Type census (R7, R8) and the motion record (R10)
- **R7 — wordmark at `--fs-hero-numeral` 62 / `--fs-hero-numeral-380` 42 below 520.** New `TYPE_EXCEPTIONS` entry "coming-soon wordmark (R7)", CSS rows on `.workbench .cs-wordmark` (both `var()` sizes); the second-owner precedent is `--fs-primary`/`--fs-field-label` (`type-exceptions.ts:155-158`, test `:273-281`): both names added a second time to the pinned multiset (test `:255-256`), `cssDeclarations` +2, `cssSizes` unchanged. Note: the numerals switch at **980** (`globals.css:3125`); the wordmark switches at **520** per R7 (container query, like `tr-question`). Different breakpoints, one token pair — stated, not harmonised.
- **R8 — inputs at 16 px below 520.** New entry "form input below 520 (iOS zoom, R8)", `sizes: ["16px"]`, CSS row on `.workbench .cs-fld` under the 519 container query; `16px` already exists (audit formula line, `type-exceptions.ts:102-111`), so `cssSizes` unchanged, `cssDeclarations` +1, `"16px"` added a second time to test `:285`. Above 520 inputs use `--fs-body-value` 13.5 (role, no exception).
- **The exception commit lands first** (census red until the CSS lands, then green), as the prompt asks.
- **Blind spot:** the census does not read SVG `font-size` attributes. Every SVG `<text>` gets a role class instead (`tr-step` 10 px, `tr-prov` 10.5 px) so the census and roles cover it; the design's **9 and 9.5 px SVG labels become 10 px** (`tr-step`), and SVG `letter-spacing` user units go (roles carry tracking). Nav items (`.16em`) and footer (`.1em`) reuse the existing AppNav/AppFooter literals (`AppNav.tsx:54`, `AppFooter.tsx:37`). No new size.
- **R10 motion:** one `@keyframes` pair (`cs-draw`, `cs-fade`), scoped `.workbench .cs-sheet.cs-anim`, placed after the band's block; a `@media (prefers-reduced-motion: reduce)` block sets the end state with no animation. A new test pins "the coming-soon drawing is the only other motion": exactly these two keyframes outside the band, and the reduced-motion block present. The band test (`tokens.test.ts:143-155`) stays green.

## 9. Principles (the prospect, R3; P17)
| P | Applies | How (file:line where it holds today / will be measured) |
|---|---|---|
| **P1** (DESIGN-PRINCIPLES.md:12-16) | yes | form state box fixed height per width (§6); the drawing's animation is opacity/stroke-dashoffset only — no box moves; fonts `display: swap` (`app/layout.tsx:2-20`). Measure: rects of the promise line and 01 heading identical across all five states and before/after the animation |
| P2 | yes | one hero line shared with metadata (Q6); zone words from `ZONE_LABEL`, colours from `ZONE_COLOR` |
| P3 | yes | "Get notified" in nav + closing band both land on the form |
| **P4** (:30-34) | yes | sheet, sections, close band share the 40 px page edge (desktop) / 14 px (phone), as drawn; title-block labels share one left edge (140 / 104 px column). Measure: `left` of every section rule equal ±1 px |
| P5 | yes | every text node a `tr-*` role or a declared exception (§8) |
| **P6** (:42-46) | yes | grids with `minmax(0,1fr)` as drawn (lower sheet `minmax(0,1fr) 560px`, 01 `repeat(3, …)`, 02 `repeat(4, …)`); long emails wrap/scroll inside the input, never widen the column. Measure: track widths identical with a 254-char email |
| P7, P13–P15, P18–P22 | partly | one primary per screen (Notify me; the close band's "Get notified ↑" is an anchor styled `.pri` — **flag**: two primary-styled controls. see Q10); undo per Q4 |
| P8, P16 | yes | "Sending…" is the one busy signal; no skeleton, no spinner |
| **P9** (:60-64) | yes | states carry glyph + word (§6); zone swatches carry their word (Rule 13); the grid, crop marks and zone bands are decorative and labelled so in code |
| P10 | yes | inputs/buttons 56, title-block rows ≥44, footer links 44 at ≤480 (`AppFooter.tsx:42,48`), in-page anchor links padded to 44 at phone |
| P11 | yes | Wordmark, AppFooter, `.pri`, roles reused; two new tokens with roles (Q9) |
| P12 | yes | axe WCAG 2.2 AA at 1440 and 380; contrast measured per pair with `scripts/audit-lib.js` `PAIRS` (`:47-77`) |
| **P17** | yes | the prospect (FLOW.md §1 R3 line): what this is (sheet + 01), whether it is for them (04), a way to hear when it opens (the form) |
| **Deviation** | R10 | the load animation is the only motion outside the working band — recorded here and in the new test |

## 10. Churn (Rule 5, predicted)
- `app/page.tsx` replaced (placeholder → the page); `components/PublicChrome.tsx` gains a nav variant with in-page anchors (Terms/Privacy keep Arc 1's wordmark-only nav).
- `lib/public-copy.ts` `PUBLIC_LINE` changes if Q6 = yes → `app/layout.tsx` metadata/OG description change with it.
- `lib/gate.ts:16` + `middleware.test.ts` rows (Q3); `lib/rate-limit.ts` gains the optional arg (existing callers unchanged — a test pins three-arg behaviour).
- `app/privacy/page.tsx` + `lib/legal.ts` (`PRIVACY_VERSION`); `TERMS_VERSION` untouched.
- `sentry.server.config.ts`, `sentry.edge.config.ts` `beforeSend` drops `event.request.data` — **behaviour change for every route's error events** (bodies no longer attached anywhere). Recommend global; alternative: only `/api/waitlist`.
- `globals.css`: two tokens, `.cs-*` classes, one keyframes pair; type census pins move (§8); `tokens.test.ts` may need `--da-ground-rgb`/`--sheet-grid` acknowledged if it enumerates `.workbench` tokens.
- New dependency (Q1) → `package.json`/lock.
- No backend change, no wire change, no PDF/audit change, citation counter stays 19.
- Draft issue (Temp, not this arc): "Lane width is hardcoded 12 ft and labelled OSM detection" (`classify.ts:302`, `HandoffNotes.tsx:106`) — Rule 10.

## 11. Commit sequence (each shippable; what the operator sees)
1. Rulings + design files — **done, `628e320`** — *nothing.*
2. This checkpoint — *nothing.*
3. Type-census exception commit (R7, R8) — *nothing (census red by design until 5).*
4. Red tests: `/api/waitlist` route payload tests, middleware row, limiter fail-closed tests, mounted five-state flow, reduced-motion path, motion census — *nothing.*
5. Tokens + `components/coming-soon/*` + `app/page.tsx` + copy; drawing imports `ZONE_COLOR`/`ZONE_LABEL` — *the public sees the Plan Sheet; the form posts to a handler that exists.*
6. `/api/waitlist` + `recordSignup()` + limiter option + gate row + Sentry `beforeSend` — *sign-ups reach Ryan's inbox.*
7. `/privacy` text + `PRIVACY_VERSION` — *the policy says what the form does.* **5–7 ship together** (D6: the form never ships without the policy; a form without a handler would say "sent" falsely).
8. Evidence: 1440/380 measurements vs artboards (no sideways scroll, 44 px targets, contrast per pair, P1 rects per state), prod anonymous sweep (R1.2 + `/api/waitlist` only public), one real sign-up in Ryan's inbox.

**Ship preconditions (for Ryan):** Q1's provider account + DNS + `RESEND_API_KEY` (or equivalent) in Vercel prod; Upstash env confirmed in prod (Q2); `/privacy` text ruled (§7).
