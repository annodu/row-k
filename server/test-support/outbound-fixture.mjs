import assert from "node:assert/strict";
import dns from "node:dns/promises";
import http from "node:http";
import net from "node:net";
import { once } from "node:events";

export const publicAddress = { address: "93.184.216.34", family: 4 };
export const publicIpv6 = { address: "2606:4700:4700::1111", family: 6 };

export async function fixture(t, handler, resolver = () => [publicAddress]) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const resolutions = [];
  const connections = [];
  t.mock.method(dns, "lookup", async (hostname, options) => {
    resolutions.push(hostname);
    assert.deepEqual(options, { all: true, verbatim: true });
    return resolver(hostname, resolutions.length);
  });
  const originalConnect = net.connect;
  // Exercise the real HTTP client without contacting the approved public IP;
  // record the pinned lookup before substituting the local fixture address.
  t.mock.method(net, "connect", (options, ...args) => {
    assert.equal(typeof options.lookup, "function");
    return originalConnect({
      ...options,
      lookup(hostname, lookupOptions, callback) {
        options.lookup(hostname, lookupOptions, (error, address, family) => {
          if (error) return callback(error);
          connections.push({ hostname, address, family });
          if (lookupOptions.all) {
            callback(null, [{ address: "127.0.0.1", family: 4 }]);
          } else {
            callback(null, "127.0.0.1", 4);
          }
        });
      },
    }, ...args);
  });
  const port = server.address().port;
  return { url: `http://public.test:${port}`, port, resolutions, connections, server };
}
