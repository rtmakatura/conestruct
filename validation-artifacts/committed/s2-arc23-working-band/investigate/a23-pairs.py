def lum(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
def blend(fg,bg,a):
    f=[int(fg.lstrip('#')[i:i+2],16) for i in (0,2,4)]; b=[int(bg.lstrip('#')[i:i+2],16) for i in (0,2,4)]
    return '#%02x%02x%02x'%tuple(round(a*x+(1-a)*y) for x,y in zip(f,b))
surfaces={'#0f1a26 (spec band)':'#0f1a26','--canvas #14202e':'#14202e','--canvas-tint #1b2838':'#1b2838'}
inks={'--act #34a9e8':'#34a9e8','--act-bright #56bcf2':'#56bcf2','spec #5cbef0':'#5cbef0','spec verb #a9dcf8':'#a9dcf8','--ink #eaf0f7':'#eaf0f7','--ink-on-dark #c8d1dd':'#c8d1dd','--ink-on-dark-faint #93a0b0':'#93a0b0','--warn #f4c020':'#f4c020','--rule #2c3e53':'#2c3e53','--none #93a0b0':'#93a0b0'}
print('| ink | '+' | '.join(surfaces)+' |'); print('|---'*(len(surfaces)+1)+'|')
for n,i in inks.items(): print(f'| {n} | '+' | '.join(f'{cr(i,s):.2f}' for s in surfaces.values())+' |')
print()
# track base rgba(52,169,232,0.16) and 0.4 on #0f1a26 vs canvas (non-text)
for a in (0.16,0.4): print('track', a, blend('#34a9e8','#0f1a26',a), f"{cr(blend('#34a9e8','#0f1a26',a),'#0f1a26'):.2f} vs band; {cr(blend('#34a9e8','#0f1a26',a),'#14202e'):.2f} vs canvas")
print('border --act on band', f"{cr('#34a9e8','#0f1a26'):.2f}", 'band surface vs canvas', f"{cr('#0f1a26','#14202e'):.2f}", 'vs tint', f"{cr('#0f1a26','#1b2838'):.2f}")
# disabled 0.45 opacity of typical control inks on canvas and on paper
for n,i in [('--act','#34a9e8'),('--ink-on-dark','#c8d1dd'),('--ink','#eaf0f7'),('--act-bright','#56bcf2')]:
    for sn,s in [('canvas','#14202e'),('paper','#243447')]:
        print(f'0.45 {n} on {sn}: {blend(i,s,0.45)} {cr(blend(i,s,0.45),s):.2f}')
print('--sc-disabled rgba(147,160,176,.35) on canvas', f"{cr(blend('#93a0b0','#14202e',0.35),'#14202e'):.2f}")
