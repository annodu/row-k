import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const apiHost = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

let initialized = false;

function ensureInitialized() {
  if (initialized || !apiKey) return;
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
