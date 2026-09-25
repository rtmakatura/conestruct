"""Single-leaf proof sketch: translate the Lakewood pin forward and show the
'work_start' corridor equals the recorded 'first_sign'-era corridor.

new_pin = old_pin moved along bearing by (downstream_taper + work_zone);
the simulated new build_corridor moves its anchor back by the same amount.
"""
import sys

sys.path.insert(0, ".")
import src.rules.corridor as C  # noqa: E402

kw = dict(bearing_deg=180.0, speed_mph=45, work_zone_ft=1000.0, closure_type="shoulder",
          road_type="urban_high", lane_width_ft=12.0, shoulder_width_ft=10.0)
old = C.build_corridor(lat=39.7113, lng=-105.0815, **kw)
d_ft = old.downstream_taper_ft + old.work_zone_ft
new_pin = C._destination_point(39.7113, -105.0815, 180.0, d_ft * C.M_PER_FT)
back = C._destination_point(*new_pin, 0.0, d_ft * C.M_PER_FT)
print("shift_ft", d_ft, "adv+taper+buf", old.advance_warning_ft + old.taper_ft + old.buffer_ft,
      "total", old.total_length_ft)
print("new_pin", new_pin)
print("recovered anchor", back, "delta_deg", back[0] - 39.7113, back[1] + 105.0815)
print("old bbox", old.corridor_bbox(lateral_buffer_m=30.0))
