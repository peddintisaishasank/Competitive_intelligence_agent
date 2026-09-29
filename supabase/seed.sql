-- ============================================================
-- seed.sql
-- Competitive Intelligence Agent — Demo Data
-- Run AFTER schema.sql in the Supabase SQL Editor
-- All data is FICTIONAL for demonstration purposes only.
-- ============================================================

-- ── INSERT COMPETITORS ───────────────────────────────────────────
-- We use explicit UUIDs so events can reference them below

INSERT INTO competitors (id, name, website, industry, description) VALUES
  (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
    'AgroTech AI',
    'https://example.com/agrotech',
    'Agriculture Technology',
    'AI-powered agriculture technology company focused on precision farming and crop yield optimization. [FICTIONAL DEMO DATA]'
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
    'AI-based crop monitoring and farm automation company with a focus on smallholder farmers. [FICTIONAL DEMO DATA]'
  );

-- ── INSERT EVENTS: AgroTech AI ───────────────────────────────────
-- Pattern: Increasing AI-related product launches + partnership growth

INSERT INTO competitor_events (competitor_id, event_date, category, title, description, source_name, importance) VALUES

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-10-05', 'Hiring',
    'Expanded AI engineering team with 8 new roles',
    'AgroTech AI fictionally posted 8 new positions focused on ML infrastructure and computer vision, signalling upcoming product investment. [FICTIONAL]',
    'LinkedIn Jobs', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-10-15', 'Product',
    'AI Crop Assistant v1.0 launched',
    'AgroTech AI fictionally introduced an AI assistant designed to help farmers analyze crop conditions in real time using drone imagery. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-11-10', 'Hiring',
    'AI engineering team expanded again — 12 additional hires',
    'AgroTech AI fictionally increased AI engineering headcount a second time, with focus on NLP and predictive analytics. [FICTIONAL]',
    'Glassdoor', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2025-12-01', 'Funding',
    'Series A funding round — $15M raised',
    'AgroTech AI fictionally closed a $15M Series A led by AgriVentures Capital, earmarked for product and international expansion. [FICTIONAL]',
    'TechCrunch', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-01-20', 'Partnership',
    'Partnership with GreenFields announced',
    'AgroTech AI fictionally partnered with GreenFields to explore smart irrigation and soil sensing integrations. [FICTIONAL]',
    'Press Release', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-02-14', 'Product',
    'AI Crop Assistant v2.0 — multi-crop support added',
    'AgroTech AI fictionally released a major update adding support for wheat, maize, and soybean disease detection. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-03-05', 'Marketing',
    'Launched "Grow Smarter" brand campaign',
    'AgroTech AI fictionally began a regional marketing campaign targeting mid-size farm operations across three states. [FICTIONAL]',
    'AdAge Monitor', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-04-10', 'Partnership',
    'Second partnership — with AquaGro for water management',
    'AgroTech AI fictionally signed a co-development agreement with AquaGro to integrate water-stress prediction into its platform. [FICTIONAL]',
    'Press Release', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-05-22', 'Product',
    'Launched yield prediction feature — AI Crop Assistant v2.5',
    'AgroTech AI fictionally released a yield forecasting module powered by satellite data and historical weather patterns. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-06-18', 'Expansion',
    'Entered Southeast Asian markets',
    'AgroTech AI fictionally announced market entry into Vietnam and Thailand, establishing local partnerships. [FICTIONAL]',
    'Business Wire', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-07-09', 'Hiring',
    'Regional sales team hired for APAC markets',
    'AgroTech AI fictionally onboarded 6 regional sales managers to support its Southeast Asia expansion. [FICTIONAL]',
    'LinkedIn Jobs', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-08-30', 'Product',
    'AI Crop Assistant v3.0 — real-time pest alerts',
    'AgroTech AI fictionally launched real-time pest detection alerts using satellite imagery and edge-computing sensors. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567801', '2026-09-15', 'Partnership',
    'Third partnership — with CloudAgri for cloud analytics',
    'AgroTech AI fictionally partnered with CloudAgri to offer joint analytics dashboards to enterprise farm clients. [FICTIONAL]',
    'Press Release', 'Medium' );


-- ── INSERT EVENTS: FarmVision ────────────────────────────────────
-- Pattern: Repeated pricing changes + marketing pushes

