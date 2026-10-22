# #362 production check of f13533f

- healthz: `f13533f` (`healthz.txt`). The served frontend is `70e4b87`, current; the build was skipped because the site didn't change.
- `prodcheck362.py` runs against www.conestruct.com through the site proxy. **PASS 18/18** (`replay.txt`):
  - Freeway 75 → 40, at 1000 ft and at 5000 ft of work: page 1 prints `+3 MORE ADVANCE SIGNS (G20-5P, R2-6P)`. It shows W20-1 (ROAD WORK AHEAD), R2-10 (BEGIN DOUBLE FINES ZONE) and all three W3-5 steps (40, 45, 60). Two whole plaque pairs are left.
  - Urban arterial 55 → 45, 1000 ft (its table fits today): no cut line.
- `prod-crop-freeway-75-40-L1000.png` is byte-identical (sha256 `7c9778cd9dfe6426…`) to the crop Ryan checked before the ship, `../crops/after-freeway-75-40-L1000.png`.
