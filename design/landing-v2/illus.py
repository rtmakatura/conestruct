# Plan-view illustration of the Colfax shoulder closure, drawn in the Conestruct palette.
# Not to scale. Numbers match the Oct 17 run: L/3 50 ft, buffer 200 ft, work zone 1,000 ft,
# intersection 64 ft, sidewalk +4 devices.
# Device counts (devices='run', the default) match the run too
# (validation-artifacts/committed/landing-source-run/README.md): 3 drums in the taper,
# 3 buffer cones, 18 work-zone cones, 2 downstream, each set spaced evenly in its segment.
# devices='canvas' keeps the Oct 17 canvas's decorative 6 / 4 / 21 / 2, which only the
# phone hero (hero-plan-narrow.svg) still draws: Ryan ruled it unchanged until the
# platform-wide mobile pass.
#
#   python design/landing-v2/illus.py          writes step1-plan.svg and step3-plan.svg
#   python design/landing-v2/step3-narrow.py   then derives step3-plan-narrow.svg
#
# Every top-level element carries class "z" plus an optional key (k-int, k-walk, k-taper,
# k-buffer, k-work) so motion versions can animate or spotlight parts of the plan.

GROUND = '#101c29'; GRID = '#172636'; BLOCK = '#132131'; BLDG = '#1a2a3c'; HAIR = '#223345'
RULE = '#2c3e53'; ROAD = '#1d2d3f'; LANE = '#3a4d66'; CENTER = '#8c7a2a'; WALK = '#18283a'
INK = '#eaf0f7'; BODY = '#c8d1dd'; FAINT = '#93a0b0'; DIM = '#ff8a2e'; WARN = '#f4c020'
ADV = '#e0a63c'; WORK = '#3fd3a8'
MONO = "'JetBrains Mono', ui-monospace, monospace"


def t(x, y, s, size=9, fill=FAINT, anchor='middle', weight=400, ls=1.2, rot=None):
    r = f' transform="rotate({rot} {x} {y})"' if rot is not None else ''
    return f'<text x="{x}" y="{y}" font-family="{MONO}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" letter-spacing="{ls}"{r}>{s}</text>'


def g(cls, inner, i=None):
    st = f' style="--i: {i};"' if i is not None else ''
    return f'<g class="z {cls}"{st}>{inner}</g>'


def cone(x, y):
    return f'<path d="M{x-3.5} {y+3.5} L{x} {y-4} L{x+3.5} {y+3.5} Z" fill="{DIM}"/>'


