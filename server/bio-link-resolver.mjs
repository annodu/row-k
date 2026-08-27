// Resolves the link a stylist puts in their Instagram bio into something
// usable: a real booking/website URL. Link-in-bio aggregators (Linktree,
// Beacons, etc.) never become the bookingUrl themselves — this follows them
// one level deep to find the real link inside, same rule the admin health
// check already applies when *rejecting* those hosts (see isSocialOnlyUrl in
// admin-stylists.mjs), just completing the other half of it.

const AGGREGATOR_HOSTS = [
  "linktr.ee",
  "linktree.com",
  "beacons.ai",
  "bio.site",
  "campsite.bio",
  "solo.to",
  "lnk.bio",
  "koji.to",
  "milkshake.app",
  "carrd.co",
  "linkin.bio",
  "linkr.bio",
  "tap.bio",
];

const SOCIAL_HOSTS = [
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
  "m.me",
  "twitter.com",
  "x.com",
  "youtube.com",
  "youtu.be",
  "wa.me",
  "whatsapp.com",
  "snapchat.com",
  "threads.net",
  "pinterest.com",
];

// Generic URL shorteners are opaque — the visible URL says nothing about the
// destination (seen live: a bit.ly bio link that actually pointed to a wa.me
// WhatsApp chat, which would have been wrongly kept as a "website" without
// this). Follow the redirect first, then classify whatever it lands on.
const SHORTENER_HOSTS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "rebrand.ly",
  "cutt.ly",
  "is.gd",
  "buff.ly",
  "ow.ly",
  "lnkd.in",
  "shorturl.at",
];

// Link types that are never a business website or booking link even though
// they're neither social nor a link-in-bio aggregator — seen live: a bio
// link that resolved to a GoFundMe page, which would have been wrongly kept
// as a "website".
const NON_BUSINESS_HOSTS = [
  "gofundme.com",
  "gofund.me",
  "justgiving.com",
  "paypal.me",
  "paypal.com",
  "venmo.com",
  "cash.app",
  "amazon.co.uk",
  "amazon.com",
  "spotify.com",
  "open.spotify.com",
  "apple.co",
  "music.apple.com",
];

const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function hostOf(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host, list) {
  return Boolean(host) && list.some((needle) => host === needle || host.endsWith(`.${needle}`));
}

function isAggregatorHost(host) {
  return hostMatches(host, AGGREGATOR_HOSTS);
}

function isSocialHost(host) {
  return hostMatches(host, SOCIAL_HOSTS);
}

function isShortenerHost(host) {
  return hostMatches(host, SHORTENER_HOSTS);
}

function isNonBusinessHost(host) {
  return hostMatches(host, NON_BUSINESS_HOSTS);
}

// HEAD is cheap and most shorteners support it; some don't (405/blocked), so
// fall back to a GET and just take where it landed.
async function resolveRedirectTarget(url, { timeoutMs = 6000 } = {}) {
  for (const method of ["HEAD", "GET"]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": BROWSER_USER_AGENT },
      });
      if (response.url && response.url !== url) {
        return response.url;
      }
      if (response.ok) {
        return response.url || url;
      }
    } catch {
      // try the next method
    } finally {
      clearTimeout(timeout);
    }
  }
  return "";
}

async function fetchPageHtml(url, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function extractLinksFromHtml(html = "") {
  const links = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html))) {
    if (/^https?:\/\//i.test(match[1])) {
      links.push(match[1]);
    }
  }
  return [...new Set(links)];
}

function classifyBookingPlatform(url, bookingPlatformMatchers = []) {
  const lower = url.toLowerCase();
  return bookingPlatformMatchers.find(([needle]) => lower.includes(needle))?.[1] || "";
}

// Given one candidate link from an Instagram bio, work out whether it's
// already a real booking/website link, or a link-in-bio page / shortener
// that needs to be opened to find the real one. Returns a chain of readable
// steps so the admin can see exactly how the link was resolved (or why it
// wasn't) — `depth` guards against a shortener chaining into another
// shortener indefinitely.
export async function resolveBioLink(candidateUrl, { bookingPlatformMatchers = [], chain = [], depth = 0 } = {}) {
  const empty = { bookingUrl: "", websiteUrl: "", bookingPlatform: "", chain, resolved: false };

  if (!candidateUrl || depth > 3) {
    return empty;
  }

  const host = hostOf(candidateUrl);
  if (!host) {
    return empty;
  }

  if (isSocialHost(host)) {
    chain.push({ url: candidateUrl, note: "Bio link points to a social profile, not a booking link — skipped" });
    return { ...empty, chain };
  }

  if (isNonBusinessHost(host)) {
    chain.push({ url: candidateUrl, note: "Bio link points to a non-business page (donations/payments/streaming), not a booking link — skipped" });
    return { ...empty, chain };
  }

  if (isShortenerHost(host)) {
    chain.push({ url: candidateUrl, note: "Bio link is a URL shortener — following it to see the real destination" });
    const target = await resolveRedirectTarget(candidateUrl);
    if (!target || hostOf(target) === host) {
      chain.push({ url: "", note: "Could not resolve the shortened link" });
      return { ...empty, chain };
    }
    return resolveBioLink(target, { bookingPlatformMatchers, chain, depth: depth + 1 });
  }

  if (!isAggregatorHost(host)) {
    const platform = classifyBookingPlatform(candidateUrl, bookingPlatformMatchers);
    chain.push({ url: candidateUrl, note: platform ? `Bio link recognized as ${platform}` : "Bio link used as website" });
    return platform
      ? { bookingUrl: candidateUrl, websiteUrl: "", bookingPlatform: platform, chain, resolved: true }
      : { bookingUrl: "", websiteUrl: candidateUrl, bookingPlatform: "", chain, resolved: true };
  }

  chain.push({ url: candidateUrl, note: "Bio link is a link-in-bio page — opening it to find the real link" });
  const html = await fetchPageHtml(candidateUrl);
  if (!html) {
    chain.push({ url: "", note: "Could not load the link-in-bio page" });
    return { ...empty, chain };
  }

  const childLinks = extractLinksFromHtml(html).filter((link) => {
    const childHost = hostOf(link);
    return childHost && childHost !== host && !isSocialHost(childHost) && !isAggregatorHost(childHost) && !isNonBusinessHost(childHost);
  });

  const bookingChild = childLinks.find((link) => classifyBookingPlatform(link, bookingPlatformMatchers));
  if (bookingChild) {
    const platform = classifyBookingPlatform(bookingChild, bookingPlatformMatchers);
    chain.push({ url: bookingChild, note: `Found a ${platform} link inside the link-in-bio page` });
    return { bookingUrl: bookingChild, websiteUrl: "", bookingPlatform: platform, chain, resolved: true };
  }

  const firstChild = childLinks[0];
  if (firstChild) {
    chain.push({ url: firstChild, note: "Found a link inside the link-in-bio page" });
    return { bookingUrl: "", websiteUrl: firstChild, bookingPlatform: "", chain, resolved: true };
  }

  chain.push({ url: "", note: "No usable links found inside the link-in-bio page" });
  return { ...empty, chain };
}
