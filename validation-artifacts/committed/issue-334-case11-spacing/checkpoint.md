# #334 checkpoint, 2026-10-17: Case 11 sign spacing on freeway shoulder plans

## What the investigation found
- Both shoulder generators place the freeway signs from Table 6B-1 plus a midpoint rule: first W21-5aR at A, second at the midpoint of A and taper + 500 ft, W20-2 at A + B, W20-1 at A + B + C (`src/generation/layout.py:281-283, 359-362` divided; `:730-732, 768-772` undivided). At 75 mph that is 750 / 1,000 / 2,500 / 5,140 ft from the taper.
- **Case 11** (Sheet 7, PDF p. 155; read twice: oracle O16 on zoomed crops, and `tests/fixtures/cdot_s630_typicals/case_11.json`): W5-1 500 ft, W21-5aR + W7-3a(X) 1,000 ft, W21-5aR + W16-2a "1500 FT" 2,000 ft, G20-5P / R2-1(XX) 3,000 ft, W20-1 5,200 ft. No W20-2.
- **Cases 26/27** (Sheet 14, PDF p. 162; read this session on the rendered sheet, and it matches `case_26.json` / `case_27.json`): from the taper, W21-5aR + W7-3aP 530 ft, G20-5P / R2-1 1,060 ft, W21-5aR + W16-2aP 1,320 ft, R2-10 1,580 ft, W3-5 2,110 ft, W20-1 "ROAD WORK ½ MILE" 2,640 ft. No W20-2, no W5-1.
- Today a Case 26/27 plan puts R2-10 at work start + 500 ft (`layout.py:573`), which is inside the buffer, downstream of the taper. W3-5 sits 530 ft upstream of that. Sheet 14 has both upstream of the taper. So matching Sheet 14 moves the whole Fines Double entrance, not just the two signs this issue names.
- Three more surfaces read the old geometry and must move with it: the validator's Table 6B-1 A/B/C check (`src/rules/validators.py:867-905`, which would warn on Case 11 spacing), the audit's A/B/C/A2 position labels (`src/api/audit.py:847, 865`), and the #331 sight-distance shift that reads the A sign.

This is an R145 stop on two counts. Q1 removes a sign. Q2 moves W20-1 2,500 ft closer on Case 26/27 plans and widens the scope beyond the two shoulder-closed signs.

## Q1: does W20-2 stay on freeway Case 11 plans?
- **A. (Recommended) Drop it.** Case 11 shows no W20-2. With the first W21-5aR at 2,000 ft, today's W20-2 at 2,500 ft would sit 500 ft upstream of it. Every sign in the series then traces to Case 11 (Rule 12).
- **B. Keep it, at a chosen station** (e.g. 3,500 ft, Table 6B-1's B past the first W21-5aR). Marked CHOSEN. The plan would show a sign the cited typical doesn't.

## Q2: how much of Sheet 14 does this arc build?
- **A. (Recommended) Case 11 only; split Cases 26/27 into a new issue.** This arc moves every freeway shoulder plan that cites Case 11 (no reduction, and non-standard reductions such as 65 to 55). Case 26/27 plans keep today's layout until the follow-up. The follow-up rebuilds the Sheet 14 entrance as one series: the two W21-5aR, the G20-5P / R2-1 group, R2-10, W3-5 and W20-1 at 2,640 ft. I'd file it now with the Sheet 14 reading above. Reason: it moves the Fines Double envelope and shortens W20-1, and it would not fit in this session with Case 11 (R154).
- **B. Both in this arc.** Same build as A plus the Sheet 14 series. Likely two sessions.
- **C. Cases 26/27: the two W21-5aR only** (530 / 1,320 ft); W20-2 and W20-1 stay on Table 6B-1. This mixes two sources in one series and leaves R2-10 in the buffer.

## What I'd self-rule under R145 once Q1/Q2 are answered
- S1. One producer: a `case_11_freeway_stations(taper_start)` helper in `src/rules/` holds the four Case 11 distances with their cite. Both generators, the audit's position labels and the validator read it (Rule 3).
- S2. The validator scores a Case 11 freeway shoulder plan against Case 11's distances (each sign at least its distance from the taper), not Table 6B-1 A/B/C. Other plans keep the Table 6B-1 check.
- S3. Signs are placed at exactly Case 11's distances. Case 11 calls its dimensions minimums ("1700' is min"), so exactly is the shortest compliant run.
- S4. The #331 sight-distance shift still moves the whole series by one amount.
- S5. Out of scope, to be listed in the close comment: Case 11's G20-5P / R2-1(XX) group at 3,000 ft and R2-10 at 3,500 ft. Today the plan puts G20-5P inside the work zone.

## Rule 5 prediction (if Q1 = A, Q2 = A)
Moves: every freeway shoulder plan that cites Case 11 (`e470-r-75`, `i25-r-65-night-3lanes` and the freeway corpus snapshots). W21-5aR pair moves to 1,000 / 2,000 ft, W20-1 to 5,200 ft, and W20-2 is gone, on page 1, page 2, the crew sheet, the XLSX and the quote. The audit's sign table and position labels change.
Byte-identical: every non-freeway plan, flagger, lane closure, near-intersection, and the Case 26/27 plans.
