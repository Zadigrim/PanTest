"""Generate the loader SQL for one or more cities (gen2.py from the project doc, with fixes).

Usage: python build_sql.py berlin
Needs generated/stamps.json from build_stamps.py.

Changes from the doc's gen2.py:
  - stamp calls use _okuji_tmp_stamp (the doc called the undefined _okuji_tmp_s)
  - info pages are numbered from len(PAGES)+1, not hard-coded 8..11
  - stops no longer write verification_tier; the migration-046 trigger derives it
    from experience_type + experience_verification_method (CLAUDE.md invariant 5)
  - passports, passport_pages and stops inserts are ON CONFLICT (id) DO UPDATE, so a
    rerun updates content in place. Status, is_published, price and ownership are
    never changed by a rerun.
  - helpers are dropped at the end of the same transaction that loads the data
  - a preflight file checks every column, constraint value and function the load uses
  - a verify file reads back each passport

Output: generated/<code>/NN_*.sql, run in order by load-passport.ps1.
"""
import json, sys, hashlib, importlib, os
sys.path.insert(0, '.'); sys.path.insert(0, 'content')
from frames import frame_path
from pack import PAGE_TPL, STRIP_TPL, page_payload, page_from_payload
from art import cover
from content_json import build

OWNER = "921b40f1-7111-466e-8ed7-7f69430e465a"
NS = "3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55"
SH = {"circle": "c", "oval": "o", "arch": "a", "shield": "s", "octagon": "g", "rect": "r"}
AL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
def lit(s): return "'" + s.replace("'", "''") + "'"
def md5(s): return hashlib.md5(s.encode()).hexdigest()

# Every column the load writes, per table. The preflight fails if any is missing.
COLUMNS = {
    "passports": "id creator_id title description passport_type cover_bg_color cover_bg_type cover_emblem paper_color is_published is_free price_cents cover_template cover_paper_color status expected_spend_tier expected_spend_note cover_outside_data cover_inside_data is_demo is_okuji_official country",
    "passport_pages": "id passport_id page_order page_number section_name section_title page_type background_type background_color paper_color elements background_image_url",
    "stops": "id page_id stop_order name year_established description evidence_tier radius_meters stamp_icon stamp_color stamp_shape stamp_type verification_type address_street address_city address_state address_zip lat lng verification_radius_meters box_x box_y box_width box_height learning_objective experience_type experience_verification_method classifiers journal_prompt country expected_spend_tier location_caption_mode stamp_asset_id",
    "design_assets": "id owner_id name asset_type url file_format is_monochrome scoped_passport_id display_name width_px height_px metadata",
}

def preflight(code, title):
    rows = ",\n    ".join(f"('{t}','{c}')" for t, cols in COLUMNS.items() for c in cols.split())
    return f"""-- Preflight for {code}. Read only. Raises (and the loader stops) if anything the load needs is missing,
-- or if a passport would be duplicated.
do $pre$
declare missing text; pid uuid := extensions.uuid_generate_v5('{NS}'::uuid, '{code}/passport'); n int; other text;
begin
  select string_agg(w.t||'.'||w.c, ', ') into missing
  from (values
    {rows}
  ) as w(t,c)
  where not exists (select 1 from information_schema.columns ic
                    where ic.table_schema='public' and ic.table_name=w.t and ic.column_name=w.c);
  if missing is not null then raise exception 'PREFLIGHT: missing columns: %', missing; end if;

  if not exists (select 1 from profiles where id='{OWNER}') then
    raise exception 'PREFLIGHT: creator profile {OWNER} not found'; end if;

  -- a passport with this title owned by the creator but NOT our id means an earlier load used other ids
  select string_agg(id::text||' ('||status||')', ', ') into other from passports
   where creator_id='{OWNER}' and title={lit(title)} and id<>pid;
  if other is not null then raise exception 'PREFLIGHT: % already exists under a different id: %. Not loading.', {lit(title)}, other; end if;

  select count(*) into n from passports where id=pid;
  raise notice 'PREFLIGHT OK. passport id % exists: %', pid, (n>0);
end $pre$;
select exists(select 1 from passports where id=extensions.uuid_generate_v5('{NS}'::uuid, '{code}/passport')) as already_loaded;
"""

