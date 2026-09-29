/**
 * services/intelligence/patternDetection.js
 * ─────────────────────────────────────────────────────────────────
 * Detects evidence-based trends, behavioral patterns, and sequences
 * across competitor activity periods.
 *
 * Strict Rules:
 *  - Distinguish OBSERVATION (data facts) vs PATTERN vs INTERPRETATION.
 *  - Never assume causation from correlation/sequence.
 *  - Attach real evidenceEventIds to every pattern.
 *  - Never invent patterns when evidence is weak.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Detects patterns from structured event metrics and timelines.
 *
 * @param {object} params
 * @param {string} params.competitorName
 * @param {object} params.metrics - Output from calculateEventMetrics
 * @param {object} params.windows - Output from resolveTimeWindows
 * @returns {Array<object>} Array of detected trend patterns
 */
export function detectPatterns({ competitorName, metrics, windows }) {
  const { currentEvents, previousEvents, categoryBreakdown, totalCurrent, totalPrevious, totalEventsAllTime } = metrics;
  const patterns = [];

  // 1. INSUFFICIENT DATA CHECK
  if (totalEventsAllTime <= 1 || (totalCurrent <= 1 && totalPrevious === 0)) {
    const singleEvent = currentEvents[0] || previousEvents[0];
    patterns.push({
      id: `pat-${Date.now()}-insufficient`,
      type: "INSUFFICIENT_DATA",
      title: "Insufficient Historical Activity",
      confidence: "insufficient",
      observation: `Only ${totalEventsAllTime} recorded event exists for ${competitorName}.`,
      pattern: "No historical baseline is available to establish recurring activity, velocity, or trends.",
      interpretation: "Additional events over time are required before meaningful patterns can be identified.",
      evidenceEventIds: singleEvent ? [singleEvent.id] : [],
      evidence: singleEvent ? [formatEvidence(singleEvent)] : [],
    });
    return patterns;
  }

  // 2. OVERALL ACTIVITY TREND (INCREASE / DECREASE)
  if (totalPrevious >= 2 && totalCurrent >= 3) {
    if (metrics.totalPercentChange >= 50) {
      const topCurrent = currentEvents.slice(-4);
      patterns.push({
        id: `pat-act-inc-${Date.now()}`,
        type: "ACTIVITY_INCREASE",
        title: "Significant Increase in Overall Activity",
        confidence: totalCurrent >= 6 ? "high" : "medium",
        observation: `Total events increased from ${totalPrevious} in the previous period to ${totalCurrent} in the current period (${metrics.totalPercentChange > 0 ? "+" : ""}${metrics.totalPercentChange}%).`,
        pattern: `${competitorName} demonstrated an accelerated operational tempo across multiple initiatives compared with the preceding comparison period.`,
        interpretation: "The surge in recorded milestones may reflect heightened go-to-market execution, post-funding expansion, or platform scaling.",
        evidenceEventIds: topCurrent.map(e => e.id),
        evidence: topCurrent.map(formatEvidence),
      });
    } else if (metrics.totalPercentChange <= -50) {
      patterns.push({
        id: `pat-act-dec-${Date.now()}`,
        type: "ACTIVITY_DECREASE",
        title: "Noticeable Decline in Public Activity",
        confidence: totalPrevious >= 6 ? "high" : "medium",
        observation: `Total events decreased from ${totalPrevious} in the previous period to ${totalCurrent} in the current period (${metrics.totalPercentChange}%).`,
        pattern: `External milestone velocity slowed noticeably compared with the previous baseline window.`,
        interpretation: "Fewer public announcements may indicate internal consolidation, focus on deep engineering, or quiet execution rather than a loss of capability.",
        evidenceEventIds: currentEvents.map(e => e.id),
        evidence: currentEvents.map(formatEvidence),
      });
    }
  }

  // 3. CATEGORY SURGES & DECLINES
  for (const [catName, cat] of Object.entries(categoryBreakdown)) {
    if (cat.current >= 2 && cat.previous === 0) {
      const catEvents = currentEvents.filter(e => e.category === catName);
      patterns.push({
        id: `pat-cat-surge-${catName.toLowerCase()}-${Date.now()}`,
        type: "CATEGORY_SURGE",
        title: `Surge in ${catName} Initiatives`,
        confidence: cat.current >= 3 ? "high" : "medium",
        observation: `${cat.current} ${catName} events occurred in the current period, compared with 0 in the previous period.`,
        pattern: `${competitorName} newly prioritized or ramped up public ${catName.toLowerCase()} activities where none were recorded in the prior window.`,
        interpretation: `This newly emerged activity cluster may represent an intentional strategic shift toward ${catName.toLowerCase()} investments.`,
        evidenceEventIds: catEvents.map(e => e.id),
        evidence: catEvents.map(formatEvidence),
      });
    } else if (cat.previous >= 2 && cat.current === 0) {
      const prevCatEvents = previousEvents.filter(e => e.category === catName);
      patterns.push({
        id: `pat-cat-dec-${catName.toLowerCase()}-${Date.now()}`,
        type: "CATEGORY_DECLINE",
        title: `Pause in ${catName} Activity`,
        confidence: cat.previous >= 3 ? "high" : "medium",
        observation: `${catName} events dropped from ${cat.previous} in the prior period to 0 in the current period.`,
        pattern: `Previously active ${catName.toLowerCase()} efforts have ceased or transitioned into an unannounced phase.`,
        interpretation: `The organization may have concluded their recent ${catName.toLowerCase()} cycle or redirected resources to other priorities.`,
        evidenceEventIds: prevCatEvents.map(e => e.id),
        evidence: prevCatEvents.map(formatEvidence),
      });
    } else if (cat.current >= 3 && cat.current >= cat.previous * 2) {
      const catEvents = currentEvents.filter(e => e.category === catName);
      patterns.push({
        id: `pat-cat-growth-${catName.toLowerCase()}-${Date.now()}`,
        type: "CATEGORY_SURGE",
        title: `Marked Increase in ${catName} Activity`,
        confidence: cat.current >= 4 ? "high" : "medium",
        observation: `${catName} events rose from ${cat.previous} to ${cat.current} (+${cat.percentChange}%).`,
        pattern: `${catName} represents a growing proportion of ${competitorName}'s outward momentum.`,
        interpretation: `Continued focus in ${catName.toLowerCase()} suggests ongoing product development or market push in this domain.`,
        evidenceEventIds: catEvents.map(e => e.id),
        evidence: catEvents.map(formatEvidence),
      });
    }
  }

  // 4. REPEATED PRICING ACTIVITY
  const pricingEvents = currentEvents.filter(e => e.category === "Pricing");
  if (pricingEvents.length >= 2) {
    patterns.push({
      id: `pat-pricing-repeat-${Date.now()}`,
      type: "REPEATED_ACTIVITY",
      title: "Iterative Pricing Adjustments",
      confidence: pricingEvents.length >= 3 ? "high" : "medium",
      observation: `${competitorName} adjusted pricing or package structures ${pricingEvents.length} times within the current period.`,
      pattern: "Pricing tiers or monetization models were repeatedly revised rather than kept static.",
      interpretation: "Frequent pricing updates often suggest active packaging experimentation, market price discovery, or responses to competitive tiers.",
      evidenceEventIds: pricingEvents.map(e => e.id),
      evidence: pricingEvents.map(formatEvidence),
    });
  }

  // 5. SEQUENTIAL PATTERNS (Chronological order across all available events)
  const allSorted = [...eventsSorted(eventsWithFallback(currentEvents, previousEvents))];
  const sequences = detectSequentialPatterns(allSorted, competitorName);
  patterns.push(...sequences);

  // 6. STRATEGIC SHIFT (Change in top categories)
  const shiftPattern = detectStrategicShift(currentEvents, previousEvents, competitorName);
  if (shiftPattern) patterns.push(shiftPattern);

  // 7. CROSS-CATEGORY PATTERN (e.g. Funding + Expansion, or Product + Partnership)
  const crossPatterns = detectCrossCategoryPatterns(currentEvents, competitorName);
  patterns.push(...crossPatterns);

  // 8. NO SIGNIFICANT CHANGE (Fallback if no distinct shifts were detected)
  if (patterns.length === 0 && totalCurrent >= 2) {
    patterns.push({
      id: `pat-steady-${Date.now()}`,
      type: "NO_SIGNIFICANT_CHANGE",
      title: "Stable Operational Cadence",
      confidence: "medium",
      observation: `${totalCurrent} events were recorded in the current period compared to ${totalPrevious} in the previous period, maintaining consistent categorical distribution.`,
      pattern: "Milestone velocity and focus areas remained within historical variance without abrupt spikes or drop-offs.",
      interpretation: "The competitor appears to be sustaining an established operational baseline without radical pivots in public strategy.",
      evidenceEventIds: currentEvents.slice(0, 3).map(e => e.id),
      evidence: currentEvents.slice(0, 3).map(formatEvidence),
    });
  }

  return patterns;
}

