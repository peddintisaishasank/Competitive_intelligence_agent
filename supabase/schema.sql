-- ============================================================
-- schema.sql
-- Competitive Intelligence Agent — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- ── 1. COMPETITORS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  website     TEXT,
  industry    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. COMPETITOR EVENTS TABLE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS competitor_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  event_date    DATE        NOT NULL,
  category      TEXT        NOT NULL CHECK (category IN ('Product','Pricing','Marketing','Partnership','Hiring','Funding','Expansion','Other')),
  title         TEXT        NOT NULL,
  description   TEXT,
  source_url    TEXT,
  source_name   TEXT,
  importance    TEXT        NOT NULL DEFAULT 'Medium' CHECK (importance IN ('Low','Medium','High')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_competitor_events_competitor_id
  ON competitor_events(competitor_id);

CREATE INDEX IF NOT EXISTS idx_competitor_events_event_date
  ON competitor_events(event_date DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_events_category
  ON competitor_events(category);

-- ── 4. ROW LEVEL SECURITY ────────────────────────────────────────
ALTER TABLE competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_events ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous reads (dashboard can display data without login)
CREATE POLICY "Public read competitors"
  ON competitors FOR SELECT
  USING (true);

CREATE POLICY "Public read competitor_events"
  ON competitor_events FOR SELECT
  USING (true);

-- Allow authenticated users to insert / update / delete
CREATE POLICY "Auth insert competitors"
  ON competitors FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth update competitors"
  ON competitors FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth delete competitors"
  ON competitors FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth insert competitor_events"
  ON competitor_events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth update competitor_events"
  ON competitor_events FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth delete competitor_events"
  ON competitor_events FOR DELETE
  USING (auth.role() = 'authenticated');
