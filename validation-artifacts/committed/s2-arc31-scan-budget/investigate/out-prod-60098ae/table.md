# s2-arc31 — prod distribution, 80 served audits

!!  TWO COLUMNS THAT DO NOT MEAN WHAT THEY LOOK LIKE  !!
!!
!!  residual_ms = wall_ms - duration_ms.  On a memo HIT, duration_ms is
!!  the STORED original fetch's duration, not this request's, so the
!!  subtraction is meaningless and can go negative (it did: -557 ms on
!!  c5 denver warm).  Residual is therefore reported ONLY over
!!  memo_hit == false rows, where it really is "everything the request
!!  did except the site scan" — layout plus the corridor bearing check.
!!
!!  A "warm" row with memo_hit == false is NOT a broken memo.  The memo
!!  is per container (site_scan.py:71-76) against max_containers=8
!!  (modal_app.py:132) with no declared concurrency, so the second
!!  request simply landed on another container.  That count is reported
!!  as a fan-out measurement under its own heading.

## denver / cold
- served: 20   refused (HTTP 400, scan budget): 7/20 (35 %)
- wall ms, all rows:      n=20 min=4796 p25=16696 median=20746 p75=23768 p90=26704 max=38779
- scan duration_ms, ok:   n=13 min=1843 p25=3143 median=4283 p75=10354 p90=14356 max=18089
- residual ms (memo MISS rows only — layout + corridor check): n=13 min=1371 p25=2693 median=20625 p75=20715 p90=21649 max=26834
- memo hits among ok rows: 0/13 (0 %)
- corridor check on ok rows: {'not-checked/check_unavailable': 7, 'checked': 6}
- corridor check_unavailable: 7/13 (54 %)

## denver / warm
- served: 20   refused (HTTP 400, scan budget): 3/20 (15 %)
- wall ms, all rows:      n=20 min=969 p25=4566 median=13006 p75=20690 p90=23348 max=25852
- scan duration_ms, ok:   n=17 min=1843 p25=2876 median=4250 p75=6713 p90=11641 max=18089
- residual ms (memo MISS rows only — layout + corridor check): n=7 min=862 p25=8754 median=20547 p75=20599 p90=20610 max=20617
- memo hits among ok rows: 10/17 (59 %)   <- on the 'warm' leg this is the container fan-out measurement
- corridor check on ok rows: {'not-checked/check_unavailable': 6, 'checked': 11}
- corridor check_unavailable: 6/17 (35 %)

## lakewood / cold
- served: 20   refused (HTTP 400, scan budget): 10/20 (50 %)
- wall ms, all rows:      n=20 min=5163 p25=7506 median=20486 p75=20560 p90=20601 max=25467
- scan duration_ms, ok:   n=10 min=1879 p25=2120 median=3242 p75=4754 p90=5363 max=8246
- residual ms (memo MISS rows only — layout + corridor check): n=10 min=1183 p25=2004 median=4106 p75=5414 p90=9414 max=20713
- memo hits among ok rows: 0/10 (0 %)
- corridor check on ok rows: {'checked': 6, 'not-checked/check_unavailable': 4}
- corridor check_unavailable: 4/10 (40 %)

## lakewood / warm
- served: 20   refused (HTTP 400, scan budget): 7/20 (35 %)
- wall ms, all rows:      n=20 min=1319 p25=9708 median=18540 p75=20694 p90=23416 max=24626
- scan duration_ms, ok:   n=13 min=1879 p25=2262 median=2774 p75=4025 p90=5363 max=8246
- residual ms (memo MISS rows only — layout + corridor check): n=4 min=20497 p25=20550 median=20576 p75=20601 p90=20642 max=20642
- memo hits among ok rows: 9/13 (69 %)   <- on the 'warm' leg this is the container fan-out measurement
- corridor check on ok rows: {'checked': 2, 'not-checked/check_unavailable': 11}
- corridor check_unavailable: 11/13 (85 %)

## the acceptance bars in #256, against these rows
- denver: refusals on cold runs 7/20 (35 %) — bar is <= 1 in 20
- denver: corridor check_unavailable on ok audits 13/30 (43 %) — bar is <= 1 in 20
- lakewood: refusals on cold runs 10/20 (50 %) — bar is <= 1 in 20
- lakewood: corridor check_unavailable on ok audits 15/23 (65 %) — bar is <= 1 in 20

## which server answered, and what it said
- mirror recorded: {'https://overpass-api.de/api/interpreter': 80}
- overpass remarks (#251: a remark is a mirror failure, never ok): none in this run
- response_bytes seen: {'79284': 30, '695': 25, '46404': 23, '703': 2}
  (695 B is overpass-api.de's 504 Gateway Timeout page — identified this arc by
   catching it with an HTTP-status-aware probe; arc 22 recorded the size but not
   the cause, s2-arc22-scan-honesty/README.md:120.)
