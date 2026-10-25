# #390 red proof

New tests in conestruct/site/lib/render-proxy.corridor-map.test.ts, run against the base render-proxy.ts (ae4feaf, before the fix):

    × fetchCorridorMap > a 200 with no content-type is a plain failure, not relabelled image/png
      → expected 200 to be 502 // Object.is equality
    Tests  1 failed | 5 passed (6)

The JPEG relay case passes on the base too (the base already forwards a present header); it guards the forward-as-is half of the acceptance. After the fix: Tests 6 passed (6).
