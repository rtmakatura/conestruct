# Folds measure-before.json and measure-after.json into measurements.json.
import json
from PIL import Image, ImageChops
import sys, os
B=json.load(open('measure-before.json')); A=json.load(open('measure-after.json'))
P=json.load(open('measure-probe.json')) if os.path.exists('measure-probe.json') else None
RULE=(44,62,83)  # --rule #2c3e53, the frame's 1 px rule
SHOT={'detecting':'detecting','roads':'roads','roadsEnd':'roads-end'}
def frame_pixels(folder,tag,st,v):
    # Rule-coloured device pixels on the frame's left and top lines, counted only where
    # that line runs through the dialog's interior (not on the dialog's own border),
    # over the dialog header's band (left line) and the header's width (top line).
    fr=v['frame'+st[0].upper()+st[1:]]; m=v[st]
    if not fr.get('frame'): return {'frame':'absent'}
    d=m['dialog']; h=m['header']; fx=fr['frameRect']['x']; fy=fr['frameRect']['y']
    im=Image.open(f'{folder}/{tag}-w14-picker-{SHOT[st]}.png').convert('RGB')
    near=lambda c: sum(abs(a-b) for a,b in zip(c,RULE))<=24
    res={}
    if d['x']+1 < fx < d['x']+d['w']-1:
        ys=range(int((h['y']+4)*2), int((h['bottom']-4)*2)); xs=(int(fx*2), int(fx*2)+1)
        res['leftLine']={'devicePx':len(ys)*2,'ruleColoured':sum(near(im.getpixel((x,y))) for x in xs for y in ys)}
    else: res['leftLine']='not inside the dialog'
    if d['y']+1 < fy < d['bottom']-1:
        xs=range(int((d['x']+20)*2), int((d['x']+d['w']-20)*2)); ys=(int(fy*2), int(fy*2)+1)
        res['topLine']={'devicePx':len(xs)*2,'ruleColoured':sum(near(im.getpixel((x,y))) for x in xs for y in ys)}
    else: res['topLine']='not inside the dialog'
    return res
def pick(m):
    return {'dialog':m['dialog'],'dialogGap':m['dialogGap'],'edgePointsOutsideDialog':m['edgePointsOutsideDialog'],'header':m['header'],'footer':m['footer'],
            'save':m['save'],'cancel':m['cancel'],'status':m['status'],'scroller':m['scroller'],'docScroll':m['docScroll']}
out={'method':"Local next dev of this worktree; Playwright Chromium (1440x900, 390x844, 360x780) and WebKit (390x844), DPR 2. /api/road-bearing stubbed with four one-way candidates (Overpass unavailable 2026-10-25) and held until the 'Detecting road…' footer was measured; geocode and the rest live. Pointer parked at the viewport's bottom-right corner before every measure and shot. Rects are getBoundingClientRect in CSS px; lines = distinct client-rect tops of the element's text. edgePoints: elementFromPoint at y in {1,4,vh-4,vh-1} x x in {1,vw/2,vw-1}; 'outside' counts points not inside the dialog. reach: each road row scrolled into view (block nearest) in its scroller, then its centre and bottom edge hit-tested and its bottom compared with the footer's top.",
     'note':'Playwright WebKit is not a real iPhone; iOS Safari is unchecked.'}
for ph,D in (('before',B),('after',A)):
    out[ph]={t:{'consoleErrors':v['consoleErrors'],'pageErrors':v['pageErrors'],'httpErrors':v['httpErrors'],
                'detecting':pick(v['detecting']),'roads':pick(v['roads']),'roadsEnd':pick(v['roadsEnd']),'reach':v['reach'],'settle':v['settle'],
                'frame':{st:{**v['frame'+st[0].upper()+st[1:]],'pixels':frame_pixels(ph,t,st,v)} for st in SHOT}} for t,v in D.items()}
