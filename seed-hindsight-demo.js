/**
 * seed-hindsight-demo.js
 * ─────────────────────────────────────────────────────────────────
 * Phase 7 Demo — Seeds 5 historical events for a fictional competitor
 * ("AgroTech AI") and retains them in Hindsight.
 *
 * Run: node seed-hindsight-demo.js
 *
 * Prerequisites:
 *  - .env must have HINDSIGHT_API_KEY and SUPABASE_SERVICE_ROLE_KEY
 *  - Supabase must have the Phase 7 migration applied
 *    (supabase/phase7_hindsight_migration.sql)
 *
 * This script demonstrates:
 *   Events → Hindsight RETAIN → Long-term Memory → Hindsight RECALL
 * ─────────────────────────────────────────────────────────────────
 */

import { config as dotenv }          from "dotenv";
import { createClient }              from "@supabase/supabase-js";
import {
  ensureMemoryBank,
  retainCompetitorEvent,
  recallCompetitorMemory,
} from "./services/hindsight.js";

dotenv();

const COMPETITOR_NAME = "AgroTech AI";

// Demo events — 5 historical events spanning April–August 2026
const DEMO_EVENTS = [
  {
    event_date:  "2026-04-15",
    category:    "Product",
    title:       "Launched AI Crop Monitoring Platform",
    description: "AgroTech AI launched an AI-powered crop monitoring platform that uses satellite imagery and sensor data to detect disease, optimize irrigation, and predict yield in real time.",
    source_name: "AgroTech AI Press Release",
    importance:  "High",
  },
  {
    event_date:  "2026-05-22",
    category:    "Product",
    title:       "Released GPT-powered Soil Analysis AI Feature",
    description: "AgroTech AI integrated a GPT-based natural language interface into their platform, allowing farmers to ask soil health questions in plain English and receive actionable recommendations.",
    source_name: "TechCrunch",
    importance:  "High",
  },
  {
    event_date:  "2026-06-10",
    category:    "Partnership",
    title:       "Formed Strategic Partnership with John Deere",
    description: "AgroTech AI announced a co-development partnership with John Deere to integrate their AI monitoring platform directly into John Deere's connected equipment ecosystem.",
    source_name: "AgriNews",
    importance:  "High",
  },
  {
    event_date:  "2026-07-03",
    category:    "Hiring",
    title:       "Posted 18 Senior ML Engineering Roles",
    description: "AgroTech AI posted 18 senior machine learning engineering positions focused on computer vision and geospatial AI, signaling a major platform expansion.",
    source_name: "LinkedIn Jobs",
    importance:  "Medium",
  },
  {
    event_date:  "2026-08-19",
    category:    "Pricing",
    title:       "Reduced Enterprise Tier by 25%",
    description: "AgroTech AI cut their Enterprise pricing tier by 25%, likely in response to competitive pressure from FarmVision and SmartHarvest entering the market.",
    source_name: "Pricing Page Monitor",
    importance:  "High",
  },
];

async function main() {
  console.log("🌱  Phase 7 Demo: Seeding AgroTech AI events into Hindsight\n");

  // 1. Ensure memory bank exists
  console.log("1️⃣  Ensuring Hindsight memory bank exists…");
  const bankResult = await ensureMemoryBank();
  if (!bankResult.ok) {
    console.error("❌ Failed to create/verify memory bank:", bankResult.error);
    process.exit(1);
  }

  // 2. Insert demo competitor in Supabase (if not already present)
  console.log("\n2️⃣  Creating demo competitor in Supabase…");
  const sbUrl = process.env.SUPABASE_URL || "https://jrtraipuqwvnyolzipas.supabase.co";
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydHJhaXB1cXd2bnlvbHppcGFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MDI1NzgsImV4cCI6MjEwNjE3ODU3OH0.TzA7TmiB_1lKhz3XoHnJT6IG-vPZu4qUW2cyvHQ5KFg";
  const sb = createClient(
    sbUrl,
    sbKey,
    { auth: { persistSession: false } }
  );

  let competitorId;
  const { data: existing } = await sb
    .from("competitors")
    .select("id")
    .eq("name", COMPETITOR_NAME)
    .single();

  if (existing) {
    competitorId = existing.id;
    console.log(`   ↪ Competitor already exists: ${COMPETITOR_NAME} (${competitorId})`);
  } else {
    const { data: created, error } = await sb
      .from("competitors")
      .insert([{
        name:        COMPETITOR_NAME,
        website:     "https://agrotech.ai",
        industry:    "AgriTech / AI",
        description: "AI-powered precision agriculture platform for crop monitoring and yield optimization.",
      }])
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to create competitor:", error.message);
      process.exit(1);
    }
    competitorId = created.id;
    console.log(`   ✅ Created competitor: ${COMPETITOR_NAME} (${competitorId})`);
  }

  // 3. Insert events + retain each in Hindsight
  console.log(`\n3️⃣  Inserting ${DEMO_EVENTS.length} events and retaining in Hindsight…\n`);

  for (const evData of DEMO_EVENTS) {
    process.stdout.write(`   → "${evData.title}" (${evData.event_date})… `);

    // Insert into Supabase
    const { data: event, error: insertErr } = await sb
      .from("competitor_events")
      .insert([{ ...evData, competitor_id: competitorId }])
      .select()
      .single();

    if (insertErr) {
      console.log(`❌ DB insert failed: ${insertErr.message}`);
      continue;
    }

    // Retain in Hindsight
    const retainResult = await retainCompetitorEvent(event, COMPETITOR_NAME);
    if (retainResult.ok) {
      console.log(`✅ Retained`);
    } else {
      console.log(`⚠️  DB saved, Hindsight failed: ${retainResult.error}`);
    }

    // Small delay
    await new Promise(r => setTimeout(r, 500));
  }

  // 4. Test Recall
  console.log("\n4️⃣  Testing Hindsight RECALL…\n");

  const testQueries = [
    "What has AgroTech AI been doing over the past several months?",
    "What product launches has AgroTech AI had?",
    "What pricing changes did AgroTech AI make?",
    "What partnerships has AgroTech AI announced?",
    "What did AgroTech AI do between April 2026 and September 2026?",
  ];

  for (const query of testQueries) {
    console.log(`\n   🔍 Query: "${query}"`);
    const result = await recallCompetitorMemory(query);
    if (!result.ok) {
      console.log(`   ❌ Recall failed: ${result.error}`);
    } else if (result.results.length === 0) {
      console.log(`   💭 No memories found`);
    } else {
      console.log(`   ✅ ${result.results.length} memories retrieved:`);
      result.results.slice(0, 2).forEach((m, i) => {
        const preview = m.text.substring(0, 120);
        console.log(`      ${i+1}. ${preview}…`);
      });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log("\n\n✨  Phase 7 Demo complete!");
  console.log("   Events → Hindsight RETAIN → Long-term Memory → Hindsight RECALL\n");
}

main().catch(err => {
  console.error("💥 Unexpected error:", err.message);
  process.exit(1);
});
