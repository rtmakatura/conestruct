# Folds measure-*.json (production runs) into measurements.json with one verdict per check.
# Run from prod-check/: python script/measure.py
import json, re
from PIL import Image

L1 = json.load(open('measure-l1-downloads.json', encoding='utf-8'))
L2 = json.load(open('measure-l2.json', encoding='utf-8'))
L3 = json.load(open('measure-l3.json', encoding='utf-8'))
REF2 = json.load(open('../L2/measurements.json', encoding='utf-8'))
REF3 = json.load(open('../L3/measurements.json', encoding='cp1252'))  # L3 wrote it in the Windows code page
ACT = (52, 169, 232)
RULE = (44, 62, 83)  # --rule #2c3e53, the frame's 1 px rule (as L3/script/measure.py)

def lum(c):
    def ch(v):
        v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c[:3]; return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return round((la + 0.05) / (lb + 0.05), 2)
def rgb(s): return tuple(int(x) for x in re.findall(r'\d+', s)[:3])
def ground(img, vr):
    x, y, w, h = vr; return img.getpixel((int((x + 4) * 2), int((y + h - 4) * 2)))

out = {'method': "Production https://www.conestruct.com at ae38fac (healthz checked first), gate header attached to conestruct.com requests only. Playwright Chromium (1440x900, 390x844, 360x780) and WebKit (390x844), DPR 2. Road detection live (no stub): /api/road-bearing returned 200 with candidates on every run (statuses in each run's log). Pointer parked at the viewport's bottom-right corner before every measure and shot; picker shots wait for Mapbox requests to settle (none in flight for 1.5 s). Label centre x = text node client-rect centre minus the control's left edge, the same control measured unpressed then pressed. Select contrast: computed ink against the screenshot pixel at (x + 0.6w, y + 6), the rendered ground (L2's method). Frame pixels: rule-coloured device pixels where the frame's left/top line crosses the dialog's header band (L3's method).",
       'note': 'Playwright WebKit is not a real iPhone; iOS Safari is unchecked.', 'checks': {}}
C = out['checks']

# 1-3
c1 = {t: L1[t]['fresh']['w20'] for t in ('1440', '390')}
C['1_W20'] = {'measured': c1, 'pass': all('Set a location first: use Pick on map to find the site.' in ' '.join(v) for v in c1.values())}
c2 = {t: {'reason': L1[t]['declined']['w7'], 'strip': L1[t]['declined']['declinedStrip'], 'stripRect': L1[t]['declined']['stripRect']} for t in ('1440', '390')}
C['2_W7'] = {'measured': c2, 'pass': all(any(l.strip() == 'Generation declined. The PLAN DECLINED notice says why.' for l in v['reason']) and v['strip'] and (v['stripRect'] or {}).get('visible') for v in c2.values())}
c3 = {t: L1[t]['declined']['w6'] for t in ('1440', '390')}
C['3_W6'] = {'measured': c3, 'pass': all(any('the option shown stands' in l for l in v) and not any('you picked' in l for l in v) for v in c3.values())}

# 4 W12
c4 = {}
for t, v in L2.items():
    if 'error' in v: c4[t] = {'error': v['error']}; continue
    im = Image.open(f'shots/px-{t}-chips.png').convert('RGB'); ims = Image.open(f'shots/px-{t}-seg.png').convert('RGB')
    n = v['segAfter']['Night']
    c4[t] = {'chip': {'unpressedCheck': [v['chipUnpressed']['checkContent'], v['chipUnpressed']['checkVisibility']], 'pressedCheck': [v['chipPressed']['checkContent'], v['chipPressed']['checkVisibility']],
                      'labelCentreX_unpressed': v['chipUnpressed']['labelTextCentreX'], 'labelCentreX_pressed': v['chipPressed']['labelTextCentreX'], 'delta': v['chipCentreDelta'],
                      'checkContrastOnGround': ratio(ACT, ground(im, v['chipPressed']['vrect']))},
             'toggle': {'Night_unpressed': {k: v['segBefore']['Night'][k] for k in ('pressed', 'checkContent', 'labelTextCentreX', 'buttonCentreX')},
                        'Night_pressed': {k: n[k] for k in ('pressed', 'checkContent', 'checkPosition', 'labelTextCentreX', 'buttonCentreX')},
                        'delta': v['segCentreDelta'], 'checkContrastOnGround': ratio(ACT, ground(ims, n['vrect']))}}
