# #390 plan (R145, no stop)

Base ae4feaf (tip of issue-389-overpass-guard). Branch issue-390-proxy-content-type.

1. Problem: `fetchCorridorMap` relabels a 200 with no `content-type` as `image/png` -- `headers.set("content-type", contentType || "image/png")` (conestruct/site/lib/render-proxy.ts:418 at ae4feaf). A silent default (Rule 10); after #369 the backend sends `image/jpeg` for the satellite style, so the guess would also be wrong.
2. Rulings: Rule 10 (absence of signal renders as absence; honest refusal beats silent substitution). Rule 11 (test at payload level). No Ryan ruling on this seam.
3. Change: relay the upstream `content-type` as-is; a 200 that carries none cancels the upstream body, logs, and answers 502 "Corridor map failed" (the proxy's existing plain-failure copy and shape, render-proxy.ts:414). Header comment "a PNG out" becomes "an image out".
4. Rule 5 churn: behavior change only for a 200 with no content-type (was 200 image/png, now 502 text "Corridor map failed"). Latent: the backend always sets the header (src/api/render_api.py render_corridor_map, `media_type=media_type`), so production answers are byte-identical, image/png and image/jpeg both forwarded unchanged as before. No Python file, no other proxy function, no route, no UI touched.
5. Proof: payload-level vitest in conestruct/site/lib/render-proxy.corridor-map.test.ts -- 200 image/jpeg reaches the caller as image/jpeg (stub now JPEG, matching production after #369); 200 image/png still image/png; 200 with no content-type answers 502 "Corridor map failed", not image/png. Red proof against the base (red-proof.md). Full vitest, tsc --noEmit, next lint.
