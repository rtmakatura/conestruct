import sys
from pathlib import Path
p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:80]
    s = s.replace(old, new)

# (a)+(b) layout tiers
rep('''    total = schedule_rows + advance_rows
    if total <= 8:''', '''    # Vertical rhythm (R116 prototype): section_header draws its title
    # 4 pt below the cursor and drops section_header_pad[1], so the
    # title-to-next-baseline gap is pad[1] - 4; 12 keeps it at 8 pt in
    # every tier.  footer_pads[1] is the pitch of the 6.5 pt bold footer
    # lines: never below 7 pt.  Two columns only when the advance table
    # itself is long (> 6 rows); a short table split in two only doubles
    # its column headers.
    total = schedule_rows + advance_rows
    if total <= 8:''')
rep('''        return _NotesLayout(
            row_pitch=9.0,
            section_header_pad=(3.0, 10.0),
            col_header_pad=(3.0, 7.0),
            footer_pads=(3.0, 6.0),
            param_pitch=9.0,
            two_col_advance=False,
        )
    return _NotesLayout(
        row_pitch=8.0,
        section_header_pad=(3.0, 10.0),
        col_header_pad=(3.0, 7.0),
        footer_pads=(3.0, 6.0),
        param_pitch=9.0,
        two_col_advance=True,
    )''', '''        return _NotesLayout(
            row_pitch=9.0,
            section_header_pad=(3.0, 12.0),
            col_header_pad=(3.0, 7.0),
            footer_pads=(3.0, 7.0),
            param_pitch=9.0,
            two_col_advance=False,
        )
    return _NotesLayout(
        row_pitch=8.0,
        section_header_pad=(3.0, 12.0),
        col_header_pad=(3.0, 7.0),
        footer_pads=(3.0, 7.0),
        param_pitch=9.0,
        two_col_advance=advance_rows > 6,
    )''')

# (b) tier from list rows only
rep('''    # near_intersection adds the Cases 18/19 citation note (a bold line
    # + three fine-print disclosures) beneath the Reference footer —
    # count those lines into the tier budget so the box tightens its
    # padding instead of overflowing.  Zero for every other kind.
    # Lane-closure plans with a lane CHOICE also add the #176
    # rightmost-lane assumption note (2 wrapped lines); the predicate is
    # single-sourced in ``rightmost_lane_assumption_active`` (layout.py)
    # so the note fires everywhere the assumption operates.
    rightmost_lane_note''', '''    # Lane-closure plans with a lane CHOICE add the #176 rightmost-lane
    # assumption note; the predicate is single-sourced in
    # ``rightmost_lane_assumption_active`` (layout.py) so the note fires
    # everywhere the assumption operates.  The fixed-obligation notes
    # below are not list rows: the tier is picked from list rows only,
    # and the fit loop makes room for the fixed text by cutting rows.
    rightmost_lane_note''')
rep('''    extra_note_lines = (
        (5 if params.near_intersection else 0)
        + (2 if rightmost_lane_note else 0)
        + (2 if scan_disclosure else 0)
        + (2 if corrections_line else 0)
    )
    layout = _notes_layout(len(schedule_order or []), len(advance) + extra_note_lines)''',
'''    layout = _notes_layout(len(schedule_order or []), len(advance))''')

# (c) never draw an empty table
rep('''        section_header(advance_section_title)
        capped_advance = advance[:advance_cap]''', '''        if advance and advance_cap == 0:
            # Every advance row was cut: one honest line names the count,
            # the codes and where the series lives, in place of the
            # section title + column headers over an empty table (rule 10).
            y[0] -= layout.section_header_pad[0]
            cv.setStrokeColor(colors.HexColor("#888888"))
            cv.setLineWidth(0.4)
            cv.line(
                x, y[0] + layout.section_header_pad[0], x_right, y[0] + layout.section_header_pad[0]
            )
            codes = list(dict.fromkeys(code for code, _d, _s in advance if code and code != "—"))
            noun = "ADVANCE SIGN" if len(advance) == 1 else "ADVANCE SIGNS"
            line_text = (
                f"{len(advance)} {noun} OFF-PAGE ({', '.join(codes)}). "
                "SEE CREW NARRATIVE & DEVICE LIST"
            )
            cv.setFillColor(colors.black)
            cv.setFont("Helvetica-Bold", 7)
            y[0] -= 4
            for line in _wrap_to_width(
                cv, line_text, "Helvetica-Bold", 7, x_right - x, max_lines=3
            ):
                cv.drawString(x, y[0], line)
                y[0] -= layout.row_pitch
            return _finish(cv, y)
        section_header(advance_section_title)
        capped_advance = advance[:advance_cap]''')
