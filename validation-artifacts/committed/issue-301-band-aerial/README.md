# #301 piece 1 — the aerial on the WHERE band: the evidence

- **Authority:** `rulings.md` (every ruling, verbatim).
- **The plan:** `checkpoint.md`.
- **The measurements behind the plan:** `probes/`.

## The prod sweep: the shipped version (`d6e00a7`, 2026-09-26)

`sweep.cjs` ran headless against https://www.conestruct.com/sandbox, with no local backend or dev
server (Ryan, 2026-09-26). The prod healthz sha was `d6e00a7` = `main`.

It has three runs, each at 1440 and 380. Every state saves `prod/<run>-<width>-NN-<state>.{png,json}`: the aerial's stage, its note, its
legend rows and lines, the frame's box, the image's natural size, and whether the page scrolls
sideways. `prod/<run>-<width>-log.txt` lists the pictures the band asked for.

| Run | Pin | States on the band |
|---|---|---|
| shoulder | N Broadway SB, 39.73370, −104.98753 | fresh (no aerial) → side owed → side chosen, kind owed → both answered → the picker's CORRIDOR EXTENT |
| flagger | Lafayette St, 39.74362, −104.97070; the kind confirmed first | fresh → kind confirmed, side owed → both answered (two approaches) |
| noroad | 39.74480, −104.95010 (no road detected) | fresh → side owed → a heading chosen, kind owed → both answered |

**What prod showed (identical at 1440 and 380, bar the size):**

| State | Stage | On the band |
|---|---|---|
| No pin | none | no aerial |
| Side owed | `pin` | the pin, and "Say which side is occupied to lay out the work"; no legend |
| Side chosen, kind owed | `work` | the work segment; legend "Work zone" and "Approaches lay out after you confirm the kind" |
| Both answered | `laid_out` | the whole corridor, with the advance warning upstream (north of the Broadway SB pin); legend: Advance warning, Taper, Buffer, Work zone, Downstream |
| Flagger, both answered | `laid_out` | both approaches; the legend adds "Faded: past the mapped road" and "Two approaches: northbound (the work's side) and southbound" |
| The picker (piece 2) | n/a | CORRIDOR EXTENT reads only "Centerline — OSM, full corridor": no Total, no per-zone feet |

**Measured on every state:**
- **The frame** is 846 × 300 at 1440 and 318 × 250 at 380 (rules 104 and 172).
- **The picture** is drawn at the frame's inner size: 844 × 298 → 1688 × 596 at @2x, and 316 × 248 → 632 × 496. There is no crop and no upscale.
- **`hScroll: false`** in every record at both widths.

**Findings:**
1. **None blocking.** Every ruled state renders as ruled, at both widths.
2. **The pin marker is drawn on the corridor.** It sits over the start of the upstream channels (the taper and buffer on Broadway at 30 mph). At step 0 the advance warning still shows past it. It is the ruled pin (rule 107, "keep the pin"), so this is noted, not changed. Zooming in (below) clears it.

## The zoom states (Ryan's hand-check ruling, 2026-09-26)

Zoom is on this branch (`a7225ff`), not yet on prod. Until it ships, the zoom evidence comes from real
Mapbox pictures drawn by this branch's `/render/corridor-map`:
- **Script:** `probes/zoom_probe.py`.
- **Pictures:** `probes/zoom/`, both fixtures at 600 × 300 and 348 × 250, every step from −1 to +3.
- **Log:** `probes/zoom-probe.txt`.

What they show:
- **Step −1** is half the size of step 0, so the backend's fit agrees with Mapbox's `auto`.
- **+1 to +3** close in on the work segment's middle.
- **+3** is street level: lane edges and crosswalks are visible.
- **The pin and the overlay** are the same at every step.

After the ship, `sweep.cjs` captures the zoom states on prod as well. When the band carries
+ / −, it steps in three times, out once, and resets, recording each step's `zoomStep`.
