# #447 red proof

Each new test group, run against the code broken one way, then the code restored. Failing test counts are the runner's.

| Break | Suite | Result |
|---|---|---|
| subject not filtered by the scan's classifier | py | 1 failed, 22 passed |
| dashed subject not drawn | py | 4 failed, 19 passed |
| map slot removed from the card | vitest | Tests 11 failed | 5 passed (16) |
| key and chip name a line whatever the backend said | vitest | Tests 2 failed | 14 passed (16) |
| proxy drops the two headers | vitest | Tests 1 failed | 15 passed (16) |
| every crossing drawn, not the nearest | py | 1 failed, 24 passed |
| the space under the map only rendered once loaded | vitest | Tests 1 failed | 14 passed (15) |