if P:
    out['regression_probe']={'what':'The first-pass fix (p-0, picker still z-50) at 390 Chromium, shot to show the stacking and pixel checks catch the frame through the dialog. Shots in probe/.',
        **{t:{st:{**v['frame'+st[0].upper()+st[1:]],'pixels':frame_pixels('probe',t,st,v)} for st in SHOT} for t,v in P.items()}}
# Desktop deltas: every rect at 1440, after minus before.
def flat(m,pre=''):
    r={}
    for k,v in m.items():
        if isinstance(v,dict) and {'x','y','w','h'}<=set(v): r[pre+k]=v
        elif isinstance(v,dict): r.update(flat(v,pre+k+'.'))
        elif isinstance(v,list):
            for i,e in enumerate(v):
                if isinstance(e,dict): r.update(flat(e,f'{pre}{k}[{i}].'))
    return r
dd={}
for st in ('detecting','roads','roadsEnd'):
    fb=flat(B['1440'][st]); fa=flat(A['1440'][st])
    dd[st]={k:{c:round(fa[k][c]-fb[k][c],2) for c in ('x','y','w','h')} for k in fb}
dd['reach']=[{c:round(a[c]-b[c],2) for c in ('top','bottom','footerTop')} for a,b in zip(A['1440']['reach'],B['1440']['reach'])]
mx=max(abs(x) for st in ('detecting','roads','roadsEnd') for r in dd[st].values() for x in r.values())
mx=max(mx,max(abs(x) for r in dd['reach'] for x in r.values()))
out['desktop_1440_rect_deltas']=dd; out['desktop_1440_max_abs_delta_px']=mx
# Footer pixels at 1440, before vs after (the map above it carries live tiles, so only the footer band is compared).
px={}
for shot in ('detecting','roads','roads-end'):
    st={'detecting':'detecting','roads':'roads','roads-end':'roadsEnd'}[shot]
    f=B['1440'][st]['footer']; box=tuple(int(round(v*2)) for v in (f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
    a=Image.open(f'before/1440-w14-picker-{shot}.png').convert('RGB').crop(box); b=Image.open(f'after/1440-w14-picker-{shot}.png').convert('RGB').crop(box)
    diff=ImageChops.difference(a,b); n=sum(1 for p in diff.getdata() if p!=(0,0,0))
    px[shot]={'footerBoxDevicePx':box,'pixelsDiffering':n,'pixelsTotal':a.size[0]*a.size[1]}
out['desktop_1440_footer_pixels']=px
json.dump(out,open('measurements.json','w'),indent=1,ensure_ascii=False)
print('desktop max |delta|',mx, px)
for ph in ('before','after'):
    for t,v in out[ph].items(): print('FRAME',ph,t,{st:(f['frameOnTopInsideDialog'] if 'frameOnTopInsideDialog' in f else None, f['pixels']) for st,f in v['frame'].items()}, 'z',v['frame']['roads'].get('zFrame'),v['frame']['roads'].get('zPicker'),'settle',{k:x['inflightAtShot'] for k,x in v['settle'].items()})
if P:
    for t,v in out['regression_probe'].items():
        if t!='what': print('PROBE',t,{st:(f['frameOnTopInsideDialog'],f['pixels']) for st,f in v.items()})
for t in A:
    for ph,D in (('before',B),('after',A)):
        m=D[t]['roads']; dm=D[t]['detecting']
        print(t,ph,'save h/lines',m['save']['rect']['h'],m['save']['lines'],'| detecting save',dm['save']['rect']['h'],dm['save']['lines'],'| footer',m['footer']['h'],dm['footer']['h'],'| scroller',m['scroller']['clientHeight'],'| outside',m['edgePointsOutsideDialog'],'gap',m['dialogGap'],'| reach',all(r['endsAboveFooter'] and r['centreHitsRow'] and r['bottomEdgeHitsRow'] for r in D[t]['reach']))
