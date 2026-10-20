# #345 checkpoint (2026-10-19)

1. Problem: `setLanes` (conestruct/site/lib/scenarios/what-writes.ts:192) clears
   `roadLanesPerDirection` on every shoulder form lane edit, so #335's recovery
   (3 x 11 ft on a 4-lane freeway) drops the #310 note. With the relay kept,
   `lanes_drawn_below_road` (src/generation/layout.py:207) would print the #341
   "(entered)" sentence, which names no reason for the 3.
2. Rulings: #345 recommends option (a); #341 S1 (name a limit only when it is the
   cause). R145 self-ruled below (S1, S2).
3. Change: frontend keeps the relay unless the detection was disputed; backend adds
   one freeway-minimum branch to the one producer.
4. Rule 5: the pinned clear test flips; the new sentence appears only on freeway
   plans drawn at `freeway_max_drawable_lanes(shoulder)` (< 4) with a bigger road.
   #310 and #341 sentences byte-identical elsewhere; no snapshot moves. The branch
   carries #344's evidence commit 9fb4255 unchanged.
5. Proof: tests/test_lane_ceiling.py through /render/audit, /render/markdown and
   page 1; lane-ceiling-relay.test.ts for kept vs disputed-cleared.
