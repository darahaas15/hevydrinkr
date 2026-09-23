-- =============================================================
-- Pin search_path on SECURITY DEFINER functions
-- Run AFTER 20260923_group_roast_access.sql
--
-- Every SECURITY DEFINER function in public ran with the caller's
-- search_path. That is the "function_search_path_mutable" warning in
-- Supabase's security advisor, and it breaks trigger chains that start
-- from another role: creating a user through the auth API runs
-- handle_new_user -> handle_new_user_notification_prefs with auth's
-- search_path, where the unqualified notification_preferences table
-- does not resolve.
--
-- None of these functions use extension-schema helpers, so pinning
-- them to public changes no name resolution in their bodies.
-- =============================================================

DO $$
DECLARE
  f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}')) AS c
        WHERE c LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', f);
  END LOOP;
END $$;
