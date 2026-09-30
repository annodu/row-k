import assert from "node:assert/strict";
import dns from "node:dns/promises";
import tls from "node:tls";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import { safeFetch } from "./outbound-http.mjs";
import { assertSafeOutboundHttpUrl, resolveSafeOutboundHttpUrl } from "./security.mjs";
import { fixture, publicAddress, publicIpv6 } from "./test-support/outbound-fixture.mjs";

test("pins the approved DNS answer and preserves Host even when DNS subsequently changes", async (t) => {
  let host;
  const f = await fixture(t, (req, res) => {
    host = req.headers.host;
    res.end("public content");
  }, (_, count) => count === 1 ? [publicAddress, publicIpv6] : [{ address: "127.0.0.1", family: 4 }]);
  const response = await safeFetch(`${f.url}/page`, { headers: { Host: "127.0.0.1" } });
  assert.equal(await response.text(), "public content");
  assert.equal(response.url, `${f.url}/page`);
  assert.equal(host, `public.test:${f.port}`);
  assert.deepEqual(f.resolutions, ["public.test"]);
  assert.deepEqual(f.connections[0].address, [publicAddress, publicIpv6]);
});

test("resolves and pins each redirect independently", async (t) => {
  const f = await fixture(t, (req, res) => {
    if (req.url === "/start") {
      res.writeHead(302, { Location: `http://other.test:${f.port}/end` });
      res.end();
    } else res.end("destination");
  }, (host) => [host === "public.test" ? publicAddress : { address: "1.1.1.1", family: 4 }]);
  const response = await safeFetch(`${f.url}/start`);
  assert.equal(await response.text(), "destination");
  assert.equal(response.url, `http://other.test:${f.port}/end`);
  assert.equal(response.redirected, true);
  assert.deepEqual(f.resolutions, ["public.test", "other.test"]);
  assert.deepEqual(f.connections.map((entry) => entry.address[0].address), ["93.184.216.34", "1.1.1.1"]);
});

test("blocks a private DNS answer after a same-host redirect", async (t) => {
  const f = await fixture(t, (_, res) => {
    res.writeHead(302, { Location: "/private" });
    res.end();
  }, (_, count) => count === 1 ? [publicAddress] : [{ address: "10.0.0.1", family: 4 }]);
  await assert.rejects(safeFetch(f.url), /private network/);
  assert.equal(f.connections.length, 1);
  assert.equal(f.resolutions.length, 2);
});

test("blocks redirects to private literal addresses before a second connection", async (t) => {
  const f = await fixture(t, (_, res) => {
    res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
    res.end();
  });
  await assert.rejects(safeFetch(f.url), /private network/);
  assert.equal(f.connections.length, 1);
});

test("rejects mixed public/private, empty, or malformed DNS answers without connecting", async (t) => {
  let answer;
  const f = await fixture(t, (_, res) => res.end(), () => answer);
  for (answer of [[publicAddress, { address: "192.168.1.1", family: 4 }], [],
    [{ address: "invalid", family: 4 }], [{ address: "127.0.0.1", family: 6 }]]) {
    await assert.rejects(safeFetch(f.url), /private network/);
  }
  assert.equal(f.connections.length, 0);
});

test("rejects private, reserved, tunneled, and mapped private IP forms", async () => {
  const urls = [
    "http://localhost/", "http://child.localhost/", "http://metadata.google.internal/",
    "http://127.1/", "http://2130706433/", "http://0x7f000001/",
    "http://10.0.0.1/", "http://100.64.0.1/", "http://172.31.1.1/", "http://192.168.1.1/",
    "http://192.0.2.1/", "http://198.18.0.1/", "http://224.0.0.1/", "http://0.0.0.0/",
    "http://[::1]/", "http://[::]/", "http://[fc00::1]/", "http://[fe90::1]/", "http://[ff02::1]/",
    "http://[::ffff:7f00:1]/", "http://[::ffff:ac10:1]/", "http://[::ffff:a9fe:a9fe]/",
    "http://[::127.0.0.1]/", "http://[64:ff9b::a00:1]/", "http://[2002:7f00:1::]/",
    "http://[2001:db8::1]/", "file:///etc/passwd", "ftp://example.com/",
    "https://user:password@example.com/",
  ];
  for (const url of urls) await assert.rejects(assertSafeOutboundHttpUrl(url), undefined, url);
});

test("accepts public IPv4, IPv6, and public mapped literals without DNS", async (t) => {
  t.mock.method(dns, "lookup", () => assert.fail("IP literals must not use DNS"));
  for (const url of ["https://1.1.1.1/", "https://[2606:4700:4700::1111]/", "https://[::ffff:808:808]/"]) {
    const target = await resolveSafeOutboundHttpUrl(url);
    assert.equal(target.addresses.length, 1);
    assert.equal(target.url.toString(), url);
  }
});

