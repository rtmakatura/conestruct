# Arc 2 evidence — the Plan Sheet at `/`

## `local-f2de42e/` — browser leg, local **dev** server, commit `f2de42e`
`AUDIT_OUT=<dir> node measure.cjs http://localhost:3100` (`next dev`, 2026-09-26). Five widths: 1440, 1024, 768, 390, 380.

| Check | Result |
|---|---|
| Sideways scroll | none at any width (`scrollWidth == innerWidth`) |
| Drawing shown | `cs-wide` at 1440/1024/768, `cs-narrow` at 390/380 (one per width) |
| Type (R7, A2-T) | h1 22 / 19 px, wordmark 62 / 42 px (520 container), body 13.5 px; SVG text 10 / 10.5 px (no 9 / 9.5) |
| Edges (P4) | sheet, sections and close band share 40–(W−40) at desktop and 14–(W−14) at phone |
| Title block | label column one left edge; every row 44 px |
| Targets (P10, rule 15) | none under 32 px at desktop, none under 44 px (both dimensions) at 390/380 |
| Contrast (P12) | lowest real pair `#93a0b0` on `#16232f` 6.00:1 (nav/footer faint text); all others higher |
| axe WCAG 2.2 AA + best practice | 0 violations at every width |
| R10, no-preference | first `.cs-fade` at opacity 0 with `cs-fade` running at first paint; **no rect of the sheet, sections, h1, primary or legend moved** between first paint and +2.2 s (P1) |
| R10, reduce | 20 animated elements, 0 animating, 0 below opacity 1, 0 transformed — static end state at first paint |
| Mail links | three visible "Get notified" at every width |

**One flagged pair is a dev-server artifact, not the page:** this run's contrast list includes "WORK" (and at phone the callout line) at 1:1, i.e. its group was at opacity 0 when measured more than 2.2 s after load. The immediately preceding run of the same script against the same code did not flag it, and `probe-remount.cjs` (three fresh loads at 1440) shows the work group's animation `finished` at 1.6 s and opacity 1 from 2 s on, **the same DOM node throughout** (no remount) and no console errors besides Clerk's development-key warning. The likely cause is `next dev` re-injecting CSS on hot updates, which restarts CSS animations in open pages; the same thing is why the full-page captures are taken in the reduced-motion context (see `measure.cjs`). A production-build measurement was started (`next build`) and **stopped by the session for low system memory** before it finished; it is still owed — run `measure.cjs` against `next start`, or against prod after the ship (`/` is public, no bypass header needed).

Screenshots: `plan-sheet-<w>-first-screen.png` (no-preference, after the animation) and `plan-sheet-<w>-full.png` (reduced motion, full page).

## Owed after the ship (Ryan's go)
- `node measure.cjs https://www.conestruct.com` with `AUDIT_OUT` set — the same table on prod.
- Anonymous sweep: only R1.2's set answers (Arc 2 adds no public path — A2-Q1 dropped `/api/waitlist`).
- `/healthz` sha == HEAD and the served bundle polled before the frontend leg.
