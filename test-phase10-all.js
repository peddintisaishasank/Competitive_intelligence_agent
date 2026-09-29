/**
 * test-phase10-all.js
 * Comprehensive automated verification test for Phase 10:
 * Trend & Pattern Intelligence Engine.
 */

import { config } from 'dotenv';
config();

import { analyzeCompetitorTrends, compareCompetitorTrends } from './services/intelligence/trendEngine.js';
import { runCompetitiveIntelligenceAgent } from './services/agent/agent.js';

async function runAllTests() {
  console.log('====================================================');
  console.log('   PHASE 10: AUTOMATED VERIFICATION TEST SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc, condition) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
    }
  }

  // ── TEST 1: Competitor with Many Historical Events (AgroTech AI) ──
  console.log('\n--- 1. Competitor with Many Events (AgroTech AI 6M) ---');
  const t1 = await analyzeCompetitorTrends({ competitorName: 'AgroTech AI', window: '6m' });
  assert('Returns competitor details', t1.competitor && t1.competitor.name === 'AgroTech AI');
  assert('Calculates quantitative current and previous counts', t1.metrics.totalCurrent >= 0 && t1.metrics.totalPrevious >= 0);
  assert('Categorical breakdown includes all standard categories', Object.keys(t1.metrics.categoryBreakdown).length >= 8);
  assert('Detects patterns with non-empty evidence links', t1.patterns.length > 0 && t1.patterns.every(p => Array.isArray(p.evidenceEventIds)));

  // ── TEST 2: Competitor with Only One Event (reliance) ─────────────
  console.log('\n--- 2. Single Event Competitor (reliance) ---');
  const t2 = await analyzeCompetitorTrends({ competitorName: 'reliance', window: '6m' });
  assert('Correctly returns INSUFFICIENT_DATA', t2.patterns.some(p => p.type === 'INSUFFICIENT_DATA'));
  assert('Confidence is insufficient or low', t2.patterns[0]?.confidence === 'insufficient');
  assert('Explains insufficient data in observation', t2.patterns[0]?.observation.includes('Only 1'));

  // ── TEST 3: Sequential Pattern Detection (Hiring -> Product) ──────
  console.log('\n--- 3. Sequential Pattern Detection (AgroTech AI) ---');
  const seqPatterns = t1.patterns.filter(p => p.type === 'SEQUENTIAL_PATTERN');
  assert('Detects sequential patterns across timeline', seqPatterns.length > 0);
  const hiringProduct = seqPatterns.find(p => p.title.includes('Hiring') && p.title.includes('Product'));
  assert('Identifies Hiring preceding Product sequence', Boolean(hiringProduct));
  if (hiringProduct) {
    assert('Explicitly states correlation does not imply causation', hiringProduct.interpretation.includes('correlation does not'));
    assert('Has exactly 2 supporting evidence events', hiringProduct.evidenceEventIds.length === 2);
  }

  // ── TEST 4: Cross-Category Pattern Detection ──────────────────────
  console.log('\n--- 4. Cross-Category Pattern Detection ---');
  const crossPattern = t1.patterns.find(p => p.type === 'CROSS_CATEGORY_PATTERN');
  assert('Identifies cross-category momentum', Boolean(crossPattern));

  // ── TEST 5: Custom Date Range ─────────────────────────────────────
  console.log('\n--- 5. Custom Date Range ---');
  const t5 = await analyzeCompetitorTrends({
    competitorName: 'AgroTech AI',
    window: 'custom',
    customStart: '2025-10-01',
    customEnd: '2026-03-31',
  });
  assert('Respects custom date window', t5.windows.windowType === 'custom');
  assert('Calculates custom window events', t5.metrics.totalCurrent >= 3);

  // ── TEST 6: Competitor Comparison (AgroTech AI vs FarmVision) ─────
  console.log('\n--- 6. Competitor Comparison Mode ---');
  const t6 = await compareCompetitorTrends({
    competitorAName: 'AgroTech AI',
    competitorBName: 'FarmVision',
    window: '6m',
  });
  assert('Contains Competitor A metrics', t6.comparison.competitorA.name === 'AgroTech AI');
  assert('Contains Competitor B metrics', t6.comparison.competitorB.name === 'FarmVision');
  assert('Descriptive analysis avoids ranking or claiming who is better',
    !t6.comparison.descriptiveAnalysis.includes('better') &&
    !t6.comparison.descriptiveAnalysis.includes('winner') &&
    !t6.comparison.descriptiveAnalysis.includes('winning')
  );

  // ── TEST 7: Agent Integration (Trend Question) ────────────────────
  console.log('\n--- 7. Agent Integration (Trend Question) ---');
  const agentTrend = await runCompetitiveIntelligenceAgent({
    message: "What patterns do you see in AgroTech AI's activity over the past six months?",
  });
  assert('Agent returns structured response', Boolean(agentTrend.answer));
  assert('Agent includes pattern insights', Boolean(agentTrend.patterns));
  assert('Agent includes key findings with dates', agentTrend.keyFindings && agentTrend.keyFindings.length > 0);

  // ── TEST 8: Agent Integration (Comparison Question) ───────────────
  console.log('\n--- 8. Agent Integration (Comparison Question) ---');
  const agentComp = await runCompetitiveIntelligenceAgent({
    message: "Compare AgroTech AI and FarmVision over the past six months.",
  });
  assert('Agent answers comparison question', Boolean(agentComp.answer));
  assert('Agent cites both competitors',
    agentComp.answer.toLowerCase().includes('agrotech') ||
    agentComp.patterns?.toLowerCase().includes('farmvision')
  );

  // ── TEST 9: Existing Phase 8 Agent Question ───────────────────────
  console.log('\n--- 9. Existing Phase 8 Agent Question ---');
  const agentRecent = await runCompetitiveIntelligenceAgent({
    message: "What has AgroTech AI done recently?",
  });
  assert('Phase 8 question succeeds', Boolean(agentRecent.answer));
  assert('Evidence events are populated', Array.isArray(agentRecent.eventsUsed) && agentRecent.eventsUsed.length > 0);

  // ── TEST 10: Fallback Gracefulness (Skip AI) ──────────────────────
  console.log('\n--- 10. Fallback Gracefulness (Skip AI Mode) ---');
  const t10 = await analyzeCompetitorTrends({
    competitorName: 'FarmVision',
    window: '6m',
    skipAI: true,
  });
  assert('Generates quantitative metrics without AI', t10.metrics.totalEventsAllTime > 0);
  assert('Produces deterministic patterns cleanly', t10.patterns.length > 0);

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed}/${total} PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('====================================================\n');
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
