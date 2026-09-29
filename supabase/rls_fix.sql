-- ============================================================
-- rls_fix.sql
-- Fixes RLS so the anon key can INSERT / UPDATE / DELETE.
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Why this is needed:
--   The existing schema only allows `authenticated` role to
--   write, but this dashboard uses the anon (public) key with
--   no user login. This script replaces those policies with
--   permissive ones that work with the anon key.
-- ============================================================

-- ── Drop authenticated-only write policies ────────────────────
DROP POLICY IF EXISTS "Auth insert competitors"        ON competitors;
DROP POLICY IF EXISTS "Auth update competitors"        ON competitors;
DROP POLICY IF EXISTS "Auth delete competitors"        ON competitors;
DROP POLICY IF EXISTS "Auth insert competitor_events"  ON competitor_events;
DROP POLICY IF EXISTS "Auth update competitor_events"  ON competitor_events;
DROP POLICY IF EXISTS "Auth delete competitor_events"  ON competitor_events;

-- Also drop if reset_and_seed named them differently
DROP POLICY IF EXISTS "Public insert competitors"      ON competitors;
DROP POLICY IF EXISTS "Public update competitors"      ON competitors;
DROP POLICY IF EXISTS "Public delete competitors"      ON competitors;
DROP POLICY IF EXISTS "Public insert competitor_events" ON competitor_events;
DROP POLICY IF EXISTS "Public update competitor_events" ON competitor_events;
DROP POLICY IF EXISTS "Public delete competitor_events" ON competitor_events;

-- ── Create permissive write policies for anon + authenticated ─
CREATE POLICY "Public insert competitors"
  ON competitors FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update competitors"
  ON competitors FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Public delete competitors"
  ON competitors FOR DELETE
  USING (true);

CREATE POLICY "Public insert competitor_events"
  ON competitor_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update competitor_events"
  ON competitor_events FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Public delete competitor_events"
  ON competitor_events FOR DELETE
  USING (true);
