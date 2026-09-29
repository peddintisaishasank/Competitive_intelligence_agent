-- ============================================================
-- Phase 9 Migration: Automated Competitor Intelligence Ingestion
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Extend competitors with optional public source URLs
ALTER TABLE competitors
  ADD COLUMN IF NOT EXISTS rss_url  TEXT,
  ADD COLUMN IF NOT EXISTS news_url TEXT;

-- 2. Extend competitor_events with source traceability & duplicate tracking
ALTER TABLE competitor_events
  ADD COLUMN IF NOT EXISTS source_item_id   TEXT,
  ADD COLUMN IF NOT EXISTS content_hash     TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_method TEXT DEFAULT 'automated_ingestion';

-- 3. Indexes for fast deduplication lookup
CREATE INDEX IF NOT EXISTS idx_competitor_events_source_url
  ON competitor_events(source_url);

CREATE INDEX IF NOT EXISTS idx_competitor_events_content_hash
  ON competitor_events(content_hash);
