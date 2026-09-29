-- ============================================================
-- fix_rls_auth.sql
-- Fix Supabase RLS Insert Error for 'competitors'
--
-- HOW TO USE:
--   1. Open Supabase Dashboard (https://supabase.com/dashboard)
--   2. Go to your project (jrtraipuqwvnyolzipas) → SQL Editor → New Query
--   3. Paste this script and click "Run"
--
-- DIAGNOSIS:
--   1. Authentication State:
--      - The frontend uses the Supabase publishable/anon key without end-user sign-in.
--      - auth.role() = 'anon', auth.uid() IS NULL.
--      - The current frontend user is UNAUTHENTICATED.
--   2. Existing Grants & Policies:
--      - The existing schema only provided an INSERT policy for auth.role() = 'authenticated'.
--      - No INSERT policy existed for the 'anon' role.
--      - When an unauthenticated user submitted the Add Competitor form,
--        PostgreSQL evaluated auth.role() = 'authenticated' as FALSE,
--        raising error 42501: "new row violates row-level security policy for table competitors".
--   3. Security Solution:
--      - Keep RLS strictly ENABLED on all tables.
--      - Do NOT create a public unrestricted INSERT policy (WITH CHECK (true)).
--      - Instead, create a RESTRICTED INSERT policy with strict column-level validation:
--        * name must be non-null, non-empty after trimming, and <= 200 characters.
--        * website (if provided) must start with http:// or https:// and be <= 500 characters.
--        * industry (if provided) must be <= 100 characters.
--        * description (if provided) must be <= 2000 characters.
--      - Explicitly grant necessary table privileges (SELECT, INSERT) to anon and authenticated roles.
-- ============================================================

-- ── STEP 1: ENSURE ROW LEVEL SECURITY IS ENABLED ───────────────────
ALTER TABLE competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_events ENABLE ROW LEVEL SECURITY;

-- ── STEP 2: GRANT TABLE PRIVILEGES ──────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE competitors TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE competitor_events TO anon, authenticated;

-- ── STEP 3: DROP OBSOLETE / INSECURE POLICIES ──────────────────────
DROP POLICY IF EXISTS "Public insert competitors"           ON competitors;
DROP POLICY IF EXISTS "Public update competitors"           ON competitors;
DROP POLICY IF EXISTS "Public delete competitors"           ON competitors;
DROP POLICY IF EXISTS "Auth insert competitors"             ON competitors;
DROP POLICY IF EXISTS "Restricted insert competitors"       ON competitors;

DROP POLICY IF EXISTS "Public insert competitor_events"     ON competitor_events;
DROP POLICY IF EXISTS "Public update competitor_events"     ON competitor_events;
DROP POLICY IF EXISTS "Public delete competitor_events"     ON competitor_events;
DROP POLICY IF EXISTS "Auth insert competitor_events"       ON competitor_events;
DROP POLICY IF EXISTS "Restricted insert competitor_events" ON competitor_events;

-- ── STEP 4: PUBLIC READ POLICIES ───────────────────────────────────
DROP POLICY IF EXISTS "Public read competitors" ON competitors;
CREATE POLICY "Public read competitors"
  ON competitors FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read competitor_events" ON competitor_events;
CREATE POLICY "Public read competitor_events"
  ON competitor_events FOR SELECT
  USING (true);

-- ── STEP 5: RESTRICTED INSERT POLICIES (NO UNRESTRICTED WITH CHECK (true)) ─
-- Validates competitor payload to ensure clean, bounded inputs:
CREATE POLICY "Restricted insert competitors"
  ON competitors FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL
    AND length(trim(name)) > 0
    AND length(name) <= 200
    AND (website IS NULL OR length(trim(website)) = 0 OR (length(website) <= 500 AND website ~* '^https?://'))
    AND (industry IS NULL OR length(industry) <= 100)
    AND (description IS NULL OR length(description) <= 2000)
  );

-- Validates competitor event payload to ensure valid categories and bounded fields:
CREATE POLICY "Restricted insert competitor_events"
  ON competitor_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    competitor_id IS NOT NULL
    AND title IS NOT NULL
    AND length(trim(title)) > 0
    AND length(title) <= 255
    AND category IN ('Product','Pricing','Marketing','Partnership','Hiring','Funding','Expansion','Other')
    AND importance IN ('Low','Medium','High')
    AND (source_url IS NULL OR length(trim(source_url)) = 0 OR (length(source_url) <= 500 AND source_url ~* '^https?://'))
    AND (description IS NULL OR length(description) <= 4000)
  );

-- ── STEP 6: AUTHENTICATED-ONLY UPDATE & DELETE POLICIES ────────────
-- Destructive operations remain strictly guarded:
DROP POLICY IF EXISTS "Auth update competitors" ON competitors;
CREATE POLICY "Auth update competitors"
  ON competitors FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    name IS NOT NULL AND length(trim(name)) > 0 AND length(name) <= 200
  );

DROP POLICY IF EXISTS "Auth delete competitors" ON competitors;
CREATE POLICY "Auth delete competitors"
  ON competitors FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Auth update competitor_events" ON competitor_events;
CREATE POLICY "Auth update competitor_events"
  ON competitor_events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    title IS NOT NULL AND length(trim(title)) > 0
  );

DROP POLICY IF EXISTS "Auth delete competitor_events" ON competitor_events;
CREATE POLICY "Auth delete competitor_events"
  ON competitor_events FOR DELETE
  TO authenticated
  USING (true);
