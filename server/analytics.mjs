// Pulls real usage data from PostHog's HogQL Query API for the admin Analytics page.
// Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID to be set; returns null otherwise
// so the caller can fall back to placeholder data (see AnalyticsSummary in src/AdminApp.tsx).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session IDs from the pre-2026-07-17 Umami→PostHog import that hit localhost/127.0.0.1 (dev
// testing), not the live site. The import stamped every event with the importer's own $ip and
// re-derived GeoIP from it, wiping out each visitor's real IP/location — so unlike live traffic,
// this historical batch can only be split into real-vs-dev by distinct_id (which the import
// preserved as the original Umami session_id), not by IP. See data/umami-dev-sessions.json.
let umamiDevSessionIds = [];
try {
  umamiDevSessionIds = JSON.parse(await fs.readFile(path.resolve(__dirname, "../data/umami-dev-sessions.json"), "utf8"));
} catch {
  umamiDevSessionIds = [];
}

// Per-session country/city for the same pre-2026-07-17 import, sourced from the original Umami
// export rather than PostHog's $geoip_* properties — those are all derived from the single
// fabricated $ip above (see internalTrafficExclusionClause), so every imported event resolves to
// the importer's own city. Real visitors were geo-diverse; Umami captured that correctly before
// the migration, PostHog just never got it. Only covers real (non-dev) sessions.
let umamiSessionGeo = [];
try {
  umamiSessionGeo = JSON.parse(await fs.readFile(path.resolve(__dirname, "../data/umami-session-geo.json"), "utf8"));
} catch {
  umamiSessionGeo = [];
}
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

// Every distinct_id that came from the historical import (real or dev) — used to exempt those
// rows from IP matching below, since they all share one fabricated $ip regardless of who the
// real visitor was (see umamiSessionGeo above). IP exclusion is only meaningful for live traffic.
const umamiImportedSessionIds = [...umamiDevSessionIds, ...umamiSessionGeo.map((session) => session.sessionId)];

const ZERO_RESULT_LIMIT = 5;
const TOP_STYLISTS_LIMIT = 5;
const ALL_TIME_MAX_DAYS = 1095; // cap "All time" at 3 years so the chart never grows unbounded
const RECENT_ACTIVITY_LIMIT = 50;

export const RANGE_PRESETS = {
  "24h": { days: 1, granularity: "hour", buckets: 24 },
  "7d": { days: 7, granularity: "day", buckets: 7 },
  "30d": { days: 30, granularity: "day", buckets: 30 },
  "90d": { days: 90, granularity: "day", buckets: 90 },
};

const FILTER_EVENT_GROUPS = [
  { event: "service_filter_selected", group: "Services", selectedProp: "selected", labelProp: "selection" },
  { event: "location_filter_selected", group: "Locations", selectedProp: "selected", labelProp: "selection" },
  { event: "price_filter_selected", group: "Price", selectedProp: "selected", labelProp: "selection" },
  { event: "braiding_preference_selected", group: "Preferences", selectedProp: "selected", labelProp: "selection" },
  { event: "hijabi_toggle_changed", group: "Preferences", selectedProp: "enabled", fixedLabel: "Hijabi friendly" },
  { event: "verified_reviews_toggle_changed", group: "Preferences", selectedProp: "enabled", fixedLabel: "All reviews" },
  { event: "google_reviews_only_toggle_changed", group: "Preferences", selectedProp: "enabled", fixedLabel: "Google" },
  { event: "booking_sites_only_toggle_changed", group: "Preferences", selectedProp: "enabled", fixedLabel: "Booking sites" },
];

const FILTER_GROUP_ORDER = ["Services", "Locations", "Price", "Preferences"];

