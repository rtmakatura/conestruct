"""Lane-closure audit, phase 2: score every fetched row against the oracle.

Usage:  python check.py      (reads runs/, writes results.json, runs/*/page1.png, runs/*/plan-text.txt)

Adapted from audit-shoulder/check.py (#370).  Reads only what production
served (plan PDF, device XLSX, quote XLSX, crew .md, audit JSON) and compares
it with oracle.py, whose values are quoted with their pages in
oracle-sources.md (L1-L20).  The one piece of repo code it uses is the page-1
containment measurement (tests/test_pdf_containment.py), which measures text
boxes and computes no traffic-control value.

Checks follow checkpoint.md section 3 (C1-C15); each cites the L item whose
check rule it applies.  Each yields PASS, FLAG or INFO.  Lakewood rows (F5,
N12) score INFO while 02-JURISDICTION-DATA.md is missing (Ryan, 2026-10-22).
L16 is scored on the figures it quotes, not its paraphrase (rulings.md R7).
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import pypdfium2 as pdfium
from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
RUNS = HERE / "runs"
sys.path.insert(0, str(HERE))
import oracle as O  # noqa: E402

PASS, FLAG, INFO = "PASS", "FLAG", "INFO"
SIGN_RX = re.compile(r"^[A-Z]\d+-\d+[A-Za-z]*(\(\w+\))?$")
STATION = r"(-?[\d,]+)"
# C15: the field or reason each refusal row's message must name.
REFUSAL_NAMES = {
    "R1": r"one.?way", "R2": r"single-lane", "R3": r"more lanes|one through lane",
    "R4": r"\bspeed\b", "R5": r"laneWidth|lane width", "R6": r"divided",
    "R7": r"num_lanes|1-lane-per-direction", "R8": r"inside the work zone",
    "R9": r"turn.?bay storage", "R10": r"lane counts",
}
# R1's road (Broadway) also carries five lanes, so a lane-count refusal is true but not the row's reason.
REFUSAL_ALSO_TRUE = {"R1": r"more lanes"}


def num(s: str) -> float:
    return float(s.replace(",", ""))


# --- readers (from audit-shoulder/check.py) ---------------------------------
def pdf_pages(path: Path) -> list[str]:
    doc = pdfium.PdfDocument(str(path))
    try:
        return [doc[i].get_textpage().get_text_range().replace("\r", "") for i in range(len(doc))]
    finally:
        doc.close()


def render_page1(path: Path, out: Path) -> None:
    doc = pdfium.PdfDocument(str(path))
    try:
        doc[0].render(scale=150 / 72).to_pil().convert("RGB").save(out, optimize=True)
    finally:
        doc.close()


def device_key(code: str, desc: str) -> str:
    code = (code or "").strip()
    if code and code != "—" and SIGN_RX.match(code.split()[0]):
        return code.split()[0]
    d = desc.lower()
    first = desc.split()[0] if desc.split() else ""
    if SIGN_RX.match(first):
        return first
    for k, words in (("light_plant", ["light plant", "flood light", "floodlight"]),
                     ("warning_light", ["steady-burn", "warning light"]),
                     ("drum", ["drum"]), ("cone", ["cone"]), ("barricade_iii", ["type iii", "type 3"]),
                     ("barricade_ii", ["type ii ", "type 2"]), ("barricade_i", ["type i ", "type 1"]),
                     ("arrow_board", ["arrow board", "arrow panel"]), ("pcms", ["message sign", "pcms"]),
                     ("afad", ["afad", "automated flagger"]), ("pilot_car", ["pilot"]),
                     ("flagger", ["flagger"]), ("vertical_panel", ["vertical panel"]), ("tubular", ["tubular"]),
                     ("tma", ["attenuator"]), ("beacon", ["beacon"]), ("barrier", ["barrier"])):
        if any(w in d for w in words):
            return k
    return d.strip()


def parse_page1(t: str) -> dict:
    p: dict = {"text": t}
    head, _, rest = t.partition("METHOD OF HANDLING TRAFFIC")
    p["drawing_text"] = head
    for key, rx in (("dim_taper", r"\bL = ([\d,]+) ft"), ("dim_buffer", r"BUFFER = ([\d,]+) ft"),
                    ("dim_work", r"WORK ZONE = ([\d,]+) ft"),
                    ("par_speed", r"Speed limit: (\d+) mph"), ("par_work", r"Work zone: ([\d,]+) ft"),
                    ("par_taper", r"(?:One-lane two-way taper|Lane taper \(L\)): ([\d,]+) ft"),
                    ("par_buffer", r"Buffer: ([\d,]+) ft"), ("total", r"TOTAL DEVICES (\d+)")):
        m = re.search(rx, t)
        p[key] = num(m.group(1)) if m else None
    sched = {}
    m = re.search(r"SIGN SCHEDULE\n# CODE DESCRIPTION\n(.*?)\n(?:ADVANCE WARNING|DRAWN AS|TRAFFIC CONTROL DEVICE SUMMARY)", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"^(\d+) (\S+) (.+)$", line.strip())
            if mm:
                sched[int(mm.group(1))] = mm.group(2)
    p["schedule"] = sched
    adv = []
    m = re.search(r"CODE DESCRIPTION DISTANCE\n(.*?)(?:\n(?:\+\d+ MORE|CROSS-STREET|CLOSED LANE|DRAWN AS|TRAFFIC CONTROL|[A-Z ]+:)|$)", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"^(\S+) (.+?) ([\d,]+) ft$", line.strip())
            if mm and SIGN_RX.match(mm.group(1)):
                adv.append((mm.group(1), mm.group(2), num(mm.group(3))))
    p["advance"] = adv
    m = re.search(r"(?:\+\d+ MORE ADVANCE SIGNS|\d+ ADVANCE SIGNS OFF-PAGE) \(([^)]*)\)", t)
    p["advance_overflow"] = [c.strip() for c in m.group(1).split(",")] if m else []
    summ = {}
    m = re.search(r"MUTCD DEVICE QTY\n(.*?)\nTOTAL DEVICES", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"^(\S+) (.+) (\d+)$", line.strip())
            if mm:
                k = device_key(mm.group(1), mm.group(2))
                summ[k] = summ.get(k, 0) + int(mm.group(3))
    p["summary"] = summ
    return p


def parse_crew(md: str) -> dict:
    c: dict = {"text": md}
    eq = {}
    sec = re.search(r"## Required Equipment\n(.*?)\n## ", md, re.S)
    if sec:
        for line in sec.group(1).splitlines():
            mm = re.match(r"^(\s*)- (\d+)× (.+)$", line)
            if not mm:
                continue
            indent, n, desc = mm.groups()
            if not indent and "Sign (see sign list" in desc:
                continue
            k = device_key("", desc)
            eq[k] = eq.get(k, 0) + int(n)
    c["equipment"] = eq
    c["advance"] = [(mm.group(1), num(mm.group(2)), mm.group(4)) for mm in re.finditer(
        r"- (\S+) at ([\d,]+) ft upstream of taper start \(station ([\d,]+) ft\), ([a-z ]+?)\.", md)]
    mm = re.search(rf"Place (\d+) channelizing drums in the ([a-z -]+?) taper, starting at station {STATION} ft and working upstream to station {STATION} ft", md)
    c["drums"] = (int(mm.group(1)), num(mm.group(3)), num(mm.group(4)), mm.group(2)) if mm else None
    mm = re.search(r"Place (\d+) traffic cones in the (?:one-lane two-way|merging) taper", md)
    c["taper_cones"] = int(mm.group(1)) if mm else None
    # Every cone run's stated spacing and the highest station it reaches (tangent and buffer).
    runs = []
    for mm in re.finditer(r"(\d+) (?:more )?traffic cones (?:along|at)[^.]*?(?:approximately )?(\d+) ft spacing[^.]*?(?:to (?:the taper \()?station " + STATION + r" ft)", md):
        runs.append((int(mm.group(1)), num(mm.group(2)), num(mm.group(3))))
    c["cone_runs"] = runs
    # Far side: the closed-lane line continues past the cross street up to the taper (Fig 6P-22 note 7).
    mm = re.search(r"continue the closed-lane cone line upstream from the work zone to the downstream curb line of the cross street[^.]*?up to the taper: (\d+) cones", md)
    c["through_cross"] = int(mm.group(1)) if mm else None
    c["stations"] = [num(x) for x in re.findall(r"Station #\d at station " + STATION + " ft", md)]
    mm = re.search(rf"Place (\d+) traffic cones in the downstream taper, between station {STATION} ft[^.]*?and station {STATION}", md)
    c["downstream"] = (int(mm.group(1)), abs(num(mm.group(2)) - num(mm.group(3)))) if mm else None
    mm = re.search(r"Maintain ([\d,]+) ft longitudinal buffer", md)
    c["buffer"] = num(mm.group(1)) if mm else None
    mm = re.search(r"\*\*Work zone length:\*\* ([\d,]+) ft", md)
    c["work"] = num(mm.group(1)) if mm else None
    mm = re.search(r"\*\*Speed limit:\*\* (\d+) mph", md)
    c["speed"] = num(mm.group(1)) if mm else None
    mm = re.search(r"Position arrow board at ([^(]*?)\(station " + STATION + r" ft\)", md)
    c["arrow_at"] = (mm.group(1).strip(), num(mm.group(2))) if mm else None
    mm = re.search(r"Set to ([A-Z ]+?) mode", md)
    c["arrow_mode"] = mm.group(1).strip().lower() if mm else None
    return c


def read_xlsx_devices(path: Path) -> dict:
    wb = load_workbook(path, data_only=True)
    ws = wb["Device List"]
    out: dict = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None or row[2] is None:
            continue
        k = device_key("", str(row[2]))
        out[k] = out.get(k, 0) + int(row[5] or 0)
    return out


def read_quote(path: Path) -> dict:
    wb = load_workbook(path, data_only=True)
    ws = wb["Equipment Detail"]
    out: dict = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not isinstance(row[0], int):
            continue
        k = device_key(str(row[2] or ""), str(row[3] or ""))
        out[k] = out.get(k, 0) + int(row[4] or 0)
    return out


def audit_devices(a: dict) -> dict:
    out: dict = {}
    for d in (a.get("breakdown") or {}).get("devices") or []:
        k = device_key(d.get("code") or "", d.get("device") or "")
        out[k] = out.get(k, 0) + int(d.get("qty") or 0)
    return out


def r(check, status, oracle="", plan="", src="", note=""):
    return {"check": check, "status": status, "oracle": str(oracle), "plan": str(plan), "source": src, "note": note}


def stn(s) -> float:
    return num(str(s))


# --- checks ------------------------------------------------------------------
def check_row(row: dict, d: Path, containment) -> dict:
    req = json.loads((d / "request.json").read_text("utf-8"))["scenario"]
    a = json.loads((d / "audit.json").read_text("utf-8"))
    if a.pop("site_scan_token", None) is not None:
        # The signed scan token stays out of the committed record.
        (d / "audit.json").write_text(json.dumps(a, indent=1, ensure_ascii=False), "utf-8")
    pages = pdf_pages(d / "plan.pdf")
    p1 = parse_page1(pages[0])
    crew = parse_crew((d / "crew.md").read_text("utf-8"))
    for code in p1["advance_overflow"]:
        for c_code, c_dist, _side in crew["advance"]:
            if c_code == code and not any(x[0] == code and x[2] == c_dist for x in p1["advance"]):
                p1["advance"].append((code, "(crew sheet; page 1 overflow line)", c_dist))
    render_page1(d / "plan.pdf", d / "page1.png")
    (d / "plan-text.txt").write_text("\n\n=== PAGE BREAK ===\n\n".join(pages), "utf-8")

    kind = req["kind"] if "kind" in req else row["kind"]
    flag_kind = kind == "flagger_lane_closure"
    speed = int(req["speed"])
    rt = req["roadType"]
    juris = req.get("jurisdiction_key")
    W = float(req["laneWidth"])
    wl = float(req["workLen"])
    wz = req.get("workZoneSpeed")
    if wz is None:
        m = re.search(r"R2-1\S* SPEED LIMIT (\d+)", p1["text"])
        wz = int(m.group(1)) if m and int(m.group(1)) < speed else speed
    night = bool(req.get("night"))
    texts_all = "\n".join([p1["text"], crew["text"], json.dumps(a, ensure_ascii=False)])
    out = []

    # C1 taper (L1, L2, L3)
    tz = a["sections"]["taper"]
    shown = {"page 1 label": p1["dim_taper"], "page 1 notes": p1["par_taper"],
             "audit": tz.get("L_required_ft"), "audit summary": a["summary"].get("taper_length_ft")}
    if crew["drums"]:
        shown["crew sheet"] = crew["drums"][2] - crew["drums"][1]
    vals = {k: v for k, v in shown.items() if v is not None}
    agree = len(set(vals.values())) <= 1
    taper_len = vals.get("crew sheet") or (min(vals.values()) if vals else None)
    if flag_kind:
        lo, hi = O.ONE_LANE_TWO_WAY_TAPER_FT
        ok = bool(vals) and all(lo <= v <= hi for v in vals.values())
        want, src = f"{lo}–{hi} ft one-lane two-way taper", "MUTCD Table 6B-3, p. 775; §6B.08 ¶14, p. 776 (L3)"
    else:
        need = int(O.merging_taper_min(W, wz))
        ok = bool(vals) and min(vals.values()) + 0.5 >= need
        want, src = f"merging taper ≥ L = {need} ft (W={W:g}, S={wz})", "MUTCD Table 6B-4 and 6B-3, p. 775 (L1, L2)"
    out.append(r("C1 taper", PASS if ok and agree else FLAG, want, ", ".join(f"{k} {v:g}" for k, v in vals.items()),
                 src, "" if agree else "surfaces disagree"))

    # C2 buffer (L9)
    bmin = O.buffer_min(wz)
    bvals = {"page 1 label": p1["dim_buffer"], "page 1 notes": p1["par_buffer"],
             "audit": a["sections"]["buffer"].get("buffer_ft"), "crew sheet": crew["buffer"]}
    bv = {k: v for k, v in bvals.items() if v is not None}
    buf = max(bv.values()) if bv else 0.0
    if not bv:
        out.append(r("C2 buffer", INFO, f"optional; if used ≥ {bmin} ft", "no buffer", "MUTCD Table 6B-2, p. 775; §6B.06 ¶11, p. 773 (L9)"))
    else:
        bagree = len(set(bv.values())) <= 1
        out.append(r("C2 buffer", PASS if (min(bv.values()) + 0.5 >= bmin and bagree) else FLAG, f"≥ {bmin} ft at {wz} mph",
                     ", ".join(f"{k} {v:g}" for k, v in bv.items()), "MUTCD Table 6B-2, p. 775; §6B.06 ¶11, p. 773 (L9)",
                     "" if bagree else "surfaces disagree"))

    # C3 downstream taper (L4)
    per_lane = re.findall(r"[^\n]{0,60}downstream taper[^\n]{0,80}per lane[^\n]{0,20}|[^\n]{0,40}per lane[^\n]{0,60}downstream taper[^\n]{0,20}", texts_all, re.I)
    if crew["downstream"]:
        n, ln = crew["downstream"]
        lo, hi = O.DOWNSTREAM_TAPER_FT
        st = PASS if ln <= hi else FLAG
        note = "" if ln >= lo else f"{ln:g} ft is under the {lo} ft low end (¶12 gives a range)"
        if per_lane:
            st = FLAG
            note = (note + "; " if note else "") + "states the range per lane: " + per_lane[0].strip()[:160]
        out.append(r("C3 downstream taper", st, f"{lo}–{hi} ft, not per lane", f"{n} cones over {ln:g} ft",
                     "MUTCD Table 6B-3, p. 775; §6B.08 ¶12, p. 776 (L4)", note))
    else:
        out.append(r("C3 downstream taper", FLAG if flag_kind else INFO, "flagger: ¶14 \"should be used\"; near-intersection: ¶12 \"If used\"",
                     "no downstream taper in the crew sheet", "MUTCD §6B.08 ¶12, ¶14, p. 776 (L4)",
                     "" if flag_kind else "Case 18 runs the closed lane to the corner"))

    # C4 device spacing (L10, L3/L4's approximately 20 ft)
    notes, st = [], PASS
    if crew["drums"] and taper_len:
        n = crew["drums"][0]
        sp = taper_len / max(1, n - 1)
        if sp > O.taper_spacing_max(speed) + 0.5:
            st = FLAG
            notes.append(f"taper: {n} drums over {taper_len:g} ft = {sp:.0f} ft apart > {O.taper_spacing_max(speed):g}")
        else:
            notes.append(f"taper {sp:.0f} ft ≤ {O.taper_spacing_max(speed):g}")
            if flag_kind and abs(sp - O.SHORT_TAPER_DEVICE_SPACING_FT) > 5:
                notes.append(f"(INFO: {sp:.0f} ft is not about {O.SHORT_TAPER_DEVICE_SPACING_FT} ft, L3)")
    else:
        notes.append("taper drums not found in the crew sheet")
        st = INFO
    if crew["cone_runs"]:
        worst = max(x[1] for x in crew["cone_runs"])
        reach = max(x[2] for x in crew["cone_runs"])
        if crew["through_cross"] and crew["drums"]:
            reach = crew["drums"][1]
            notes.append(f"{crew['through_cross']} cones carry the line past the cross street to the taper")
        if worst > O.tangent_spacing_max(speed) + 0.5:
            st = FLAG
        notes.append(f"cone runs at {', '.join(f'{x[1]:g}' for x in crew['cone_runs'])} ft ≤ {O.tangent_spacing_max(speed):g}?")
        taper_down = crew["drums"][1] if crew["drums"] else wl + buf
        gap = taper_down - reach
        bay = re.search(r"reopens as a left-turn bay[^.:]*?: place (\d+) cones along the lane line from the upstream curb line[^.]*? up to station " + STATION + " ft", crew["text"])
        if bay:
            # TA-23: the closed lane reopens as a turn bay before the cross street; its storage length is unsourced (N10).
            gap = taper_down - num(bay.group(2))
            notes.append(f"turn bay coned to station {num(bay.group(2)):g}; {gap:g} ft left open as the bay entry (INFO: no page sets it)")
            st = INFO if st == PASS else st
        elif gap > O.tangent_spacing_max(speed) + 0.5:
            st = FLAG
            notes.append(f"the cones stop at station {reach:g}; the taper starts at {taper_down:g}: a {gap:g} ft gap > 2S")
    else:
        notes.append("tangent cone runs not found in the crew sheet")
        st = INFO if st == PASS else st
    out.append(r("C4 device spacing", st, f"taper ≤ {speed} ft, tangent (buffer + work area) ≤ {2 * speed} ft",
                 "; ".join(notes), "MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18 (L10)"))

    # C5 device type and size (L11, L13)
    notes, st = [], PASS
    if crew["taper_cones"]:
        st = FLAG
        notes.append(f"{crew['taper_cones']} cones on the {'one-lane two-way' if flag_kind else 'merging'} taper")
    elif crew["drums"]:
        notes.append(f"{crew['drums'][0]} drums on the {crew['drums'][3]} taper")
    drum_in = [int(g) for tup in re.findall(r"(\d+)-inch channelizing drum|Channelizing Drum \((\d+)-inch\)", p1["text"] + crew["text"]) for g in tup if g]
    if drum_in and min(drum_in) < O.DRUM_MIN_HEIGHT_IN:
        st = FLAG
    notes.append("drums " + (", ".join(f"{x}-inch" for x in sorted(set(drum_in))) or "size not stated"))
    if speed >= O.TYPE1_BARRICADE_BANNED_FROM_MPH:
        t1 = re.search(r"Type (?:I|1) barricade", p1["text"] + crew["text"])
        if t1:
            st = FLAG
        notes.append("Type 1 barricade: " + (t1.group(0) if t1 else "none"))
    out.append(r("C5 device type and size", st, "drums or vertical panels on the taper, drums ≥ 36 in; no Type 1 barricade at 55+ mph",
                 "; ".join(notes), "S-630-1 Sheet 4 legend; MUTCD §6K.06 ¶01, p. 820; S-630-1 Note 16 (L11, L13)"))

    # C6 sign series and spacing (L5, L6, L15)
    cat = O.category(rt, speed)
    A = O.ADVANCE[cat][0]
    adv = sorted(((c, dist) for c, _desc, dist in p1["advance"]), key=lambda x: -x[1])
    order = [c for c, _ in adv]
    dists = [dist for _, dist in adv]
    gaps = [b - a_ for a_, b in zip(dists[1:] + [0.0], dists)]
    short = [f"{order[i]} {g:g}" for i, g in enumerate(gaps) if g + 0.5 < A]
    lane = req["meta"]["work"]["side"]
    if flag_kind:
        afad_note = ""
        summ = dict(p1["summary"])
        if req.get("afad") and "W20-7a" in order and "W20-7" not in order:
            # L18: no AFAD sign is quoted, so W20-7a in the W20-7 slot is recorded, not scored.
            order = ["W20-7" if c == "W20-7a" else c for c in order]
            adv = [("W20-7" if c == "W20-7a" else c, x) for c, x in adv]
            summ["W20-7"] = summ.get("W20-7a", 0)
            afad_note = "INFO: W20-7a AFAD AHEAD stands in the W20-7 slot (no AFAD sign is quoted, L18)"
        series = [c for c in order if c in O.FLAGGER_SERIES]
        missing = [c for c in O.FLAGGER_SERIES if c not in order]
        bad_order = series != list(O.FLAGGER_SERIES)
        w34 = "W3-4" in order and not (order.index("W20-4") < order.index("W3-4") < order.index("W20-7")) if {"W3-4", "W20-4", "W20-7"} <= set(order) else False
        both = all(summ.get(c, 0) >= 2 for c in O.FLAGGER_SERIES) or "opposing approach" in crew["text"]
        st = FLAG if (missing or bad_order or w34 or not both or short) else PASS
        why = [f"missing {', '.join(missing)}"] if missing else []
        why += ["wrong order"] if bad_order else []
        why += ["W3-4 not between W20-4 and W20-7"] if w34 else []
        why += ["one approach only"] if not both else []
        why += [f"gaps under A={A}: {', '.join(short)}"] if short else []
        why += [afad_note] if afad_note else []
        out.append(r("C6 flagger sign series", st, f"W20-1 → W20-4 → (W3-4) → W20-7 on both approaches, gaps ≥ {A} ft ({cat})",
                     " → ".join(f"{c} {x:g}" for c, x in adv) + f"; summary W20-1/W20-4/W20-7 = {[summ.get(c, 0) for c in O.FLAGGER_SERIES]}",
                     "MUTCD Fig 6P-10, p. 879; S-630-1 Sheet 9 Case 17; Table 6B-1, p. 773 (L5, L6)", "; ".join(why)))
    else:
        suf = "R" if lane == "right" else "L"
        want = [O.NEAR_INTERSECTION_SERIES[0]] + [c + suf for c in O.NEAR_INTERSECTION_SERIES[1:]]
        got = [c for c in order if c in want or c.rstrip("RL") in O.NEAR_INTERSECTION_SERIES[1:]]
        why = []
        if got != want:
            why.append(f"series {got}, expected {want}")
        urban = rt.startswith("urban")
        if short:
            why.append(f"gaps under A={A}: {', '.join(short)}" + (" (urban: INFO per Sheet 10 Note 1)" if urban else ""))
        st = FLAG if (got != want or (short and not urban)) else (INFO if short else PASS)
        out.append(r("C6 closed-approach sign series", st, f"{' → '.join(want)}, gaps ≥ {A} ft ({cat})",
                     " → ".join(f"{c} {x:g}" for c, x in adv), "S-630-1 Sheet 10 Case 18; MUTCD Figs 6P-21/22, pp. 901/903; Table 6B-1 (L5, L15)",
                     "; ".join(why)))
        appr = (a["sections"].get("approaches") or {}).get("approaches") or []
        miss = [x["id"] for x in appr if not any(s.get("Code") == "W20-1" for s in x.get("sign_table") or [])]
        out.append(r("C6b cross-street W20-1", FLAG if miss else (PASS if appr else INFO), "W20-1 on each drawn cross-street approach",
                     f"{len(appr)} approaches; " + (f"no W20-1 on {', '.join(miss)}" if miss else "all carry W20-1"),
                     "MUTCD Fig 6P-22, p. 903; S-630-1 Sheet 10 Case 18 (L15)"))
    if juris == "lakewood":
        lcat = O.category(rt, speed, O.LAKEWOOD_URBAN_HIGH_FROM_MPH)
        out.append(r("C6c Lakewood breakpoint", INFO, f"Lakewood's 35 mph split makes this road {lcat}", f"plan uses {cat}",
                     "data/jurisdictions/lakewood.json", "INFO while 02-JURISDICTION-DATA.md is missing (Ryan, 2026-10-22)"))

    # C7 flagger stations, pilot car, AFAD (L7, L17, L18)
    fl = a["sections"].get("flagger") or {}
    if flag_kind:
        tbl = fl.get("table") or []
        sts = sorted((stn(x["Station (ft)"]) for x in tbl), reverse=True)
        if not sts and req.get("afad"):
            sts = sorted(crew["stations"], reverse=True)
        notes, st = [f"{len(sts)} stations at {', '.join(f'{x:g}' for x in sts)}"], PASS
        if req.get("afad"):
            notes.append("AFAD stations from the crew sheet (the audit's flagger table is empty)")
        if len(sts) < 2:
            st = FLAG
            notes.append("one flagger station (Fig 6P-10 note 2 needs a short, low-volume zone)")
        if crew["drums"] and sts:
            up = crew["drums"][2]
            w207 = next((x for c, x in adv if c == "W20-7"), None)
            off = sts[0] - up
            if off < -0.5 or (w207 is not None and sts[0] >= up + w207):
                st = FLAG
                notes.append(f"upstream flagger {off:g} ft from the taper's upstream end, not between it and W20-7")
            else:
                notes.append(f"upstream flagger {off:g} ft before the taper (INFO: Fig 6P-10 draws it at the taper's upstream end)" if off > 0.5 else "upstream flagger at the taper")
            if w207 is not None and (up + w207) - sts[0] + 0.5 < A:
                st = FLAG
                notes.append(f"flagger to W20-7 = {(up + w207) - sts[0]:g} ft < A = {A}")
        if len(sts) >= 2:
            past = -sts[-1]
            lo, hi = O.OPPOSITE_FLAGGER_PAST_WORK_FT
            notes.append(f"opposite flagger {past:g} ft past the work area" + ("" if lo <= past <= hi else f" (INFO: Case 17 draws {lo}–{hi})"))
        out.append(r("C7 flagger stations", st, "a flagger at each end; the upstream one at the taper after W20-7, A to W20-7; the opposite one 200–300 ft past the work",
                     "; ".join(notes), "MUTCD Fig 6P-10, p. 879; §6D.06, p. 786; §6E.02 ¶01, p. 787; S-630-1 Case 17 (L7)"))
        if req.get("pilotCar"):
            r420 = "R4-20" in p1["summary"] or re.search(r"\bR4-20\b", crew["text"])
            g204 = O.PILOT_CAR_SIGN in texts_all
            out.append(r("C7b pilot car", PASS if (g204 and not r420 and len(sts) >= 2) else FLAG, "G20-4 on the pilot vehicle; a flagger at each end",
                         f"G20-4 {'named' if g204 else 'not named'}; R4-20 {'named' if r420 else 'absent'}; {len(sts)} flaggers",
                         "MUTCD §6E.04 ¶03-¶04, p. 787; S-630-1 Sheet 25 Case 42 (L17)"))
        if req.get("afad"):
            af = re.search(r"[^\n]{0,60}(?:AFAD|Automated Flagger Assistance)[^\n]{0,60}", crew["text"] + p1["text"])
            out.append(r("C7c AFAD", PASS if af else INFO, "the AFAD shown at the flagger station", af.group(0).strip() if af else "AFAD not named",
                         "MUTCD §6E.05 (L18)"))

    # C8 arrow board (L14)
    has_ab = "arrow_board" in p1["summary"] or "arrow_board" in crew["equipment"]
    mode = crew["arrow_mode"]
    if flag_kind:
        st = FLAG if (mode and mode != "caution") else (PASS if (mode == "caution" or not has_ab) else INFO)
        out.append(r("C8 arrow board", st, "none, or caution mode only", f"{'present' if has_ab else 'none'}; mode {mode or 'not stated'}"
                     + f"; page 1 {p1['summary'].get('arrow_board', 0)}, crew {crew['equipment'].get('arrow_board', 0)}",
                     "MUTCD §6L.06 ¶17-¶18, p. 833; S-630-1 Note 26 (L14)"))
    else:
        at = crew["arrow_at"]
        up = crew["drums"][2] if crew["drums"] else None
        st = INFO if not has_ab else (PASS if (at and up is not None and abs(at[1] - up) <= 1) else INFO)
        out.append(r("C8 arrow board", st, "if drawn, at the start of the merging taper", f"{at[0]} station {at[1]:g}; taper starts at {up}; mode {mode}" if at else ("present, position not stated" if has_ab else "none"),
                     "MUTCD §6L.06 ¶19, p. 833 (L14)"))

    # C9 near side / far side (L16, L15 far-side rule)
    if not flag_kind:
        ap = a["sections"].get("approaches") or {}
        label, s = ap.get("side"), ap.get("along_station_ft")
        exp = None if s is None else ("near" if s < 0 else "far" if s > wl else "inside")
        words = set(m.lower() for m in re.findall(r"\b(near|far)[ -]side\b", p1["text"] + crew["text"], re.I))
        st = PASS if (label and label == exp and words <= {label}) else FLAG
        out.append(r("C9 near or far side", st, f"cross street at station {s} → {exp} side (Fig 6P-21: closure before the intersection; Fig 6P-22: past it)",
                     f"audit {label}; page 1 / crew say {sorted(words) or 'neither'}; row asked {row.get('side')}",
                     "MUTCD Figs 6P-21, 6P-22, pp. 901/903 (L16; rulings R7)"))
        if label == "far" and lane == "right":
            r37 = "R3-7R" in p1["summary"] or "R3-7R" in crew["text"]
            cont = crew["through_cross"]
            out.append(r("C9b far side: R3-7R or continuous channelizers", PASS if (r37 or cont) else FLAG, "R3-7R RIGHT LANE MUST TURN RIGHT, or note 7's continuous channelizers",
                         "R3-7R present" if r37 else (f"{cont} cones continue the closed-lane line from the taper to the cross street" if cont else "neither"),
                         "MUTCD Fig 6P-22 and note 7, pp. 902-903 (L15)"))
        if row.get("extra", {}).get("turnBayStorageFt"):
            out.append(r("C9c turn bay storage", INFO, "no page sets the storage length", f"{row['extra']['turnBayStorageFt']} ft sent",
                         "oracle-sources.md 'Not sourced'"))

    # C10 every surface agrees (Rule 10)
    surfaces = {"page 1 summary": p1["summary"], "device XLSX": read_xlsx_devices(d / "devices.xlsx"),
                "quote XLSX": read_quote(d / "quote.xlsx"), "crew sheet": crew["equipment"], "audit": audit_devices(a)}
    diffs = []
    for k in sorted(set().union(*surfaces.values())):
        vk = {s: v.get(k, 0) for s, v in surfaces.items()}
        if len(set(vk.values())) > 1:
            diffs.append(f"{k}: " + ", ".join(f"{s} {n}" for s, n in vk.items()))
    out.append(r("C10 device counts agree", FLAG if diffs else PASS, "same quantity of every device on every surface",
                 "; ".join(diffs) or f"{sum(p1['summary'].values())} devices, equal on 5 surfaces", "Rule 10 / P2 one voice per fact"))
    pairs = [("speed", p1["par_speed"], speed), ("work zone", p1["par_work"], p1["dim_work"]),
             ("work zone (request)", p1["dim_work"], wl), ("taper", p1["par_taper"], p1["dim_taper"]),
             ("buffer", p1["par_buffer"], p1["dim_buffer"]), ("crew work zone", crew["work"], wl), ("crew speed", crew["speed"], speed)]
    bad = [f"{n}: {x:g} vs {y:g}" for n, x, y in pairs if x is not None and y is not None and abs(x - y) > 0.5]
    out.append(r("C10b notes match drawing", FLAG if bad else PASS, "every value in NOTES equals its drawn label and the request",
                 "; ".join(bad) or "match", "Rule 10"))

    # C11 containment and edition (Rule 9)
    if containment:
        fails = containment(str(d / "plan.pdf"))
        cnt = {k: len(v) for k, v in fails.items()}
        out.append(r("C11 containment", PASS if not any(cnt.values()) else FLAG, "0/0/0",
                     f"{cnt['edge']}/{cnt['box_cross']}/{cnt['collisions']}", "tests/test_pdf_containment.py measure",
                     json.dumps(fails)[:300] if any(cnt.values()) else ""))
    eds = sorted(set(re.findall(r"MUTCD (?:11th Ed(?:ition|\.)|2009|2023)", p1["text"] + crew["text"])))
    case_url = (a["sections"].get("case") or {}).get("url", "")
    st = FLAG if ("19-Page" in case_url or any("2009" in e for e in eds)) else PASS
    out.append(r("C11b edition", st, "MUTCD 11th Edition throughout; S-630-1 July 2026 (26 sheets)",
                 f"{', '.join(eds)}; audit links {case_url.rsplit('/', 1)[-1] or 'no S-630-1 set'}", "Rule 9; CLAUDE.md staleness note",
                 "edition finding: goes to #265" if "19-Page" in case_url else ""))

    # C12 limited sight distance (L19)
    if (req["meta"].get("siteConditions") or {}).get("limited_sight_distance"):
        adj = [x for x in a["sections"].get("site_adjustments") or [] if x.get("flag") == "limited_sight_distance"]
        rule = (adj[0].get("rule", "") + " " + adj[0].get("action", "")) if adj else ""
        # Without the flag the nearest sign sits A past the flagger (C7), the rest A apart (L5, L7).
        f_off = (max(crew["stations"]) - crew["drums"][2]) if (flag_kind and crew["stations"] and crew["drums"]) else 0
        base = [f_off + A * (i + 1) for i in range(len(dists))][::-1]
        moved = bool(dists) and all(x > b for x, b in zip(dists, base))
        marked = re.search(r"chosen|house|not sourced|engineering judgment", rule, re.I)
        cited = re.search(r"¶\s*\d+", rule)
        out.append(r("C12 limited sight distance", PASS if (moved and (marked or cited)) else FLAG,
                     "each sign farther upstream than without the flag; a fixed factor cited or marked chosen",
                     f"signs at {', '.join(f'{x:g}' for x in dists)}; without the flag {base}; audit: \"{rule.strip()[:200]}\"",
                     "MUTCD §6B.04 ¶04-¶08, p. 771 (L19)",
                     ("" if (marked or cited) else "the factor isn't cited or marked chosen (Rule 12)")
                     + ("INFO: the cited ¶04/¶06 ranges aren't quoted in oracle-sources.md, so the distance itself isn't scored" if cited and not marked else "")))

    # C13 pedestrian access (L20)
    flags = (a["sections"].get("site_scan") or {}).get("flags") or {}
    if req.get("pedestrianAccess") or flags.get("pedestrian_facility"):
        ped = re.search(r"R9-9|R9-11|SIDEWALK CLOSED|does not cover pedestrian|pedestrian[^.\n]{0,80}not", p1["text"] + crew["text"], re.I)
        out.append(r("C13 pedestrian access", PASS if ped else FLAG, "the closure shown (TA-28) or the limit stated",
                     (f"pedestrianAccess={bool(req.get('pedestrianAccess'))}, scan sidewalk={bool(flags.get('pedestrian_facility'))}; ")
                     + (ped.group(0) if ped else "silent"), "MUTCD TA-28, pp. 914-915; §6N.04 ¶06, p. 843 (L20)"))

    # C14 night (L8, L12)
    if night:
        cone_sz = [int(x) for x in re.findall(r"Traffic Cone \((\d+)-inch\)", p1["text"] + crew["text"])]
        small = [x for x in cone_sz if x < O.CONE_MIN_IN_NIGHT_OR_FREEWAY]
        out.append(r("C14 night cone height", FLAG if small else PASS, "≥ 36 in at night",
                     ", ".join(f"{x}-inch" for x in sorted(set(cone_sz))) or "no cones", "S-630-1 Sheet 2 Note 15 (L12)"))
        if flag_kind:
            lit = re.search(r"[^\n]{0,80}(?:illuminat|flood ?light|light plant)[^\n]{0,80}", crew["text"] + p1["text"] + json.dumps(fl), re.I)
            out.append(r("C14b flagger station lighting", PASS if lit else FLAG, "flagger stations illuminated at night",
                         lit.group(0).strip()[:200] if lit else "no lighting for the flagger stations",
                         "MUTCD §6D.06 ¶05, p. 786; S-630-1 Note 22 (L8)"))
    elif speed >= 45:
        cone_sz = sorted(set(int(x) for x in re.findall(r"Traffic Cone \((\d+)-inch\)", p1["text"])))
        out.append(r("C14 cone height (45+ mph)", INFO, "36 in where ADT ≥ 2,000 (no ADT input)", ", ".join(f"{x}-inch" for x in cone_sz) or "no cones",
                     "S-630-1 Sheet 2 Note 15 (L12)"))

    road = req["meta"]["confirmedRoad"]["candidate"]
    ctx = {"kind": kind, "road": f"{road.get('name') or ''} {road.get('ref') or ''}".strip(), "class": road["highway_class"],
           "roadType": rt, "divided": bool(req.get("divided")), "lanes": req.get("lanes") or req.get("detectedLanesTotal"), "laneWidth": W, "speed": speed,
           "wz_speed": wz, "lane": lane, "workLen": wl, "night": night, "jurisdiction": juris,
           "ta": a["summary"].get("ta"), "case": a["summary"].get("case_id"), "category": cat}
    return {"ctx": ctx, "checks": out}


def check_refusal(row: dict, d: Path) -> dict:
    """C15: a 4xx answer that names the row's field or reason, and no plan served."""
    meta = json.loads((d / "fetch.json").read_text("utf-8"))
    status = meta.get("audit_status")
    body = (d / "audit.json").read_text("utf-8") if (d / "audit.json").exists() else ""
    pdf_status = (meta.get("downloads") or {}).get("pdf", {}).get("status")
    named = bool(re.search(REFUSAL_NAMES[row["id"]], body, re.I))
    also = REFUSAL_ALSO_TRUE.get(row["id"])
    try:
        detail = json.loads(body).get("detail")
        msg = json.dumps(detail, ensure_ascii=False)[:400] if detail is not None else body[:400]
    except ValueError:
        msg = body[:400]
    why = []
    refused = isinstance(status, int) and 400 <= status < 500
    if not refused:
        why.append(f"status {status}")
    if pdf_status == 200:
        why.append("a plan PDF was served")
    if not named:
        why.append(f"message doesn't name /{REFUSAL_NAMES[row['id']]}/")
    if refused and pdf_status != 200 and named:
        st = PASS
    elif refused and pdf_status != 200 and also and re.search(also, body, re.I):
        st = INFO
        why.append("refused for a reason that is also true of this road")
    else:
        st = FLAG
    return {"status": st, "http": status, "pdf": pdf_status, "message": msg, "why": "; ".join(why)}


