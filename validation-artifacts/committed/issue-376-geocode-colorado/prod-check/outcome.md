# #376 production check of a0e59c5 (2026-10-23)

The ship verified: healthz sha = `a0e59c511cbac5c62a80dfd3a4d8ecdedeeacf3d`, and the served frontend was built at `a0e59c5`.

Each row is a `POST https://www.conestruct.com/api/geocode` with body `{"address", "jurisdiction_key"}` and the scripts' gate header, run by `check.py` beside this file. Raw answers are in `results.json`. The #352 rows are that issue's production check (`issue-352-authority-areas/prod-check.md`), re-run unchanged.

| input | jurisdiction | answer | status | verdict | source |
|---|---|---|---|---|---|
| `US 287 & Dillon Rd, Lafayette, CO` | none | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 row 1 (was California) |
| `US 287 & Dillon Rd, Lafayette` | none | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 row 2 (was Louisiana) |
| `US 287 & Dillon Rd, Lafayette` | cdot | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 row 3 (was Louisiana) |
| `US 287 & Dillon Rd, Lafayette, Colorado` | none | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 row 4 |
| `Colfax & Main, Aurora, IL` | none | outside colorado | HTTP 422 | PASS | #376 R1 (was Aurora, Illinois) |
| `Johnston & Pinhook, Lafayette, LA` | none | outside colorado | HTTP 422 | PASS | #376 R1 |
| `US 285 & CO 9` | cdot | {"lat":39.221229,"lng":-105.993766,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `I-25 & US 50` | cdot | {"lat":38.338098,"lng":-104.619794,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `Colfax & Main` | cdot | {"lat":39.738365,"lng":-104.323716,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `Academy & Platte` | el_paso | {"lat":38.839656,"lng":-104.757338,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `Eisenhower & Lincoln` | loveland | {"lat":40.407199,"lng":-105.073065,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `Colfax & Main` | e470 | add a city | HTTP 422 | PASS | #352 |
| `Colfax & Main` | none | add a city | HTTP 422 | PASS | #352 |
| `Colfax & Williams` | none | {"lat":39.739964,"lng":-104.966006,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `Colfax & Williams` | denver | {"lat":39.739964,"lng":-104.966006,"placeType":"intersection"} | HTTP 200 | PASS | #352 |
| `1437 Bannock St, Denver, CO` | none | {"lat":39.739247,"lng":-104.99097,"placeType":"address"} | HTTP 200 | PASS | #352 |

**16/16 PASS.**
- The four searches from the issue answer the Lafayette, Colorado corner, 39.957998, -105.090397. Before the fix, the first answered Lafayette, California and the other three Lafayette, Louisiana.
- A named other state answers 422 `outside colorado`, which the search bar shows as "Plans cover Colorado roads only." (R1). "Colfax & Main, Aurora, IL" used to answer Aurora, Illinois.
- #352's ten rows answer exactly as on `30cc023`.

Not checked here: the `check spelling` path. Mapbox fully matched the one misspelling tried (see `../live-run.txt`), so that path is proved only against the stub (`lib/geocode.test.ts`).
