import { Agent, fetch } from "undici";
import { resolveSafeOutboundHttpUrl } from "./security.mjs";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(rawUrl, options = {}) {
  const { timeoutMs = 15_000, maxBytes = 4_000_000, maxRedirects = 5, ...fetchOptions } = options;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 ||
      !Number.isInteger(maxBytes) || maxBytes < 0 ||
      !Number.isInteger(maxRedirects) || maxRedirects < 0) {
    throw new Error("Invalid remote request limits.");
  }
  const headers = new Headers(fetchOptions.headers);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Remote request timed out.")), timeoutMs);
  const signal = fetchOptions.signal
    ? AbortSignal.any([controller.signal, fetchOptions.signal])
    : controller.signal;
  let nextUrl = rawUrl;
  let method = String(fetchOptions.method || "GET").toUpperCase();
  let body = fetchOptions.body;
  // Let the URL determine Host and TLS SNI, never a caller-supplied header.
  headers.delete("host");

  try {
    if (body?.getReader || body?.[Symbol.asyncIterator]) {
      throw new Error("Streaming request bodies are not supported.");
    }
    for (let redirects = 0; ; redirects += 1) {
      signal.throwIfAborted();
      const { url, addresses } = await resolveTarget(nextUrl, signal);
      signal.throwIfAborted();
      // A new agent per hop prevents stale pools or a second DNS lookup from
      // connecting to an address outside this hop's validated DNS answer.
      const agent = new Agent({
        connect: {
          autoSelectFamily: true,
          rejectUnauthorized: true,
          lookup(hostname, lookupOptions, callback) {
            if (hostname.toLowerCase().replace(/^\[|\]$/g, "") !== url.hostname.toLowerCase().replace(/^\[|\]$/g, "")) {
              callback(new Error("Unexpected outbound hostname."));
              return;
            }
            const candidates = lookupOptions.family
              ? addresses.filter((entry) => entry.family === lookupOptions.family)
              : addresses;
            if (!candidates.length) {
              callback(new Error("No approved address for the requested family."));
            } else if (lookupOptions.all) {
              callback(null, candidates.map((entry) => ({ ...entry })));
            } else {
              callback(null, candidates[0].address, candidates[0].family);
            }
          },
        },
      });
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          method,
          body,
          headers,
          signal,
          redirect: "manual",
          dispatcher: agent,
        });
        const location = response.headers.get("location");
        if (!redirectStatuses.has(response.status) || !location || fetchOptions.redirect === "manual") {
          return await bufferResponse(response, { maxBytes, method, redirected: redirects > 0 });
        }
        await response.body?.cancel();
        if (fetchOptions.redirect === "error") {
          throw new Error("Redirects are not allowed.");
        }
        if (redirects >= maxRedirects) {
          throw new Error("Too many redirects.");
        }
        const target = new URL(location, url);
        if (target.origin !== url.origin) {
          for (const name of ["authorization", "cookie", "proxy-authorization"]) headers.delete(name);
        }
        if ((response.status === 303 && method !== "HEAD") ||
            ([301, 302].includes(response.status) && method === "POST")) {
          method = "GET";
          body = undefined;
          for (const name of ["content-length", "content-type", "content-encoding", "content-language", "content-location"]) {
            headers.delete(name);
          }
        }
        nextUrl = target.toString();
      } finally {
        await agent.destroy();
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveTarget(url, signal) {
  let onAbort;
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try {
    return await Promise.race([resolveSafeOutboundHttpUrl(url), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

async function bufferResponse(response, { maxBytes, method, redirected }) {
  const chunks = [];
  let length = 0;
  if (response.body) {
    if (Number(response.headers.get("content-length")) > maxBytes) {
      await response.body.cancel();
      throw new Error("Remote response is too large.");
    }
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) {
          await reader.cancel();
          throw new Error("Remote response is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const headers = new Headers(response.headers);
  // Undici decodes compressed bodies; these headers no longer describe them.
  headers.delete("content-encoding");
  headers.delete("content-length");
  const noBody = method === "HEAD" || [204, 205, 304].includes(response.status);
  const buffered = new Response(noBody ? null : Buffer.concat(chunks, length), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  Object.defineProperties(buffered, {
    url: { value: response.url },
    redirected: { value: redirected },
  });
  return buffered;
}
