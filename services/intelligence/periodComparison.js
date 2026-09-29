/**
 * services/intelligence/periodComparison.js
 * ─────────────────────────────────────────────────────────────────
 * Handles date window calculation, event bucketing, and quantitative
 * comparison between current and previous time periods.
 *
 * All numbers are calculated strictly from stored Supabase events.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Resolves window definition into explicit Date ranges for:
 *  - Current Period: [currentStart, currentEnd]
 *  - Previous Period: [prevStart, prevEnd] (equal duration preceding currentStart)
 *
 * Supported windows: '30d', '90d', '6m', '12m', 'custom'
 *
 * @param {string} windowType - '30d' | '90d' | '6m' | '12m' | 'custom'
 * @param {string} [customStart] - YYYY-MM-DD
 * @param {string} [customEnd]   - YYYY-MM-DD
 * @param {Date}   [referenceDate] - Default now (or latest event date)
 */
export function resolveTimeWindows(windowType = "6m", customStart = null, customEnd = null, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  ref.setHours(23, 59, 59, 999);

  let currentEnd = new Date(ref);
  let currentStart = new Date(ref);
  let windowLabel = "Last 6 Months";

  switch (windowType) {
    case "30d":
      currentStart.setDate(currentStart.getDate() - 30);
      windowLabel = "Last 30 Days";
      break;
    case "90d":
      currentStart.setDate(currentStart.getDate() - 90);
      windowLabel = "Last 90 Days";
      break;
    case "12m":
      currentStart.setFullYear(currentStart.getFullYear() - 1);
      windowLabel = "Last 12 Months";
      break;
    case "custom":
      if (customStart && customEnd) {
        currentStart = new Date(customStart);
        currentEnd = new Date(customEnd);
        currentEnd.setHours(23, 59, 59, 999);
        windowLabel = `${formatDate(currentStart)} → ${formatDate(currentEnd)}`;
      } else {
        currentStart.setMonth(currentStart.getMonth() - 6);
        windowLabel = "Last 6 Months";
      }
      break;
    case "6m":
    default:
      currentStart.setMonth(currentStart.getMonth() - 6);
      windowLabel = "Last 6 Months";
      break;
  }

  // Duration in milliseconds
  const durationMs = currentEnd.getTime() - currentStart.getTime();

  // Previous period immediately precedes currentStart by the same duration
  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return {
    windowType,
    windowLabel,
    current: {
      start: currentStart.toISOString().split("T")[0],
      end: currentEnd.toISOString().split("T")[0],
      startDate: currentStart,
      endDate: currentEnd,
      label: `${formatDate(currentStart)} → ${formatDate(currentEnd)}`,
    },
    previous: {
      start: prevStart.toISOString().split("T")[0],
      end: prevEnd.toISOString().split("T")[0],
      startDate: prevStart,
      endDate: prevEnd,
      label: `${formatDate(prevStart)} → ${formatDate(prevEnd)}`,
    },
  };
}

/**
 * Groups and counts events across categories, months, and importance levels.
 *
 * @param {Array} events - All competitor events
 * @param {object} windows - Output of resolveTimeWindows
 */
export function calculateEventMetrics(events = [], windows) {
  const { current, previous } = windows;

  const currentEvents = [];
  const previousEvents = [];
  const olderEvents = [];

  for (const ev of events) {
    if (!ev.event_date) continue;
    const evTime = new Date(ev.event_date).getTime();

    if (evTime >= current.startDate.getTime() && evTime <= current.endDate.getTime()) {
      currentEvents.push(ev);
    } else if (evTime >= previous.startDate.getTime() && evTime <= previous.endDate.getTime()) {
      previousEvents.push(ev);
    } else if (evTime < previous.startDate.getTime()) {
      olderEvents.push(ev);
    }
  }

  // Sort chronological
  currentEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  previousEvents.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

  // Category counts
  const categories = [
    "Product", "Pricing", "Marketing", "Partnership",
    "Hiring", "Funding", "Expansion", "Other"
  ];

  const categoryBreakdown = {};
  for (const cat of categories) {
    const curCount = currentEvents.filter(e => e.category === cat).length;
    const prevCount = previousEvents.filter(e => e.category === cat).length;
    categoryBreakdown[cat] = {
      category: cat,
      current: curCount,
      previous: prevCount,
      change: curCount - prevCount,
      percentChange: prevCount === 0
        ? (curCount > 0 ? 100 : 0)
        : Math.round(((curCount - prevCount) / prevCount) * 100),
    };
  }

  // Monthly breakdown for current period (timeline chart)
  const monthlyCounts = {};
  for (const ev of currentEvents) {
    const ym = ev.event_date.substring(0, 7); // YYYY-MM
    monthlyCounts[ym] = (monthlyCounts[ym] || 0) + 1;
  }

  const monthlyTimeline = Object.entries(monthlyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, count]) => {
      const [y, m] = yearMonth.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const label = `${monthNames[parseInt(m, 10) - 1]} ${y.slice(2)}`;
      return { yearMonth, label, count };
    });

  // Importance breakdown
  const importanceCurrent = {
    High: currentEvents.filter(e => e.importance === "High").length,
    Medium: currentEvents.filter(e => e.importance === "Medium").length,
    Low: currentEvents.filter(e => e.importance === "Low").length,
  };

  const totalCurrent = currentEvents.length;
  const totalPrevious = previousEvents.length;
  const totalChange = totalCurrent - totalPrevious;
  const totalPercentChange = totalPrevious === 0
    ? (totalCurrent > 0 ? 100 : 0)
    : Math.round(((totalCurrent - totalPrevious) / totalPrevious) * 100);

  return {
    totalEventsAllTime: events.length,
    totalCurrent,
    totalPrevious,
    totalChange,
    totalPercentChange,
    categoryBreakdown,
    monthlyTimeline,
    importanceCurrent,
    currentEvents,
    previousEvents,
  };
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
