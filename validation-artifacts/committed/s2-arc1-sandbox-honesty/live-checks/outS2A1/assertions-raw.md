# s2-arc1 live checks — raw log

- `2026-08-17T18:36:38.672Z` healthz sha: 46a0df84aaa831934e4011c3285d06eaa0103ccc
- `2026-08-17T18:36:38.673Z` expected (git rev-parse origin/main): 46a0df84aaa831934e4011c3285d06eaa0103ccc
- `2026-08-17T18:36:40.428Z` served bundle sha: 46a0df84aaa831934e4011c3285d06eaa0103ccc
- `2026-08-17T18:36:40.428Z` **PASS** — gate. healthz == origin/main == served bundle (46a0df8)
- `2026-08-17T18:36:52.129Z` Lakewood candidate picked
- `2026-08-17T18:36:52.554Z` **PASS** — F3a. in-modal clamp annotation on the lanes row
- `2026-08-17T18:36:53.415Z` **FAIL** — AX1. axe zero violations — open modal with the clamp annotation (1 finding(s) — axe-modal-clamp-note.json)
- `2026-08-17T18:36:54.321Z` picker saved (Lakewood + lanes=6 override)
- `2026-08-17T18:36:54.324Z` **PASS** — F3b. seam clamped note visible after save
- `2026-08-17T18:36:54.803Z` **FAIL** — AX2. axe zero violations — page with seam handoff notes visible (1 finding(s) — axe-seam-notes.json)
- `2026-08-17T18:37:14.041Z` Greeley candidate picked (changed detection)
- `2026-08-17T18:37:14.907Z` picker saved (Greeley)
- `2026-08-17T18:37:14.910Z` **PASS** — F1. changed-detection laneWidth overwrite named at the seam
- `2026-08-17T18:37:14.912Z` F1 sibling note also visible: "Lanes set to 2/direction (OSM detection — was 4)."
- `2026-08-17T18:37:36.384Z` Lakewood candidate picked (flagger)
- `2026-08-17T18:37:37.755Z` picker saved (flagger + lanes/divided overrides)
- `2026-08-17T18:37:37.758Z` **PASS** — F2a. lanes override skipped note (flagger has no lane count)
- `2026-08-17T18:37:37.761Z` **PASS** — F2b. divided override skipped note (flagger has no divided toggle)
- `2026-08-17T18:37:39.568Z` reduction enabled at 55 mph (posted 65)
- `2026-08-17T18:38:08.214Z` Colfax candidate picked (detected maxspeed tag: unmeasured)
- `2026-08-17T18:38:09.091Z` picker saved (Colfax)
- `2026-08-17T18:38:09.093Z` **PASS** — F4a. cleared note names the dropped reduction
- `2026-08-17T18:38:09.095Z` **PASS** — F4b. reduction input gone (workZoneSpeed cleared)
- `2026-08-17T18:38:09.097Z` **PASS** — F4c. no INVALID INPUT / workZoneSpeed 400 on the strip
- `2026-08-17T18:38:38.389Z` #123 Lincoln St (primary couplet control): row titles=["low confidence","inferred from class=tertiary · low confidence · class=tertiary, oneway=false"]
- `2026-08-17T18:38:38.402Z` #123 Lincoln St (primary couplet control): value=undivided, oneway=false, provenance="inferred from class=tertiary · low confidence · class=tertiary, oneway=false"
- `2026-08-17T18:38:38.402Z` **PASS** — #123. Lincoln St (primary couplet control): couplet claim never accompanies an undivided value (undivided, oneway=false / no couplet claim)
- `2026-08-17T18:39:08.410Z` #123 E 13th Ave: row titles=["low confidence","inferred from class=secondary · low confidence · class=secondary, oneway=true"]
- `2026-08-17T18:39:08.422Z` #123 E 13th Ave: value=undivided, oneway=true, provenance="inferred from class=secondary · low confidence · class=secondary, oneway=true"
- `2026-08-17T18:39:08.422Z` **PASS** — #123. E 13th Ave: couplet claim never accompanies an undivided value (undivided, oneway=true / no couplet claim)
- `2026-08-17T18:39:37.794Z` #123 E 14th Ave: row titles=["low confidence","inferred from class=tertiary · low confidence · class=tertiary, oneway=true"]
- `2026-08-17T18:39:37.806Z` #123 E 14th Ave: value=undivided, oneway=true, provenance="inferred from class=tertiary · low confidence · class=tertiary, oneway=true"
- `2026-08-17T18:39:37.806Z` **PASS** — #123. E 14th Ave: couplet claim never accompanies an undivided value (undivided, oneway=true / no couplet claim)

Failures: 2
