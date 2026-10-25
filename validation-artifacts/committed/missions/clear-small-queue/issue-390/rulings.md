# #390 rulings

- R1 (R145 self-ruled): a 200 with no content-type answers 502 with the existing plain-failure body "Corridor map failed" (render-proxy.ts:414, the "anything else" branch), rather than new copy. No new user-facing string, so docs/style.md adds nothing. Fits Rule 10 (honest refusal over a guessed PNG) and the issue's proposed solution.
- R2 (R145 self-ruled): the upstream body is cancelled before the 502 so the unused response doesn't hold the connection; a console.error line names the cause, matching the proxy's existing `corridor map upstream <status>` log.
- R3 (R145 self-ruled): the 200 stub in render-proxy.corridor-map.test.ts becomes JPEG (bytes FF D8 FF E0, image/jpeg), matching production after #369; a separate PNG case keeps image/png covered.
