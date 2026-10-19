import type { SiteAnalytics } from "./site-analytics";
import type { ProductAnalytics } from "./product-analytics";

// Versioned, self-contained aggregate report. The default API contract stays unchanged.
export function analyticsExport(official: SiteAnalytics, product: ProductAnalytics, now: Date) {
  return {
    schema: "puzzoria.analytics",
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    timezone: "UTC",
    period: { from: official.from, to: official.to, currentDayIsPartial: true },
    filters: { days: official.filters.days, game: official.filters.game ?? null,
      puzzleLocale: official.filters.locale ?? null, interfaceLocale: official.filters.interfaceLocale ?? null,
      mode: official.filters.mode ?? null },
    definitions: {
      null: "Unknown, not applicable or no denominator; never interpret as zero.",
      identity: "A registered account or guest device, never a unique human. Cookie removal or multiple guest devices can create extra identities. Counts are not additive between days or games.",
      official: "Server-verified game records. Starts are actual starts, not reservations. Official totals group starts in the selected period with finishes observed by generatedAt; product.games groups verified finishes completed in that period. Those cohorts can differ.",
      visits: "Optional first-party measurement after consent, respecting DNT/GPC. Visitors, acquisition, navigation and active time describe only this measured fraction of traffic.",
      activeTime: "Estimated foreground interaction time in seconds, not official elapsed duration. Abrupt closure or collection failures can lose events. Active-time samples are measured sessions.",
      units: "Durations and active time: seconds. failedLatencyMedian: milliseconds. Percentages: 0–100. Dates: UTC.",
      retention: "Exact UTC return at D+1/D+7/D+30 after first observed activity in the selected scope, requiring a server start or verified finish. Only fully elapsed return days are in the mature denominator. A visit alone is not a playing return.",
      frequency: "DAU/WAU/MAU use their own rolling 1/7/30 UTC-day windows ending on the current partial UTC day, independently of the report's 7/30/90-day period.",
      acquisition: "Session source or first source observed in retained measured history, not guaranteed original acquisition. No full referrer URLs.",
      funnel: "Distinct session counts for each stage; not proof of a sequential conversion path. Navigation transitions are not necessarily played games.",
      distribution: { metric: "Measured sessions by estimated active seconds", buckets: ["<60", "60–<300", "300–<900", ">=900"] },
      filters: "Interface locale filters optional measurement only. Puzzle locale filters official records and game-duration cohorts. Quality counters are global to the selected period.",
      exclusions: "Administrator accounts, imported official results and local finish previews are excluded; recognised bots are excluded from optional collection.",
      ads: "No advertising integration is active. Revenue and rewards remain unknown until an authorised provider confirms them.",
    },
    report: { official, product },
  };
}