/**
 * Searches timeline for chronological pairings:
 *  - Hiring → Product Launch (within 30-180 days)
 *  - Funding → Expansion (within 30-180 days)
 *  - Partnership → Product Launch
 *  - Pricing Change → Marketing Campaign
 */
function detectSequentialPatterns(events, competitorName) {
  const sequences = [];

  const pairs = [
    {
      first: "Hiring",
      second: "Product",
      name: "Hiring Activity Preceding Product Release",
      desc: (h, p) => `Hiring event "${h.title}" (${h.event_date}) was followed by Product event "${p.title}" (${p.event_date}).`,
      interpretation: "This observed sequence suggests engineering capacity additions may have supported the subsequent product delivery. Note: correlation does not establish direct causation.",
    },
    {
      first: "Funding",
      second: "Expansion",
      name: "Capital Raise Preceding Geographic / Market Expansion",
      desc: (f, e) => `Funding event "${f.title}" (${f.event_date}) was followed by Expansion announcement "${e.title}" (${e.event_date}).`,
      interpretation: "Capital deployment typically precedes geographic rollouts and regional hiring initiatives. Sequence is descriptive rather than strictly causal.",
    },
    {
      first: "Partnership",
      second: "Product",
      name: "Ecosystem Partnership Preceding Product Rollout",
      desc: (pt, pr) => `Partnership announcement "${pt.title}" (${pt.event_date}) preceded Product event "${pr.title}" (${pr.event_date}).`,
      interpretation: "Joint development or distribution agreements often provide technical integrations or channel readiness for downstream product launches.",
    },
    {
      first: "Pricing",
      second: "Marketing",
      name: "Pricing Revisions Accompanied by Marketing Push",
      desc: (pr, m) => `Pricing event "${pr.title}" (${pr.event_date}) was followed by Marketing campaign "${m.title}" (${m.event_date}).`,
      interpretation: "Pricing alterations are frequently reinforced with commercial outreach to drive adoption or soften value-proposition adjustments.",
    },
  ];

  for (const pair of pairs) {
    for (let i = 0; i < events.length; i++) {
      const e1 = events[i];
      if (e1.category !== pair.first) continue;
      const t1 = new Date(e1.event_date).getTime();

      for (let j = i + 1; j < events.length; j++) {
        const e2 = events[j];
        if (e2.category !== pair.second) continue;
        const t2 = new Date(e2.event_date).getTime();
        const diffDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));

        // Plausible sequential window between 7 days and 210 days
        if (diffDays >= 7 && diffDays <= 210) {
          sequences.push({
            id: `pat-seq-${pair.first.toLowerCase()}-${pair.second.toLowerCase()}-${e1.id.slice(0, 4)}-${e2.id.slice(0, 4)}`,
            type: "SEQUENTIAL_PATTERN",
            title: pair.name,
            confidence: "high",
            observation: pair.desc(e1, e2),
            pattern: `A distinct sequence of ${pair.first} preceding ${pair.second} by approximately ${diffDays} days was observed in the timeline.`,
            interpretation: pair.interpretation,
            evidenceEventIds: [e1.id, e2.id],
            evidence: [formatEvidence(e1), formatEvidence(e2)],
          });
          // Match one strong pair per sequence rule to prevent combinatorial explosion
          break;
        }
      }
    }
  }

  return sequences;
}

