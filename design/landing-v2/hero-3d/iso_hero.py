# Landing hero: the Oct 17 Colfax shoulder closure as an isometric diorama. Static (no animation).
# Usage:  python iso_hero.py hero-iso.svg
# Device layout comes from validation-artifacts/committed/landing-source-run/ (Oct 17 run, 30 mph, 1,000 ft).
# Groups that link to the hero card carry data-k="int|walk|taper|buffer|dev"; every top-level group has class "z".
# Same keys as the flat drawing (k-int, k-walk, k-taper, k-buffer, k-work, cn, ab, sg) so the card's
# linked highlight works unchanged. Along the road, world x is in feet and to scale (taper start = 0 ft);
# the work zone has a plan-style break (600-1,100 ft not shown). Widths across the road are exaggerated.
# Camera from the south-west, so signs facing oncoming eastbound traffic face the viewer.
import math, re
# Conestruct design-system colors (dark only)
INK, BODY, FAINT = '#eaf0f7', '#c8d1dd', '#93a0b0'
DIM, WARN, WORK = '#ff8a2e', '#f4c020', '#3fd3a8'      # output orange, site-condition yellow, work-zone teal
RULE, LANE, CENTER = '#2c3e53', '#3a4d66', '#8c7a2a'
MONO = "'JetBrains Mono', ui-monospace, monospace"

A, B = math.radians(24), math.radians(30)
KY, KX = 1.6, 0.72
BRK0_FT, BRK1_FT, GAP = 600, 1100, 22


def F(ft):
    # feet along the road -> world x, with the break removed
    return ft if ft <= BRK0_FT else ft - (BRK1_FT - BRK0_FT) + GAP


YS, YN, T = -30, 212, 16
X0, X1 = F(-345), F(1430)
BX0, BX1 = F(BRK0_FT), BRK0_FT + GAP
PIECES = [(X0, BX0), (BX1, X1)]
WALK = (0, 12); SHO = (12, 28); EB1 = (50, 72); WB2 = (96, 118); NWALK = (118, 130)
WIL = (320, 360)                      # Williams St: the run's work starts 90 ft west of it (log-1440)
STREETS = [WIL]
SEGS = [(X0, WIL[0]), (WIL[1], BX0), (BX1, X1)]
TP0, TP1, WZ0, WZ1 = F(0), F(50), F(250), F(1250)
SUN = (-0.30, -0.55)  # light from the north-east: shadows fall toward the viewer


def _raw(x, y, z=0):
    y, x = y * KY, x * KX
    return (x * math.cos(A) - y * math.cos(B), -x * math.sin(A) - y * math.sin(B) - z)


_pts = [_raw(x, y, z) for x in (X0, X1) for y in (YS - 16, YN) for z in (-T, 0, 84)]
_minx, _maxx = min(a for a, b in _pts), max(a for a, b in _pts)
_miny, _maxy = min(b for a, b in _pts), max(b for a, b in _pts)
W, M, BOT = 1200, 18, 46
K = (W - 2 * M) / (_maxx - _minx)
H = round((_maxy - _miny) * K + M + BOT)
OX = M - _minx * K
OY = M - _miny * K


def P(x, y, z=0):
    a, b = _raw(x, y, z)
    return (OX + a * K, OY + b * K)


def pts(ps):
    return ' '.join(f'{a:.1f},{b:.1f}' for a, b in ps)


def poly(ps, fill, stroke='none', sw=1, extra=''):
    return f'<polygon points="{pts(ps)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>'


def quad(x0, y0, x1, y1, z, fill, stroke='none', sw=1, extra=''):
    return poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], fill, stroke, sw, extra)


def line(x0, y0, x1, y1, z, stroke, sw=1, dash=None, op=1):
    a, b = P(x0, y0, z), P(x1, y1, z)
    da = f' stroke-dasharray="{dash}"' if dash else ''
    return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{stroke}" stroke-width="{sw}" stroke-opacity="{op}"{da}/>'


def hull(ps):
    ps = sorted(set(ps))
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in ps:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def shadow(x0, y0, x1, y1, h, op=0.38):
    base = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    moved = [(x + SUN[0] * h, y + SUN[1] * h) for x, y in base]
    return poly([P(x, y, 0) for x, y in hull(base + moved)], '#050b12', extra=f' fill-opacity="{op}"')


def box(x0, y0, x1, y1, h, top, south, west, stroke='none', z0=0):
    return (poly([P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z0 + h), P(x0, y0, z0 + h)], south, stroke, 0.6)
            + poly([P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z0 + h), P(x0, y0, z0 + h)], west, stroke, 0.6)
            + quad(x0, y0, x1, y1, z0 + h, top, stroke, 0.6))


TS = [1.0]  # text scale, set per render
VIEW = ['wide']


def text(x, y, s, size=9, fill=FAINT, anchor='middle', weight=400, ls=1.2):
    size = size * TS[0]
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{MONO}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" letter-spacing="{ls}">{s}</text>'


