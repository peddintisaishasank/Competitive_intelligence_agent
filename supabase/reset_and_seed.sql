-- ============================================================
-- reset_and_seed.sql
-- ① Drops old tables (with wrong column names)
-- ② Recreates with the correct schema  (matching db.js / schema.sql)
-- ③ Applies RLS policies
-- ④ Seeds demo data
--
-- HOW TO USE:
--   Supabase Dashboard → SQL Editor → New Query
--   Paste this entire file → click Run
-- ============================================================


-- ── STEP 1: DROP OLD TABLES ───────────────────────────────────────
DROP TABLE IF EXISTS competitor_events CASCADE;
DROP TABLE IF EXISTS competitors       CASCADE;


-- ── STEP 2: RECREATE TABLES WITH CORRECT COLUMNS ─────────────────

CREATE TABLE competitors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  website     TEXT,
  industry    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE competitor_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID        NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  event_date    DATE        NOT NULL,
  category      TEXT        NOT NULL CHECK (category IN (
                  'Product','Pricing','Marketing','Partnership',
                  'Hiring','Funding','Expansion','Other')),
  title         TEXT        NOT NULL,
  description   TEXT,
  source_url    TEXT,
  source_name   TEXT,
  importance    TEXT        NOT NULL DEFAULT 'Medium'
                            CHECK (importance IN ('Low','Medium','High')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── STEP 3: INDEXES ───────────────────────────────────────────────

CREATE INDEX idx_competitor_events_competitor_id
  ON competitor_events(competitor_id);

CREATE INDEX idx_competitor_events_event_date
  ON competitor_events(event_date DESC);

CREATE INDEX idx_competitor_events_category
  ON competitor_events(category);


-- ── STEP 4: ROW LEVEL SECURITY ────────────────────────────────────

ALTER TABLE competitors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read competitors"
  ON competitors FOR SELECT USING (true);

CREATE POLICY "Public read competitor_events"
  ON competitor_events FOR SELECT USING (true);

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


-- ── STEP 5: SEED COMPETITORS ──────────────────────────────────────

INSERT INTO competitors (id, name, website, industry, description) VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
    'AgroTech AI',
    'https://example.com/agrotech',
    'Agriculture Technology',
    'AI-powered agriculture technology company focused on precision farming. [FICTIONAL DEMO DATA]'
  ),
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567802',
    'FarmVision',
    'https://example.com/farmvision',
    'Agriculture Technology',
    'Smart farming and crop analytics company leveraging satellite imagery and IoT sensors. [FICTIONAL DEMO DATA]'
  ),
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567803',
    'CropMind',
    'https://example.com/cropmind',
    'Agriculture Technology',
    'AI-based crop monitoring and farm automation for smallholder farmers. [FICTIONAL DEMO DATA]'
  );


-- ── STEP 6: SEED EVENTS ───────────────────────────────────────────

INSERT INTO competitor_events
  (competitor_id, event_date, category, title, description, source_name, importance)
