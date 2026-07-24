import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";
const INTERNAL_VISITOR_KEY = "rowk_internal_visitor";
const OPT_OUT_PARAM = "rk_owner";

let initialized = false;

// Marks this browser as belonging to the site owner/admin, so trackEvent becomes a permanent
// no-op here — set once an admin session is confirmed (see AdminApp.tsx), so testing the public
// site while signed in doesn't skew real visitor data. Never set for regular visitors.
export function markAsInternalVisitor() {
  try {
    localStorage.setItem(INTERNAL_VISITOR_KEY, "1");
  } catch {
    // localStorage may be unavailable (e.g. private browsing) — nothing to do.
  }
}

// Devices that never log into /admin (e.g. checking the live site on a phone) never get the
// flag above set. Visiting the site once with ?rk_owner=1 bookmarked opts that device out too,
// without needing an admin session. Runs once at module load, before the first pageview fires.
(function applyOptOutParam() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get(OPT_OUT_PARAM) !== "1") return;
  markAsInternalVisitor();
  params.delete(OPT_OUT_PARAM);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", url);
})();

function isInternalVisitor() {
  if (window.location.pathname.startsWith("/admin")) return true;
  try {
    return localStorage.getItem(INTERNAL_VISITOR_KEY) === "1";
  } catch {
    return false;
  }
}

function ensureInitialized() {
  if (initialized || !apiKey || isInternalVisitor()) return;
  posthog.init(apiKey, {
    api_host: apiHost,
    person_profiles: "identified_only",
    capture_pageview: true,
    // Nothing is written to the visitor's device (no cookie, no localStorage), so no cookie
    // consent banner is needed — matches Umami's cookieless behavior. Trade-off: each pageload
    // gets a fresh anonymous ID, so repeat-visitor recognition across sessions is lost.
    persistence: "memory",
  });
  initialized = true;
}

export function trackEvent(eventName: string, data?: Record<string, string | number | boolean | null>) {
  ensureInitialized();
  if (!initialized) return;
  posthog.capture(eventName, data ?? undefined);
}
