-- Preflight for ber. Read only. Raises (and the loader stops) if anything the load needs is missing,
-- or if a passport would be duplicated.
do $pre$
declare missing text; pid uuid := extensions.uuid_generate_v5('3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55'::uuid, 'ber/passport'); n int; other text;
begin
  select string_agg(w.t||'.'||w.c, ', ') into missing
  from (values
    ('passports','id'),
    ('passports','creator_id'),
    ('passports','title'),
    ('passports','description'),
    ('passports','passport_type'),
    ('passports','cover_bg_color'),
    ('passports','cover_bg_type'),
    ('passports','cover_emblem'),
    ('passports','paper_color'),
    ('passports','is_published'),
    ('passports','is_free'),
    ('passports','price_cents'),
    ('passports','cover_template'),
    ('passports','cover_paper_color'),
    ('passports','status'),
    ('passports','expected_spend_tier'),
    ('passports','expected_spend_note'),
    ('passports','cover_outside_data'),
    ('passports','cover_inside_data'),
    ('passports','is_demo'),
    ('passports','is_okuji_official'),
    ('passports','country'),
    ('passport_pages','id'),
    ('passport_pages','passport_id'),
    ('passport_pages','page_order'),
    ('passport_pages','page_number'),
    ('passport_pages','section_name'),
    ('passport_pages','section_title'),
    ('passport_pages','page_type'),
    ('passport_pages','background_type'),
    ('passport_pages','background_color'),
    ('passport_pages','paper_color'),
    ('passport_pages','elements'),
    ('passport_pages','background_image_url'),
    ('stops','id'),
    ('stops','page_id'),
    ('stops','stop_order'),
    ('stops','name'),
    ('stops','year_established'),
    ('stops','description'),
    ('stops','evidence_tier'),
    ('stops','radius_meters'),
    ('stops','stamp_icon'),
    ('stops','stamp_color'),
    ('stops','stamp_shape'),
    ('stops','stamp_type'),
    ('stops','verification_type'),
    ('stops','address_street'),
    ('stops','address_city'),
    ('stops','address_state'),
    ('stops','address_zip'),
    ('stops','lat'),
    ('stops','lng'),
    ('stops','verification_radius_meters'),
    ('stops','box_x'),
    ('stops','box_y'),
    ('stops','box_width'),
    ('stops','box_height'),
    ('stops','learning_objective'),
    ('stops','experience_type'),
    ('stops','experience_verification_method'),
    ('stops','classifiers'),
    ('stops','journal_prompt'),
    ('stops','country'),
    ('stops','expected_spend_tier'),
    ('stops','location_caption_mode'),
    ('stops','stamp_asset_id'),
    ('design_assets','id'),
    ('design_assets','owner_id'),
    ('design_assets','name'),
    ('design_assets','asset_type'),
    ('design_assets','url'),
    ('design_assets','file_format'),
    ('design_assets','is_monochrome'),
    ('design_assets','scoped_passport_id'),
    ('design_assets','display_name'),
    ('design_assets','width_px'),
    ('design_assets','height_px'),
    ('design_assets','metadata')
  ) as w(t,c)
  where not exists (select 1 from information_schema.columns ic
                    where ic.table_schema='public' and ic.table_name=w.t and ic.column_name=w.c);
  if missing is not null then raise exception 'PREFLIGHT: missing columns: %', missing; end if;

  if not exists (select 1 from profiles where id='921b40f1-7111-466e-8ed7-7f69430e465a') then
    raise exception 'PREFLIGHT: creator profile 921b40f1-7111-466e-8ed7-7f69430e465a not found'; end if;

  -- a passport with this title owned by the creator but NOT our id means an earlier load used other ids
  select string_agg(id::text||' ('||status||')', ', ') into other from passports
   where creator_id='921b40f1-7111-466e-8ed7-7f69430e465a' and title='Berlin · A City Passport' and id<>pid;
  if other is not null then raise exception 'PREFLIGHT: % already exists under a different id: %. Not loading.', 'Berlin · A City Passport', other; end if;

  select count(*) into n from passports where id=pid;
  raise notice 'PREFLIGHT OK. passport id % exists: %', pid, (n>0);
end $pre$;
select exists(select 1 from passports where id=extensions.uuid_generate_v5('3c0d1a2b-5e6f-4a7b-8c9d-0e1f2a3b4c55'::uuid, 'ber/passport')) as already_loaded;