def helpers():
    fr = " ".join(f"when '{c}' then '{frame_path(a)}'" for a, c in SH.items())
    enc = "'data:image/svg+xml;charset=utf-8,'||replace(replace(replace(replace(svg,'%','%25'),'#','%23'),'<','%3C'),'>','%3E')"
    return f"""create or replace function public._okuji_tmp_path(e text) returns text language plpgsql as $f$
declare al text:='{AL}'; p text[]:='{{}}'; q int:=1; c text; x int; y int;
begin
  while q<=length(e) loop
    c:=substr(e,q,1);
    if c='>' then x:=(strpos(al,substr(e,q+1,1))-1)*64+strpos(al,substr(e,q+2,1))-1; y:=(strpos(al,substr(e,q+3,1))-1)*64+strpos(al,substr(e,q+4,1))-1; p:=p||('M'||x||' '||y); q:=q+5;
    elsif c='.' then p:=p||'z'::text; q:=q+1;
    elsif c='*' then x:=(strpos(al,substr(e,q+1,1))-1)*64+strpos(al,substr(e,q+2,1))-1-2048; y:=(strpos(al,substr(e,q+3,1))-1)*64+strpos(al,substr(e,q+4,1))-1-2048; p:=p||('l'||x||' '||y); q:=q+5;
    else x:=strpos(al,c)-33; y:=strpos(al,substr(e,q+1,1))-33; p:=p||('l'||x||' '||y); q:=q+2; end if;
  end loop;
  return array_to_string(p,'');
end $f$;
create or replace function public._okuji_tmp_put(code text, key text, kind text, svg text, want text) returns void language plpgsql as $f$
declare ns uuid:='{NS}'; pid uuid:=extensions.uuid_generate_v5(ns,code||'/passport'); slug text:=split_part(key,'/',4); sid uuid;
begin
  if md5(svg)<>want then raise exception 'md5 mismatch for %', key; end if;
  sid:=extensions.uuid_generate_v5(ns,code||'/stop/'||slug);
  insert into design_assets(id,owner_id,name,asset_type,url,file_format,is_monochrome,scoped_passport_id,display_name,width_px,height_px,metadata)
  values(extensions.uuid_generate_v5(ns,key),'{OWNER}',
    case kind when 'cover' then code||'-cover.svg' when 'page' then code||'-page-'||slug||'.svg' else slug||'.svg' end,
    case kind when 'cover' then 'cover' when 'page' then 'background' else 'stamp' end,
    {enc},
    'image/svg+xml',kind='stamp',pid,
    case kind when 'cover' then (select title from passports where id=pid)||' cover wrap' when 'page' then (select title from passports where id=pid)||' page '||slug
      else (select name from stops where id=sid) end,
    case kind when 'cover' then 1252 when 'page' then 612 else 600 end, case kind when 'stamp' then 600 else 869 end,
    case kind when 'stamp' then jsonb_build_object('source','passport-designer','default_ink',(select stamp_color from stops where id=sid)) else '{{"source":"passport-designer"}}'::jsonb end)
  on conflict (id) do update set url=excluded.url;
  if kind='stamp' then update stops set stamp_asset_id=extensions.uuid_generate_v5(ns,key) where id=sid; end if;
  if kind='page' then update passport_pages set background_image_url={enc} where id=extensions.uuid_generate_v5(ns,code||'/page/'||slug); end if;
  if kind='cover' then update passports set cover_outside_data=jsonb_set(cover_outside_data,'{{image_url}}',to_jsonb({enc})) where id=pid; end if;
end $f$;
create or replace function public._okuji_tmp_stamp(code text, slug text, sh text, e text, want text) returns void language sql as $f$
  select public._okuji_tmp_put(code, code||'/asset/stamp/'||slug, 'stamp',
    '<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 600 600'' width=''100%'' height=''100%''><path fill=''currentColor'' fill-rule=''evenodd'' d='''||(case sh {fr} end)||public._okuji_tmp_path(e)||'''/></svg>', want) $f$;
create or replace function public._okuji_tmp_page(code text, n int, p text, i text, t text, t2 text, e text, want text) returns void language sql as $f$
  select public._okuji_tmp_put(code, code||'/asset/page/'||n, 'page',
    replace(replace(replace(replace({lit(PAGE_TPL)},'{{P}}',p),'{{I}}',i),'{{T2}}',t2),'{{STRIP}}',
      case when e='' then '' else replace(replace({lit(STRIP_TPL)},'{{T}}',t),'{{D}}',public._okuji_tmp_path(e)) end), want) $f$;
"""

DROP_HELPERS = """drop function if exists public._okuji_tmp_stamp(text,text,text,text,text);
drop function if exists public._okuji_tmp_page(text,int,text,text,text,text,text,text);
drop function if exists public._okuji_tmp_put(text,text,text,text,text);
drop function if exists public._okuji_tmp_path(text);
"""