INSERT INTO competitor_events (competitor_id, event_date, category, title, description, source_name, importance) VALUES

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-10-20', 'Pricing',
    'Introduced annual billing discount — 20% off',
    'FarmVision fictionally introduced a 20% discount for annual subscriptions to compete with free-tier offerings from rivals. [FICTIONAL]',
    'Pricing Page Monitor', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-11-05', 'Product',
    'Satellite image resolution upgrade',
    'FarmVision fictionally upgraded its satellite imagery resolution from 10m to 3m, improving crop health detection accuracy. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-11-25', 'Marketing',
    'Sponsored AgriExpo 2025 as Gold Sponsor',
    'FarmVision fictionally secured a Gold sponsorship slot at AgriExpo 2025, gaining prominent brand exposure. [FICTIONAL]',
    'Event Website', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2025-12-15', 'Pricing',
    'Reduced Starter plan by $30/month',
    'FarmVision fictionally cut the Starter plan price, likely responding to competitive pressure from free-tier entrants. [FICTIONAL]',
    'Pricing Page Monitor', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-01-10', 'Partnership',
    'Integration with John Deere Operations Center',
    'FarmVision fictionally announced API-level integration with John Deere Operations Center for seamless data sharing. [FICTIONAL]',
    'Press Release', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-02-20', 'Pricing',
    'Enterprise pricing restructured — new seat-based model',
    'FarmVision fictionally moved enterprise customers to a seat-based model, which increased average contract value by an estimated 35%. [FICTIONAL]',
    'Pricing Page Monitor', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-03-12', 'Marketing',
    'Launched YouTube tutorial series',
    'FarmVision fictionally released a 10-part YouTube series targeting first-time AgTech adopters. [FICTIONAL]',
    'YouTube Analytics', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-04-22', 'Hiring',
    'Hired VP of Marketing from AgriAnalytics Corp',
    'FarmVision fictionally recruited a high-profile VP of Marketing, signalling an upcoming brand push. [FICTIONAL]',
    'LinkedIn News', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-05-08', 'Pricing',
    'Free tier launched — 5 fields unlimited',
    'FarmVision fictionally launched a free tier allowing up to 5 fields with unlimited satellite checks. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-06-14', 'Product',
    'Mobile app redesign released',
    'FarmVision fictionally released a fully redesigned mobile app with offline mode and voice commands. [FICTIONAL]',
    'App Store Release Notes', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-07-30', 'Pricing',
    'Raised Pro plan by $10/month',
    'FarmVision fictionally increased the Pro plan by $10, possibly after the free tier reduced upgrade pressure. [FICTIONAL]',
    'Pricing Page Monitor', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-08-18', 'Marketing',
    'Television campaign launched in rural regions',
    'FarmVision fictionally began a television advertising push targeting farming communities in major agricultural states. [FICTIONAL]',
    'Ad Intelligence Monitor', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567802', '2026-09-10', 'Expansion',
    'Expanded to Brazilian agribusiness market',
    'FarmVision fictionally announced market entry into Brazil, the world largest soybean-producing region. [FICTIONAL]',
    'Business Wire', 'High' );


-- ── INSERT EVENTS: CropMind ──────────────────────────────────────
-- Pattern: Heavy hiring before product launches; funding events

INSERT INTO competitor_events (competitor_id, event_date, category, title, description, source_name, importance) VALUES

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-10-08', 'Hiring',
    'Hired 15 software engineers across backend and ML',
    'CropMind fictionally posted 15 engineering roles primarily in backend infrastructure and ML model serving. [FICTIONAL]',
    'LinkedIn Jobs', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-10-25', 'Hiring',
    'Onboarded 5 agronomists as domain experts',
    'CropMind fictionally brought on 5 professional agronomists to provide domain expertise for AI model training. [FICTIONAL]',
    'Company Blog', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-11-15', 'Product',
    'CropMind Automation Suite v1.0 released',
    'Following two months of heavy hiring, CropMind fictionally launched its first farm automation product, covering irrigation and fertilizer scheduling. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2025-12-05', 'Funding',
    'Seed round extended — additional $5M raised',
    'CropMind fictionally extended its seed round with $5M from three agricultural-focused angel investors. [FICTIONAL]',
    'Crunchbase', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-01-15', 'Hiring',
    'Data engineering team doubled — 10 new hires',
    'CropMind fictionally doubled its data engineering capacity, suggesting a major data pipeline overhaul ahead of new product features. [FICTIONAL]',
    'LinkedIn Jobs', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-02-28', 'Product',
    'Real-time crop disease scanner launched',
    'After the January hiring surge, CropMind fictionally shipped a computer-vision disease scanner with same-day diagnosis capability. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-03-20', 'Marketing',
    'Published "State of AI in Farming" report',
    'CropMind fictionally published a 40-page industry report to establish thought leadership ahead of a product launch. [FICTIONAL]',
    'PR Newswire', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-04-05', 'Funding',
    'Series A — $20M closed',
    'CropMind fictionally closed a $20M Series A round led by AgriGrowth Ventures, earmarked for product R&D and farmer outreach. [FICTIONAL]',
    'TechCrunch', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-04-18', 'Hiring',
    'Sales and partnerships team hired — 8 roles',
    'Following Series A, CropMind fictionally hired 8 sales and business development professionals. [FICTIONAL]',
    'LinkedIn Jobs', 'Low' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-05-30', 'Product',
    'CropMind Automation Suite v2.0 — robotics integration',
    'CropMind fictionally launched a robotics integration module enabling automated spraying and harvesting commands. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-06-25', 'Partnership',
    'Partnership with TractorLink for equipment telemetry',
    'CropMind fictionally partnered with TractorLink to pull real-time equipment telemetry into its automation platform. [FICTIONAL]',
    'Press Release', 'Medium' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-07-14', 'Hiring',
    'Pre-launch hiring surge — 20 engineering roles',
    'CropMind fictionally posted 20 senior engineering positions, strongly suggesting a major upcoming product release. [FICTIONAL]',
    'LinkedIn Jobs', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-08-22', 'Product',
    'SmallHolder Edition launched — affordable tier for small farms',
    'After the July hiring surge, CropMind fictionally released a simplified, low-cost product tier targeting smallholder farmers in emerging markets. [FICTIONAL]',
    'Company Blog', 'High' ),

  ( 'a1b2c3d4-e5f6-7890-abcd-ef1234567803', '2026-09-05', 'Expansion',
    'Pilot program launched in India — 200 farm partners',
    'CropMind fictionally launched a government-subsidized pilot in India covering 200 smallholder farms. [FICTIONAL]',
    'Business Wire', 'High' );