ok4 = all('error' not in x and '✓' in x['chip']['pressedCheck'][0] and x['chip']['pressedCheck'][1] == 'visible' and x['chip']['unpressedCheck'][1] == 'hidden'
          and abs(x['chip']['delta']) <= 0.01 and '✓' in x['toggle']['Night_pressed']['checkContent'] and x['toggle']['Night_unpressed']['checkContent'] in ('none', 'normal')
          and abs(x['toggle']['delta']['Night']) <= 0.01 and abs(x['toggle']['delta']['Daytime']) <= 0.01 for x in c4.values())
C['4_W12'] = {'measured': c4, 'pass': ok4}

# 5 W13
c5 = {}
for t, v in L2.items():
    if 'selects' not in v: continue
    im = Image.open(f'shots/{t}-w13-select.png').convert('RGB'); rows = []
    for s in v['selects']:
        x, y, w, hh = s['rect']
        if y < 0 or (y + hh) * 2 > im.size[1]: rows.append({**s, 'sampled': 'off-screen'}); continue
        px = im.getpixel((int((x + w * 0.6) * 2), int((y + 6) * 2)))
        rows.append({**s, 'renderedGround': px, 'inkOnRenderedGround': ratio(rgb(s['color']), px)})
    c5[t] = rows
wk = [r['inkOnRenderedGround'] for r in c5.get('390-webkit', []) if 'inkOnRenderedGround' in r]
C['5_W13'] = {'measured': c5, 'webkit390_min': min(wk) if wk else None, 'pass': bool(wk) and min(wk) >= 4.5}

# 6 W15
c6 = {t: {k: {'text': v[k]['stepText'], 'lines': v[k]['stepLinesByRects'], 'linesByHeight': v[k]['stepLinesByHeight'], 'scrollWidth': v[k]['scrollWidth'], 'innerWidth': v[k]['innerWidth']}
          for k in ('head', 'located_head', 'what_head') if k in v} for t, v in L2.items() if t != '390-webkit'}
C['6_W15'] = {'measured': c6, 'pass': all(len(x) == 3 and all(s['lines'] == 1 and s['scrollWidth'] == s['innerWidth'] for s in x.values()) for x in c6.values())}

# 7 W21
# L2's measurements.json holds its text double-encoded ("Â·" for "·"); repaired here before comparing.
ref1440 = [{**c, 'text': c['text'].encode('latin-1').decode('utf-8')} for c in REF2['after']['1440']['nav_bordered_cells']]
c7 = {t: L2[t]['nav'] for t in ('1440', '390', '360', '390-webkit') if t in L2}
C['7_W21'] = {'measured': c7, 'reference_1440_L2_after': ref1440,
              'pass': c7['390']['wordmark']['borderRight'] == '0px' and c7['390']['borderedCells'] == [] and c7['1440']['borderedCells'] == ref1440}

# 8 hover fold-in
c8 = {t: {'pressedHovered': v['hoverPressed'], 'unpressedHovered': v['hoverUnpressed']['hovered'], 'unpressedAtRest': v['restUnpressed']} for t, v in L2.items() if 'hoverPressed' in v}
C['8_hover'] = {'measured': c8, 'pass': all(x['pressedHovered'] == 'rgb(52, 169, 232)' for x in c8.values()) and len(c8) == 4}

