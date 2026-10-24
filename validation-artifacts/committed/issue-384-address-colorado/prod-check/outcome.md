# #384 production check of fb8958b (2026-10-23)

The ship verified: healthz sha = `fb8958bbda0f5aedd9c459800e374ccb4fff2f09`, and the served frontend was built at `fb8958b`.

Each row is a `POST https://www.conestruct.com/api/geocode` with body `{"address", "jurisdiction_key"}` and the scripts' gate header, run by `check.py` beside this file. Raw answers are in `results.json`. The #376 and #352 rows are from `issue-376-geocode-colorado/prod-check/`, re-run unchanged.

| input | jurisdiction | answer | status | verdict | source |
|---|---|---|---|---|---|
| `100 Main St, Lafayette, CO` | none | check address | HTTP 404 | PASS | #384 issue (was Wisconsin) |
| `100 Main St, Lafayette` | none | check address | HTTP 404 | PASS | #384 issue (was Indiana) |
| `100 Main St, Aurora` | none | check address | HTTP 404 | PASS | #384 R1 (was Indiana) |
| `350 5th Ave, New York, NY` | none | outside colorado | HTTP 422 | PASS | #384 another state named |
| `1600 Pennsylvania Ave, Washington, DC` | none | outside colorado | HTTP 422 | PASS | #384 another state named |
| `Lafayette, LA` | none | outside colorado | HTTP 422 | PASS | #384 R2 (box: a Leadville street) |
| `Denver, PA` | none | outside colorado | HTTP 422 | PASS | #384 R2 (box: Parkfield, Denver) |
| `200 S Public Rd, Lafayette` | none | {"lat":39.997225,"lng":-105.090456,"placeType":"address"} | HTTP 200 | PASS | #384 unchanged |
| `1 Main St, Longmont, CO 80501` | none | {"lat":40.159755,"lng":-105.103291,"placeType":"address"} | HTTP 200 | PASS | #384 partial match, typed city |
| `1437 Banock St, Denver` | none | {"lat":39.739247,"lng":-104.99097,"placeType":"address"} | HTTP 200 | PASS | #384 misspelled street, typed city |
| `1437 Bannock St, Denver` | none | {"lat":39.739247,"lng":-104.99097,"placeType":"address"} | HTTP 200 | PASS | #384 full match, no state typed |
| `1437 Bannock St, Denver, CO` | none | {"lat":39.739247,"lng":-104.99097,"placeType":"address"} | HTTP 200 | PASS | #352 / #384 boxed, same answer |
| `US 287 & Dillon Rd, Lafayette, CO` | none | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 unchanged |
| `US 287 & Dillon Rd, Lafayette` | cdot | {"lat":39.957998,"lng":-105.090397,"placeType":"intersection"} | HTTP 200 | PASS | #376 unchanged |
| `Colfax & Main, Aurora, IL` | none | outside colorado | HTTP 422 | PASS | #376 unchanged |
| `Colfax & Williams` | denver | {"lat":39.739964,"lng":-104.966006,"placeType":"intersection"} | HTTP 200 | PASS | #352 unchanged |

**16/16 PASS.**
- The three issue searches answer 404 `check address`, which the search bar shows as "No match in Colorado for that address. Check the spelling." (R1). Before the fix they answered Darlington, Wisconsin; Lafayette, Indiana; and Aurora, Indiana.
- Another state named answers 422 `outside colorado` ("Plans cover Colorado roads only."), including the two R2 cases that Mapbox fully matches inside the Colorado box.
- Colorado addresses answer the same points as the branch's live run (`../live-run.txt`), and the cross-street rows answer as on `a0e59c5`.