def main() -> None:
    os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")
    sys.path.insert(0, str(REPO))
    try:
        from tests.test_pdf_containment import measure_containment as containment
    except Exception as e:  # noqa: BLE001
        print("containment unavailable:", e)
        containment = None
    m = json.loads((HERE / "matrix.json").read_text("utf-8"))
    results = {"healthz": json.loads((RUNS / "healthz.json").read_text("utf-8")), "rows": []}
    for row in m["rows"]:
        d = RUNS / row["id"]
        entry = {"row": row, "pin": m["pins"][row["pin"]]}
        if not (d / "fetch.json").exists():
            entry["error"] = "not fetched"
        else:
            meta = json.loads((d / "fetch.json").read_text("utf-8"))
            if meta.get("error"):
                entry["error"] = meta["error"]
            elif row["expect"] == "refuse":
                entry["refusal"] = check_refusal(row, d)
            elif meta.get("audit_status") != 200 or not (d / "plan.pdf").exists():
                body = (d / "audit.json").read_text("utf-8")[:500] if (d / "audit.json").exists() else ""
                entry["error"] = f"expected a plan; audit answered {meta.get('audit_status')}: {body}"
            else:
                entry.update(check_row(row, d, containment))
        results["rows"].append(entry)
        print(row["id"], entry.get("error", "")[:160] or (entry.get("refusal") or {}).get("status") or
              " ".join(f"{c['check'].split()[0]}:{c['status']}" for c in entry["checks"]))
    (HERE / "results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), "utf-8")


if __name__ == "__main__":
    main()