rep('''            y[0] -= layout.row_pitch

        y[0] -= layout.footer_pads[0]
        cv.setFont("Helvetica-Oblique", 6.5)''', '''            y[0] -= layout.row_pitch
        return _finish(cv, y)

    def _finish(cv: canvas.Canvas, y: list[float]) -> float:
        y[0] -= layout.footer_pads[0]
        cv.setFont("Helvetica-Oblique", 6.5)''')

# (d) fold NI fine print into the bold line
rep('''        if params.near_intersection:
            # Option C citation note (Refs #117): the sheet cites the plate
            # instead of drawing the cross street — with the plate-vs-tool
            # deltas in fine print (the #103 disclosure posture).  Lines
            # wrap to the box width via the shared _wrap_to_width helper.
            note_w = width - 16.0
            for line in _wrap_to_width(
                cv,
                (
                    "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES "
                    "18/19: NOT DRAWN. SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT."
                ),''', '''        if params.near_intersection:
            # Option C citation note (Refs #117): the sheet cites the plate
            # instead of drawing the cross street.  The plate-vs-tool
            # departures (the #103 disclosure posture) are pointed to, not
            # printed: the audit's case narrative carries all three.  Lines
            # wrap to the box width via the shared _wrap_to_width helper.
            note_w = width - 16.0
            for line in _wrap_to_width(
                cv,
                (
                    "CROSS-STREET CONTROL PER CDOT S-630-1 SHEET 10, CASES "
                    "18/19: NOT DRAWN. PLATE DEPARTURES: SEE AUDIT. SEE DEVICE "
                    "LIST, CREW NARRATIVE, AND AUDIT."
                ),''')
rep('''                cv.drawString(x, y[0], line)
            cv.setFont("Helvetica-Oblique", 6)
            cv.setFillColor(colors.HexColor("#666666"))
            for fine_print in (
                (
                    "Plate typifies corner-quadrant work with a cross-street "
                    "closure train; this plan places advance sets only (corner "
                    "work tracked at issue #128)."
                ),
                # #309 R114 Q5: the audit's departure (2), the same way.
                (
                    "A one-way street has no opposing mainline direction; the "
                    "plate's opposing-direction signing does not apply."
                    if params.one_way_street
                    else "Opposing mainline direction not signed (undivided "
                    "single-side convention; the plate signs both directions)."
                ),
                (
                    "Plate typifies rural sign placement; urban applications "
                    "require block-based placement (Sheet 10 Note 1)."
                ),
            ):
                # max_lines=3: the 4-box footer's narrower width (spec §4,
                # issue #150) wraps these onto a third line — allowed, so no
                # citation text is ever ellipsis-truncated.
                for line in _wrap_to_width(
                    cv, fine_print, "Helvetica-Oblique", 6, note_w, max_lines=3
                ):
                    y[0] -= layout.footer_pads[1]
                    cv.drawString(x, y[0], line)
        if rightmost_lane_note:''', '''                cv.drawString(x, y[0], line)
        if rightmost_lane_note:''')

# (c) two-column cuts two rows at a time
rep('''        if advance_cap > 0:
            advance_cap -= 1
        else:''', '''        if advance_cap > 0:
            # A two-column cut frees a row pitch only in pairs.
            advance_cap = max(0, advance_cap - (2 if layout.two_col_advance else 1))
        else:''')
p.write_text(s, encoding="utf-8", newline="")
print("patched")
