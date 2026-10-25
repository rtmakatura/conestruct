# #395 red proof

`lib/render-proxy.json-content-type.test.ts` against the pre-fix `render-proxy.ts` (HEAD `d6fc99e`): 6 failed, 6 passed (12). The six failures are exactly the no-header cases:

- fetchAuditTrail > a 200 with no content-type is relayed with none, not labelled application/json
- fetchCorridorGeometry > (same)
- fetchDeviceBreakdown > (same)
- fetchJurisdictionSuggest > (same)
- fetchNearestIntersection > (same)
- fetchQuoteBreakdown > (same)

With the fix: 12 passed (12).
