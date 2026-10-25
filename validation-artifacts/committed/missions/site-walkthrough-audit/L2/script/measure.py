import json, re
from PIL import Image
def lum(c):
    def ch(v):
        v/=255; return v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    r,g,b=c[:3]; return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b)
def ratio(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return round((la+0.05)/(lb+0.05),2)
def rgb(s): return tuple(int(x) for x in re.findall(r'\d+',s)[:3])
ACT=(52,169,232)
def ground(img, vr):
    x,y,w,h=vr; return img.getpixel((int((x+4)*2), int((y+h-4)*2)))
out={"method":"Local next dev of the worktree; Playwright Chromium and WebKit at DPR 2; /api/road-bearing stubbed with one two-way East Colfax Avenue candidate (Overpass unavailable 2026-10-25), everything else live. Pointer parked at the viewport's bottom-right corner before every measure and screenshot. Grounds are sampled from screenshot pixels 4 px inside the element's bottom-left corner (the rendered ground, not the computed style, since WebKit ignores the select's background); inks are computed styles (the check is var(--act) = rgb(52,169,232)). Contrast is WCAG 2.x relative luminance. Label centre x is the text node's client-rect centre minus the button/chip's left edge.","note":"Playwright WebKit is not a real iPhone; iOS Safari is unchecked."}
D={}
for phase in ['before','after']:
    d={}
    for part in ['c','w']: d.update(json.load(open(f'measure-{phase}-{part}.json')))
    D[phase]=d
    P={}
    for tag,v in d.items():
        e={k:v[k] for k in ['consoleErrors','pageErrors','devOverlay','httpErrors','failedHosts'] if k in v}
        e['consoleErrors']=sorted(set(e.get('consoleErrors',[])))
        for key in ['head','located_head','what_head']:
            h=v[key]; e[key]={k:h[k] for k in ['stepText','step','stepLineHeight','stepLines','scrollWidth','innerWidth']}
        e['nav_bordered_cells']=v['nav']['borderedCells']
        e['kind_chips']=[{k:c[k] for k in c if k!='vrect'} for c in v['chips']]
        e['segmented']=[{'name':s['name'],'opts':[{k:o[k] for k in o if k!='vrect'} for o in s['opts']]} for s in v['seg']]
        im=Image.open(f'px/{phase}-{tag}-chips.png').convert('RGB')
        pc=[c for c in v['chips'] if c['pressed']=='true'][0]; g=ground(im,pc['vrect'])
        e['check_on_pressed_kind_chip']={'ground':g,'ratio':ratio(ACT,g)}
        im=Image.open(f'px/{phase}-{tag}-seg.png').convert('RGB')
        so=[o for s in v['seg'] for o in s['opts'] if o['pressed']=='true' and o['vrect'][1]>=0 and (o['vrect'][1]+o['vrect'][3])*2<=im.size[1]]
        e['check_on_pressed_toggle']=[{'option':o['t'],'ground':ground(im,o['vrect']),'ratio':ratio(ACT,ground(im,o['vrect']))} for o in so]
        im=Image.open(f'{phase}/{tag}-w13-select.png').convert('RGB'); sl=[]
        for s in v['selects']:
            x,y,w,hh=s['rect']
            if y<0 or (y+hh)*2>im.size[1]: sl.append({**s,'sampled':'off-screen'}); continue
            px=im.getpixel((int((x+w*0.6)*2), int((y+6)*2)))
            sl.append({**s,'renderedGround':px,'inkOnRenderedGround':ratio(rgb(s['color']),px)})
        e['selects']=sl
        P[tag]=e
    out[phase]=P
# centre deltas
deltas={}
for tag in D['after']:
    b=D['before'][tag]; a=D['after'][tag]; r={}
    for cb,ca in zip(b['chips'],a['chips']):
        r[ca['id']+(' (pressed)' if ca['pressed']=='true' else '')]={'textLeftX':[cb['labelTextLeftX'],ca['labelTextLeftX']],'centreX_before':cb['labelTextCentreX'],'centreX_after':ca['labelTextCentreX'],'delta':round(ca['labelTextCentreX']-cb['labelTextCentreX'],2)}
    for sb,sa in zip(b['seg'],a['seg']):
        for ob,oa in zip(sb['opts'],sa['opts']):
            r[f"{sa['name']}: {oa['t']}"+(' (pressed)' if oa['pressed']=='true' else '')]={'centreX_before':ob['labelTextCentreX'],'centreX_after':oa['labelTextCentreX'],'buttonCentreX':oa['buttonCentreX'],'delta':round(oa['labelTextCentreX']-ob['labelTextCentreX'],2)}
    deltas[tag]=r
out['label_centre_x_before_after']=deltas
json.dump(out,open('measurements.json','w'),indent=1)
for tag,r in deltas.items():
    print(tag,'max|delta|',max(abs(x['delta']) for x in r.values()), [ (k,x['delta']) for k,x in r.items() if abs(x['delta'])>0.01])
for ph in ['before','after']:
    for tag,e in out[ph].items():
        print(ph,tag,'chip✓',e['check_on_pressed_kind_chip']['ratio'],'toggle✓',[x['ratio'] for x in e['check_on_pressed_toggle']],'sel',sorted(set(str(s.get('inkOnRenderedGround')) for s in e['selects'])),'step',e['head']['stepLines'],e['located_head']['stepLines'],e['what_head']['stepLines'],'sw',e['located_head']['scrollWidth'],e['head']['innerWidth'],'nav',[c['borderRight'] for c in e['nav_bordered_cells']], 'chipborder',[c['borderColor'] for c in e['kind_chips']])
