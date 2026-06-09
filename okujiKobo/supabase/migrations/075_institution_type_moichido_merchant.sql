-- Migration 075: institutions.institution_type — add 'moichido_merchant'
--
-- Web-tree migration. Extends the institutions_institution_type_check
-- constraint to permit 'moichido_merchant' as a value. M4.2's merchant
-- account model: a moichido merchant IS an institution with this type;
-- no new table, no new column. Employee membership + capabilities flow
-- through the existing employee_authorizations machinery unchanged.
--
-- The full value list mirrors migration 015's institutions_institution_type_check
-- exactly, with one new entry added under a new 'moichido' comment block.
-- Re-running this migration on a database where 015 hasn't landed will
-- skip cleanly because the DO block's exception handler swallows the
-- ALTER failure (same pattern 015 itself uses).
--
-- ROLLBACK: re-run migration 015's CHECK clause without 'moichido_merchant'.
-- Safe only when no row carries the new value.

DO $$
BEGIN
  -- TWO historical constraint names sit on this column:
  --   institutions_type_check             (added in 010/011)
  --   institutions_institution_type_check (added in 014/015)
  -- Both must permit the value or INSERTs fail. We drop both and
  -- re-add the canonical one so the table ends up with exactly the
  -- whitelist below.
  ALTER TABLE public.institutions
    DROP CONSTRAINT IF EXISTS institutions_type_check;
  ALTER TABLE public.institutions
    DROP CONSTRAINT IF EXISTS institutions_institution_type_check;
  ALTER TABLE public.institutions
    ADD CONSTRAINT institutions_institution_type_check
    CHECK (institution_type IN (
      -- Educational
      'k12_school','public_library','museum','educational_nonprofit',
      'after_school_program','literacy_organization','youth_development','homeschool_cooperative',
      -- Cultural preservation
      'historical_society','heritage_organization','cultural_center','oral_history_project',
      -- Community arts
      'community_theater','public_art_organization','community_arts_center',
      'community_music_program','writing_center',
      -- Social services
      'food_bank','homeless_shelter','refugee_immigrant_services','free_health_clinic','adult_literacy',
      -- Environmental / conservation
      'parks_department','nature_conservatory','land_trust','watershed_council',
      'native_plant_society','wildlife_rehabilitation','environmental_education',
      -- Nature & science (admission determines pricing)
      'zoo','aquarium','botanical_garden','science_museum','childrens_museum','nature_center',
      -- Community access
      'community_garden','maker_space','tool_lending_library','seed_library',
      -- Municipal
      'municipality',
      -- Commercial — community tier
      'chamber_of_commerce','local_tourism_board','proprietor','hotel_group_small',
      -- Commercial — regional tier
      'state_tourism_board','convention_bureau',
      -- Commercial — enterprise tier
      'hotel_chain','airline','expo_organizer','national_tourism_org','theme_park','cruise_line',
      -- Patron
      'corporate_sponsor','foundation',
      -- moichido (M4.2) — merchant accounts that surface on moichido.app
      'moichido_merchant',
      -- Legacy / catch-all
      'nature_center_paid','tourism_board','general','library','school','park',
      'historic_site','nonprofit','other'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;
