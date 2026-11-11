# #517 string table (ruling 9: "Every new string is listed with its source")

Draft from brief A. Each string's file: `conestruct/site/lib/scenarios/why-lines.ts`, unless § Producers below names another file for it (#521: the round-2 line here said one producer for all, which was not true). `<n>`, `<name>`, `<tag>` and the like are filled from data; the "Source" column says which.

Checked against docs/style.md's unslop rules (no em dashes, no corrective antithesis, none of the listed words).

## New strings

| String | Where | Source |
|---|---|---|
| What's the job? | band question | ruling 1 (verbatim) |
| We filled this in from the road you confirmed. Check our <n> guesses, then tell us about the work. (n=1: "guess") | intro line | ruling 1 (verbatim); <n> = rows in the box (S1) |
| We filled this in from the road you confirmed. | intro, no box | ruling 1 ("drops its second clause") |
| We filled in what we could from your pin. Check our <n> guesses, then tell us about the work. | intro, no confirmed road but a pin guess (jurisdiction) | brief A call: ruling 1's first clause would be false with no confirmed road (Rule 10) |
| No confirmed road at this pin, so nothing was prefilled. Set what the plan needs. | intro, no road, no guess | kept from today (WhatBand questionProvenance) |
| Check these <n> guesses / Check this guess | box heading | ruling 1 ("Check these <n> guesses"); singular is brief A's call |
| Based on the road's map tag and the built-up area around it | road type reason | ruling 2; record `guesses.road_type` (`highwayClass`, `urban` true) |
| Based on the road's map tag and the open country around it | road type reason | ruling 2; `guesses.road_type.urban` false |
| Based on the road's map tag | street class reason | ruling 2 (example); record `guesses.street_class` |
| Based on where your pin is | jurisdiction reason | ruling 2 (example); record `guesses.jurisdiction_key` (the pin) |
| Based on the road's map tag. The map has no posted speed here. | speed reason | ruling 2; record `guesses.speed` (R126: no readable posted speed) |
| Our guess | any reason with no record to state | ruling 2 / Rule 10 |
| Measured from the map (✓) | source line | ruling 5 (verbatim) |
| Our guess. Check it. (⚠) | source line | ruling 5 (verbatim) |
| Default | source line | ruling 5 (verbatim) |
| Not set yet | source line | ruling 5 (verbatim) |
| Set by you | source line | S4 |
| Checked (✓) | source line / reason line after a check | ruling 3, S4 |
| (why: <label>) | source button, screen-reader only | brief A (names which field's why) |
| About the work | section heading | ruling 1 (verbatim) |
| Type of work | row label (was "Work type") | ruling 1 |
| Work hours | row label (was "Hours") | ruling 1 |
| Measured from the map | row title | ruling 1 |
| <n> mph · <n> lanes each way · <n> ft lanes · Divided/Undivided/One-way · <road type> · <Class> street · <jurisdiction> | measured row's line (**superseded in round 3** by "Not from the map" below: the first line lists only measured values) | ruling 1 (example "30 mph · 2 lanes each way · 12 ft lanes · Divided"); values from the scenario; road type / class / jurisdiction only when not in the box (S3) |
| Speed not set / Street class not set / Carriageway not set / No jurisdiction | measured row's line, unset values | Rule 10 |
| Change / Done | measured row's button | ruling 1 ("Change"); "Done" brief A's call |
| <Label>: <error or alert> / <Label>: Not set yet. / <Label>: Check it. (⚠) | measured row, closed | S5 |
| File details (optional) | row title | ruling 1 (verbatim) |
| Project name and location description. They print on the plan's title block. <n> not set. | file details line | ruling 1 (verbatim); <n> from meta.project / meta.locationDescription; n=0 drops the last sentence |
| Show / Hide | file details button | ruling 1 ("Show"); "Hide" brief A's call |
| Pick start and end dates | date button, unset | ruling 7 (verbatim) |
| Mon Nov 16 / Mon Nov 16 to Fri Nov 20 | date button, set | ruling 7 (format); dates from schedule.work_date / work_date_end |
| Optional. We check them against <name>'s work hours. | under unset dates | ruling 7 (verbatim); <name> = jurisdictionBlock.name, else the picked option's label |
| Optional. Pick a jurisdiction to check them against its work hours. | under unset dates, no jurisdiction | S9 |
| <name>'s work hours: <glyph> <text> | under set dates | ruling 7; glyph + text verbatim from `windowsSummary` (ScheduleField.tsx), only the frame is new |
| Work hours: <glyph> <text> | the same, no jurisdiction name | ruling 7 frame, Rule 10 |
| See all of <name>'s work hours | link under the hours result | ruling 7 (verbatim) |
| <Month> <year>, Previous month, Next month, Su Mo Tu We Th Fr Sa, <Weekday>, <Month> <d>, <yyyy>, Clear | date picker (DateRangePicker.tsx) | S8 |
| Pick the first day. / Pick the last day, or the same day again for one day. | date picker hint | S8 |
| Not set | listbox placeholder; start/end time clearing option (was "—") | ruling 6; #199's display-only default |
| Local time. | under start time (ScheduleField.tsx) | was "operator-set · local time" |
| An end before the start runs past midnight. | under end time (ScheduleField.tsx) | was "crosses midnight when it is earlier than the start" (#188) |
| residential street, main road, secondary road, smaller through road, minor road, freeway, major highway, living street, service road, <base> ramp, else the tag with `_` read as a space | map-tag words in tips | brief A's tag word map (`tagWords`) |

## Why tips (first line = the plain-words reason)

| Field / state | Tip | Basis |
|---|---|---|
| Speed, measured | The road's map record says the posted speed is <n> mph. If the sign on site says otherwise, change it here. | ruling 5's example; detection row `Speed limit`, token measured |
| Speed, guess | The map has no posted speed for this road, so we used the usual speed for a <tag words>: <n> mph. Check the sign on site. | `guesses.speed`, `speedEstimateForClass` |
| Speed, unset | The map has no posted speed for this road and its type gives no estimate. Pick the posted speed. / No confirmed road, so no speed came from the map. Pick the posted speed. | `speedSet` false |
| Speed, yours | You set this speed. | operator-set |
| Lanes, measured | The road's map record says <n> lanes each way. If the road on site differs, change it here. | lanes row, measured |
| Lanes, estimate | The map has no lane count for this road, so <n> each way is the usual count for its type. Check it on site. | classifier `highway-class fallback` (method inferred) |
| Lanes, carried (#418) | This count came from an earlier road. Set the real count for this one. | was "not confirmed · set the real count · from an earlier road" |
| Lanes, default | The plan's starting count. The map has no count here, so set the real count. / The plan's starting count. Set the real count. | was "default · the map has no count here; set the real count" / "default · set the real count" |
| Lanes, near intersection doubt (#420) | The map reads <n> each way, but turn lanes can inflate counts near an intersection. / The map reads <n> each way. | was "not confirmed · the map reads <n> per side, but turn lanes …" |
| Lanes, fixed kind (#209) | This plan kind always uses this count. <reason without its mid-dot prefix> | WHAT_CELLS lanesReason |
| Lane width | The plan's standard lane. The map doesn't measure lane width, so check it on site. / You set this lane width. | was "default · the plan's standard lane; detection doesn't measure width" |
| Road type, guess | We read the road's map tag (<tag words>) and the built-up area / open country around your pin. | `guesses.road_type` |
| Road type, measured | The road's map tag (<tag words>) sets this road type. | road type row, measured |
| Road type, default / yours | The plan's starting road type. / You set this road type. | |
| Any detection, generic | The road's map record says <v>. / The map's <v> is an estimate. Check it on site. / The map gives <v>, with no note of where it came from. (+ The plan uses <v>, the nearest value it offers. / You changed it to <v>.) / You changed it, so the plan no longer uses the map's value. / You changed it. The map's <v> stays on the plan's record. | provenance.ts tokens measured / inferred / no source tag / changed in plan / operator-set / withdrawn / overridden |
| One-way / Divided line | One-way: <yes/no>. <detection words> / Divided: <yes/no>. <detection words> (round 1: never "Divided: Divided."; the Divided line is dropped when the Carriageway field or the Divided toggle carries the fact) | was "One-way Yes · OSM · Yes · measured" |
| Carriageway (#308) | You answered this. / The map shows a road with the same name <d> m away, so we read it as divided. / The map shows no road with the same name within 100 m, so we read it as one-way. / The map couldn't tell whether the other direction runs on a separate road. (+ alert "The map couldn't tell. Pick one.") | `carriagewayVerdict`, TWIN_RADIUS_M (backend mirror) |
| Divided toggle | Undivided until you say otherwise. / You set this. | was "default · undivided until you say otherwise" |
| Street class | We matched the road's map tag (<tag words>) to a street class. / You set this street class. / Pick the street class. The work-hour rules can depend on it. | was "guessed, not confirmed · OSM highway=<tag> · from the road" |
| Street class evidence (JurisdictionSection.tsx) | The road's map tag: <tag words>. / … The map tag is only a stand-in; the adopted map governs. | was "detected road tier: OSM <tag>" / "The road tier is a proxy; the adopted map governs." |
| Jurisdiction | We looked up which boundary your pin falls in. / You picked this jurisdiction. / No jurisdiction yet, so the plan follows the MUTCD and the Colorado Supplement only. / Checking which boundary your pin falls in. | was "guessed, not confirmed · from the pin" / "MUTCD + Colorado Supplement only" / "checking the pin's boundary data" |
| Jurisdiction status | <name> calls this plan a <tcp_term>. / Checked as <name>. / Checking the jurisdiction for this plan. / Not checked: the plan was declined. The option shown stands. / The check didn't answer. The option shown stands. | was "evaluated · <authority> · calls this plan a <tcp_term>" / "evaluated as <name>" / "evaluating: …" / "not checked: …" / "check failed: …" |
| Type of work | This plan kind's usual job. Change it if the job differs. / You set the type of work. | was "default · this kind's usual job; change it if the job differs" |
| Work hours | Daytime. Night work adds retroreflective devices. / You set the work hours. | was "default · daytime; night work adds retroreflective devices" |
| Speed reduction | No lower limit through the work zone. / You set the speed reduction. | was "default · no lower limit through the zone" |
| Work-zone speed limit | <d> mph below the posted speed. S-630-1 Sheet 2 Note 3: 1 advance sign. / … <k> stepped sign installations. | was "Δ<d> mph · S-630-1 Sheet 2 Note 3: …" (citation kept verbatim) |
| Work dates | You set one day. / You set a range of days. + The work-hour check and permit lead times read these dates. / The work-hour check and permit lead times need a date. | was "operator-set · one day · permit lead times read this" etc. |
| Project name | Names the file and prints on the plan's title block. | was "operator-set · names the file and the title block" |
| Location description | Prints in the title block's location row. / Optional. When it is empty, the address prints in the title block instead. | was "operator-set · the title block's LOCATION row" / "optional · the address stands in when this is empty" |

## Old strings retired (jargon → new)

| Old | New |
|---|---|
| WHAT header "<n> guesses marked ⚠ · change any that are wrong" / "prefilled from the road" / "nothing detected; set what the plan needs" | (no header line; the count moves to the intro line) |
| Anything we got wrong? | What's the job? |
| Everything here came off the road you confirmed. Change what is wrong; ignore what is right. | the intro line above |
| The road / The job (column heads) | the box, "About the work", "Measured from the map" |
| ✓ measured · ⚠ from the road · ⚠ from the pin · ✓ yours · default · ◌ not set · ✓ evaluated · ◌ evaluating · ◌ checking · ◌ not checked · ◌ check failed · i about | the six source words above |
| OSM · <v> · measured / inferred / overridden … | the detection words above |
| Denver windows · set dates to check (footer) | removed (ruling 7); hours result under the dates |
| File details · ◌ 2 not set · OPEN › / close ‹ | File details (optional) row, Show / Hide |
| withdrawn · you changed the count, so the plan no longer uses the map's | You changed it, so the plan no longer uses the map's value. |
| Lane width · <line> | (round 1) Lane width is its own row: source line "Default" / "Set by you", tip as above |

## Kept byte-identical

- #198's handoff sentences (`handoffNotesByCell`), now in the why tip of the field they describe, glyph in its own node.
- The jurisdiction lookup's own output: `JurisdictionWarnings` (on show under the control) and `JurisdictionEvidence` (in the tip).
- `windowsSummary`'s glyph and text, and #227's windows table rows (`ScheduleWindows`). Its heading is not kept: S21 changed "<NAME> WINDOWS" to "<Name>'s work hours" (see § Fold-in S21).
- The jurisdiction option labels, "Not set: MUTCD + CDOT only", the road type / work type / lane / width option labels.

## Fold-in S21 (item lead)
| Old | New | Source |
|---|---|---|
| `<NAME> WINDOWS` (windows table heading, ScheduleField.tsx) | `<Name>'s work hours` | ruling 1 (no caps labels); name = `jurisdiction.name` from the backend block |

## Round 1 repairs (item lead)
| String | Where | Source |
|---|---|---|
| About the road | the road-values row's title when no road is confirmed (`detected === null`) | S22; Rule 10 (nothing there was measured) |
| Default / Set by you (Lane width's own source line) | the new Lane width row | ruling 5's words; S4; `laneWidthWhy` |
| Divided: yes. / Divided: no. | road type tip's detection line | replaces "Divided: Divided." / "Divided: Undivided." |
| <label>: Check it. (for a road-type detection line wanting a check) | measured row, closed | S5 |

## Producers (#521, round 3)

Every string in this table is made in `conestruct/site/lib/scenarios/why-lines.ts` except these, each made in the file named:

| File | Strings |
|---|---|
| `components/bands/WhatBand.tsx` | What's the job?; About the work; Measured from the map and About the road (the row titles); File details (optional); Speed not set; Street class not set; Carriageway not set; No jurisdiction; Change / Done; Show / Hide; <n> lanes each way, and <n> lanes on a one-way road; Divided / Undivided / One-way; <n> mph; <n> ft lanes; the closed row's "<Label>: <detail>" check lines; the labels Speed, Lanes, Lane width, Road type, Jurisdiction, Work dates, Project name, Location description |
| `components/bands/PlanDetails.tsx` | Type of work; Work hours; Speed reduction; Work-zone speed limit; the Street class, Carriageway and Divided labels |
| `components/ScheduleField.tsx` | Start time; End time; Not set (the times' clearing option); Local time.; An end before the start runs past midnight.; <Name>'s work hours (#227's table heading, S21) |
| `components/ui/Listbox.tsx` | Not set (the button's placeholder while no value is picked) |
| `components/ui/DateRangePicker.tsx` | Previous month; Next month; the month heading; the day initials; Pick the first day.; Pick the last day, or the same day again for one day. |
| `components/bands/FieldCell.tsx` | (why: <label>) (screen-reader only, on every source button) |
| `components/JurisdictionSection.tsx` | the street class evidence (S20, reworded: "The road's map tag: <words>."); `JurisdictionEvidence` and `JurisdictionWarnings` byte-identical |
| `components/HandoffNotes.tsx` | #198's handoff sentences, byte-identical |

## New in round 3 (#520, #521)

| String | Where | Source | File |
|---|---|---|---|
| Not from the map: <values> | measured row, closed, second line: the values whose source is not "Measured from the map" | #521, Rule 10; R145 S25 | why-lines.ts (`notFromMap`) |
| <n> lanes / 1 lane (no "each way") | measured row line and the Lanes tip, when the carriageway reads one-way | #521 | WhatBand.tsx; why-lines.ts (`lanesWhy`) |
| The map reads <n> lanes. / so <n> lanes is the usual count … / says <n> lanes. | Lanes tips on a one-way road (the two-way wording is byte-identical) | #521 | why-lines.ts (`lanesWhy`) |
| Set by you / Not set yet | Start time and End time source lines | ruling 5, S4; #521 (R145 S26) | why-lines.ts (`timeWhy`) via FieldCell.tsx |
| You set this start time. / You set this end time. | the times' why tips | S26 | why-lines.ts (`timeWhy`) |
| You have not picked a start time yet. / You have not picked an end time yet. | the times' why tips, unset | S26 | why-lines.ts (`timeWhy`) |
