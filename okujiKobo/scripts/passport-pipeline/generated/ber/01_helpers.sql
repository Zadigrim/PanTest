create or replace function public._okuji_tmp_path(e text) returns text language plpgsql as $f$
declare al text:='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; p text[]:='{}'; q int:=1; c text; x int; y int;
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
declare ns uuid:='3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55'; pid uuid:=extensions.uuid_generate_v5(ns,code||'/passport'); slug text:=split_part(key,'/',4); sid uuid;
begin
  if md5(svg)<>want then raise exception 'md5 mismatch for %', key; end if;
  sid:=extensions.uuid_generate_v5(ns,code||'/stop/'||slug);
  insert into design_assets(id,owner_id,name,asset_type,url,file_format,is_monochrome,scoped_passport_id,display_name,width_px,height_px,metadata)
  values(extensions.uuid_generate_v5(ns,key),'921b40f1-7111-466e-8ed7-7f69430e465a',
    case kind when 'cover' then code||'-cover.svg' when 'page' then code||'-page-'||slug||'.svg' else slug||'.svg' end,
    case kind when 'cover' then 'cover' when 'page' then 'background' else 'stamp' end,
    'data:image/svg+xml;charset=utf-8,'||replace(replace(replace(replace(svg,'%','%25'),'#','%23'),'<','%3C'),'>','%3E'),
    'image/svg+xml',kind='stamp',pid,
    case kind when 'cover' then (select title from passports where id=pid)||' cover wrap' when 'page' then (select title from passports where id=pid)||' page '||slug
      else (select name from stops where id=sid) end,
    case kind when 'cover' then 1252 when 'page' then 612 else 600 end, case kind when 'stamp' then 600 else 869 end,
    case kind when 'stamp' then jsonb_build_object('source','passport-designer','default_ink',(select stamp_color from stops where id=sid)) else '{"source":"passport-designer"}'::jsonb end)
  on conflict (id) do update set url=excluded.url;
  if kind='stamp' then update stops set stamp_asset_id=extensions.uuid_generate_v5(ns,key) where id=sid; end if;
  if kind='page' then update passport_pages set background_image_url='data:image/svg+xml;charset=utf-8,'||replace(replace(replace(replace(svg,'%','%25'),'#','%23'),'<','%3C'),'>','%3E') where id=extensions.uuid_generate_v5(ns,code||'/page/'||slug); end if;
  if kind='cover' then update passports set cover_outside_data=jsonb_set(cover_outside_data,'{image_url}',to_jsonb('data:image/svg+xml;charset=utf-8,'||replace(replace(replace(replace(svg,'%','%25'),'#','%23'),'<','%3C'),'>','%3E'))) where id=pid; end if;
end $f$;
create or replace function public._okuji_tmp_stamp(code text, slug text, sh text, e text, want text) returns void language sql as $f$
  select public._okuji_tmp_put(code, code||'/asset/stamp/'||slug, 'stamp',
    '<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 600 600'' width=''100%'' height=''100%''><path fill=''currentColor'' fill-rule=''evenodd'' d='''||(case sh when 'c' then 'M7 300a293 293 0 1 0 586 0a293 293 0 1 0 -586 0zM29 300a271 271 0 1 0 542 0a271 271 0 1 0 -542 0zM47.5 300a252.5 252.5 0 1 0 505 0a252.5 252.5 0 1 0 -505 0zM52.5 300a247.5 247.5 0 1 0 495 0a247.5 247.5 0 1 0 -495 0z' when 'o' then 'M3 300a297 261 0 1 0 594 0a297 261 0 1 0 -594 0zM25 300a275 239 0 1 0 550 0a275 239 0 1 0 -550 0zM41.5 300a258.5 222.5 0 1 0 517 0a258.5 222.5 0 1 0 -517 0zM46.5 300a253.5 217.5 0 1 0 507 0a253.5 217.5 0 1 0 -507 0z' when 'a' then 'M11 589V260A289 249 0 0 1 589 260V589zM33 567V260A267 227 0 0 1 567 260V567zM49.5 550.5V262A250.5 210.5 0 0 1 550.5 262V550.5zM54.5 545.5V262A245.5 205.5 0 0 1 545.5 262V545.5z' when 's' then 'M29 19H571V300C571 456.6 427.7 551 300 593.75C172.3 551 29 456.6 29 300zM51 41H549V300C549 443.4 412.3 529 300 566.25C187.7 529 51 443.4 51 300zM67.5 57.5H532.5V300C532.5 431.5 405.75 510.5 300 549.125C194.25 510.5 67.5 431.5 67.5 300zM72.5 62.5H527.5V300C527.5 428.5 402.25 505.5 300 542.875C197.75 505.5 72.5 428.5 72.5 300z' when 'g' then 'M171 11L11 171L11 429L171 589L429 589L589 429L589 171L429 11zM181 33L33 181L33 419L181 567L419 567L567 419L567 181L419 33zM189 50L50 189L50 411L189 550L411 550L550 411L550 189L411 50zM191 54L54 191L54 409L191 546L409 546L546 409L546 191L409 54z' when 'r' then 'M55 11L11 55L11 545L55 589L545 589L589 545L589 55L545 11zM65 33L33 65L33 535L65 567L535 567L567 535L567 65L535 33zM71 50L50 71L50 529L71 550L529 550L550 529L550 71L529 50zM73 54L54 73L54 527L73 546L527 546L546 527L546 73L527 54z' end)||public._okuji_tmp_path(e)||'''/></svg>', want) $f$;
create or replace function public._okuji_tmp_page(code text, n int, p text, i text, t text, t2 text, e text, want text) returns void language sql as $f$
  select public._okuji_tmp_put(code, code||'/asset/page/'||n, 'page',
    replace(replace(replace(replace('<svg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 612 869'' width=''612'' height=''869''><rect width=''612'' height=''869'' fill=''#{P}''/><path d=''M24,14L588,14L598,24L598,845L588,855L24,855L14,845L14,24Z'' fill=''none'' stroke=''#{I}'' stroke-width=''2'' stroke-linejoin=''round''/><path d=''M30,20L582,20L592,30L592,839L582,849L30,849L20,839L20,30Z'' fill=''none'' stroke=''#{I}'' stroke-width=''1''/><path d=''M48,48h44M70,40v16M520,48h44M542,40v16'' stroke=''#{I}'' stroke-width=''2'' stroke-linecap=''round''/><circle cx=''70'' cy=''48'' r=''4'' fill=''none'' stroke=''#{I}'' stroke-width=''2''/><circle cx=''542'' cy=''48'' r=''4'' fill=''none'' stroke=''#{I}'' stroke-width=''2''/>{STRIP}<rect x=''24'' y=''822'' width=''564'' height=''23'' fill=''#{T2}''/><path d=''M24,834q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0q12,-6 24,0'' fill=''none'' stroke=''#{I}'' stroke-width=''2'' stroke-linecap=''round''/></svg>','{P}',p),'{I}',i),'{T2}',t2),'{STRIP}',
      case when e='' then '' else replace(replace('<path fill=''#{T}'' fill-rule=''evenodd'' d=''{D}''/><rect x=''24'' y=''811'' width=''564'' height=''3'' fill=''#{T}''/>','{T}',t),'{D}',public._okuji_tmp_path(e)) end), want) $f$;
