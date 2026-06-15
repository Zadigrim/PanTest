-- 087_clear_qr_on_experience_stops.sql
-- Event/Activity stops (experience_type='experience') are honor-based and are
-- never QR-verified, so a qr_code_id left over from when the stop was a
-- Location is stale. Clear it for any existing experience stop.
--
-- Going forward, the designer clears the token on the location→event switch
-- (RightInspector.handleTypeChange), so this one-time data fix only addresses
-- stops that were converted before that change shipped.
--
-- Stable stop-QR path only; does not touch moichido punch QRs or terminal
-- prize codes. Idempotent.

UPDATE public.stops
   SET qr_code_id = NULL
 WHERE experience_type = 'experience'
   AND qr_code_id IS NOT NULL;