function isConfigured() {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

function parseInternalIps() {
  return (process.env.POSTHOG_INTERNAL_IPS || "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

// Excludes traffic from the site owner's own IP(s) (live testing) and known dev-session
// distinct_ids (the imported Umami history, see above) so neither skews visitor numbers. IPs
// are set via POSTHOG_INTERNAL_IPS (comma-separated) — this only affects the raw HogQL queries
// below, not PostHog's own UI (its "Filter out internal and test users" project setting is a
// separate, insight-level filter that doesn't apply to queries run via the API).
// Note: rows where $ip is null are always kept — if PostHog isn't capturing IPs (GeoIP/IP
// capture disabled in project settings), the IP half of this exclusion silently becomes a no-op.
//
// IP matching is skipped entirely for imported rows (distinct_id in umamiImportedSessionIds):
// the whole historical batch shares one fabricated $ip, so applying an IP list to it would catch
// real backfilled visitors along with dev ones. Those rows rely solely on the dev-session check
// below instead; IP matching only ever applies to genuinely live traffic.
function internalTrafficExclusionClause() {
  const clauses = [];

  const ips = parseInternalIps();
  if (ips.length) {
    const list = ips.map((ip) => `'${ip}'`).join(", ");
    const importedList = umamiImportedSessionIds.map((id) => `'${id}'`).join(", ");
    const importedExemption = importedList ? `distinct_id IN (${importedList}) OR ` : "";
    clauses.push(`(${importedExemption}properties.$ip IS NULL OR properties.$ip NOT IN (${list}))`);
  }

  if (umamiDevSessionIds.length) {
    const list = umamiDevSessionIds.map((id) => `'${id}'`).join(", ");
    clauses.push(`distinct_id NOT IN (${list})`);
  }

  if (!clauses.length) return "";
  return ` AND ${clauses.join(" AND ")}`;
}

async function resolveRange(range) {
  if (range === "all") {
    const rows = await runHogQLQuery(`SELECT min(timestamp) AS first_seen FROM events`);
    const firstSeen = rows[0]?.[0] ? new Date(rows[0][0]) : null;
    const daysSinceFirstSeen = firstSeen ? Math.ceil((Date.now() - firstSeen.getTime()) / 86400000) + 1 : 365;
    const days = Math.min(Math.max(daysSinceFirstSeen, 1), ALL_TIME_MAX_DAYS);
    return { days, granularity: "day", buckets: days };
  }
  return RANGE_PRESETS[range] ?? RANGE_PRESETS["7d"];
}

async function runHogQLQuery(query) {
  const apiHost = process.env.POSTHOG_API_HOST || "https://us.posthog.com";
  const projectId = process.env.POSTHOG_PROJECT_ID;
  // "blocking" forces PostHog to finish the calculation before responding — without it,
  // a cold cache can return an empty/stale result while the real one computes in the background.
  const response = await fetch(`${apiHost}/api/projects/${projectId}/query/?refresh=blocking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`PostHog query failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  return payload.results ?? [];
}

function isTruthy(value) {
  return value === true || value === 1 || value === "true" || value === "1";
}

async function fetchVisitorsSeries(preset) {
  const internalTrafficExclusion = internalTrafficExclusionClause();
  if (preset.granularity === "hour") {
    const rows = await runHogQLQuery(`
      SELECT toStartOfHour(timestamp) AS bucket, count(DISTINCT person_id) AS visitors
      FROM events
      WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusion}
      GROUP BY bucket
      ORDER BY bucket
    `);
    const byBucket = new Map(rows.map(([bucket, visitors]) => [String(bucket).slice(0, 13), Number(visitors)]));

    const series = [];
    for (let i = preset.buckets - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setUTCMinutes(0, 0, 0);
      date.setUTCHours(date.getUTCHours() - i);
      const key = date.toISOString().slice(0, 13);
      series.push({ date: `${key}:00:00.000Z`, count: byBucket.get(key) ?? 0 });
    }
    return series;
  }

  const rows = await runHogQLQuery(`
    SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusion}
    GROUP BY day
    ORDER BY day
  `);
  const byDay = new Map(rows.map(([day, visitors]) => [String(day).slice(0, 10), Number(visitors)]));

  const series = [];
  for (let i = preset.buckets - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    series.push({ date: key, count: byDay.get(key) ?? 0 });
  }
  return series;
}

async function fetchClickCounts(preset) {
  const rows = await runHogQLQuery(`
    SELECT
      countIf(event = 'book_click') AS booking_clicks,
      countIf(event = 'instagram_click') AS instagram_clicks,
      countIf(event = 'verified_reviews_click') AS reviews_clicks
    FROM events
    WHERE event IN ('book_click', 'instagram_click', 'verified_reviews_click') AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
  `);
  const [bookingClicks, instagramClicks, reviewsClicks] = rows[0] ?? [0, 0, 0];
  return { bookingClicks: Number(bookingClicks) || 0, instagramClicks: Number(instagramClicks) || 0, reviewsClicks: Number(reviewsClicks) || 0 };
}

async function fetchFilterUsage(preset) {
  const rows = await runHogQLQuery(`
    SELECT
      event,
      properties.selection AS selection,
      properties.selected AS selected,
      properties.enabled AS enabled,
      count() AS n
    FROM events
    WHERE event IN (${FILTER_EVENT_GROUPS.map((entry) => `'${entry.event}'`).join(", ")})
      AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
    GROUP BY event, selection, selected, enabled
  `);

  const groups = new Map(FILTER_GROUP_ORDER.map((label) => [label, new Map()]));

  for (const [event, selection, selected, enabled, count] of rows) {
    const config = FILTER_EVENT_GROUPS.find((entry) => entry.event === event);
    if (!config) continue;
    const flag = config.selectedProp === "enabled" ? enabled : selected;
    if (!isTruthy(flag)) continue;
    const label = config.fixedLabel ?? selection;
    if (!label) continue;
    const rowsForGroup = groups.get(config.group);
    rowsForGroup.set(label, (rowsForGroup.get(label) ?? 0) + Number(count));
  }

  return FILTER_GROUP_ORDER.map((label) => ({
    label,
    rows: [...groups.get(label).entries()]
      .map(([rowLabel, count]) => ({ label: rowLabel, count }))
      .sort((a, b) => b.count - a.count),
  })).filter((group) => group.rows.length > 0);
}

async function fetchZeroResultSearches(preset) {
  const rows = await runHogQLQuery(`
    SELECT
      properties.services AS services,
      properties.location AS location,
      properties.hijabi_friendly AS hijabi_friendly,
      properties.no_gel AS no_gel,
      properties.wheelchair_accessible AS wheelchair_accessible,
      count() AS n,
      max(timestamp) AS last_seen
    FROM events
    WHERE event = 'search_zero_results' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
    GROUP BY services, location, hijabi_friendly, no_gel, wheelchair_accessible
    ORDER BY n DESC
    LIMIT ${ZERO_RESULT_LIMIT}
  `);

  return rows.map(([services, location, hijabiFriendly, noGel, wheelchairAccessible, count, lastSeen]) => {
    const filters = [];
    if (services && services !== "none") filters.push(...String(services).split(", "));
    if (location && location !== "all") filters.push(...String(location).split(", "));
    if (isTruthy(hijabiFriendly)) filters.push("Hijabi friendly");
    if (isTruthy(noGel)) filters.push("Can braid without gel");
    if (isTruthy(wheelchairAccessible)) filters.push("Wheelchair accessible");
    return {
      filters,
      count: Number(count),
      lastSeenAt: String(lastSeen).slice(0, 10),
    };
  });
}

async function fetchTopStylists(preset) {
  // Ranked by booking/Instagram clicks, not stylist_viewed impressions — a card scrolling into
  // view is position-biased (see App.tsx's IntersectionObserver), a click requires real interest.
  const rows = await runHogQLQuery(`
    SELECT properties.salon AS salon, any(properties.location) AS location, count() AS clicks
    FROM events
    WHERE event IN ('book_click', 'instagram_click') AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
    GROUP BY salon
    ORDER BY clicks DESC
    LIMIT ${TOP_STYLISTS_LIMIT}
  `);

  return rows
    .filter(([salon]) => Boolean(salon))
    .map(([salon, location, clicks]) => ({
      name: String(salon),
      areaLabel: location ? String(location) : "",
      clicks: Number(clicks),
    }));
}

async function fetchReviewsClicksByPlatform(preset) {
  const rows = await runHogQLQuery(`
    SELECT properties.platform AS platform, count() AS clicks
    FROM events
    WHERE event = 'verified_reviews_click' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
    GROUP BY platform
    ORDER BY clicks DESC
  `);

  return rows
    .filter(([platform]) => Boolean(platform))
    .map(([platform, clicks]) => ({ platform: String(platform), clicks: Number(clicks) }));
}

async function fetchDeviceBreakdown(preset) {
  // $device_type is auto-captured by posthog-js on every event (Desktop/Mobile/Tablet),
  // no extra client-side tracking needed — same distinct-visitor methodology as fetchVisitorsSeries.
  const rows = await runHogQLQuery(`
    SELECT properties.$device_type AS device_type, count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}
    GROUP BY device_type
    ORDER BY visitors DESC
  `);

  return rows
    .filter(([deviceType]) => Boolean(deviceType))
    .map(([deviceType, visitors]) => ({ deviceType: String(deviceType), visitors: Number(visitors) }));
}

function countryName(code) {
  if (!code) return null;
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

// Merges live PostHog geo (accurate, from real per-visitor $ip) with the CSV-sourced historical
// geo (see umamiSessionGeo above) into one set of country/city breakdowns. The two sources never
// overlap: imported sessions are excluded from the live query by distinct_id so their corrupted
// $geoip_* properties can't leak in, and only get counted via the CSV mapping instead.
async function fetchLocationBreakdown(preset) {
  const cutoff = Date.now() - preset.days * 86400000;
  const countryCounts = new Map();
  const cityCounts = new Map();

  for (const session of umamiSessionGeo) {
    if (new Date(`${session.createdAt.replace(" ", "T")}Z`).getTime() < cutoff) continue;
    if (session.countryCode) countryCounts.set(session.countryCode, (countryCounts.get(session.countryCode) ?? 0) + 1);
    if (session.city) cityCounts.set(session.city, (cityCounts.get(session.city) ?? 0) + 1);
  }

  const mappedSessionIds = umamiSessionGeo.map((session) => `'${session.sessionId}'`).join(", ");
  const excludeMapped = mappedSessionIds ? ` AND distinct_id NOT IN (${mappedSessionIds})` : "";

  const rows = await runHogQLQuery(`
    SELECT properties.$geoip_country_code AS country_code, properties.$geoip_city_name AS city, count(DISTINCT person_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL ${preset.days} DAY${internalTrafficExclusionClause()}${excludeMapped}
    GROUP BY country_code, city
  `);

  for (const [countryCode, city, visitors] of rows) {
    const n = Number(visitors) || 0;
    if (countryCode) countryCounts.set(countryCode, (countryCounts.get(countryCode) ?? 0) + n);
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + n);
  }

  const toSortedList = (counts) =>
    [...counts.entries()]
      .map(([key, visitors]) => [key, visitors])
      .sort((a, b) => b[1] - a[1]);

  return {
    countryBreakdown: toSortedList(countryCounts)
      .slice(0, 10)
      .map(([code, visitors]) => ({ country: countryName(code) ?? code, visitors })),
    cityBreakdown: toSortedList(cityCounts)
      .slice(0, 10)
      .map(([city, visitors]) => ({ city, visitors })),
  };
}

async function fetchAllTimeStats() {
  const internalTrafficExclusion = internalTrafficExclusionClause();
  const [visitorRows, clickRows] = await Promise.all([
    // uniq() (HyperLogLog-based approximate distinct count) instead of the
    // exact count(DISTINCT ...) — the exact form was scanning the entire
    // unbounded events table and regularly hitting PostHog's max execution
    // time as the table grew.
    runHogQLQuery(`SELECT uniq(person_id) AS visitors FROM events WHERE event = '$pageview'${internalTrafficExclusion}`),
    runHogQLQuery(`
      SELECT countIf(event = 'book_click') AS booking_clicks, countIf(event = 'instagram_click') AS instagram_clicks
      FROM events
      WHERE 1=1${internalTrafficExclusion}
    `),
  ]);
  const [visitors] = visitorRows[0] ?? [0];
  const [bookingClicks, instagramClicks] = clickRows[0] ?? [0, 0];
  return {
    visitors: Number(visitors) || 0,
    bookingClicks: Number(bookingClicks) || 0,
    instagramClicks: Number(instagramClicks) || 0,
  };
}

// Raw recent events, most-recent first — deliberately unfiltered by POSTHOG_INTERNAL_IPS (unlike
// every query above) so the admin can see their own visits land and check the isInternal flag
// against them, instead of the exclusion silently hiding the thing they're trying to verify.
export async function fetchRecentActivity(limit = RECENT_ACTIVITY_LIMIT) {
  if (!isConfigured()) return null;

  try {
    const internalIps = parseInternalIps();
    const rows = await runHogQLQuery(`
      SELECT timestamp, event, properties.$current_url AS url, properties.$device_type AS device_type, properties.$ip AS ip
      FROM events
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);

    return rows.map(([timestamp, event, url, deviceType, ip]) => ({
      timestamp: String(timestamp),
      event: String(event),
      url: url ? String(url) : null,
      deviceType: deviceType ? String(deviceType) : null,
      ip: ip ? String(ip) : null,
      isInternal: Boolean(ip && internalIps.includes(String(ip))),
    }));
  } catch (error) {
    console.error("PostHog recent activity fetch failed", error);
    return null;
  }
}

// The dashboard endpoint calls this on every admin page load — even with
// uniq() instead of an exact count, a live PostHog query is still slow
// enough (and occasionally times out) that it shouldn't block every load.
// Cache the last successful result for a few minutes, and on failure fall
// back to that stale-but-known-good value instead of surfacing an error.
const ALL_TIME_CACHE_TTL_MS = 5 * 60 * 1000;
let allTimeCache = { value: null, fetchedAt: 0 };

export async function fetchAllTimeSummary() {
  if (!isConfigured()) return null;

  if (Date.now() - allTimeCache.fetchedAt < ALL_TIME_CACHE_TTL_MS) {
    return allTimeCache.value;
  }

  try {
    const value = await fetchAllTimeStats();
    allTimeCache = { value, fetchedAt: Date.now() };
    return value;
  } catch (error) {
    console.error("PostHog all-time analytics fetch failed", error);
    return allTimeCache.value;
  }
}

export async function fetchAnalyticsSummary(range = "7d") {
  if (!isConfigured()) return null;

  try {
    const preset = await resolveRange(range);
    const [visitorsByDay, clicks, filterUsage, zeroResultSearches, topStylists, reviewsClicksByPlatform, deviceBreakdown, locationBreakdown] =
      await Promise.all([
        fetchVisitorsSeries(preset),
        fetchClickCounts(preset),
        fetchFilterUsage(preset),
        fetchZeroResultSearches(preset),
        fetchTopStylists(preset),
        fetchReviewsClicksByPlatform(preset),
        fetchDeviceBreakdown(preset),
        fetchLocationBreakdown(preset),
      ]);

    return {
      granularity: preset.granularity,
      visitorsByDay,
      bookingClicks: clicks.bookingClicks,
      instagramClicks: clicks.instagramClicks,
      reviewsClicks: clicks.reviewsClicks,
      reviewsClicksByPlatform,
      filterUsage,
      zeroResultSearches,
      topStylists,
      deviceBreakdown,
      countryBreakdown: locationBreakdown.countryBreakdown,
      cityBreakdown: locationBreakdown.cityBreakdown,
    };
  } catch (error) {
    console.error("PostHog analytics fetch failed", error);
    return null;
  }
}
