# #333 Rule 5 prediction (committed before code)

## Behavior that changes (deliberate)
Every **shoulder** plan (divided, undivided, one-way street) gains `n − 1` lane-edge cones in its buffer, where `n = ceil(buffer / 2S)`. Table 6B-2's buffers are all several times 2S, so every shoulder plan changes. Examples:

| Plan | Buffer | 2S | Buffer cones |
|---|---|---|---|
| N Broadway, 30 mph | 200 ft | 60 ft | 3 (at 50 ft spacing) |
| Ogden, 25 mph | 155 ft | 50 ft | 3 (38.75 ft) |
| US 24, 65 mph | 645 ft | 130 ft | 4 (129 ft) |
| E-470, 75 mph | 820 ft | 150 ft | 5 (136.7 ft) |

What follows from that, on every shoulder plan:
- **Cone counts:** the CONE line on page 1's device summary, the device XLSX, the quote XLSX (cones at $1.50/day each) and the crew sheet's equipment list each rise by that many.
- **Audit spacing section:**
  - a new `buffer_count_text` line, and new fields `n_buffer_cones` and `buffer_cone_spacing_ft`;
  - the downstream line reads "T tangent + B buffer + D downstream = N cones total";
  - `result_text`'s device total includes them;
  - `tangent_count_text` and `n_tangent_cones_required` (work zone only) are unchanged.
- **Crew sheet step 3:** a new sentence places the buffer cones, giving count, spacing, stations and the Note 18b citation.
- **Page 1:** the buffer label reads `BUFFER = N ft (NTS) · K CONES`. No cone is drawn inside the compressed buffer.
- **The validator comment** at `validators.py:778-780` ("buffer space, which is intentionally empty") is reworded. Its check is unchanged.

## Unchanged
- Lane closures, flagger, near-intersection, work-beyond-shoulder and mobile plans: byte-identical. The parity harness shows only shoulder scenarios changed.
- Every shoulder plan's taper, buffer length, signs and stations stay as they are.
- Containment stays 0/0/0 on every fixture. `test_page1_channelizers` passes.

## Tests and records that move with it
- Shoulder snapshots (`tests/snapshots/audit_shoulder_*.json`, `tests/snapshots/corpus/grid_*` shoulder files, `tests/fixtures/tiering/*`) are regenerated, and the diff is checked to contain only cone counts and the new lines.
- Count assertions in `test_verification.py`, `test_crew_narrative.py`, `test_audit_endpoint.py` and `test_formula_fields.py` are updated.
- The verify scripts' hard-coded `n_tangent_cones_total` are updated.
- New: `tests/test_buffer_cones_333.py`. It checks the helper, both generators, Note 18b's ≤ 2S across buffer + work zone, the five surfaces agreeing, and page 1 drawing none in the buffer while naming them.
