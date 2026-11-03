# #437 production check on 9a9ca2d (2026-11-03)

SHIP VERIFIED: `/healthz` sha and the served frontend both `9a9ca2d` (main HEAD).

Run: `script/walk-prod.mjs` (branch 3's walk, pointed at https://www.conestruct.com with the gate token from `.env.local`, never printed). Playwright Chromium, DPR 2, 1440x900 and 390x844. Denver Colfax pin, the shoulder work kind. `/api/road-bearing` is stubbed with the same three roads as the branch 3 walk and #436's production check (`STUB=1`): the live picker labels the roads differently, so the script's "westbound" pick didn't match. Everything else ran on production, including the backend, the site scan on live Overpass, audit and downloads. Raw facts: `walk.json`. Crops: `1440-*.png`, `390-*.png`.

The first two attempts were script failures, not product failures. (1) The fixed 3 s wait after Apply caught the regenerate still in flight. The script now waits for the band and the in-flight ribbon to clear. (2) At 390, one Generate hit the site scan's 20 s budget on the free mirrors and the page refused honestly ("Site scan unavailable", Retry / Generate anyway). The rerun completed at both widths.

| Check | 1440 | 390 |
|---|---|---|
| Strip at load says the count in words: "Plan ready. Answer 3 quick questions before you send it." | PASS | PASS |
| Three questions, changed-the-plan first (sidewalks, bike lane, intersection) | PASS | PASS |
| G11: no "Previous answer: … staged, not yet applied." ribbon at any staging step (the `ribbons` array is empty on every step from q1-yes to ready-to-apply) | PASS | PASS |
| Downloads warning row present on every step before Apply ("These files match the plan before your 3 answers. Answer first and they'll update.") | PASS | PASS |
| Downloads live throughout: no download button disabled before Apply; a plan-sheet PDF saved before answering and after Apply | PASS | PASS |
| Yes/No each way on all three questions, Undo and reopen Q1 and Q2 from their rows (`reopenedQ1`, `reopenedQ2` true) | PASS | PASS |
| One regenerate per Apply (`rendersForApply` = 1) | PASS | PASS |
| Device total 40 before Apply, 38 after (the bike lane answered No takes its 2 devices off, as its consequence line says) | PASS | PASS |
| N = 0 after Apply: the warning row is gone and the strip keeps today's verdict wording ("VERIFIED · 4 PLAN FLAGS") | PASS | PASS |
| No target under 44 px in the results stack or the strip (generated, q2-open, ready-to-apply, applied) | PASS | PASS |
| Price quote row: "Price quote · Contractor estimate, not a permit fee · Open", no $ before a preview (D7, Rule 10) | PASS | PASS |
| axe: one violation, `heading-order` on `#needs-you-h` (h1 → h3). It's also on main from before this chain, so it goes into the follow-up issue, not here. | known | known |

Not covered: an N = 1 render. Colfax gives 3 questions; the singular is covered by tests only.

Result: 11 PASS, 0 FAIL at both widths; one known axe finding carried to the follow-up.
