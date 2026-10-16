"""Shoulder-work audit, phase 2: score every fetched row against the oracle.

Usage:  python check.py      (reads runs/, writes results.json, index.md, runs/*/page1.png)

Reads only what production served (plan PDF, device XLSX, quote XLSX, crew
.md, audit JSON) and compares it with oracle.py, which copies its values
from MUTCD / S-630-1 by hand.  The one piece of repo code it uses is the
page-1 containment measurement (tests/test_pdf_containment.py), which
measures text boxes and computes no traffic-control value.

Each check yields PASS, FLAG or INFO.  A Lakewood difference that only
exists under Lakewood's own (provisional) breakpoint is INFO tagged
QUESTION (ruling e).  Edition findings carry #265 (ruling d).
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


def num(s: str) -> float:
    return float(s.replace(",", ""))


# --- readers -----------------------------------------------------------------
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
    for k, words in (("light_plant", ["light plant"]), ("warning_light", ["steady-burn", "warning light"]),
                     ("drum", ["drum"]), ("cone", ["cone"]), ("barricade_iii", ["type iii", "type 3"]),
                     ("barricade_ii", ["type ii ", "type 2"]), ("barricade_i", ["type i ", "type 1"]),
                     ("arrow_board", ["arrow board", "arrow panel"]), ("pcms", ["message sign", "pcms"]),
                     ("vertical_panel", ["vertical panel"]), ("tubular", ["tubular"]),
                     ("tma", ["attenuator"]), ("beacon", ["beacon"]), ("barrier", ["barrier"])):
        if any(w in d for w in words):
            return k
    return d.strip()


def parse_page1(t: str) -> dict:
    p: dict = {"text": t}
    head, _, rest = t.partition("METHOD OF HANDLING TRAFFIC")
    p["drawing_text"] = head
    for key, rx in (("dim_taper", r"L/3 = ([\d,]+) ft"), ("dim_buffer", r"BUFFER = ([\d,]+) ft"),
                    ("dim_work", r"WORK ZONE = ([\d,]+) ft"),
                    ("par_speed", r"Speed limit: (\d+) mph"), ("par_work", r"Work zone: ([\d,]+) ft"),
                    ("par_taper", r"Shoulder taper \(L/3\): ([\d,]+) ft"), ("par_buffer", r"Buffer: ([\d,]+) ft"),
                    ("total", r"TOTAL DEVICES (\d+)")):
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
    m = re.search(r"CODE DESCRIPTION DISTANCE\n(.*?)(?:\n(?:DRAWN AS|TRAFFIC CONTROL|[A-Z ]+:)|$)", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"^(\S+) (.+?) ([\d,]+) ft$", line.strip())
            if mm:
                adv.append((mm.group(1), mm.group(2), num(mm.group(3))))
    p["advance"] = adv
    m = re.search(r"\+(\d+) MORE ADVANCE SIGNS \(([^)]*)\)", t)
    p["advance_overflow"] = [c.strip() for c in m.group(2).split(",")] if m else []
    summ = {}
    m = re.search(r"MUTCD DEVICE QTY\n(.*?)\nTOTAL DEVICES", t, re.S)
    if m:
        for line in m.group(1).splitlines():
            mm = re.match(r"^(\S+) (.+) (\d+)$", line.strip())
            if mm:
                k = device_key(mm.group(1), mm.group(2))
                summ[k] = summ.get(k, 0) + int(mm.group(3))
    p["summary"] = summ
    markers = []
    toks = head.split()
    for i, tok in enumerate(toks):
        if tok.isdigit() and int(tok) in sched and not (i + 1 < len(toks) and toks[i + 1] in ("ft", "ft)", "mph")):
            markers.append(int(tok))
    p["markers"] = markers
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
    adv = []
    for mm in re.finditer(r"- (\S+) at ([\d,]+) ft upstream of taper start \(station ([\d,]+) ft\), ([a-z ]+?)\.", md):
        adv.append((mm.group(1), num(mm.group(2)), mm.group(4)))
    c["advance"] = adv
    mm = re.search(r"Place (\d+) channelizing drums in the shoulder taper, starting at station ([\d,]+) ft and working upstream to station ([\d,]+) ft", md)
    c["drums"] = (int(mm.group(1)), num(mm.group(2)), num(mm.group(3))) if mm else None
    mm = re.search(r"place (\d+) traffic cones along [^\n]*?starting at station ([\d,]+)(?: ft)?[^\n]*?to station ([\d,]+) ft", md)
    c["tangent"] = (int(mm.group(1)), num(mm.group(2)), num(mm.group(3))) if mm else None
    mm = re.search(r"Place (\d+) traffic cones in the downstream taper, between station (-?[\d,]+) ft", md)
    c["downstream"] = (int(mm.group(1)), abs(num(mm.group(2)))) if mm else None
    mm = re.search(r"Maintain ([\d,]+) ft longitudinal buffer", md)
    c["buffer"] = num(mm.group(1)) if mm else None
    mm = re.search(r"\*\*Work zone length:\*\* ([\d,]+) ft", md)
    c["work"] = num(mm.group(1)) if mm else None
    mm = re.search(r"\*\*Speed limit:\*\* (\d+) mph", md)
    c["speed"] = num(mm.group(1)) if mm else None
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


# --- checks ------------------------------------------------------------------
def buf_for_c3(p1: dict, a: dict) -> float:
    return p1["dim_buffer"] or p1["par_buffer"] or a["sections"]["buffer"].get("buffer_ft") or 0


def r(check, status, oracle="", plan="", src="", note=""):
    return {"check": check, "status": status, "oracle": str(oracle), "plan": str(plan), "source": src, "note": note}


def check_row(row: dict, d: Path, containment) -> dict:
    req = json.loads((d / "request.json").read_text("utf-8"))["scenario"]
    a = json.loads((d / "audit.json").read_text("utf-8"))
    if a.pop("site_scan_token", None) is not None:
        # The signed scan token stays out of the committed record.
        (d / "audit.json").write_text(json.dumps(a, indent=1, ensure_ascii=False), "utf-8")
    pages = pdf_pages(d / "plan.pdf")
    p1 = parse_page1(pages[0])
    p2 = pages[1] if len(pages) > 1 else ""
    crew = parse_crew((d / "crew.md").read_text("utf-8"))
    xl = read_xlsx_devices(d / "devices.xlsx")
    qt = read_quote(d / "quote.xlsx")
    ad = audit_devices(a)
    # Signs page 1 names in its "+N MORE ADVANCE SIGNS (...)" overflow line
    # take their distances from the crew sheet it points to.
    for code in p1["advance_overflow"]:
        for c_code, c_dist, _side in crew["advance"]:
            if c_code == code and not any(x[0] == code and x[2] == c_dist for x in p1["advance"]):
                p1["advance"].append((code, "(crew sheet; page 1 overflow line)", c_dist))
    render_page1(d / "plan.pdf", d / "page1.png")
    (d / "plan-text.txt").write_text("\n\n=== PAGE BREAK ===\n\n".join(pages), "utf-8")

    speed = int(req["speed"])
    side = req["meta"]["work"]["side"]
    rt = req["roadType"]
    juris = req.get("jurisdiction_key")
    tz = a["sections"]["taper"]
    W = float(tz.get("shoulder_width_ft") or tz.get("offset_ft"))
    # Work-zone speed: an operator reduction, else a reduction the plan signs (R2-1 in the summary).
    wz = req.get("workZoneSpeed")
    if wz is None:
        m = re.search(r"R2-1\S* SPEED LIMIT (\d+)", p1["text"])
        wz = int(m.group(1)) if m and int(m.group(1)) < speed else speed
    oneway = (req.get("carriageway") or {}).get("oneway") in ("yes", "-1") and not req.get("divided")
    divided = bool(req.get("divided"))
    out = []
    texts_all = "\n".join([p1["text"], p2, crew["text"]])

    # C1 taper (O1, O2)
    need = O.shoulder_taper_min(W, speed)
    need_wz = O.shoulder_taper_min(W, wz)
    shown = {"page 1 label": p1["dim_taper"], "page 1 notes": p1["par_taper"], "audit": tz.get("L_required_ft")}
    if crew["drums"]:
        shown["crew sheet"] = crew["drums"][2] - crew["drums"][1]
    vals = {k: v for k, v in shown.items() if v is not None}
    lo = min(vals.values()) if vals else None
    agree = len(set(vals.values())) <= 1
    st = PASS if (lo is not None and lo + 0.5 >= min(need, need_wz) and agree) else FLAG
    out.append(r("C1 taper", st, f"L/3 ≥ {need:.0f} ft (W={W:g} ft, S={speed})" + (f"; {need_wz:.0f} ft at {wz} mph" if wz != speed else ""),
                 ", ".join(f"{k} {v:g}" for k, v in vals.items()), "MUTCD Table 6B-4 and 6B-3, p. 775 (O1, O2)",
                 "" if agree else "surfaces disagree"))

    # C2 advance spacing (O3)
    cat = O.category(rt, speed)
    A, B, C = O.ADVANCE[cat]
    dists = sorted({x[2] for x in p1["advance"] if not x[0].endswith("P")})
    gaps = [dists[0]] + [b - a_ for a_, b in zip(dists, dists[1:])] if dists else []
    want = [A, B, C]
    lsd = bool((req["meta"].get("siteConditions") or {}).get("limited_sight_distance"))
    ok = len(gaps) >= 1 and all(g + 0.5 >= w for g, w in zip(gaps, want))
    note = ""
    if juris == "lakewood" and rt == "urban_arterial":
        lcat = O.category(rt, speed, O.LAKEWOOD_URBAN_HIGH_FROM_MPH)
        if lcat != cat:
            la = O.ADVANCE[lcat]
            lok = all(g + 0.5 >= w for g, w in zip(gaps, la))
            note = (f"QUESTION for Ryan (ruling e): under Lakewood's 35 mph split this road is {lcat} "
                    f"({la[0]}/{la[1]}/{la[2]} ft); the plan's gaps {'meet' if lok else 'fall short of'} it.")
    out.append(r("C2 advance sign spacing", PASS if ok else FLAG, f"{cat}: A {A}, B {B}, C {C} ft (minimum)",
                 "gaps " + ", ".join(f"{g:g}" for g in gaps) + f" (signs at {', '.join(f'{x:g}' for x in dists)} ft)",
                 "MUTCD Table 6B-1, p. 773; S-630-1 Sheet 4 (O3)", note))
    if note:
        out.append(r("C2b Lakewood breakpoint", INFO, "", "", "data/jurisdictions/lakewood.json", note))
    if rt == "freeway":
        seen: dict = {}
        got = []
        for code, want_ft in O.CASE11_FROM_TAPER:
            at = sorted(x[2] for x in p1["advance"] if x[0] == code)
            i = seen.get(code, 0)
            seen[code] = i + 1
            got.append((code, want_ft, at[i] if i < len(at) else None))
        short = [(f"{c} at {g:g} ft (Case 11: {w})" if g is not None else f"{c} missing (Case 11: {w})")
                 for c, w, g in got if g is None or g + 0.5 < w]
        out.append(r("C2c Case 11 distances", FLAG if short else PASS,
                     ", ".join(f"{c} ≥ {w} ft" for c, w, _ in got),
                     ", ".join(f"{c} {g:g}" if g is not None else f"{c} missing" for c, _w, g in got),
                     "S-630-1 Sheet 7, Case No. 11 (O16)", "; ".join(short)))
    road_oneway = ((req["meta"]["confirmedRoad"]["candidate"].get("tags") or {}).get("oneway")) in ("yes", "-1")
    case_txt = a["summary"].get("case_id") or ""
    if divided and not road_oneway:
        out.append(r("C15 carriageway", FLAG, "a divided road's carriageways are mapped one-way; a single two-way way is one undivided road",
                     f"OSM way {req['meta']['confirmedRoad']['candidate'].get('way_id')} ({req['meta']['confirmedRoad']['candidate']['highway_class']}) has oneway="
                     f"{(req['meta']['confirmedRoad']['candidate'].get('tags') or {}).get('oneway')}; the plan says \"{case_txt}\"",
                     "Rule 10 (the plan contradicts the road it relays)",
                     "the site's classifier marks every trunk road divided (conestruct/site/lib/road-detection/classify.ts roadTypeAndDivided)"))

    # C3 limited sight distance (O4)
    if lsd:
        adj = [x for x in a["sections"].get("site_adjustments") or [] if x.get("flag") == "limited_sight_distance"]
        base = [A, A + B, A + B + C]
        ratios = [round(x / b, 2) for x, b in zip(dists, base)]
        rule = adj[0].get("rule", "") if adj else ""
        action = adj[0].get("action", "") if adj else ""
        moved = bool(ratios) and all(x > 1.0 for x in ratios)
        marked = re.search(r"chosen|house|not sourced|engineering judgment", rule + action, re.I)
        # The audit says "50% farther upstream from the taper".  Test that
        # against the other reading: 1.5 x the station from the work zone's
        # downstream end (station 0 = end of work; taper start = work + buffer + taper).
        t_start = float(req["workLen"]) + float(buf_for_c3(p1, a)) + float(lo or 0)
        from_taper = [round(1.5 * b) for b in base]
        from_end = [round(1.5 * (t_start + b) - t_start) for b in base]
        fits_taper = all(abs(x - y) <= 2 for x, y in zip(dists, from_taper))
        fits_end = all(abs(x - y) <= 2 for x, y in zip(dists, from_end))
        notes3 = []
        if fits_end and not fits_taper:
            notes3.append(f"signs sit at {', '.join(f'{x:g}' for x in dists)} ft before the taper: 1.5 × their station from the work zone's far end "
                          f"({', '.join(f'{x:g}' for x in from_end)}), not 50% farther from the taper as the audit says ({', '.join(f'{x:g}' for x in from_taper)})")
        if not marked:
            notes3.append("the 50% factor is filed under §6B.04, which gives no factor, and isn't marked as chosen (Rule 12)")
        st = FLAG if (not moved or not marked or (fits_end and not fits_taper)) else PASS
        out.append(r("C3 limited sight distance", st, f"§6B.04 ¶07–¶08 allow an increase, no factor; audit's own claim: 50% farther from the taper = {from_taper}",
                     f"distances {[round(x) for x in dists]}; audit: \"{action}\" rule \"{rule}\"",
                     "MUTCD §6B.04 ¶04–¶08, p. 771 (O4)", "; ".join(notes3)))

    # C4 buffer (O5)
    bmin = O.buffer_min(wz)
    if rt == "freeway" and speed in O.CDOT_FREEWAY_BUFFER_MIN:
        bmin = max(bmin, O.CDOT_FREEWAY_BUFFER_MIN[speed]) if wz == speed else O.CDOT_FREEWAY_BUFFER_MIN[speed]
    bvals = {"page 1 label": p1["dim_buffer"], "page 1 notes": p1["par_buffer"],
             "audit": a["sections"]["buffer"].get("buffer_ft"), "crew sheet": crew["buffer"]}
    m2 = re.search(r"Buffer: ([\d,]+) ft", p2)
    if m2:
        bvals["page 2"] = num(m2.group(1))
    bv = {k: v for k, v in bvals.items() if v is not None}
    if not bv:
        out.append(r("C4 buffer", INFO, f"optional; if used ≥ {bmin} ft", "no buffer", "MUTCD Table 6B-2, p. 775; S-630-1 Note 24 (O5)"))
    else:
        bagree = len(set(bv.values())) <= 1
        st = PASS if (min(bv.values()) + 0.5 >= bmin and bagree) else FLAG
        out.append(r("C4 buffer", st, f"≥ {bmin} ft at {wz} mph", ", ".join(f"{k} {v:g}" for k, v in bv.items()),
                     "MUTCD Table 6B-2, p. 775; S-630-1 Note 24, Sheet 14 (O5)", "" if bagree else "surfaces disagree"))

    # C5 device spacing (O6, O7)
    notes = []
    st = PASS
    taper_len = vals.get("crew sheet") or lo
    if crew["drums"] and taper_len:
        n = crew["drums"][0]
        sp = taper_len / max(1, n - 1)
        if sp > O.taper_spacing_max(speed) + 0.5:
            st = FLAG
            notes.append(f"taper: {n} drums over {taper_len:g} ft = {sp:.0f} ft apart > {O.taper_spacing_max(speed):g}")
        else:
            notes.append(f"taper {sp:.0f} ft ≤ {O.taper_spacing_max(speed):g}")
    else:
        notes.append("taper devices not found in crew sheet")
        st = INFO
    buf = (bv and max(bv.values())) or 0
    if crew["tangent"]:
        n, s0, s1 = crew["tangent"]
        sp = (s1 - s0) / max(1, n - 1)
        if sp > O.tangent_spacing_max(speed) + 0.5:
            st = FLAG
            notes.append(f"tangent {sp:.0f} ft > {O.tangent_spacing_max(speed):g}")
        else:
            notes.append(f"tangent {sp:.0f} ft ≤ {O.tangent_spacing_max(speed):g} from station {s0:g} to {s1:g}")
        wl = float(req["workLen"])
        uncovered = (wl + buf) - s1
        if buf and uncovered > O.tangent_spacing_max(speed) + 0.5:
            st = FLAG
            notes.append(f"the {buf:g} ft buffer (stations {wl:g}–{wl + buf:g}) has no channelizing devices: a {uncovered:g} ft gap > 2S = {O.tangent_spacing_max(speed):g} ft")
    else:
        notes.append("tangent devices not found in crew sheet")
        st = INFO if st == PASS else st
    if crew["downstream"]:
        dn = crew["downstream"][1]
        if not (O.DOWNSTREAM_TAPER_FT[0] <= dn <= O.DOWNSTREAM_TAPER_FT[1]):
            st = FLAG
        notes.append(f"downstream taper {dn:g} ft (50–100)")
    out.append(r("C5 device spacing", st, f"taper ≤ {speed} ft, tangent (buffer + work area) ≤ {2 * speed} ft",
                 "; ".join(notes), "MUTCD §6K.01 ¶04, p. 815; S-630-1 Note 18; §6B.08 ¶12, p. 776 (O6, O7)"))

    # C6 sign legends, arrow-board mode, freeway set (O8, O10, O12)
    codes = set(p1["summary"])
    want_code = "W21-5aR" if side == "right" else "W21-5aL"
    other = "W21-5aL" if side == "right" else "W21-5aR"
    st = PASS if (want_code in codes and other not in codes) else FLAG
    out.append(r("C6a shoulder sign legend", st, f"{want_code} only", ", ".join(sorted(c for c in codes if c.startswith("W21"))),
                 "MUTCD §6H.22 ¶02, p. 807 (O8)"))
    bad_arrow = re.findall(r"[^\n]{0,40}(?:RIGHT_ARROW|LEFT_ARROW|(?<!caution )arrow mode|sequential arrow|chevron mode|right arrow|left arrow|double arrow)[^\n]{0,40}", texts_all, re.I)
    bad_arrow = [x for x in bad_arrow if not re.search(r"never an arrow|not an arrow|no arrow", x, re.I)]
    caution = re.search(r"caution mode", texts_all, re.I)
    st = FLAG if bad_arrow else (PASS if caution else INFO)
    out.append(r("C6b arrow board mode", st, "caution mode only", "; ".join(bad_arrow[:2]) or ("caution mode stated" if caution else "mode not stated"),
                 "MUTCD §6N.06 ¶09, p. 845; TA-4 Note 8, p. 866; S-630-1 Note 26 (O10)"))
    if rt == "freeway":
        has = {c for c in codes}
        plaque = [c for c in has if c.startswith(("W16-2", "W16-4", "W7-3"))]
        st = PASS if ("W20-1" in has and want_code in has) else FLAG
        out.append(r("C6c freeway sign set", st, "W20-1 then W21-5a; plaque W16-2/W16-4P/W7-3aP if the end isn't visible",
                     ", ".join(sorted(has)), "MUTCD §6N.06 ¶03, p. 845; TA-5, p. 869; S-630-1 Sheet 7 Case 11 (O12)",
                     "" if plaque else "no distance plaque (INFO: conditional on sight)"))

    # C7 sides (O9)
    sides = {x[2] for x in crew["advance"]}
    if oneway:
        st = PASS if sides and sides <= {side + " side"} else FLAG
        exp = f"{side} side only (TA-3 Note 1)"
    elif divided:
        mirrored = bool(re.search(r"matching signs? on (?:the )?(?:left|right) side", crew["text"]))
        claims = re.search(r"[^\n]*must be posted on BOTH sides[^\n]*", crew["text"] + p1["text"], re.I)
        if claims:
            st = FLAG
        else:
            st = INFO if mirrored else PASS
        exp = "closure side; a mirror is R54's house choice and must not be called required"
        if claims:
            sides = sides | {f"crew sheet: \"{claims.group(0).strip()[:160]}\""}
        elif mirrored:
            sides = sides | {"mirrored on the other side"}
    else:
        st = PASS if sides and sides <= {side + " side"} else INFO
        exp = f"{side} side (own direction, TA-3 figure)"
    n8 = [c for c in a["sections"]["colorado"].get("checks") or [] if "Note 8" in json.dumps(c)]
    n8d = n8[0].get("detail", "") if n8 else ""
    out.append(r("C7 signs by side", st, exp, ", ".join(sorted(sides)) + (f"; audit Note 8: {n8d[:120]}" if n8d else ""),
                 "S-630-1 Note 8; MUTCD TA-3 Note 1, p. 864; §6N.06 ¶03, p. 845; #243 R54 (O9)"))

    # C8 device counts across surfaces
    drawn: dict = {}
    for mk in p1["markers"]:
        k = p1["schedule"][mk]
        drawn[k] = drawn.get(k, 0) + 1
    mirror_offpage = divided and bool(re.search(r"Place matching signs on left side at each location", crew["text"]))
    for code, _desc, _dist in p1["advance"]:
        drawn[code] = drawn.get(code, 0) + (2 if mirror_offpage else 1)
    surfaces = {"page 1 summary": p1["summary"], "device XLSX": xl, "quote XLSX": qt, "crew sheet": crew["equipment"], "audit": ad}
    keys = set().union(*surfaces.values())
    diffs = []
    for k in sorted(keys):
        vals_k = {s: v.get(k, 0) for s, v in surfaces.items()}
        if len(set(vals_k.values())) > 1:
            diffs.append(f"{k}: " + ", ".join(f"{s} {n}" for s, n in vals_k.items()))
    sign_diffs = []
    for k, n in p1["summary"].items():
        if mirror_offpage and k in p1["schedule"].values() and drawn.get(k, 0) * 2 == n:
            continue  # median copies are drawn unnumbered (checked by eye on colo-r-35)
        if SIGN_RX.match(k) and drawn.get(k, 0) != n:
            sign_diffs.append(f"{k}: summary {n}, drawn or listed off-page {drawn.get(k, 0)}")
    st = FLAG if diffs else PASS
    out.append(r("C8 device counts agree", st, "same quantity of every device on every surface",
                 "; ".join(diffs) or f"{sum(p1['summary'].values())} devices, {len(keys)} types, equal on 5 surfaces",
                 "Rule 10 / P2 one voice per fact"))
    out.append(r("C8b drawn signs vs summary", FLAG if sign_diffs else PASS, "every sign in the summary is drawn or listed off-page",
                 "; ".join(sign_diffs) or "match", "Rule 10",
                 "drawn counts read from page-1 schedule markers; cones and drums are vector glyphs and are not counted here"))

    # C9 assumed values labelled (Rule 10)
    sh = re.search(r"shoulder width\s*[:=]?\s*\d+(?:\.\d)? ?ft|SHOULDER = \d+(?:\.\d)? ?ft|\b\d+(?:\.\d)?[ -]?(?:ft|foot)[ -](?:wide )?shoulder\b(?! taper| closure| closed| work)", p1["text"], re.I)
    out.append(r("C9a assumed shoulder width shown", PASS if sh else FLAG, f"page 1 states the {W:g} ft shoulder width the taper uses (no input exists)",
                 sh.group(0) if sh else "page 1 never states the shoulder width", "Rule 10; MUTCD TA-3 Note 8, p. 864 (O11)",
                 "the taper L = W·S… uses W; the audit discloses it only for one-way streets" if not sh else ""))
    jname = ((a.get("breakdown") or {}).get("jurisdiction") or {}).get("name")
    says_cdot = re.search(r"CDOT", p1["text"])
    if juris and juris != "cdot":
        out.append(r("C9b jurisdiction math", INFO, "jurisdiction rules applied, or the plan says CDOT's are used",
                     f"{jname}; page 1 cites " + ("CDOT S-630-1" if says_cdot else "no CDOT reference"), "Rule 10",
                     "the engine always computes with CDOT values (src/api/schemas.py:1519)"))
    if juris == "denver":
        out.append(r("C9c edition (#265)", INFO, "Denver's record pins MUTCD 2009 R2 (PT-116.1)",
                     "plan cites MUTCD 11th Edition", "data/jurisdictions/denver.json; ruling d", "tracked in #265"))
    case_url = a["sections"].get("case", {}).get("url", "")
    if "19-Page" in case_url:
        out.append(r("C9d CDOT edition link (#265)", FLAG, "S-630-1 July 01, 2026, 26 sheets",
                     f"audit links {case_url.rsplit('/', 1)[-1]}", "S-630-1 2026; CLAUDE.md staleness note; ruling d",
                     "edition finding: goes to #265"))

    # C10 notes vs drawing
    pairs = [("speed", p1["par_speed"], speed), ("work zone", p1["par_work"], p1["dim_work"]),
             ("work zone (request)", p1["dim_work"], float(req["workLen"])),
             ("taper", p1["par_taper"], p1["dim_taper"]), ("buffer", p1["par_buffer"], p1["dim_buffer"]),
             ("crew work zone", crew["work"], float(req["workLen"])), ("crew speed", crew["speed"], speed)]
    bad = [f"{n}: {x:g} vs {y:g}" for n, x, y in pairs if x is not None and y is not None and abs(x - y) > 0.5]
    missing = [n for n, x, y in pairs if x is None]
    adv_codes = {x[0] for x in p1["advance"]}
    sched_codes = set(p1["schedule"].values())
    signs_sum = {k for k in p1["summary"] if SIGN_RX.match(k)}
    orphan = sorted(signs_sum - adv_codes - sched_codes)
    st = FLAG if (bad or orphan) else PASS
    out.append(r("C10 notes match drawing", st, "every value in NOTES equals its drawn label; every summary sign is in the schedule or off-page list",
                 "; ".join(bad + [f"not placed: {', '.join(orphan)}"] if orphan else bad) or "match" + (f" (not printed: {', '.join(missing)})" if missing else ""),
                 "Rule 10"))

    # C11 containment
    if containment:
        fails = containment(str(d / "plan.pdf"))
        cnt = {k: len(v) for k, v in fails.items()}
        out.append(r("C11 containment", PASS if not any(cnt.values()) else FLAG, "0/0/0",
                     f"{cnt['edge']}/{cnt['box_cross']}/{cnt['collisions']}", "tests/test_pdf_containment.py measure",
                     json.dumps(fails)[:300] if any(cnt.values()) else ""))

    # C12 night, school, sidewalk, cones, Type 1 (O13, O14, O15)
    night = bool(req.get("night"))
    cone_sz = re.findall(r"Traffic Cone \((\d+)-inch\)", p1["text"])
    if night or rt == "freeway":
        small = [int(x) for x in cone_sz if int(x) < O.CONE_MIN_IN_NIGHT_OR_FREEWAY]
        out.append(r("C12a cone height", FLAG if small else PASS, "≥ 36 in at night or on a freeway",
                     ", ".join(f"{x}-inch" for x in sorted(set(int(c) for c in cone_sz))) or "no cones",
                     "S-630-1 Sheet 2 Note 15 (O13)"))
    if speed >= O.TYPE1_BARRICADE_BANNED_FROM_MPH:
        t1 = re.search(r"Type (?:I|1) barricade", p1["text"])
        out.append(r("C12b Type 1 barricade", FLAG if t1 else PASS, "none at 55 mph or more", t1.group(0) if t1 else "none",
                     "S-630-1 Sheet 2 Note 16 (O14)"))
    scan = a["sections"].get("site_scan") or {}
    flags = scan.get("flags") or {}
    places = row.get("place") or []
    if "sidewalk" in places or flags.get("pedestrian_facility"):
        ped = re.search(r"R9-9|R9-11|SIDEWALK CLOSED|pedestrian", p1["text"] + crew["text"], re.I)
        if flags.get("pedestrian_facility"):
            st = PASS if ped else FLAG
            pl = "scan found a sidewalk; " + ("plan closes it (R9-9 / pedestrian notes)" if ped else "plan is silent")
        else:
            st = INFO
            pl = "scan found no sidewalk at this pin"
        out.append(r("C12c sidewalk", st, "closure shown (TA-28) or limits stated", pl, "MUTCD TA-28 Note 1, p. 914; §6N.04 ¶06, p. 843 (O15)"))
    if "school" in places or flags.get("school_zone"):
        s1 = re.search(r"S1-1|school", p1["text"] + crew["text"], re.I)
        out.append(r("C12d school", INFO, "no work-zone school rule in the sources",
                     f"scan school_zone={flags.get('school_zone')}; plan: " + ("mentions school / S1-1" if s1 else "no school mention"), "unsourced (INFO only)"))
    if night:
        lit = re.findall(r"[^\n]{0,60}(?:night|lighting|illuminat|Class 3)[^\n]{0,60}", crew["text"] + p1["text"], re.I)
        out.append(r("C12e night", INFO, "recorded only", "; ".join(x.strip() for x in lit[:3]) or "no night text", "unsourced beyond O13"))

    # C13 shoulder >= 8 ft (O11)
    adv_n = len(p1["advance"])
    drums = crew["drums"][0] if crew["drums"] else 0
    out.append(r("C13 ≥8 ft shoulder closed", PASS if (W < 8 or (adv_n >= 1 and drums >= 1)) else FLAG,
                 "≥1 advance warning sign and channelizing devices on a shoulder taper",
                 f"{adv_n} advance signs, {drums} taper devices (W={W:g} ft)", "MUTCD §6N.06 ¶02, p. 845; TA-3 Note 8 (O11)"))

    road = req["meta"]["confirmedRoad"]["candidate"]
    ctx = {"road": f"{road.get('name') or ''} {road.get('ref') or ''}".strip(), "class": road["highway_class"],
           "oneway": (road.get("tags") or {}).get("oneway"), "roadType": rt, "divided": divided, "lanes": req["lanes"],
           "laneWidth": req["laneWidth"], "speed": speed, "wz_speed": wz, "side": side, "workLen": req["workLen"],
           "night": night, "lsd": lsd, "jurisdiction": jname, "scan": scan.get("status"), "scan_flags": flags,
           "ta": a["summary"].get("ta"), "case": a["summary"].get("case_id"), "category": cat}
    return {"ctx": ctx, "checks": out}


def check_refusal(row: dict, d: Path) -> dict:
    meta = json.loads((d / "fetch.json").read_text("utf-8"))
    exp = row["expect"]
    status = meta.get("audit_status")
    body = (d / "audit.json").read_text("utf-8") if (d / "audit.json").exists() else ""
    pdf_status = (meta.get("downloads") or {}).get("pdf", {}).get("status")
    ok_status = status in exp["refuse"]
    named = bool(re.search(exp["names"], body, re.I))
    code_ok = ("code" not in exp) or exp["code"] in body
    served = pdf_status == 200
    try:
        detail = json.loads(body).get("detail")
        msg = json.dumps(detail)[:400] if detail is not None else body[:400]
    except Exception:
        msg = body[:400]
    st = PASS if (ok_status and named and code_ok and not served) else FLAG
    why = []
    if not ok_status:
        why.append(f"status {status}, expected {exp['refuse']}")
    if not named:
        why.append(f"message doesn't name /{exp['names']}/")
    if not code_ok:
        why.append(f"code {exp['code']} missing")
    if served:
        why.append("a plan PDF was served")
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
            elif "expect" in row:
                entry["refusal"] = check_refusal(row, d)
            elif meta.get("audit_status") != 200 or not (d / "plan.pdf").exists():
                body = (d / "audit.json").read_text("utf-8")[:500] if (d / "audit.json").exists() else ""
                entry["error"] = f"expected a plan; audit answered {meta.get('audit_status')}: {body}"
            else:
                entry.update(check_row(row, d, containment))
        results["rows"].append(entry)
        print(row["id"], entry.get("error") or (entry.get("refusal") or {}).get("status") or
              " ".join(f"{c['check'].split()[0]}:{c['status']}" for c in entry["checks"]))
    (HERE / "results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False), "utf-8")


if __name__ == "__main__":
    main()
