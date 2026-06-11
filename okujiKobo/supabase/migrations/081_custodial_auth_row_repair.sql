-- Migration 081: repair the custodial auth.users row for GoTrue
--
-- Migration 049 manually INSERTed the custodial account into auth.users
-- with only the columns it needed; the token/change columns were left
-- NULL. GoTrue-created rows store empty strings there, and GoTrue's
-- user queries scan those columns into non-nullable Go strings — so any
-- API that reads the custodial row (admin listUsers, the dashboard's
-- Authentication → Users page) fails with "Database error finding
-- users".
--
-- Set the string-scanned columns to '' to match GoTrue-created rows.
-- Idempotent; touches only the custodial row.

UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE id = '00000000-0000-0000-0000-000000000001';