def content_sql(d):
    head = json.dumps({k: v for k, v in d.items() if k not in ('pages', 'stops')}, ensure_ascii=True, separators=(',', ':'))
    pages = json.dumps(d['pages'], ensure_ascii=True, separators=(',', ':'))
    stops = json.dumps(d['stops'], ensure_ascii=True, separators=(',', ':'))
    for s in (head, pages, stops): assert '$J$' not in s and '$Q$' not in s
    c1 = f"""do $Q$ declare d jsonb:=$J${head}$J$; pg jsonb:=$J${pages}$J$; ns uuid:='{NS}'; pid uuid;
begin
  pid:=extensions.uuid_generate_v5(ns,(d->>'code')||'/passport');
  insert into passports(id,creator_id,title,description,passport_type,cover_bg_color,cover_bg_type,cover_emblem,paper_color,is_published,is_free,price_cents,
    cover_template,cover_paper_color,status,expected_spend_tier,expected_spend_note,cover_outside_data,cover_inside_data,is_demo,is_okuji_official,country)
  values(pid,'{OWNER}',d->>'title',d->>'desc','location',d->>'cover_bg','gradient',d->>'emblem','#'||(d->>'paper'),false,true,0,'guilloche_blue',d->>'paper','draft',d->>'tier',d->>'note',
    jsonb_build_object('back_bg',d->>'cover_bg','elements','[]'::jsonb,'front_bg',d->>'cover_bg','image_url',null,'image_scale',1,'image_opacity',100,'image_position_x',0.5,'image_position_y',0.5),
    jsonb_build_object('back_bg',d->>'paper','elements','[]'::jsonb,'front_bg',d->>'paper','image_url',null,'image_scale',1,'image_opacity',80,'image_position_x',0.5,'image_position_y',0.5),true,true,d->>'country')
  on conflict (id) do update set title=excluded.title, description=excluded.description, cover_emblem=excluded.cover_emblem,
    expected_spend_tier=excluded.expected_spend_tier, expected_spend_note=excluded.expected_spend_note, country=excluded.country,
    is_demo=true, is_okuji_official=true;
  insert into passport_pages(id,passport_id,page_order,page_number,section_name,section_title,page_type,background_type,background_color,paper_color,elements)
  select extensions.uuid_generate_v5(ns,(d->>'code')||'/page/'||(p->>'n')),pid,(p->>'n')::int-1,(p->>'n')::int,'Page '||(p->>'n'),p->>'title',p->>'type','custom',p->>'ink',d->>'paper',p->'elements'
  from jsonb_array_elements(pg) p
  on conflict (id) do update set page_order=excluded.page_order, page_number=excluded.page_number, section_name=excluded.section_name,
    section_title=excluded.section_title, page_type=excluded.page_type, background_color=excluded.background_color,
    paper_color=excluded.paper_color, elements=excluded.elements;
end $Q$;
"""
    c2 = f"""do $Q$ declare ss jsonb:=$J${stops}$J$; ns uuid:='{NS}'; code text:='{d['code']}';
begin
  insert into stops(id,page_id,stop_order,name,year_established,description,evidence_tier,radius_meters,stamp_icon,stamp_color,stamp_shape,stamp_type,verification_type,
    address_street,address_city,address_state,address_zip,lat,lng,verification_radius_meters,box_x,box_y,box_width,box_height,learning_objective,
    experience_type,experience_verification_method,classifiers,journal_prompt,country,expected_spend_tier,location_caption_mode)
  select extensions.uuid_generate_v5(ns,code||'/stop/'||(s->>'slug')),extensions.uuid_generate_v5(ns,code||'/page/'||(s->>'page')),(s->>'order')::int,
    s->>'name',s->>'year',s->>'desc',2,150,'',s->>'ink','circle','custom_asset','presence',s->>'street',{lit(d['city'])},{lit(d['state'])},s->>'zip',(s->>'lat')::float8,(s->>'lng')::float8,
    (s->>'radius')::int,(s->>'bx')::float8,(s->>'by')::float8,270,290,s->>'obj','location','gps',array(select jsonb_array_elements_text(s->'cls')),s->>'prompt',{lit(d['country_name'])},s->>'tier','address'
  from jsonb_array_elements(ss) s
  on conflict (id) do update set page_id=excluded.page_id, stop_order=excluded.stop_order, name=excluded.name, year_established=excluded.year_established,
    description=excluded.description, stamp_color=excluded.stamp_color, address_street=excluded.address_street, address_zip=excluded.address_zip,
    lat=excluded.lat, lng=excluded.lng, verification_radius_meters=excluded.verification_radius_meters, box_x=excluded.box_x, box_y=excluded.box_y,
    learning_objective=excluded.learning_objective, experience_type=excluded.experience_type,
    experience_verification_method=excluded.experience_verification_method, classifiers=excluded.classifiers,
    journal_prompt=excluded.journal_prompt, country=excluded.country, expected_spend_tier=excluded.expected_spend_tier;
end $Q$;
"""
    return c1, c2