def g(cls, inner, i=None):
    st = f' style="--i: {i};"' if i is not None else ''
    return f'<g class="z {cls}"{st}>{inner}</g>'


def cone(x, y, uid, h=11):
    # square rubber base on the pavement, round tapered body (elliptical bottom, rounded tip),
    # two reflective collars that wrap the body, contact shadow
    s = 3.4
    o = shadow(x - s, y - s, x + s, y + s, h * 0.55, 0.5)
    o += box(x - s, y - s, x + s, y + s, 1.0, '#b4551a', '#8a3f12', '#6f330f')
    bx, by = P(x, y, 1.0)
    ax, ay = P(x, y, h)
    r, ry = 4.3, 1.7          # body radius at the base, ellipse depth
    rt = 0.9                  # radius at the rounded tip
    o += (f'<path d="M{bx-r:.1f} {by:.1f} '
          f'C{bx-r*0.92:.1f} {by-(by-ay)*0.45:.1f} {ax-rt*1.6:.1f} {ay+(by-ay)*0.18:.1f} {ax-rt:.1f} {ay+0.6:.1f} '
          f'A{rt:.1f} {rt*0.7:.1f} 0 0 1 {ax+rt:.1f} {ay+0.6:.1f} '
          f'C{ax+rt*1.6:.1f} {ay+(by-ay)*0.18:.1f} {bx+r*0.92:.1f} {by-(by-ay)*0.45:.1f} {bx+r:.1f} {by:.1f} '
          f'A{r:.1f} {ry:.1f} 0 0 1 {bx-r:.1f} {by:.1f} Z" fill="url(#cg{uid})"/>')
    for f in (0.30, 0.56):
        yy = by - (by - ay) * f
        w = r * (1 - f * 0.78)
        o += f'<path d="M{bx-w:.1f} {yy:.1f} A{w:.1f} {ry*(1-f*0.6):.1f} 0 0 0 {bx+w:.1f} {yy:.1f}" stroke="#f4f1ea" stroke-width="1.5" fill="none"/>'
    return o


def drum(x, y, uid, h=9.5, r=3.0):
    # 36-in channelizing drum: shaded cylinder, two reflective bands, contact shadow
    o = shadow(x - r * 0.8, y - r * 0.8, x + r * 0.8, y + r * 0.8, h * 0.55, 0.5)
    bx, by = P(x, y, 0)
    tx, ty = P(x, y, h)
    rs, ry = r * 1.25, 1.6
    o += (f'<path d="M{bx-rs:.1f} {by:.1f} L{tx-rs:.1f} {ty:.1f} A{rs:.1f} {ry:.1f} 0 0 1 {tx+rs:.1f} {ty:.1f} '
          f'L{bx+rs:.1f} {by:.1f} A{rs:.1f} {ry:.1f} 0 0 1 {bx-rs:.1f} {by:.1f} Z" fill="url(#cg{uid})"/>')
    for f in (0.28, 0.62):
        yy = by - (by - ty) * f
        o += f'<path d="M{bx-rs:.1f} {yy:.1f} A{rs:.1f} {ry:.1f} 0 0 0 {bx+rs:.1f} {yy:.1f} l0 -2.2 A{rs:.1f} {ry:.1f} 0 0 1 {bx-rs:.1f} {yy-2.2:.1f} Z" fill="#f4f1ea"/>'
    o += f'<ellipse cx="{tx:.1f}" cy="{ty:.1f}" rx="{rs:.1f}" ry="{ry:.1f}" fill="#ffa45a" stroke="#c35a16" stroke-width="0.6"/>'
    return o


def sign_face(x, y, zc, d):
    # a diamond warning sign in the plane facing west (oncoming eastbound traffic).
    # The panel edge shows behind it (+x, away from the viewer), and the black border and legend
    # are only on the front, so it reads as facing the cars.
    def S(u, v, dx=0.0):
        return P(x + dx, y + u / KY, zc + v)
    dia = lambda k, dx=0.0: [S(0, d * k, dx), S(d * k, 0, dx), S(0, -d * k, dx), S(-d * k, 0, dx)]
    o = poly(dia(1, 1.6), '#4a5666', '#0c1622', 0.8)                     # panel edge / back
    o += poly(dia(1), DIM, '#0c1622', 0.8)                               # reflective face
    o += poly(dia(0.82), 'none', '#111820', 1.1)                         # black border
    for v, a in ((2.6, 3.0), (0.2, 4.2), (-2.2, 3.0)):                   # legend
        q0, q1 = S(-a, v), S(a, v)
        o += f'<line x1="{q0[0]:.1f}" y1="{q0[1]:.1f}" x2="{q1[0]:.1f}" y2="{q1[1]:.1f}" stroke="#111820" stroke-width="1.6"/>'
    return o


