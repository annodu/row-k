import { safeFetch } from "./outbound-http.mjs";

// True only for an https URL on the default port whose host is one of `hosts`
// or a subdomain of one. Lookalikes ("evilinstagram.com", "instagram.com.evil")
// and plain http never match.
export function isDirectFetchHost(rawUrl, hosts = []) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase();
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

// `directHosts` lets Chromium fetch those well-known public hosts itself instead
// of through safeFetch. Use it only for big platforms whose DNS nobody else
// controls: some (Instagram) fingerprint the Node client and serve a "not
// available" page to it. Everything else, including any navigation away from
// those hosts, still goes through the pinned client.
export async function createSafeBrowserPage(browser, { directHosts = [], ...options } = {}) {
  const page = await browser.newPage({ ...options, serviceWorkers: "block", acceptDownloads: false });
  const context = page.context();
  const controller = new AbortController();
  page.once("close", () => controller.abort());
  context.once("close", () => controller.abort());
  try {
    // Context routing also covers frames, workers, and the first popup request.
    await context.route("**/*", async (route) => {
      try {
        const request = route.request();
        if (isDirectFetchHost(request.url(), directHosts)) {
          await route.continue();
          return;
        }
        const response = await safeFetch(request.url(), {
          method: request.method(),
          headers: await request.allHeaders(),
          body: request.postDataBuffer(),
          maxBytes: 20_000_000,
          signal: controller.signal,
        });
        const headers = Object.fromEntries(response.headers);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) headers["set-cookie"] = cookies.join("\n");
        for (const name of ["connection", "transfer-encoding", "keep-alive", "trailer", "upgrade"]) delete headers[name];
        let body = Buffer.from(await response.arrayBuffer());
        // Playwright does not route subsequent HTTP redirects. Consume the
        // entire chain through safeFetch and keep relative HTML assets valid.
        if (response.redirected && /text\/html/i.test(headers["content-type"] || "")) {
          const baseUrl = response.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
          const base = `<base href="${baseUrl}">`;
          let html = body.toString("utf8");
          if (/<head\b[^>]*>/i.test(html)) {
            html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${base}`);
          } else if (/<html\b[^>]*>/i.test(html)) {
            html = html.replace(/<html\b[^>]*>/i, (root) => `${root}<head>${base}</head>`);
          } else {
            html = html.replace(/^(\s*<!doctype[^>]*>)?/i, (doctype) => `${doctype}<head>${base}</head>`);
          }
          body = Buffer.from(html);
        }
        await route.fulfill({
          status: response.status,
          headers,
          body,
        });
      } catch {
        await route.abort("blockedbyclient").catch(() => {});
      }
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    return page;
  } catch (error) {
    await page.close().catch(() => {});
    throw error;
  }
}