/**
 * Detects strategic shifts between dominant categories across windows.
 */
function detectStrategicShift(currentEvents, previousEvents, competitorName) {
  if (currentEvents.length < 3 || previousEvents.length < 3) return null;

  const getTopCategory = (events) => {
    const counts = {};
    for (const e of events) counts[e.category] = (counts[e.category] || 0) + 1;
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    return sorted[0] ? { category: sorted[0][0], count: sorted[0][1] } : null;
  };

  const prevTop = getTopCategory(previousEvents);
  const curTop = getTopCategory(currentEvents);

  if (prevTop && curTop && prevTop.category !== curTop.category && curTop.count >= 2) {
    const curTopEvents = currentEvents.filter(e => e.category === curTop.category);
    const prevTopEvents = previousEvents.filter(e => e.category === prevTop.category);

    return {
      id: `pat-shift-${Date.now()}`,
      type: "STRATEGIC_SHIFT",
      title: `Strategic Shift from ${prevTop.category} to ${curTop.category}`,
      confidence: "medium",
      observation: `Primary activity shifted from ${prevTop.category} (${prevTop.count} events in prior period) to ${curTop.category} (${curTop.count} events in current period).`,
      pattern: `The dominant focus of public activity evolved from ${prevTop.category.toLowerCase()} to ${curTop.category.toLowerCase()}.`,
      interpretation: `This rebalancing reflects a strategic transition across phases of business maturity, pivoting from prior foundations to new operational goals.`,
      evidenceEventIds: [...prevTopEvents.slice(0, 2), ...curTopEvents.slice(0, 2)].map(e => e.id),
      evidence: [...prevTopEvents.slice(0, 2), ...curTopEvents.slice(0, 2)].map(formatEvidence),
    };
  }

  return null;
}