def tree(x, y, uid, h=17, r=7.5):
    sx, sy = P(x + SUN[0] * h * 0.8, y + SUN[1] * h * 0.8)
    o = f'<ellipse cx="{sx:.1f}" cy="{sy:.1f}" rx="{r*K*1.15:.1f}" ry="{r*K*0.5:.1f}" fill="#050b12" fill-opacity="0.35"/>'
    a, b = P(x, y, 0), P(x, y, h - r * 0.6)
    o += f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="#3b3326" stroke-width="1.6"/>'
    c = P(x, y, h)
    o += f'<circle cx="{c[0]:.1f}" cy="{c[1]:.1f}" r="{r*K:.1f}" fill="url(#tg{uid})"/>'
    return o


HOVER = {'int': 'int', 'walk': 'walk', 'taper': 'taper', 'buffer': 'buffer', 'dev': 'dev'}


def _hover_key(cls):
    c = cls.split()
    if 'k-int' in c: return 'int'
    if 'k-walk' in c: return 'walk'
    if 'k-taper' in c: return 'taper'
    if 'k-buffer' in c: return 'buffer'
    if 'cn' in c or 'sg' in c: return 'dev'
    return None


def _add_hover(svg_text):
    def sub(m):
        k = _hover_key(m.group(1))
        if not k:
            return m.group(0)
        return f'<g class="z {m.group(1)} hv" onMouseEnter="{{{{on.{k}}}}}" onMouseLeave="{{{{off}}}}"'
    return re.sub(r'<g class="z ([^"]*)"', sub, svg_text)


def _add_data_k(svg_text):
    def sub(m):
        k = _hover_key(m.group(1))
        return m.group(0) if not k else f'<g class="z {m.group(1)} hv" data-k="{k}"'
    return re.sub(r'<g class="z ([^"]*)"', sub, svg_text)


def svg(svg_class='', uid='i', view='wide', hover=False):
    out = _svg(svg_class, uid, view)
    if hover == 'data':
        return _add_data_k(out)
    return _add_hover(out) if hover else out


def view_box(view):
    if view == 'wide':
        return 0, 0, W, H, 1.3
    # phone: crop to the arrow board, taper, buffer and the start of the work zone
    ps = [P(x, y, z) for x in (F(-70), F(330)) for y in (YS - 16, YN - 70) for z in (-T - 14, 0, 30)]
    x0 = min(a for a, b in ps); x1 = max(a for a, b in ps)
    y0 = min(b for a, b in ps); y1 = max(b for a, b in ps)
    vbw, vbh = x1 - x0, y1 - y0
    ts = max(1.3, 11.2 * vbw / (9 * 358))
    return x0, y0, vbw, vbh, ts


