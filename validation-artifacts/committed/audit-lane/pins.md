# #370 lane-closure audit pins — production /api/road-bearing + /api/jurisdiction/suggest, 2026-10-22

Raw JSON responses were kept in the session-2 scratchpad, not committed; session 3 re-fetches each pin into `runs/_pins/`. All scan_status = ok. The Loveland row used in matrix.json is W 8th St, per rulings.md R3.
Key: "div" = what the site would classify (fetch.py mirror): trunk/motorway => divided; one-way with twin <= 100 m => divided. Lanes = OSM `lanes` / per direction (`lanes_forward`, else total/2). Juris = /api/jurisdiction/suggest. U/R = road-bearing `isUrban`.

| id | lat, lng | road (way) | class | oneway | div | lanes tot/dir | centre lane | maxspeed | juris | U/R | fit |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P-OGDEN | 39.72650, -104.97525 | Ogden St (338577483) | residential | no | no | 2 / 1 | none | — | denver | U | FIT |
| P-LOUIS | 39.69280, -104.96595 | E Louisiana Ave (231239989), snap 17 m | tertiary | no | no | 2 / 1 | none | 30 | denver | U | FIT |
| P-W9 | 39.73105, -105.10397 | W 9th Ave (487077597) | residential | no | no | untagged / class default 1 | none | — | lakewood | U | FIT* (lanes not tagged) |
| P-LAF | 39.73447, -104.97067 | Lafayette St (579481688) | residential | no | no | 2 / 1 | none | — | denver | U | FIT (35 = operator speed) |
| P-LOOKOUT | 39.73300, -105.24000 | Lookout Mountain Rd CR 68 (1432422179), snap 11 m | tertiary | no | no | 2 / 1 | none | 20 | none (outside_supported) | **U** | FIT* (OSM 20 mph, isUrban true) |
| P-CO119 | 40.00185, -105.41289 | Boulder Canyon Dr CO 119 (328275725) | primary | — | no | 2 / 1 (fwd1/back1) | none | 45 | none | R | FIT |
| P-US24 | 39.02175, -105.79286 | US 24 (17122234) | **trunk** | — | **yes (by class)** | 2 / 1 | none | — | none | R | FIT* (trunk reads divided) |
| P-US285 | 39.26455, -105.95722 | US 285 (202321013), N of Fairplay | **trunk** | — | **yes (by class)** | 2 / 1 | none | 55 | none | R | FIT* (trunk reads divided) |
| P-EPC | 39.08849, -104.69514 | Black Forest Rd (7683615), snap 14 m | tertiary | no | no | 2 / 1 | none | 45 | none — El Paso County in reason text | R | FIT (juris must be operator-picked) |
| P-LOVE | 40.41992, -105.07292 | N Lincoln Ave (935452388) | tertiary | — | no | 2 / 1 | none | 30 | none — Larimer County | U (place "Browns Corner") | FIT (juris operator-picked); alt 40.39999,-105.08671 W 8th St, place "Loveland", no maxspeed |
| P-CTL | 39.77290, -104.94783 | E 40th Ave (440279205) | tertiary | no | no | 3 / fwd1 back1 | `lanes_both_ways: "1"` (OSM turn:lanes:both_ways=left; road-bearing tags lack that key) | 35 | denver | U | FIT; alt E Smith Rd 39.77616,-104.93706 same tags |
| P-COLFAX-RACE | 39.73997, -104.96632 | E Colfax Ave (600545936) | primary | **yes** | **yes** (twin 11.8 m) | 2 per carriageway | — | 30 | denver | U | **NO FIT** |
| P-BWAY-11 | 39.73370, -104.98753 | N Broadway (131232822), snap 11 m, signal 16 m | primary | yes | no (twin searched, none) | 5 / 5 | turn_lanes `\|\|\|\|right` | 30 | denver | U | FIT |
| P-ART40 | 39.66100, -104.94070 | S Colorado Blvd CO 2 (628694074), signal 25 m | primary | no | no | 6 / 3 (total/2) | none | 40 | denver | U | FIT |
| P-WCOLFAX | 39.74016, -105.13048 | W Colfax Ave (44453684) | primary | no | no | 6 / 3 (total/2) | none | **45** | lakewood | U | FIT* (45, not 35) |
| P-SIG45 | 39.79090, -105.05325 | Sheridan Blvd CO 95 (39994971), signal 17 m (W 52nd) | primary | no | no | 4 / 2 | none | 45 | denver (near_boundary, 217 ft) | U | FIT |
| P-N14 | 38.36191, -105.10715 | S Robinson Ave CO 67 (1110105498), Florence | primary | — | no | 4 / 2 (fwd2/back2) | none | 55 | none | R | FIT (rural) |
| P-DIVIDED | 39.70900, -104.94070 | S Colorado Blvd CO 2 (16991616) | primary | yes | yes (twin 14.8 m) | 3 / 3 | — | 35 | denver (near_boundary) | U | FIT |
| P-SINGLE | 39.878635, -105.530885 | Gamble Gulch Rd CR 15N (17055665), Gilpin | unclassified | no | no | 1 / 1 | — | — | none | R | FIT; alt Fox Hollow Rd 39.655875,-105.13401 (Lakewood, lanes 1, U) |

Notes
- /api/jurisdiction/suggest never names El Paso County or Loveland (returns null, "outside_supported", county in the reason). Those jurisdictions must be operator-selected.
- E Colfax in Denver is mapped as split one-way carriageways along its length (Race, Ogden, Cherry, 2200 block all twin 9–13 m) → reads divided. Undivided Colfax alternative in Denver: W Colfax 39.74035,-105.04014 (way 476332944, 5 lanes 2/2 + both_ways 1, 30 mph, denver, no signal in range).
- W Colfax in Lakewood at 35 mph is all split carriageways in OSM; the only undivided Lakewood stretch (Simms–Union area) is posted 45.
- Owens St lanes=1 (39.74019,-105.1201) is the median crossover between Colfax carriageways — rejected for P-SINGLE.
- Other N14 tries: CO 7 E 160th Ave 39.98690,-104.83829 (50 mph, 2/2, isUrban true); CR 49 40.37098,-104.60209 (65 mph, 4 lanes, rural); CO 115 38.38688,-105.07422 (40 mph, 2/2, rural).
- **Session 4 (2026-10-22): N14 uses Ryan's fallback, CO 2 in Commerce City** (rulings R6). Cross-street search "CO 2 & E 104th Ave, Commerce City, Colorado" → intersection 39.885314, -104.847744; "Highway 2" (way 326641944 at the work start) reads primary, two-way, 6 lanes at the intersection, 55 mph, isUrban true, no jurisdiction on record. Matrix pin `CO2`. Rejected on the way: US 287 at CO 56 Berthoud (two-way but 65 mph), at Arapahoe Rd and Isabelle Rd (60 mph), at Dillon Rd and Baseline Rd (split carriageways); US 85 at CO 52 and CO 83 at Hess Rd (split carriageways); Marksheffel Rd and Tower Rd (split carriageways or 45 mph). The search "US 287 & Dillon Rd, Lafayette, CO" with no jurisdiction answered Lafayette, California (37.89, -122.12); "…, Lafayette" with no state answered Lafayette, Louisiana; "…, Lafayette, Colorado" found the intersection.