def svg(uid='a', view=None, note=True, traffic=False, rings=False, svg_class='', devices='run'):
    W, H = 1200, 430
    top_blk, top_walk, road0 = (96, 128), (128, 140), 140
    shoulder = (240, 258); walk = (258, 272); bot_blk = (272, 324)
    bar_y = 340
    streets = [(40, 72, 'GILPIN ST', ''), (500, 534, 'WILLIAMS ST', 'k-int'), (1112, 1146, 'HIGH ST', '')]
    tp0, tp1, wz0, wz1 = 400, 460, 560, 1060
    vb = view or f'0 0 {W} {H}'
    cls = f' class="{svg_class}"' if svg_class else ''
    o = [f'<svg{cls} viewBox="{vb}" width="100%" role="img" aria-label="Illustration of the Colfax shoulder closure: advance warning signs, a 50 foot taper, a 200 foot buffer and a 1,000 foot work zone along the eastbound shoulder, with the nearby intersection and sidewalk flagged" style="display: block; height: auto;">']
    o.append(f'<defs><pattern id="g{uid}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="{GRID}" stroke-width="1"/></pattern>'
             f'<pattern id="h{uid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="{WORK}" stroke-width="1.4" stroke-opacity="0.55"/></pattern>'
             f'<pattern id="w{uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="{LANE}" stroke-width="1"/></pattern></defs>')
    o.append(f'<rect width="{W}" height="{H}" fill="{GROUND}"/><rect width="{W}" height="{H}" fill="url(#g{uid})"/>')

    city = []
    edges = [0] + [v for s in streets for v in s[:2]] + [W]
    for i in range(0, len(edges), 2):
        x0, x1 = edges[i], edges[i + 1]
        for (y0, y1) in (top_blk, bot_blk):
            city.append(f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{BLOCK}" stroke="{HAIR}"/>')
            x, k = x0 + 10, 0
            while x < x1 - 40:
                w = 34 + (k * 17) % 46
                if x + w > x1 - 8: w = x1 - 8 - x
                if w < 18: break
                yy0 = y0 + 6 if y0 == top_blk[0] else y0 + 10
                city.append(f'<rect x="{x}" y="{yy0}" width="{w}" height="{(y1-y0)-16}" fill="{BLDG}" stroke="{HAIR}"/>')
                x += w + 8 + (k * 5) % 9
                k += 1
    city.append(f'<rect x="0" y="{top_walk[0]}" width="{W}" height="{top_walk[1]-top_walk[0]}" fill="{WALK}"/>')
    city.append(f'<rect x="0" y="{walk[0]}" width="{W}" height="{walk[1]-walk[0]}" fill="{WALK}"/>')
    city.append(f'<rect x="0" y="{road0}" width="{W}" height="{shoulder[1]-road0}" fill="{ROAD}"/>')
    o.append(g('base', ''.join(city)))
    for (x0, x1, name, key) in streets:
        st = (f'<rect x="{x0}" y="0" width="{x1-x0}" height="{bot_blk[1]}" fill="{ROAD}"/>'
              f'<line x1="{(x0+x1)/2}" y1="0" x2="{(x0+x1)/2}" y2="{top_walk[0]}" stroke="{LANE}" stroke-dasharray="6 6"/>'
              f'<line x1="{(x0+x1)/2}" y1="{walk[1]}" x2="{(x0+x1)/2}" y2="{bot_blk[1]}" stroke="{LANE}" stroke-dasharray="6 6"/>'
              + t((x0 + x1) / 2 + 3, 300, name, 8.5, FAINT, rot=-90))
        o.append(g(f'base {key}', st))

    ln = ''.join(f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{LANE}" stroke-width="1.2" stroke-dasharray="14 12"/>' for y in (165, 215))
    ln += f'<line x1="0" y1="188.5" x2="{W}" y2="188.5" stroke="{CENTER}" stroke-width="1.3"/><line x1="0" y1="191.5" x2="{W}" y2="191.5" stroke="{CENTER}" stroke-width="1.3"/>'
    ln += f'<line x1="0" y1="240" x2="{W}" y2="240" stroke="{LANE}" stroke-width="1.2"/>'
    ln += t(830, 182, 'E COLFAX AVE', 9, FAINT, ls=3)
    for (x, y, d) in ((980, 152, -1), (980, 177, -1), (110, 202, 1), (110, 227, 1)):
        x2 = x + 34 * d
        ln += f'<line x1="{x}" y1="{y}" x2="{x2}" y2="{y}" stroke="{FAINT}" stroke-width="1.4"/><path d="M{x2} {y} l{-6*d} -4 v8 z" fill="{FAINT}"/>'
    o.append(g('lanes', ln))

    if traffic:
        cars = []
        for (y, d, dur, delays) in ((152, -1, 11, (0, 5.2)), (177, -1, 14, (2.1, 8.9)), (202, 1, 14, (0.0, 7.0))):
            for dl in delays:
                c = 'car-w' if d < 0 else 'car-e'
                cars.append(f'<rect class="car {c}" x="-20" y="{y-3.5}" width="16" height="7" fill="{BODY}" fill-opacity="0.55" style="animation-duration: {dur}s; animation-delay: -{dl}s;"/>')
        # right eastbound lane: signal left, move over one lane before the taper, carry on away from the cones
        for dl in (3.5, 10.5):  # same 14s loop as the upper lane, phased to land midway between its cars
            st = f'animation-duration: 14s; animation-delay: -{dl}s;'
            cars.append(f'<g class="car-merge" style="{st}"><rect x="-20" y="223.5" width="16" height="7" fill="{BODY}" fill-opacity="0.55"/>'
                        f'<g class="sig" style="{st}"><circle class="sigd" cx="-6" cy="223.2" r="1" fill="{ADV}"/><circle class="sigd" cx="-18" cy="223.2" r="1" fill="{ADV}"/></g></g>')
        o.append(f'<g class="z traffic">{"".join(cars)}</g>')

    o.append(g('k-work wz', f'<rect x="{wz0}" y="242" width="{wz1-wz0}" height="14" fill="url(#h{uid})" stroke="{WORK}" stroke-opacity="0.8"/>'))
    walkc = f'<rect x="{wz0-10}" y="{walk[0]}" width="{wz1-wz0+20}" height="{walk[1]-walk[0]}" fill="url(#w{uid})"/>'
    for x in (wz0 - 16, wz1 + 16):
        walkc += f'<rect x="{x-4}" y="{walk[0]+3}" width="8" height="8" fill="{GROUND}" stroke="{INK}" stroke-width="1"/>'
    o.append(g('k-walk walk', walkc))

    n = 0
    if devices == 'canvas':
        taper, buffer = [tp0 + i * (tp1 - tp0) / 5 for i in range(6)], range(480, wz0, 26)
        work = range(wz0, wz1 + 1, 25)
    else:
        # the run: 3 drums 25 ft apart across the taper, 3 buffer cones 50 ft apart,
        # 18 work-zone cones end to end (58.8 ft apart)
        taper = [tp0 + i * (tp1 - tp0) / 2 for i in range(3)]
        buffer = [tp1 + i * (wz0 - tp1) / 4 for i in range(1, 4)]
        work = [round(wz0 + i * (wz1 - wz0) / 17, 1) for i in range(18)]
    for x in taper:
        y = 255 - (x - tp0) / (tp1 - tp0) * (255 - 241)
        o.append(g('cn k-taper', cone(x, y), n)); n += 1
    for x in buffer:
        o.append(g('cn k-buffer', cone(x, 241), n)); n += 1
    for x in work:
        o.append(g('cn k-work', cone(x, 241), n)); n += 1
    for i in range(1, 3):
        o.append(g('cn k-work', cone(wz1 + i * 16, 241 + i * 6), n)); n += 1

    ab = (f'<rect x="380" y="244" width="16" height="10" fill="{GROUND}" stroke="{WARN}" stroke-width="1"/>'
          f'<g class="ab1"><circle cx="384" cy="247" r="1.4" fill="{WARN}"/><circle cx="392" cy="251" r="1.4" fill="{WARN}"/></g>'
          f'<g class="ab2"><circle cx="392" cy="247" r="1.4" fill="{WARN}"/><circle cx="384" cy="251" r="1.4" fill="{WARN}"/></g>')
    o.append(g('k-taper ab', ab))

    dy = 42
    def dim(x0, x1, label, value, key, i):
        d = (f'<line x1="{x0}" y1="{dy}" x2="{x1}" y2="{dy}" stroke="{FAINT}" stroke-width="1"/>'
             f'<line x1="{x0}" y1="{dy-6}" x2="{x0}" y2="{dy+6}" stroke="{FAINT}"/><line x1="{x1}" y1="{dy-6}" x2="{x1}" y2="{dy+6}" stroke="{FAINT}"/>'
             f'<line x1="{x0}" y1="{dy+6}" x2="{x0}" y2="{top_blk[0]}" stroke="{RULE}" stroke-dasharray="2 3"/>'
             f'<line x1="{x1}" y1="{dy+6}" x2="{x1}" y2="{top_blk[0]}" stroke="{RULE}" stroke-dasharray="2 3"/>'
             + t((x0 + x1) / 2, dy - 18, label, 8.5, FAINT) + t((x0 + x1) / 2, dy - 6, value, 10, DIM, weight=500))
        return g(f'dm {key}', d, i)
    o.append(dim(tp0, tp1, 'L/3', '50 FT', 'k-taper', 0))
    o.append(dim(tp1, wz0, 'BUFFER', '200 FT', 'k-buffer', 1))
    o.append(dim(wz0, wz1, 'WORK ZONE', '1,000 FT', 'k-work', 2))

    segs = [(150, tp0, ADV, 'k-adv'), (tp0, tp1, DIM, 'k-taper'), (tp1, wz0, DIM, 'k-buffer'), (wz0, wz1, WORK, 'k-work'), (wz1, 1150, FAINT, 'k-down')]
    for i, (a, b, c, key) in enumerate(segs):
        o.append(g(f'seg {key}', f'<rect x="{a+1}" y="{bar_y}" width="{b-a-2}" height="5" fill="{c}"/>', i))

    for i, (x, lab, sub) in enumerate(((190, 'W20-1', '300 FT'), (260, 'W20-2', '200 FT'), (330, 'W21-5AR', '100 FT'))):
        y = bar_y + 40
        sg = (f'<rect x="{x-8}" y="{y-8}" width="16" height="16" transform="rotate(45 {x} {y})" fill="{GROUND}" stroke="{DIM}" stroke-width="1.5"/>'
              f'<line x1="{x}" y1="{y-30}" x2="{x}" y2="{y-12}" stroke="{RULE}" stroke-width="1"/>' + t(x, y + 26, lab, 9, INK) + t(x, y + 39, sub, 8.5, FAINT))
        o.append(g('sg k-adv', sg, i))

    fi = (f'<line x1="517" y1="{top_blk[0]}" x2="517" y2="74" stroke="{WARN}" stroke-width="1"/>'
          + (f'<circle class="ring" cx="517" cy="{top_blk[0]}" r="3" fill="none" stroke="{WARN}" stroke-width="1.5"/>' if rings else '')
          + f'<circle cx="517" cy="{top_blk[0]}" r="3" fill="{WARN}"/>'
          f'<rect x="523" y="62" width="168" height="20" fill="{GROUND}" stroke="{WARN}" stroke-opacity="0.7"/>' + t(531, 76, '▲ INTERSECTION · 64 FT', 9, WARN, anchor='start', ls=0.8))
    o.append(g('fl k-int', fi, 0))
    fw = (f'<line x1="700" y1="{walk[1]}" x2="700" y2="{bar_y+18}" stroke="{WARN}" stroke-width="1"/>'
          + (f'<circle class="ring" cx="700" cy="{walk[1]}" r="3" fill="none" stroke="{WARN}" stroke-width="1.5"/>' if rings else '')
          + f'<circle cx="700" cy="{walk[1]}" r="3" fill="{WARN}"/>'
          f'<rect x="706" y="{bar_y+8}" width="214" height="20" fill="{GROUND}" stroke="{WARN}" stroke-opacity="0.7"/>' + t(714, bar_y + 22, '▲ SIDEWALK CLOSED · +4 DEVICES', 9, WARN, anchor='start', ls=0.8))
    o.append(g('fl k-walk', fw, 1))

    o.append(g('base', f'<g transform="translate(1160 30)"><circle r="11" fill="none" stroke="{RULE}"/><path d="M0 -8 L4 5 L0 2 L-4 5 Z" fill="{BODY}"/>' + t(0, 26, 'N', 8.5, FAINT) + '</g>'))
    if note:
        o.append(t(W - 16, H - 14, 'ILLUSTRATION · NOT TO SCALE', 8.5, FAINT, anchor='end'))
    o.append('</svg>')
    return ''.join(o)


if __name__ == '__main__':
    import pathlib
    here = pathlib.Path(__file__).parent
    for name, uid, view in (('step1-plan.svg', 'step1', '370 128 780 150'), ('step3-plan.svg', 'step3', '0 0 1200 430')):
        (here / name).write_text(svg(uid=uid, view=view, note=False), encoding='utf-8')
        print(name)
