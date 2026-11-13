-- Read back ber. Every check column should be true.
with p as (select * from passports where id=extensions.uuid_generate_v5('3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55'::uuid,'ber/passport')),
pg as (select pp.* from passport_pages pp join p on pp.passport_id=p.id),
st as (select s.* from stops s join pg on s.page_id=pg.id)
select p.id, p.title, p.status, p.is_demo, p.is_okuji_official, p.is_free, p.price_cents, p.country,
  (select count(*) from pg) as pages, (select count(*) from pg)=11 as pages_ok,
  (select count(*) from st) as stops, (select count(*) from st)=28 as stops_ok,
  (select count(*) from st where stamp_asset_id is not null) as stops_with_stamp,
  not exists (select 1 from st where stamp_asset_id is null
              or not exists (select 1 from design_assets a where a.id=st.stamp_asset_id)) as every_stop_has_stamp,
  not exists (select 1 from pg where background_image_url is null) as every_page_has_background,
  (p.cover_outside_data->>'image_url') is not null as cover_has_image,
  (select count(*) from st where verification_tier=3) as stops_tier3_from_trigger,
  p.creator_id='921b40f1-7111-466e-8ed7-7f69430e465a' as owned_by_creator,
  p.status='draft' and p.is_demo and p.is_okuji_official and p.is_free and coalesce(p.price_cents,0)=0 as flags_ok
from p;
select count(*) as leftover_tmp_helpers from pg_proc where proname like '\_okuji\_tmp\_%';