/**
 * Detects synchronized cross-category activity (e.g. concurrent Product + Expansion or Funding + Expansion).
 */
function detectCrossCategoryPatterns(currentEvents, competitorName) {
  const patterns = [];
  const categoriesPresent = new Set(currentEvents.map(e => e.category));

  if (categoriesPresent.has("Product") && categoriesPresent.has("Expansion") && currentEvents.length >= 4) {
    const relevant = currentEvents.filter(e => e.category === "Product" || e.category === "Expansion");
    patterns.push({
      id: `pat-cross-prod-exp-${Date.now()}`,
      type: "CROSS_CATEGORY_PATTERN",
      title: "Parallel Product Development and Market Expansion",
      confidence: "medium",
      observation: `${competitorName} simultaneously executed on both Product and Expansion fronts within the current window.`,
      pattern: "Product version releases co-occurred alongside geographic or segment market entries.",
      interpretation: "Simultaneous execution suggests a scalable product core capable of internationalization without stalling core R&D.",
      evidenceEventIds: relevant.map(e => e.id),
      evidence: relevant.map(formatEvidence),
    });
  }

  return patterns;
}

function eventsSorted(events) {
  return [...events].sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
}

function eventsWithFallback(cur, prev) {
  const map = new Map();
  for (const e of [...prev, ...cur]) map.set(e.id, e);
  return Array.from(map.values());
}

function formatEvidence(e) {
  return {
    id: e.id,
    date: e.event_date,
    category: e.category,
    title: e.title,
    importance: e.importance,
    source: e.source_name || e.source || "Supabase",
  };
}