test("keeps HTTPS hostname/SNI and certificate verification while pinning DNS", async (t) => {
  t.mock.method(dns, "lookup", async () => [publicAddress]);
  const attempted = new Error("TLS probe stopped");
  let connection;
  t.mock.method(tls, "connect", (options) => {
    connection = options;
    throw attempted;
  });
  await assert.rejects(safeFetch("https://public.test/", { headers: { Host: "attacker.test" } }),
    (error) => error.cause === attempted);
  assert.equal(connection.host, "public.test");
  assert.equal(connection.servername, "public.test");
  assert.equal(connection.rejectUnauthorized, true);
  const address = await new Promise((resolve, reject) => {
    connection.lookup("public.test", { all: true }, (error, result) => error ? reject(error) : resolve(result));
  });
  assert.deepEqual(address, [publicAddress]);
  await assert.rejects(new Promise((resolve, reject) => {
    connection.lookup("other.test", {}, (error) => error ? reject(error) : resolve());
  }), /Unexpected outbound hostname/);
});

test("strips credentials across origins and switches POST to GET on 302", async (t) => {
  const requests = [];
  const f = await fixture(t, (req, res) => {
    requests.push({ method: req.method, headers: req.headers });
    if (requests.length === 1) res.writeHead(302, { Location: `http://other.test:${f.port}/` });
    res.end("ok");
  });
  await safeFetch(f.url, {
    method: "POST", body: "payload",
    headers: { Authorization: "Bearer secret", Cookie: "session=secret", "Proxy-Authorization": "secret", "Content-Type": "text/plain" },
  });
  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].headers.authorization, "Bearer secret");
  assert.equal(requests[1].method, "GET");
  for (const name of ["authorization", "cookie", "proxy-authorization", "content-type", "content-length"]) {
    assert.equal(requests[1].headers[name], undefined, name);
  }
});

test("preserves POST and its body on 307 redirects", async (t) => {
  const requests = [];
  const f = await fixture(t, async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, body });
    if (requests.length === 1) res.writeHead(307, { Location: "/end" });
    res.end("ok");
  });
  await safeFetch(f.url, { method: "POST", body: "payload" });
  assert.deepEqual(requests, [{ method: "POST", body: "payload" }, { method: "POST", body: "payload" }]);
});

test("respects manual/error redirects and caps redirect loops", async (t) => {
  const f = await fixture(t, (_, res) => {
    res.writeHead(302, { Location: "/again" });
    res.end();
  });
  assert.equal((await safeFetch(f.url, { redirect: "manual" })).status, 302);
  await assert.rejects(safeFetch(f.url, { redirect: "error" }), /Redirects are not allowed/);
  await assert.rejects(safeFetch(f.url, { maxRedirects: 1 }), /Too many redirects/);
  assert.equal(f.connections.length, 4);
});

test("caps streamed and decompressed bodies", async (t) => {
  const f = await fixture(t, (req, res) => {
    if (req.url === "/gzip") {
      res.writeHead(200, { "Content-Encoding": "gzip" });
      res.end(gzipSync("a".repeat(5000)));
    } else {
      res.write("a".repeat(512));
      res.end("a".repeat(512));
    }
  });
  await assert.rejects(safeFetch(f.url, { maxBytes: 100 }), /too large/);
  await assert.rejects(safeFetch(`${f.url}/gzip`, { maxBytes: 100 }), /too large/);
  const response = await safeFetch(`${f.url}/gzip`, { maxBytes: 5000 });
  assert.equal((await response.text()).length, 5000);
  assert.equal(response.headers.get("content-encoding"), null);
});

test("handles HEAD and responses with no body", async (t) => {
  const f = await fixture(t, (req, res) => {
    res.writeHead(req.url === "/empty" ? 204 : 200, { "Content-Length": "100000000" });
    res.end();
  });
  assert.equal(await (await safeFetch(f.url, { method: "HEAD" })).text(), "");
  assert.equal((await safeFetch(`${f.url}/empty`)).status, 204);
});

test("timeouts cover DNS resolution", async (t) => {
  t.mock.method(dns, "lookup", () => new Promise(() => {}));
  await assert.rejects(safeFetch("http://public.test/", { timeoutMs: 25 }), /timed out/);
});

test("timeouts cover streamed bodies and caller aborts", async (t) => {
  const f = await fixture(t, (_, res) => {
    res.write("partial");
  });
  await assert.rejects(safeFetch(f.url, { timeoutMs: 100 }), /timed out/);
  const controller = new AbortController();
  controller.abort(new Error("Cancelled by caller"));
  await assert.rejects(safeFetch(f.url, { signal: controller.signal }), /Cancelled by caller/);
});
