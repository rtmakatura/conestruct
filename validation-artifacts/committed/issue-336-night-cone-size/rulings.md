# #336 rulings

Self-ruled under R145. Every ruling below traces to a source that has been checked, or keeps existing behavior. None is a reversal.

**Source.** CDOT S-630-1 (July 01, 2026), Sheet 2, General Note 15. The text was checked against the committed extract `validation-artifacts/committed/issue-323-left-lane/sources/s630-1-pdf150.txt:117-119`:
> 15. Traffic cones shall be at least 28 inches in height. However, the minimum size shall be 36 inches when they are used on freeways and expressways, or during nighttime working hours. They should also be 36 inches when used on other high speed roadways (45 mph or more) with an ADT of 6,000 or more.

## S1 (R145 self-ruled): when a cone is 36-inch
A cone is 36-inch when any one of these holds:
- `road_type` is `freeway` or `expressway` (Note 15, "shall");
- `is_night` is set ("during nighttime working hours", "shall");
- `speed_mph >= 45` (today's rule, kept; see S2).

Otherwise it's 28-inch ("at least 28 inches").

## S2 (R145 self-ruled): the 45 mph clause stays as it is
- Note 15's high-speed clause is a "should", and it applies only with an ADT of 6,000 or more.
- The tool doesn't collect ADT. Today's code already treats 45 mph and over as 36-inch whatever the ADT. That's the conservative reading, and keeping it isn't a reversal.
- An ADT input would be new scope. It isn't filed.

## S3 (R145 self-ruled): one producer, and every input is required
- `cone_display_name(speed_mph, *, is_night, road_type)` stays the one producer (Rule 3).
- The new arguments are keyword-only and have no default, so no call site can quietly keep the speed-only rule (Rule 10).
- All six surfaces pass `params.is_night` and `params.road_type`.

## S4 (R145 self-ruled): the citation
- "MUTCD §6F.65" is a 2009-edition section number (Rule 9). It's dropped from the helper's docstring and from the comments at the call sites.
- Note 15 is cited in its place.

## S5 (R145 self-ruled): the quote's price doesn't move
- Both cone sizes fall under one pay item, 630-80380 "Traffic Cone" (`devices.py` catalog).
- The quote's rate is keyed by device type, not by size: `EQUIPMENT_DAILY_RATES[DeviceType.CONE]` (`quote_generator.py:39`).
- So the issue's "prices the wrong item" shows up in the quote only as the item's description. The description changes; the price doesn't.