VALUES

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-10-05', 'Hiring',
    'Expanded AI engineering team with 8 new roles',
    'AgroTech AI posted 8 new positions for ML and computer vision. [FICTIONAL]',
    'LinkedIn Jobs', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-10-15', 'Product',
    'AI Crop Assistant v1.0 launched',
    'Real-time crop condition analysis using drone imagery. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-11-10', 'Hiring',
    'AI engineering team expanded again — 12 additional hires',
    'Focus on NLP and predictive analytics. [FICTIONAL]',
    'Glassdoor', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-12-01', 'Funding',
    'Series A funding round — $15M raised',
    '$15M Series A led by AgriVentures Capital. [FICTIONAL]',
    'TechCrunch', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-01-20', 'Partnership',
    'Partnership with GreenFields announced',
    'Integration of satellite imagery into the platform. [FICTIONAL]',
    'Press Release', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-02-14', 'Product',
    'Mobile app released — iOS and Android',
    'Real-time field monitoring companion app. [FICTIONAL]',
    'App Store', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-04-18', 'Pricing',
    'Enterprise tier launched',
    'Custom pricing for large agricultural corporations. [FICTIONAL]',
    'Company Blog', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-05-22', 'Expansion',
    'Expansion into Southeast Asia markets',
    'Vietnam, Thailand, and Indonesia. [FICTIONAL]',
    'Reuters', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-06-30', 'Product',
    'AI Crop Assistant v2.0 — predictive yield forecasting',
    'Trained on 5 years of data. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-08-10', 'Funding',
    'Series B — $42M raised',
    'Accelerate international expansion and R&D. [FICTIONAL]',
    'TechCrunch', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-09-01', 'Hiring',
    'Global hiring push — 50 roles across 6 countries',
    'Engineering, sales, and operations. [FICTIONAL]',
    'LinkedIn Jobs', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-10-20', 'Product',
    'SatelliteView 3.0 released — sub-meter resolution',
    'Sub-meter crop health imagery. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-11-15', 'Partnership',
    'IoT sensor integration with AgriSense',
    'Bundled IoT soil sensors with the platform. [FICTIONAL]',
    'Press Release', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-12-10', 'Hiring',
    'Data science team expanded — 6 new hires',
    'Satellite image analysis specialists. [FICTIONAL]',
    'Glassdoor', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-01-08', 'Marketing',
    'CES 2026 — Best AgriTech Innovation award',
    'Won the Best AgriTech Innovation award. [FICTIONAL]',
    'Event Coverage', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-02-25', 'Pricing',
    'Free tier introduced for small farms (up to 50 acres)',
    'Capture the small-farm segment. [FICTIONAL]',
    'Company Blog', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-03-18', 'Funding',
    'Series A — $22M raised',
    'Led by DeepHarvest Ventures. [FICTIONAL]',
    'VentureBeat', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-04-30', 'Expansion',
    'European launch — UK, France, Germany',
    'Localised pricing and support. [FICTIONAL]',
    'Reuters', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-06-12', 'Product',
    'Drone integration API released',
    'Third-party drone systems feed data into the platform. [FICTIONAL]',
    'Dev Blog', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-07-28', 'Partnership',
    'Distribution partnership with AgroDirect',
    'Reach 10,000 farms. [FICTIONAL]',
    'Press Release', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-09-10', 'Product',
    'Weather-overlay feature launched',
    'Live weather-overlay layer on crop-health map. [FICTIONAL]',
    'Company Blog', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-10-28', 'Product',
    'CropMind Advisor v1.0 — AI recommendations for smallholders',
    'AI advisory tool for smallholder farmers. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-11-20', 'Funding',
    'Seed round — $5M raised',
    'From impact investors focused on food security. [FICTIONAL]',
    'AgFunder', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-12-15', 'Partnership',
    'NGO partnership with FoodForward',
    'Deploy tools to 500 smallholder farmers. [FICTIONAL]',
    'Press Release', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-03-10', 'Pricing',
    'Pay-per-harvest model introduced',
    'Reduces upfront costs for small farms. [FICTIONAL]',
    'Company Blog', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-04-22', 'Product',
    'Offline mode released — works without internet',
    'For farmers in low-connectivity areas. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-05-18', 'Funding',
    'Series A — $18M raised',
    'Three impact-focused funds participated. [FICTIONAL]',
    'AgFunder', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-06-25', 'Expansion',
    'Launch in East Africa — Kenya, Tanzania, Uganda',
    'Partnering with local co-operatives. [FICTIONAL]',
    'Reuters', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-07-14', 'Hiring',
    'Pre-launch hiring surge — 20 engineering roles',
    'Senior engineering positions ahead of major release. [FICTIONAL]',
    'LinkedIn Jobs', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-08-22', 'Product',
    'SmallHolder Edition launched — affordable tier for small farms',
    'Low-cost tier targeting emerging markets. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-09-05', 'Expansion',
    'Pilot program launched in India — 200 farm partners',
    'Government-subsidized pilot covering 200 smallholder farms. [FICTIONAL]',
    'Business Wire', 'High' );