# 9 W14
SHOT = {'detecting': 'detecting', 'roads': 'roads'}
def frame_pixels(tag, st, v):
    fr = v['frame' + st[0].upper() + st[1:]]; m = v[st]
    if not fr.get('frame'): return {'frame': 'absent'}
    d = m['dialog']; h = m['header']; fx = fr['frameRect']['x']; fy = fr['frameRect']['y']
    im = Image.open(f'shots/{tag}-w14-picker-{SHOT[st]}.png').convert('RGB')
    near = lambda c: sum(abs(a - b) for a, b in zip(c, RULE)) <= 24
    res = {}
    if d['x'] + 1 < fx < d['x'] + d['w'] - 1:
        ys = range(int((h['y'] + 4) * 2), int((h['bottom'] - 4) * 2)); xs = (int(fx * 2), int(fx * 2) + 1)
        res['leftLine'] = {'devicePx': len(ys) * 2, 'ruleColoured': sum(near(im.getpixel((x, y))) for x in xs for y in ys)}
    else: res['leftLine'] = 'not inside the dialog'
    if d['y'] + 1 < fy < d['bottom'] - 1:
        xs = range(int((d['x'] + 20) * 2), int((d['x'] + d['w'] - 20) * 2)); ys = (int(fy * 2), int(fy * 2) + 1)
        res['topLine'] = {'devicePx': len(xs) * 2, 'ruleColoured': sum(near(im.getpixel((x, y))) for x in xs for y in ys)}
    else: res['topLine'] = 'not inside the dialog'
    return res
c9 = {}
for t, v in L3.items():
    if 'error' in v: c9[t] = {'error': v['error']}; continue
    c9[t] = {st: {'dialog': v[st]['dialog'], 'gap': v[st]['dialogGap'], 'viewport': v[st]['viewport'], 'save': v[st]['save'], 'footerText': v[st]['footerText'],
                  'frameOnTopInsideDialog': v['frame' + st[0].upper() + st[1:]].get('frameOnTopInsideDialog'), 'zFrame': v['frame' + st[0].upper() + st[1:]].get('zFrame'),
                  'zPicker': v['frame' + st[0].upper() + st[1:]].get('zPicker'), 'framePixels': frame_pixels(t, st, v), 'docScroll': v[st]['docScroll']} for st in SHOT}
    c9[t]['detectingStillShownAtShot'] = v.get('detectingStillShown')
ref = REF3['after']['1440']
c9['reference_1440_L3_after'] = {st: {'dialog': ref[st]['dialog'], 'save': ref[st]['save']} for st in SHOT}
def px_ok(fp):
    return all(not isinstance(x, dict) or x['ruleColoured'] == 0 for x in fp.values()) if isinstance(fp, dict) else True
ok9 = True
for t in ('390', '360', '390-webkit'):
    x = c9.get(t, {})
    if 'error' in x or not x: ok9 = False; continue
    for st in SHOT:
        s = x[st]
        ok9 &= all(abs(g) < 0.01 for g in s['gap'].values()) and s['save']['lines'] == 1 and abs(s['save']['rect']['h'] - 44) < 0.01 and not s['frameOnTopInsideDialog'] and px_ok(s['framePixels'])
x = c9.get('1440', {})
if 'error' in x or not x: ok9 = False
else:
    for st in SHOT:
        ok9 &= x[st]['dialog'] == ref[st]['dialog'] and x[st]['save']['rect'] == ref[st]['save']['rect'] and x[st]['save']['lines'] == 1
C['9_W14'] = {'measured': c9, 'pass': ok9}

# 10 downloads
d = L1['downloads']
C['10_downloads'] = {'measured': {'banner': d.get('banner'), 'generateMs': d.get('generateMs'), 'files': d['files'], 'error': d.get('error')},
                     'pass': bool(d['files']) and 'error' not in d and all(f.get('status') == 200 and (f.get('bytes') or 0) > 0 for f in d['files'] if not f.get('hidden'))}
C['logs'] = {'l1': {t: L1[t]['log'] for t in L1}, 'l2': {t: L2[t]['log'] for t in L2}, 'l3': {t: L3[t]['log'] for t in L3}}
json.dump(out, open('measurements.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
for k, v in C.items():
    if k != 'logs': print(k, 'PASS' if v['pass'] else 'FAIL')
