# #352 production check of 30cc023 (2026-10-22)

SHIP VERIFIED: healthz sha = `30cc0239b5ee1153b8bdccfd5997d3e7fd2d7770`, and the served frontend was built at `30cc023`.

Each row is a `POST https://www.conestruct.com/api/geocode` with body `{"address", "jurisdiction_key"}` and the scripts' gate header (R1.4). No city is typed except in the street address row.

| input | jurisdiction | answer | status |
|---|---|---|---|
| `US 285 & CO 9` | cdot | {"lat":39.221229,"lng":-105.993766,"placeType":"intersection"} | HTTP 200 |
| `I-25 & US 50` | cdot | {"lat":38.338098,"lng":-104.619794,"placeType":"intersection"} | HTTP 200 |
| `Colfax & Main` | cdot | {"lat":39.738365,"lng":-104.323716,"placeType":"intersection"} | HTTP 200 |
| `Academy & Platte` | el_paso | {"lat":38.839656,"lng":-104.757338,"placeType":"intersection"} | HTTP 200 |
| `Eisenhower & Lincoln` | loveland | {"lat":40.407199,"lng":-105.073065,"placeType":"intersection"} | HTTP 200 |
| `Colfax & Main` | e470 | add a city | HTTP 422 |
| `Colfax & Main` | none | add a city | HTTP 422 |
| `Colfax & Williams` | none | {"lat":39.739964,"lng":-104.966006,"placeType":"intersection"} | HTTP 200 |
| `Colfax & Williams` | denver | {"lat":39.739964,"lng":-104.966006,"placeType":"intersection"} | HTTP 200 |
| `1437 Bannock St, Denver, CO` | none | {"lat":39.739247,"lng":-104.99097,"placeType":"address"} | HTTP 200 |

## Verdict: PASS 10/10

1. CDOT + `US 285 & CO 9` lands at Fairplay (39.221229, -105.993766). That is acceptance 1: a corner in Colorado outside the 31 places lands on the corner.
2. CDOT + `I-25 & US 50` lands at Pueblo (38.338098, -104.619794).
3. CDOT + `Colfax & Main` lands at Strasburg (39.738365, -104.323716). Before this fix it was 422 (the Strasburg flag in `rulings.md`).
4. el_paso lands in Colorado Springs, and 5. loveland lands in Loveland.
6. e470 still answers 422 "add a city" (no sourced polygon).
7. No jurisdiction + `Colfax & Main` still answers 422. That is acceptance 2: no out-of-state pin.
8. to 10. The #347 rows (Colfax & Williams with none and with denver, and the plain street address) are unchanged.

Every coordinate is identical to the pre-ship live run in `outcome.md`. The town names come from that file's reverse lookup. No browser check is needed: the picker's wording and layout didn't change, and only where the pin lands did.
