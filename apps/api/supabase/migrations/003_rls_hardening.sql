-- Subly migration 003 — RLS hardening (Supabase advisor findings)
-- Apply after 002_indexer_and_security.sql.
--
-- The API talks to the database exclusively with the service-role key, which
-- BYPASSES row-level security. The permissive `USING (true)` policies from
-- 001/002 therefore did nothing for the API but granted full read/write to the
-- anon and authenticated roles (the anon key is public by design in Supabase).
-- Correct posture: RLS enabled, NO policies — anon/authenticated get nothing,
-- the service role is unaffected.

DROP POLICY IF EXISTS "Service role full access" ON merchants;
DROP POLICY IF EXISTS "Service role full access" ON plans;
DROP POLICY IF EXISTS "Service role full access" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access" ON payments;
DROP POLICY IF EXISTS "Service role full access" ON subscription_events;
DROP POLICY IF EXISTS "Service role full access" ON webhook_deliveries;
DROP POLICY IF EXISTS "Service role full access" ON indexer_state;

-- Pin the trigger function's search_path (advisor: function_search_path_mutable).
ALTER FUNCTION update_updated_at() SET search_path = '';
