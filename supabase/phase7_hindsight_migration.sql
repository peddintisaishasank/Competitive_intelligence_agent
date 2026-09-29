-- ============================================================
-- Phase 7 Migration: Hindsight Memory Sync Tracking
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================

-- Add hindsight sync tracking columns to competitor_events
ALTER TABLE competitor_events
  ADD COLUMN IF NOT EXISTS hindsight_retained      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hindsight_retained_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hindsight_memory_ref    TEXT;

-- Index so we can quickly find un-synced events
CREATE INDEX IF NOT EXISTS idx_competitor_events_hindsight_retained
  ON competitor_events(hindsight_retained)
  WHERE hindsight_retained = FALSE;

-- RLS: allow the service-role key (used by the Express backend) to update these columns
-- The service-role key bypasses RLS, so no additional policy is needed.
-- However, if you are using the anon key from the backend, add:
-- CREATE POLICY "Allow backend to update hindsight_retained"
--   ON competitor_events FOR UPDATE
--   USING (true) WITH CHECK (true);