def _svg(svg_class, uid, view):
    vx, vy, vw, vh, TS[0] = view_box(view)
    VIEW[0] = view
    cls = f' class="{svg_class}"' if svg_class else ''
    o = [f'<svg{cls} viewBox="{vx:.0f} {vy:.0f} {vw:.0f} {vh:.0f}" width="100%" role="img" aria-label="Isometric illustration of the Colfax shoulder closure: advance signs, arrow board, a 50 foot taper, a 200 foot buffer and a 1,000 foot work zone on the eastbound shoulder, with the nearby intersection and the closed sidewalk flagged" style="display: block; height: auto;">']
    o.append('<defs>'
             f'<pattern id="h{uid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="6" stroke="{WORK}" stroke-width="1.3" stroke-opacity="0.55"/></pattern>'
             f'<pattern id="w{uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><line x1="0" y1="0" x2="0" y2="5" stroke="{WARN}" stroke-width="1" stroke-opacity="0.5"/></pattern>'
             f'<linearGradient id="bg{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#132232"/><stop offset="1" stop-color="#0c1722"/></linearGradient>'
             f'<radialGradient id="pool{uid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#1f3550" stop-opacity="0.85"/><stop offset="1" stop-color="#1f3550" stop-opacity="0"/></radialGradient>'
             f'<linearGradient id="cg{uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffa45a"/><stop offset="0.45" stop-color="#ff8a2e"/><stop offset="1" stop-color="#c35a16"/></linearGradient>'
             f'<radialGradient id="tg{uid}" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#4b6b5f"/><stop offset="0.7" stop-color="#2b4540"/><stop offset="1" stop-color="#1d322f"/></radialGradient>'
             f'<linearGradient id="fs{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2b3e"/><stop offset="1" stop-color="#0e1925"/></linearGradient>'
             f'<radialGradient id="ag{uid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{WARN}" stop-opacity="0.35"/><stop offset="1" stop-color="{WARN}" stop-opacity="0"/></radialGradient>'
             f'<radialGradient id="wg{uid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff8a2e" stop-opacity="0.16"/><stop offset="1" stop-color="#ff8a2e" stop-opacity="0"/></radialGradient>'
             '</defs>')
    o.append(f'<rect x="{vx:.0f}" y="{vy:.0f}" width="{vw:.0f}" height="{vh:.0f}" fill="url(#bg{uid})"/>')
    c = P(250, 90, 0)
    o.append(f'<ellipse cx="{c[0]:.0f}" cy="{c[1]+30:.0f}" rx="660" ry="{H*0.48:.0f}" fill="url(#pool{uid})"/>')

    # ---- ground ----
    base = []
    for (p0, p1) in PIECES:
        base.append(poly([P(p0, YS, 0), P(p1, YS, 0), P(p1, YS, -T), P(p0, YS, -T)], f'url(#fs{uid})', '#2c3e53', 0.8))
        base.append(poly([P(p0, YS, 0), P(p0, YN, 0), P(p0, YN, -T), P(p0, YS, -T)], '#0b1520', '#2c3e53', 0.8))
        base.append(quad(p0, YS, p1, YN, 0, '#162636'))
        base.append(quad(p0, SHO[0], p1, NWALK[0], 0, '#1e2f42'))
        base.append(line(p0, YS, p1, YS, 0, '#3a4f68', 1))
        base.append(line(p0, YS, p0, YN, 0, '#3a4f68', 1))
    for (a, b) in STREETS:
        base.append(quad(a, YS, b, YN, 0, '#1e2f42'))
    o.append(g('base', ''.join(base)))

    # raised sidewalks (curb faces show on the road side of the north walk)
    walks = []
    for (s0, s1) in SEGS:
        walks.append(box(s0, NWALK[0], s1, NWALK[1], 1.6, '#25384d', '#2f4560', '#1c2c3e'))
        walks.append(box(s0, WALK[0], s1, WALK[1], 1.6, '#25384d', '#2f4560', '#1c2c3e'))
    o.append(g('base', ''.join(walks)))

    # ---- markings ----
    ln = []
    segs = SEGS
    for y in (EB1[0], WB2[0]):
        for (s0, s1) in segs:
            ln.append(line(s0 + 4, y, s1 - 4, y, 0, LANE, 1.2, '12 10'))
    for y in (72.4, 73.8):
        for (s0, s1) in segs:
            ln.append(line(s0, y, s1, y, 0, CENTER, 1.2))
    for (s0, s1) in segs:
        ln.append(line(s0, SHO[1], s1, SHO[1], 0, '#4b5f7a', 1.2))
    # crosswalks: zebra bars on both sides of each cross street
    for (a, b) in STREETS:
        for xc in (a - 7, b + 7):
            if xc < X0 + 4 or xc > X1 - 4:
                continue
            y = SHO[0] + 2
            while y < NWALK[0] - 4:
                ln.append(quad(xc - 4, y, xc + 4, y + 3.2, 0, '#9aa8b8', extra=' fill-opacity="0.42"'))
                y += 6.5
    for (x, y, d) in ((880, 85, -1), (880, 107, -1)):
        a, b = P(x, y, 0), P(x + 40 * d, y, 0)
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        ln.append(f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{FAINT}" stroke-width="1.4"/>'
                  f'<path d="M0 -4 L7 0 L0 4 Z" fill="{FAINT}" transform="translate({b[0]:.1f} {b[1]:.1f}) rotate({ang:.1f})"/>')
    nm = P(40, 79, 0)
    ln.append(f'<text x="{nm[0]:.1f}" y="{nm[1]:.1f}" font-family="{MONO}" font-size="{10*TS[0]:.1f}" fill="{FAINT}" letter-spacing="4" transform="rotate({-math.degrees(A):.1f} {nm[0]:.1f} {nm[1]:.1f})">E COLFAX AVE</text>')
    o.append(g('lanes', ''.join(ln)))

    # ---- work zone surfaces ----
    glow = ''.join(f'<ellipse cx="{P(x, 20, 0)[0]:.1f}" cy="{P(x, 20, 0)[1]:.1f}" rx="{70*K:.0f}" ry="{26*K:.0f}" fill="url(#wg{uid})"/>'
                   for x in (WZ0 + 60, WZ0 + 200, BX0 - 40, BX1 + 70))
    o.append(g('k-work wz', glow + quad(WZ0, SHO[0] + 1.5, BX0, SHO[1] - 1.5, 0, f'url(#h{uid})', WORK, 1, ' stroke-opacity="0.85"')
                + quad(BX1, SHO[0] + 1.5, WZ1, SHO[1] - 1.5, 0, f'url(#h{uid})', WORK, 1, ' stroke-opacity="0.85"')))
    o.append(g('k-walk walk', quad(WZ0 - 12, WALK[0] + 1, BX0, WALK[1] - 1, 1.6, f'url(#w{uid})')
                + quad(BX1, WALK[0] + 1, WZ1 + 12, WALK[1] - 1, 1.6, f'url(#w{uid})')))

    # ---- buildings (north, behind the road) with cast shadows ----
    blds = []
    spans = [(X0 + 6, WIL[0] - 8), (WIL[1] + 8, BX0 - 4), (BX1 + 4, X1 - 6)]
    k = 0
    for (s0, s1) in spans:
        x = s0
        while x < s1 - 30:
            w = 44 + (k * 23) % 52
            if x + w > s1: w = s1 - x
            if w < 26: break
            d = 36 + (k * 13) % 34
            h = 24 + (k * 29) % 58
            blds.append((x, NWALK[1] + 9, x + w, NWALK[1] + 9 + d, h))
            x += w + 9
            k += 1
    # far end (past the break): hand-placed, varied block instead of the generated run
    yb = NWALK[1] + 9
    blds = [b for b in blds if b[0] < BX1] + [
        (BX1 + 6, yb + 4, BX1 + 44, yb + 34, 13, 'shop'),
        (BX1 + 50, yb, BX1 + 96, yb + 52, 46, 'step'),
        (BX1 + 102, yb + 8, BX1 + 128, yb + 40, 30, 'roof'),
        (BX1 + 134, yb, BX1 + 168, yb + 58, 64, 'plain'),
        (BX1 + 174, yb + 6, min(BX1 + 206, X1 - 6), yb + 36, 20, 'roof'),
    ]
    blds = [b if len(b) == 6 else b + (('roof', 'plain', 'step', 'plain')[i % 4],) for i, b in enumerate(blds)]
    o.append(g('base', ''.join(shadow(b[0], b[1], b[2], b[3], b[4], 0.42) for b in blds)))


    blds.sort(key=lambda b: P(b[0], b[1], 0)[1])
    TONES = (('#22354a', '#1a2b3e', '#132233'), ('#283c52', '#1f3246', '#162739'), ('#1f3044', '#182838', '#111e2d'))
    bl = []
    for i, (x0, y0, x1, y1, h, style) in enumerate(blds):
        top, south, west = TONES[i % 3]
        # contact shading where the facade meets the sidewalk
        bl.append(poly([P(x0, y0, 0), P(x1, y0, 0), P(x1, y0 - 4, 0), P(x0, y0 - 4, 0)], '#050b12', extra=' fill-opacity="0.35"'))
        if style == 'step':
            # lower podium, upper floors set back from the street
            bl.append(box(x0, y0, x1, y1, h * 0.45, top, south, west, '#0c1622'))
            bl.append(box(x0 + 6, y0 + 12, x1 - 4, y1, h, top, south, west, '#0c1622'))
        else:
            bl.append(box(x0, y0, x1, y1, h, top, south, west, '#0c1622'))
        if style == 'shop':
            # storefront band and a canvas awning over the sidewalk
            bl.append(poly([P(x0 + 3, y0, 2), P(x1 - 3, y0, 2), P(x1 - 3, y0, 8), P(x0 + 3, y0, 8)], '#2c4560'))
            bl.append(poly([P(x0 + 2, y0, 9.5), P(x1 - 2, y0, 9.5), P(x1 - 2, y0 - 5, 7.5), P(x0 + 2, y0 - 5, 7.5)], '#3c5f72', '#0c1622', 0.6))
        if style == 'roof':
            # rooftop mechanical units
            bl.append(box(x0 + 5, y0 + 6, x0 + 12, y0 + 13, 3.5, '#33495f', '#2a3e53', '#1f3043', '#0c1622', z0=h))
            bl.append(box(x1 - 12, y1 - 14, x1 - 5, y1 - 6, 2.5, '#33495f', '#2a3e53', '#1f3043', '#0c1622', z0=h))
        if style in ('plain', 'step') and h > 28:
            hh = h if style == 'plain' else h
            for j in range(3 if h > 50 else 2):
                zz = hh * (0.3 + 0.22 * j)
                xa, xb = (x0 + 5, x1 - 5) if style == 'plain' else (x0 + 10, x1 - 8)
                ya = y0 if style == 'plain' else y0 + 12
                if style == 'step' and zz < h * 0.45:
                    ya = y0
                bl.append(poly([P(xa, ya, zz), P(xb, ya, zz), P(xb, ya, zz + 2.6), P(xa, ya, zz + 2.6)], '#2c4560'))
    o.append(g('base', ''.join(bl)))

    # street trees on the north walk
    trees = [x for x in range(X0 + 30, X1 - 20, 72) if not any(a - 12 < x < b + 12 for a, b in STREETS + [(BX0, BX1)])]
    o.append(g('base', ''.join(tree(x, 124.5, uid) for x in trees)))

    # south side: low planters only, so nothing hides the work
    sb = ''.join(box(x0, YS + 5, x1, WALK[0] - 5, 3, '#1b2c3e', '#15243a', '#0f1c2c') for (x0, x1) in ((X0 + 6, WIL[0] - 8), (WIL[1] + 8, BX0 - 4), (BX1 + 4, X1 - 6)))
    o.append(g('base', sb))

    # ---- closed-sidewalk barricades: Type III, rails facing people on the walk ----
    bar = ''
    for x in (WZ0, WZ1):
        y0, y1 = WALK[0] + 1.5, WALK[1] - 1.5
        bar += shadow(x - 0.6, y0, x + 0.6, y1, 9, 0.4)
        for yy in (y0 + 0.8, y1 - 0.8):
            a0, a1 = P(x, yy, 1.6), P(x, yy, 11)
            bar += f'<line x1="{a0[0]:.1f}" y1="{a0[1]:.1f}" x2="{a1[0]:.1f}" y2="{a1[1]:.1f}" stroke="#c8d1dd" stroke-width="1.4"/>'
        for z0 in (4.2, 7.6):
            bar += poly([P(x, y0, z0), P(x, y1, z0), P(x, y1, z0 + 2.2), P(x, y0, z0 + 2.2)], '#f1ede4')
            n = 4
            for k in range(n):
                if k % 2 == 0:
                    ya = y0 + (y1 - y0) * k / n
                    yb = y0 + (y1 - y0) * (k + 1) / n
                    bar += poly([P(x, ya, z0), P(x, yb, z0), P(x, yb, z0 + 2.2), P(x, ya, z0 + 2.2)], DIM)
    # R9-9 on each barricade: the upstream one faces walkers coming from the west (front visible),
    # the downstream one faces walkers from the east (its back shows)
    for x, front in ((WZ0, True), (WZ1, False)):
        y0, y1 = WALK[0] + 2.5, WALK[1] - 2.5
        face = [P(x, y0, 11.5), P(x, y1, 11.5), P(x, y1, 16.5), P(x, y0, 16.5)]
        if front:
            bar += poly([P(x + 1.2, y0, 11.5), P(x + 1.2, y1, 11.5), P(x + 1.2, y1, 16.5), P(x + 1.2, y0, 16.5)], '#4a5666')
            bar += poly(face, '#f4f1ea', '#111820', 0.8)
            for zz, w in ((15, 0.75), (13.2, 0.75)):
                q0, q1 = P(x, y0 + (y1 - y0) * (1 - w) / 2, zz), P(x, y1 - (y1 - y0) * (1 - w) / 2, zz)
                bar += f'<line x1="{q0[0]:.1f}" y1="{q0[1]:.1f}" x2="{q1[0]:.1f}" y2="{q1[1]:.1f}" stroke="#111820" stroke-width="1.3"/>'
        else:
            bar += poly(face, '#7b8796', '#0c1622', 0.6)
    o.append(g('k-walk', bar))

    # ---- devices, from the Oct 17 run: 3 drums in the 50 ft taper (25 ft apart), 3 buffer cones (50 ft),
    # 18 work-zone cones (58.8 ft), 2 cones in the 50 ft downstream taper ----
    items = []
    for ft in (0, 25, 50):
        items.append((F(ft), 14.5 + ft / 50 * (26 - 14.5), 'cn k-taper', 'drum'))
    for ft in (100, 150, 200):
        items.append((F(ft), 26, 'cn k-buffer', 'cone'))
    for k in range(18):
        ft = 250 + 58.8 * k
        if ft <= BRK0_FT or ft >= BRK1_FT:
            items.append((F(ft), 26, 'cn k-work', 'cone'))
    for ft, y in ((1275, 20.2), (1300, 14.5)):
        items.append((F(ft), y, 'cn k-work', 'cone'))
    items.sort(key=lambda t: P(t[0], t[1], 0)[1])
    for n, (x, y, c, kind) in enumerate(items):
        o.append(g(c, (drum if kind == 'drum' else cone)(x, y, uid), n))

    # work truck parked in the zone: cab (east, farther) first, then the box body in front of it
    tr = shadow(420, 14.5, 453, 25.5, 14, 0.45)
    tr += box(444, 15.5, 453, 24.5, 10, '#dfe3ea', '#b9c1cc', '#c9d0d9', '#0c1622')
    tr += poly([P(446, 15.5, 5.5), P(452, 15.5, 5.5), P(452, 15.5, 9), P(446, 15.5, 9)], '#1d2a38')
    lb0, lb1 = P(445, 20, 10.6), P(452, 20, 10.6)
    tr += f'<line x1="{lb0[0]:.1f}" y1="{lb0[1]:.1f}" x2="{lb1[0]:.1f}" y2="{lb1[1]:.1f}" stroke="{WARN}" stroke-width="2.4" stroke-linecap="round"/>'
    tr += box(420, 14.5, 444, 25.5, 14, '#eef1f5', '#c3cad4', '#d6dbe2', '#0c1622')
    tr += poly([P(422, 14.5, 4), P(442, 14.5, 4), P(442, 14.5, 6), P(422, 14.5, 6)], DIM)
    o.append(g('k-work', tr))

    # arrow board trailer, caution bar lit
    ab = shadow(-24, 15, 0, 26, 26, 0.4)
    ab += box(-22, 16, -2, 25, 4, '#2c3e53', '#22344a', '#1a293b', '#0c1622')
    p0, p1 = P(-12, 20.5, 4), P(-12, 20.5, 17)
    ab += f'<line x1="{p0[0]:.1f}" y1="{p0[1]:.1f}" x2="{p1[0]:.1f}" y2="{p1[1]:.1f}" stroke="#7d8a9a" stroke-width="1.6"/>'
    gc = P(-24, 20.5, 23)
    ab += f'<ellipse cx="{gc[0]:.1f}" cy="{gc[1]:.1f}" rx="34" ry="22" fill="url(#ag{uid})"/>'
    ab += poly([P(-18, 13, 16), P(-18, 28, 16), P(-18, 28, 31), P(-18, 13, 31)], '#4a5666', '#0c1622', 0.8)
    ab += poly([P(-20, 13, 16), P(-20, 28, 16), P(-20, 28, 31), P(-20, 13, 31)], '#0a131c', '#4b5f7a', 1)
    for v in (15.5, 18, 20.5, 23, 25.5):
        q = P(-20, v, 23.5)
        ab += f'<circle cx="{q[0]:.1f}" cy="{q[1]:.1f}" r="1.6" fill="{WARN}"/>'
    o.append(g('k-taper ab', ab))

    # advance signs on posts, on the south walk
    for i, (x, lab, sub) in enumerate(((F(-300), 'W20-1', '300 FT'), (F(-200), 'W20-2', '200 FT'), (F(-100), 'W21-5AR', '100 FT'))):
        sh = P(x + SUN[0] * 18, 6 + SUN[1] * 18, 1.6)
        b0, b1 = P(x, 6, 1.6), P(x, 6, 26)
        d = 11
        zc = 26 + d
        dia = [P(x, 6, zc + d), P(x, 6 + d / KY, zc), P(x, 6, zc - d), P(x, 6 - d / KY, zc)]
        b1 = P(x, 6, zc - d)
        sg = (f'<line x1="{b0[0]:.1f}" y1="{b0[1]:.1f}" x2="{sh[0]:.1f}" y2="{sh[1]:.1f}" stroke="#050b12" stroke-opacity="0.4" stroke-width="2"/>'
              f'<line x1="{b0[0]:.1f}" y1="{b0[1]:.1f}" x2="{b1[0]:.1f}" y2="{b1[1]:.1f}" stroke="#8c99a8" stroke-width="1.5"/>'
              + sign_face(x, 6, zc, d)
              + (text(b0[0], b0[1] + 14 + 9 * TS[0], lab, 9, INK) + text(b0[0], b0[1] + 16 + 21 * TS[0], sub, 8.5, FAINT) if VIEW[0] == 'wide' else ''))
        o.append(g('sg k-adv', sg, i))
    # G20-2 END ROAD WORK, 150 ft past the downstream end (+1,400 ft): a horizontal rectangle facing eastbound traffic
    xe = F(1400)
    b0 = P(xe, 6, 1.6)
    e1 = P(xe, 6, 24)
    ew, eh, ez = 7.0, 3.6, 26.5
    S2 = lambda u, v, dx=0.0: P(xe + dx, 6 + u / KY, ez + v)
    rect = lambda dx=0.0: [S2(-ew, -eh, dx), S2(ew, -eh, dx), S2(ew, eh, dx), S2(-ew, eh, dx)]
    eg = (f'<line x1="{b0[0]:.1f}" y1="{b0[1]:.1f}" x2="{e1[0]:.1f}" y2="{e1[1]:.1f}" stroke="#8c99a8" stroke-width="1.5"/>'
          + poly(rect(1.6), '#4a5666', '#0c1622', 0.8) + poly(rect(), DIM, '#0c1622', 0.8))
    for v in (1.2, -1.2):
        q0, q1 = S2(-ew * 0.7, v), S2(ew * 0.7, v)
        eg += f'<line x1="{q0[0]:.1f}" y1="{q0[1]:.1f}" x2="{q1[0]:.1f}" y2="{q1[1]:.1f}" stroke="#111820" stroke-width="1.5"/>'
    if VIEW[0] == 'wide':
        eg += text(b0[0], b0[1] + 14 + 9 * TS[0], 'G20-2', 9, INK) + text(b0[0], b0[1] + 16 + 21 * TS[0], 'END', 8.5, FAINT)
    o.append(g('sg k-adv', eg, 3))

    # site-condition pins
    def pin(x, y, label, key, i, h=58, z0=0, flip=False):
        b0, b1 = P(x, y, z0), P(x, y, z0 + h)
        tw = (len(label) * 6.2 + 20) * TS[0]
        th = 20 * TS[0]
        rx = b1[0] - tw if flip else b1[0]
        return g(f'fl {key}',
                 f'<line x1="{b0[0]:.1f}" y1="{b0[1]:.1f}" x2="{b1[0]:.1f}" y2="{b1[1]:.1f}" stroke="{WARN}" stroke-width="1.2"/>'
                 f'<ellipse cx="{b0[0]:.1f}" cy="{b0[1]:.1f}" rx="6" ry="2.4" fill="none" stroke="{WARN}" stroke-width="1.2"/>'
                 f'<circle cx="{b0[0]:.1f}" cy="{b0[1]:.1f}" r="2" fill="{WARN}"/>'
                 f'<rect x="{rx:.1f}" y="{b1[1]-th:.1f}" width="{tw:.0f}" height="{th:.1f}" fill="#0c1622" stroke="{WARN}" stroke-opacity="0.85"/>'
                 + text(rx + 8 * TS[0], b1[1] - 6 * TS[0], label, 9, WARN, anchor='start', ls=0.8), i)
    o.append(pin(340, 74, '▲ INTERSECTION · 64 FT', 'k-int', 0, h=92) if VIEW[0] == 'wide' else pin(340, 74, '▲ INTERSECTION', 'k-int', 0, h=96, flip=True))
    o.append(pin(545, 6, '▲ SIDEWALK CLOSED · +4 DEVICES', 'k-walk', 1, h=30, z0=1.6) if VIEW[0] == 'wide' else pin(330, 6, '▲ SIDEWALK CLOSED', 'k-walk', 1, h=12, z0=1.6, flip=True))

    # dimension rail along the front edge of the slab
    ry = YS - 12
    def along(x0, x1, off=None):
        off = off if off is not None else 15
        # text anchor point centered under a rail segment, plus the rail's angle
        a, b = P(x0, ry, -T), P(x1 if x1 != x0 else x0 + 10, ry, -T)
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if x1 == x0:
            b = a
        nx, ny = -dy / L, dx / L                     # perpendicular, pointing down-right
        m = ((a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off)
        return m, math.degrees(math.atan2(dy, dx))

    def label_on(x0, x1, label, value, col):
        # centered under its line; if the label is longer than the line, it sits just before the line's start
        (mx, my), ang = along(x0, x1)
        a, b = P(x0, ry, -T), P(x1, ry, -T)
        seg_len = math.hypot(b[0] - a[0], b[1] - a[1])
        fs = 10 * min(TS[0], 1.1)
        est = (len(label) + 1 + len(value)) * fs * 0.62 + (len(label) + len(value)) * 1.0
        anchor = 'middle'
        if est > seg_len - 8:
            (sx, sy), _ = along(x0, x0)
            ux, uy = (b[0] - a[0]) / seg_len, (b[1] - a[1]) / seg_len
            mx, my, anchor = sx - ux * 6, sy - uy * 6, 'end'
        return (f'<text x="{mx:.1f}" y="{my:.1f}" font-family="{MONO}" font-size="{fs:.1f}" text-anchor="{anchor}" letter-spacing="1" '
                f'dominant-baseline="middle" transform="rotate({ang:.1f} {mx:.1f} {my:.1f})">'
                f'<tspan fill="{FAINT}">{label} </tspan><tspan fill="{col}" font-weight="600">{value}</tspan></text>')

    def seg(x0, x1, col, ends=True):
        a, b = P(x0, ry, -T), P(x1, ry, -T)
        o_ = f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{col}" stroke-width="2"/>'
        if ends:
            for q in (a, b):
                o_ += f'<line x1="{q[0]:.1f}" y1="{q[1]-5:.1f}" x2="{q[0]:.1f}" y2="{q[1]+5:.1f}" stroke="{BODY}"/>'
        return o_

    if VIEW[0] == 'narrow':
        o.append('</svg>')
        return ''.join(o)
    o.append(g('dm k-taper', seg(TP0, TP1, DIM) + label_on(TP0, TP1, 'L/3', '50 FT', DIM), 0))
    o.append(g('dm k-buffer', seg(TP1, WZ0, DIM) + label_on(TP1, WZ0, 'BUFFER', '200 FT', DIM), 1))
    q0, q1 = P(BX0, ry, -T), P(BX1, ry, -T)
    brk = f'<path d="M{q0[0]-3:.1f} {q0[1]+6:.1f} l4 -12 M{q1[0]-3:.1f} {q1[1]+6:.1f} l4 -12" stroke="{BODY}" stroke-width="1.3"/>'
    (gx, gy), gang = along(BX0, BX1)
    gap_lab = (f'<text x="{gx:.1f}" y="{gy:.1f}" font-family="{MONO}" font-size="{8.5*min(TS[0], 1.1):.1f}" fill="{FAINT}" text-anchor="middle" letter-spacing="0.6" '
               f'dominant-baseline="middle" transform="rotate({gang:.1f} {gx:.1f} {gy:.1f})">500 FT NOT SHOWN</text>')
    o.append(g('dm k-work', seg(WZ0, BX0, WORK) + seg(BX1, WZ1, WORK) + brk + label_on(WZ0, BX0, 'WORK ZONE', '1,000 FT', WORK) + gap_lab, 2))

    o.append('</svg>')
    return ''.join(o)


if __name__ == '__main__':
    import sys, pathlib
    out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'hero-iso.svg')
    out.write_text(svg(svg_class='hero-iso', uid='h', hover='data'))
    print(out, W, H)
