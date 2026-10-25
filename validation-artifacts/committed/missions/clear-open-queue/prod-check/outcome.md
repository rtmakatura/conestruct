# Mission clear-open-queue (#387) production check of 0ea3e8a: 9/9 PASS, 2 N/A

Run 2026-10-24 straight against the Modal backend (`https://rtmakatura--conestruct-render-fastapi-app.modal.run`, Bearer `MODAL_RENDER_SECRET`) with `check.py`. healthz `0ea3e8a` = `origin/main`. Per-row details are in `results.json`.

The site proxy wasn't used. The `GATE_BYPASS_TOKEN` in `conestruct/site/.env.local` gets a 401 on www.conestruct.com, so the local copy doesn't match prod.

| Issue | Case | Observed | Result |
|---|---|---|---|
| #385 #383 #380 | healthz sha = `origin/main` | `0ea3e8aa5e95c4a4518af08fadf60d715717aa40` on both | PASS |
| #381 | Thornton flagger, `/render/markdown` | 200. Required Equipment lists `1× Advance Warning Signs (jurisdiction-required)`. Setup quotes stipulation 6 word for word from `data/jurisdictions/thornton.json` | PASS |
| #381 | Thornton shoulder, `/render/markdown` | same as the flagger | PASS |
| #381 | CDOT flagger / CDOT shoulder (`jurisdiction_key: cdot`) / flagger with no jurisdiction | 200, with no `jurisdiction-required` row and no "Not placed on the drawing" | PASS ×3 |
| #369 | `POST /render/corridor-map`, `broadway-sb` fixture, laid_out 600×300 | 200, `content-type: image/jpeg`, body starts `FF D8 FF`, 205,714 bytes | PASS |
| #367 | CDOT lane closure at 65 and 75 mph, no work-zone speed, `/render/audit` | 400 "This scenario type isn't available yet…" (`lane_closure_divided` is gated, Rule 8) | N/A ×2 |
| #367 | CDOT freeway shoulder at 65 and 75 mph (control) | 200. buffer 645 / 820 ft. The source ends "CDOT S-630-1 Sheet 7 Case 11 (buffer VARIES per General Note 24)." and so does the lookup | PASS ×2 |

The 645 / 820 ft lane audits with the Table 6B-2-only source can't be seen in production. The #367 rulings say so ("Unreachable on the live API"). They're proven at the producer level by `tests/s630/test_lane_buffer_cite_367.py` and `../issue-367/byte-identity-diff.txt`, and the deployed sha contains `f43ae27`. Production shows the unchanged shoulder side.

No browser check is needed: none of the six changes how a page looks.
