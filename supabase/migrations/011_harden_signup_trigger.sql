-- Harden the auth-signup trigger.
--
-- Symptom this migration fixes: "Database error saving new user" reported by
-- the okujiKobo signup form (and any Supabase auth signup) when the trigger
-- fails to create a profile row.
--
-- Root causes addressed:
--
-- 1. display_name fallback could return NULL. profiles.display_name is
--    NOT NULL (per supabase/migrations/001_initial_schema.sql). The
--    previous trigger fell back to split_part(NEW.email, '@', 1) but
--    didn't guard against NEW.email itself being NULL (which can happen
--    on OAuth providers that don't share email). A NULL display_name
--    fails the NOT NULL check, which Supabase wraps as a generic
--    "Database error saving new user."
--
-- 2. The okujiKobo signup form passes the user's typed name as
--    raw_user_meta_data.display_name, but the trigger only looked at
--    'full_name' and 'name'. That key is now first in the COALESCE chain.
--
-- 3. NEW.app_metadata was the legacy column name; current Supabase
--    exposes the same data as raw_app_meta_data. The CASE for
--    auth_provider now reads the modern column.
--
-- 4. The whole trigger body is now wrapped in an EXCEPTION handler that
--    logs to Postgres logs and lets auth signup succeed even if profile
--    creation fails for an unforeseen reason. The signup form already
--    upserts the profile client-side after auth succeeds, so a missed
--    insert here is self-healing on the very next request rather than a
--    permanent dead account.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_display_name text;
  v_provider     text;
BEGIN
  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name',    ''),
    NULLIF(NEW.raw_user_meta_data->>'name',         ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'  -- guaranteed-non-null backstop
  );

  v_provider := CASE
    WHEN COALESCE(NEW.raw_app_meta_data->>'provider', '') = 'google' THEN 'google'
    ELSE 'email'
  END;

  INSERT INTO public.profiles (
    id, display_name, avatar_url, auth_provider
  )
  VALUES (
    NEW.id,
    v_display_name,
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    v_provider
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url    = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    auth_provider = EXCLUDED.auth_provider;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't block auth signup on a profile-insert hiccup. The signup form
  -- upserts the profile right after, and the auth user exists either way.
  RAISE WARNING 'handle_new_user failed for %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Re-create the trigger to ensure it's bound to the new function definition.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