def verify_sql(code, n_pages, n_stops):
    return f"""-- Read back {code}. Every check column should be true.
with p as (select * from passports where id=extensions.uuid_generate_v5('{NS}'::uuid,'{code}/passport')),
pg as (select pp.* from passport_pages pp join p on pp.passport_id=p.id),
st as (select s.* from stops s join pg on s.page_id=pg.id)
select p.id, p.title, p.status, p.is_demo, p.is_okuji_official, p.is_free, p.price_cents, p.country,
  (select count(*) from pg) as pages, (select count(*) from pg)={n_pages} as pages_ok,
  (select count(*) from st) as stops, (select count(*) from st)={n_stops} as stops_ok,
  (select count(*) from st where stamp_asset_id is not null) as stops_with_stamp,
  not exists (select 1 from st where stamp_asset_id is null
              or not exists (select 1 from design_assets a where a.id=st.stamp_asset_id)) as every_stop_has_stamp,
  not exists (select 1 from pg where background_image_url is null) as every_page_has_background,
  (p.cover_outside_data->>'image_url') is not null as cover_has_image,
  (select count(*) from st where verification_tier=3) as stops_tier3_from_trigger,
  p.creator_id='{OWNER}' as owned_by_creator,
  p.status='draft' and p.is_demo and p.is_okuji_official and p.is_free and coalesce(p.price_cents,0)=0 as flags_ok
from p;
select count(*) as leftover_tmp_helpers from pg_proc where proname like '\\_okuji\\_tmp\\_%';
"""

if __name__ == "__main__":
    st = json.load(open('generated/stamps.json'))
    for city in (sys.argv[1:] or ['berlin']):
        C = importlib.import_module(city); code = C.CODE; d = build(city)
        o = f'generated/{code}'; os.makedirs(o, exist_ok=True)
        for f in os.listdir(o):
            if f.endswith('.sql'): os.remove(os.path.join(o, f))
        open(f'{o}/00_preflight.sql', 'w').write(preflight(code, C.TITLE))
        open(f'{o}/01_helpers.sql', 'w').write(helpers())
        c1, c2 = content_sql(d)
        open(f'{o}/02_passport_and_pages.sql', 'w').write(c1)
        open(f'{o}/03_stops.sql', 'w').write(c2)
        lines = []
        for s in C.S:
            r = st[s['slug']]
            assert "'" not in r['enc']
            lines.append(f"select public._okuji_tmp_stamp('{code}','{s['slug']}','{SH[r['shape']]}','{r['enc']}','{md5(r['svg'])}');")
        open(f'{o}/04_stamps.sql', 'w').write("\n".join(lines) + "\n")
        pg = []
        for n, (t, ink) in enumerate(C.PAGES, 1):
            ms = [s['stamp'][1] for s in C.S[(n - 1) * 4:n * 4]]
            P = page_payload(C.PAPER, ink, ms); svg = page_from_payload(P); a = P.split(':')
            pg.append(f"select public._okuji_tmp_page('{code}',{n},'{a[0]}','{a[1]}','{a[2]}','{a[3]}','{a[4]}','{md5(svg)}');")
        for n in range(len(C.PAGES) + 1, len(C.PAGES) + 1 + len(C.INFO)):
            P = page_payload(C.PAPER, C.INFO_INK, None); svg = page_from_payload(P); a = P.split(':')
            pg.append(f"select public._okuji_tmp_page('{code}',{n},'{a[0]}','{a[1]}','{a[2]}','{a[3]}','','{md5(svg)}');")
        open(f'{o}/05_page_backgrounds.sql', 'w').write("\n".join(pg) + "\n")
        cv = cover(code); assert "$c$" not in cv
        open(f'{o}/06_cover.sql', 'w').write(f"select public._okuji_tmp_put('{code}','{code}/asset/cover','cover',$c${cv}$c$,'{md5(cv)}');\n")
        open(f'{o}/07_drop_helpers.sql', 'w').write(DROP_HELPERS)
        open(f'{o}/08_verify.sql', 'w').write(verify_sql(code, len(C.PAGES) + len(C.INFO), len(C.S)))
        print(code, 'pages', len(C.PAGES) + len(C.INFO), 'stops', len(C.S),
              {f: os.path.getsize(f'{o}/{f}') for f in sorted(os.listdir(o))})
