import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "playwright";
import { createSafeBrowserPage } from "./outbound-browser.mjs";
import { fixture } from "./test-support/outbound-fixture.mjs";

async function browserPage(t) {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  return createSafeBrowserPage(browser);
}

test("browser pages, scripts, and frames use pinned HTTP connections", async (t) => {
  // Launch before mocking the network used by the application HTTP client.
  const page = await browserPage(t);
  const requests = [];
  const f = await fixture(t, (req, res) => {
    requests.push(req.url);
    if (req.url === "/script.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end('document.querySelector("h1").textContent = "Rendered";');
    } else if (req.url === "/frame") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<p>Frame content</p>");
    } else {
      res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": ["first=one; Path=/", "second=two; Path=/"] });
      res.end('<h1>Loading</h1><script src="/script.js"></script><iframe src="/frame"></iframe>');
    }
  });
  await page.goto(f.url);
  assert.equal(await page.locator("h1").innerText(), "Rendered");
  assert.equal(await page.frameLocator("iframe").locator("p").innerText(), "Frame content");
  assert.deepEqual(new Set(requests), new Set(["/", "/script.js", "/frame"]));
  assert.equal(f.connections.length, 3);
  assert.deepEqual((await page.context().cookies()).map((cookie) => cookie.name).sort(), ["first", "second"]);
});

test("browser redirects and direct private navigation cannot bypass pinning", async (t) => {
  const page = await browserPage(t);
  let requests = 0;
  const f = await fixture(t, (_, res) => {
    requests += 1;
    res.writeHead(302, { Location: `http://127.0.0.1:${f.port}/secret` });
    res.end();
  });
  await assert.rejects(page.goto(f.url), /ERR_BLOCKED_BY_CLIENT/);
  await assert.rejects(page.goto(`http://127.0.0.1:${f.port}/secret`), /ERR_BLOCKED_BY_CLIENT/);
  assert.equal(requests, 1);
});

test("browser follows public redirects through the pinned client and resolves final-page assets", async (t) => {
  const page = await browserPage(t);
  const requests = [];
  const f = await fixture(t, (req, res) => {
    requests.push(req.url);
    if (req.url === "/") {
      res.writeHead(302, { Location: "/destination/page" });
      res.end();
    } else if (req.url === "/destination/script.js") {
      res.writeHead(200, { "Content-Type": "application/javascript" });
      res.end('document.querySelector("h1").textContent = "Redirected page rendered";');
    } else if (req.url === "/destination/page") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<!doctype html><html><head></head><body><h1>Loading</h1><script src="script.js"></script></body></html>');
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await page.goto(f.url);
  assert.equal(await page.locator("h1").innerText(), "Redirected page rendered");
  assert.deepEqual(requests, ["/", "/destination/page", "/destination/script.js"]);
  assert.equal(f.connections.length, 3);
});

test("browser blocks private frames, popups, WebSockets, and service workers", async (t) => {
  const page = await browserPage(t);
  let upgrades = 0;
  const f = await fixture(t, (_, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Public page</h1>");
  });
  f.server.on("upgrade", (_, socket) => {
    upgrades += 1;
    socket.destroy();
  });
  await page.goto(f.url);
  const privateUrl = `http://127.0.0.1:${f.port}/secret`;
  const popupPromise = page.waitForEvent("popup");
  await page.evaluate((url) => window.open(url), privateUrl);
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded").catch(() => {});
  assert.equal(f.connections.length, 1);
  const wsClosed = await page.evaluate((port) => new Promise((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/socket`);
    socket.onclose = () => resolve(true);
    socket.onopen = () => resolve(false);
  }), f.port);
  assert.equal(wsClosed, true);
  assert.equal(upgrades, 0);
  const failed = page.waitForEvent("requestfailed", { predicate: (request) => request.url() === privateUrl });
  await page.evaluate((url) => {
    const frame = document.createElement("iframe");
    frame.src = url;
    document.body.append(frame);
  }, privateUrl);
  await failed;
  assert.equal(f.connections.length, 1);
  assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker)), false);
});
