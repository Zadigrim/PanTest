"""Turn a city content module into page and stop records for the loader."""
import sys, json, importlib, uuid
NS = uuid.UUID('3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55')
def U(k): return str(uuid.uuid5(NS, k))
sys.path.insert(0, 'content'); sys.path.insert(0, '.')
from phrases import PHRASES
ALLOWED = {'heritage','outdoor','free','architecture','views','museum','family','food_drink','quirky','tour','garden','hike','marine','transit','beach','public_art','music','educational'}
MAP = {'memorial':'heritage','science':'educational','nature':'outdoor','animals':'family','art':None,'daytrip':None,'shopping':None}

def classifiers(lst):
    out = []
    for c in lst:
        c = MAP.get(c, c) if c in MAP else c
        if c and c in ALLOWED and c not in out: out.append(c)
    return out

def stop_desc(s):
    d = s['desc']
    if s.get('diet'): d += "\n\nDietary: " + s['diet']
    if s.get('price'): d += "\n\nPrice: " + s['price']
    d += "\n\nFun facts:\n- " + s['facts'][0] + "\n- " + s['facts'][1]
    d += "\n\nGood to know: " + s['good']
    return d

def info_elements(code, n, title, sections, title_ink, head_ink):
    # mirrors the Madrid info page layout: title at y100, five sections
    els = [dict(x=56,y=100,id=U(f"{code}/el/{n}/0"),runs=[{"text":title}],type="richtext",align="center",color=title_ink,width=500,height=44,fontSize=28,rotation=0,fontFamily="Georgia, serif")]
    y = 158; k = 1
    for head, body in sections:
        els.append(dict(x=56,y=y,id=U(f"{code}/el/{n}/{k}"),runs=[{"bold":True,"text":head}],type="richtext",align="left",color=head_ink,width=500,height=24,fontSize=17,rotation=0,fontFamily="Georgia, serif",fontWeight="bold")); k += 1
        if isinstance(body, str):
            runs = [{"text":body}]; h = 84; step = 116
        elif head == "Numbers":
            runs = [{"text":l+("\n" if i < len(body)-1 else "")} for i, l in enumerate(body)]; h = 67; step = 105
        else:
            runs = []
            for i, (en, loc, pr) in enumerate(body):
                last = i == len(body) - 1
                runs += [{"text":en+":  "},{"bold":True,"text":loc},{"text":f"  ({pr})"+("" if last else "\n"),"italic":True}]
            h = 67; step = 105
        els.append(dict(x=56,y=y+26,id=U(f"{code}/el/{n}/{k}"),runs=runs,type="richtext",align="left",color="333333",width=500,height=h,fontSize=12,rotation=0,fontFamily="Georgia, serif")); k += 1
        y += step
    return els

def build(city):
    C = importlib.import_module(city)
    pages = []
    for n, (title, ink) in enumerate(C.PAGES, 1):
        pages.append(dict(n=n,type="stamp",title=title,ink=ink,
            elements=[dict(x=56,y=100,id=U(f"{C.CODE}/el/{n}/0"),runs=[{"text":title}],type="richtext",align="center",color=C.TITLE_INK,width=500,height=44,fontSize=28,rotation=0,fontFamily="Georgia, serif")]))
    first_info = len(C.PAGES) + 1
    for i, (title, secs) in enumerate(C.INFO):
        n = first_info + i
        if isinstance(secs, str): secs = PHRASES[secs]
        pages.append(dict(n=n,type="information",title=title,ink=C.INFO_INK,elements=info_elements(C.CODE,n,title,secs,C.TITLE_INK,C.INFO_INK)))
    stops = []
    for i, s in enumerate(C.S):
        page = i // 4 + 1; o = i % 4
        stops.append(dict(slug=s['slug'],page=page,order=o,name=s['name'],year=s['year'] or None,street=s['street'],zip=s['zip'],
            lat=s['lat'],lng=s['lng'],radius=s['radius'],ink=s['ink'],cls=classifiers(s['cls']),tier=s['tier'],
            desc=stop_desc(s),prompt=s['prompt'],obj=s['obj'],bx=[30,312][o%2],by=[150,456][o//2],
            label=" ".join(s['stamp'][2:]).title()))
    return dict(code=C.CODE,title=C.TITLE,country=C.COUNTRY,country_name=C.COUNTRY_NAME,state=C.STATE,city=C.CITY,
        emblem=C.EMBLEM,cover_bg=C.COVER_BG,paper=C.PAPER,desc=C.DESCRIPTION,tier=C.SPEND_TIER,note=C.SPEND_NOTE,pages=pages,stops=stops)
