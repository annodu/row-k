import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const rateLimitBuckets = new Map();

export function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("X-Frame-Options", "DENY");
}

export function createRateLimiter({ windowMs, max, keyPrefix = "global", message = "Too many requests. Please try again later." }) {
  return (req, res, next) => {
    const result = checkRateLimit(req, { windowMs, max, keyPrefix });
    setRateLimitHeaders(res, result);

    if (!result.allowed) {
      return res.status(429).json({ ok: false, message });
    }

    next();
  };
}

export function enforceRateLimit(req, res, options) {
  const result = checkRateLimit(req, options);
  setRateLimitHeaders(res, result);

  if (!result.allowed) {
    res.status(429).json({ ok: false, message: options.message || "Too many requests. Please try again later." });
    return false;
  }

  return true;
}

export function requireTrustedOrigin(req, res, next) {
  if (!unsafeMethods.has(String(req.method || "").toUpperCase())) {
    return next();
  }

  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return res.status(403).json({ ok: false, message: "Cross-site requests are not allowed." });
  }

  const origin = req.headers.origin;
  if (origin && !isTrustedOrigin(origin, req)) {
    return res.status(403).json({ ok: false, message: "Request origin is not allowed." });
  }

  next();
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  const requestId = req.headers["x-request-id"] || cryptoSafeId();
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const route = req.route?.path || req.path || req.url || "unknown";
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs,
    }));
  });

  next();
}

export async function assertSafeOutboundHttpUrl(rawUrl) {
  const { url } = await resolveSafeOutboundHttpUrl(rawUrl);
  return url.toString();
}

export async function resolveSafeOutboundHttpUrl(rawUrl) {
  const parsed = parseHttpUrl(rawUrl);
  if (!parsed) {
    throw new Error("Only valid http and https URLs are allowed.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL credentials are not allowed.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new Error("This URL host is not allowed.");
  }

  const addresses = await resolveHostname(hostname);
  if (!addresses.length || addresses.some(({ address, family }) => net.isIP(address) !== family || isPrivateAddress(address))) {
    throw new Error("This URL resolves to a private network address.");
  }

  return { url: parsed, addresses };
}

export function sanitizeErrorMessage(error, fallback = "Request failed.") {
  return isHostedRuntime() ? fallback : error?.message || fallback;
}

function checkRateLimit(req, { windowMs, max, keyPrefix = "global" }) {
  const now = Date.now();
  const key = `${keyPrefix}:${getClientIp(req)}`;
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + windowMs };
    rateLimitBuckets.set(key, nextBucket);
    cleanupRateLimitBuckets(now);
    return { allowed: true, remaining: Math.max(max - 1, 0), resetAt: nextBucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: bucket.count <= max, remaining: Math.max(max - bucket.count, 0), resetAt: bucket.resetAt };
}

function setRateLimitHeaders(res, result) {
  res.setHeader("RateLimit-Remaining", String(result.remaining));
  res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(Math.max(result.resetAt - Date.now(), 0) / 1000)));
  }
}

function cleanupRateLimitBuckets(now) {
  if (rateLimitBuckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function getClientIp(req) {
  const platformIp = isHostedRuntime()
    ? firstValidIp(req.headers["x-real-ip"]) || firstValidIp(req.headers["x-forwarded-for"])
    : "";
  return platformIp || firstValidIp(req.ip) || firstValidIp(req.socket?.remoteAddress) || "unknown";
}

function firstValidIp(value = "") {
  const candidate = String(Array.isArray(value) ? value[0] : value)
    .split(",")[0]
    .trim()
    .replace(/^\[|\]$/g, "");
  return net.isIP(candidate) ? candidate : "";
}

function isTrustedOrigin(origin, req) {
  try {
    const originUrl = new URL(origin);
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
    const protocol = String(req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http"));
    return (
      (originUrl.host === host && originUrl.protocol === `${protocol}:`) ||
      isAllowedDevOrigin(originUrl, host)
    );
  } catch {
    return false;
  }
}

function isAllowedDevOrigin(originUrl, host) {
  if (isHostedRuntime()) {
    return false;
  }

  const hostName = getHostnameFromHostHeader(host);
  const devHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  return devHosts.has(originUrl.hostname) && devHosts.has(hostName);
}

function getHostnameFromHostHeader(host = "") {
  if (host.startsWith("[")) {
    return host.slice(1, host.indexOf("]"));
  }

  return host.split(":")[0];
}

function cryptoSafeId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseHttpUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function isBlockedHostname(hostname = "") {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "localhost" || normalized.endsWith(".localhost") || normalized === "metadata.google.internal";
}

async function resolveHostname(hostname) {
  const literalType = net.isIP(hostname);
  if (literalType) {
    return [{ address: hostname, family: literalType }];
  }

  return dns.lookup(hostname, { all: true, verbatim: true });
}

function isPrivateAddress(address = "") {
  try {
    const parsed = ipaddr.process(address);
    // Reject special ranges and IPv6 outside global unicast, including tunnels.
    return parsed.range() !== "unicast" ||
      (parsed.kind() === "ipv6" && !parsed.match(ipaddr.parse("2000::"), 3));
  } catch {
    return true;
  }
}

function isHostedRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
