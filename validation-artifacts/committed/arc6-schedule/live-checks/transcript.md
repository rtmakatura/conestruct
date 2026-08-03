# Arc 6 live-site verification — #188 + #199 + #206 (production, headless)

Run 2026-08-03T03:43Z (UTC; 2026-08-02 evening local) against
`https://www.conestruct.com/sandbox`, Playwright headless Chromium.
Read-only: no accounts, no DB writes, no plan saves. Generate clicks are
the sandbox's client-side stage flip; every captured POST is the page's
own stateless `/device-breakdown` render call.

## Build gate

| Surface | SHA |
|---|---|
| `git rev-parse origin/main` | `3f0628302d06078a05a6db35604121463dd7354f` |
| Modal `/healthz` | `3f0628302d06078a05a6db35604121463dd7354f` |
| Served Vercel bundle (`/_next/static` chunk scan) | `3f0628302d06078a05a6db35604121463dd7354f` |

Gate PASSED — all three equal. Backend-first ordering was honored this
arc (validation relaxation: the old backend 422s overnight payloads);
both surfaces are at the same sha, so the lag window is closed.

## Results — 24/24 PASS, 0 failures (23 checks + gate)

**#199 — honest unset.**
- **Check 1, cold load:** "Not set" chip presented as selected
  (`aria-pressed="true"`), "Single day" not asserted, no date/time
  inputs mounted; the single fresh breakdown POST carries **no schedule
  key** — the default is display-only. `01-cold-notset.png`.
- **Check 2, Denver pin + arterial, no schedule:** chip reads "windows
  shown · **not checked**", no verdict; backend returns
  `{"status":"unknown","violations":[],"note":"no work schedule
  provided"}`. `02-denver-noschedule.png`.
- **Check 3, residual times under "Not set":** after entering times
  (11:00→10:00 wrap from check 5), choosing "Not set" leaves the
  residual times riding the payload — and the backend refuses to judge
  them: `status "unknown"`, note "schedule marked Not set — hours not
  evaluated". Chip shows "not checked", never a verdict.
  `03-tbd-residual-notevaluated.png`.

**#188 — overnight entry end to end.**
- **Check 4, Denver arterial 20:00→05:00 (Wed 2026-08-05):** the end
  select offers "5:00 AM (next day)" (48 options, none filtered);
  the payload POSTs and returns **200** (pre-fix: 422); verdict
  **inside** with note "overnight shift — evaluated across midnight
  against the work date's windows"; chip renders "inside window ✓";
  the band overlay renders **two positive-width segments**
  (left 83.33%/width 16.67% = 20→24, left 0%/width 20.83% = 0→5).
  `04-denver-overnight-inside.png`.
- **Check 5, stranded-end regression:** 8:00–10:00 set, start moved to
  11:00 — the end select displays "10:00 AM (next day)" (not a blank)
  and the POST carries exactly `{start_time: 11, end_time: 10}`:
  display and payload agree. `05-stranded-end-wrap.png`.
- **Check 6, strip cell:** after Generate, the collapsed Hours cell
  reads "8:00 PM–5:00 AM (+1 day)". `06-strip-plus-one-day.png`.

**#206 — composition fix on prod.**
- **Check 7, Denver day shift 9:00–15:00 weekday arterial:** verdict
  **inside**, zero violations; the pre-fix false "outside window ·
  review schedule" appears nowhere on the page.
  `07-denver-day-inside.png`.
- **Check 8, genuine violation (10:00–16:00):** still **outside** —
  one violation, 0.5 h, and the copy names the full alternative set:
  "0.5 h falls outside the permitted 8:30 AM–3:30 PM / 8:00 PM–12:00 AM
  / 12:00 AM–5:00 AM windows (Weekday)"; payload's violation carries
  the 3-window `windows` list. `08-denver-genuine-violation.png`.
- **Check 9, Greeley cumulative control (7:30–15:00 arterial):** still
  **outside** the inner envelope — exactly one violation, 1.0 h vs the
  8:30 AM–4:00 PM inner window (outer 7–19 satisfied): the union change
  did not loosen nested envelopes. `09-greeley-cumulative.png`.

## Run notes

- Three runs. Run 1 failed only its own probe (4e): check 8's
  auto-expand left the hours chip open, and the probe's blind
  expand-click collapsed it before counting overlay segments — fixed to
  check `aria-expanded` first. Run 2 aborted on a transient
  wait-timeout at check 7 (schedule fields queried before they mounted
  after the "Single day" click) — fixed by waiting for `#sched-date`
  and lengthening verdict waits. Run 3 (this one): 24/24. No
  production behavior differed across runs — every product assertion
  that executed passed identically in all three.
- Payload captures (request schedule + response `hours_eval`, in
  order, for the cold-load and Denver contexts): `payload-captures.json`.
- Full timestamped assertion log: `assertions-raw.md`.
- Script: `arc6-live-checks.js` (run with
  `EXPECTED_SHA=$(git rev-parse origin/main) node arc6-live-checks.js`;
  outputs land in `out6/`).
