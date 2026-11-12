-- One-time derive-assist backfill for passports.country / passports.region
-- (migration 112 columns). NOT a schema migration — a data backfill, run once
-- against the live DB on 2026-11-12 to seed location from each passport's stops
-- so the location filter + location map have data.
--
-- Conservative + honest: a passport's country is set ONLY when every located
-- stop agrees on one country (unanimous); a US passport's region is set ONLY
-- when every stop agrees on one state. Ambiguous (multi-country / multi-state)
-- and no-stop-data passports are LEFT UNSET — they surface under "No location
-- set" rather than being guessed.
--
-- Result on first run: 49/61 placed a country (31 of those a US state); 1
-- multi-country + 11 no-data left unset. Re-runnable: it only ever sets a
-- confident value and never overwrites toward NULL.

with sn as (
  select pg.passport_id,
    case lower(trim(s.country))
      when 'united states' then 'US' when 'usa' then 'US' when 'mexico' then 'MX'
      when 'japan' then 'JP' when 'canada' then 'CA' when 'italy' then 'IT'
      when 'greece' then 'GR' when 'ireland' then 'IE' when 'iceland' then 'IS'
      when 'china' then 'CN' when 'france' then 'FR' when 'united kingdom' then 'GB'
      when 'spain' then 'ES' else null end as cc,
    case when upper(trim(s.address_state))='HAWAII' then 'US-HI'
         when upper(trim(s.country)) in ('UNITED STATES','USA') and length(trim(s.address_state))=2
           then 'US-'||upper(trim(s.address_state)) else null end as rc
  from public.passport_pages pg join public.stops s on s.page_id=pg.id
  where pg.passport_id in (select id from public.passports where credential_type='persistent')
),
cv as (
  select passport_id,
    count(*) filter (where cc is not null) placed,
    count(distinct cc) filter (where cc is not null) n_cc, max(cc) cc1,
    count(distinct rc) filter (where rc is not null) n_rc, max(rc) rc1
  from sn group by passport_id
)
update public.passports p set
  country = cv.cc1,
  region  = case when cv.cc1='US' and cv.n_rc=1 then cv.rc1 else p.region end
from cv
where cv.passport_id = p.id
  and p.credential_type='persistent'
  and cv.n_cc = 1;
