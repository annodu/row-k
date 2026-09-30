import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { parseEnv } from "node:util";
import { test } from "node:test";
import express from "express";
import { createAdminAuthStore } from "./admin-auth-store.mjs";
import { adminSessionMaxAgeSeconds, authenticateAdmin, createAdminSessionToken, createAdminTotp, getAdminAuthConfig, verifyAdminSessionToken } from "./admin-auth.mjs";
import { generateAdminMfaSetup, writeAdminMfaSetup } from "../scripts/setup-admin-mfa.mjs";
import { registerAdminStylistRoutes } from "./admin-stylists.mjs";

function configuration() {
  const setup = generateAdminMfaSetup();
  const env = {
    NODE_ENV: "development", VERCEL: "0", ADMIN_PASSWORD: "test-admin-password",
    ADMIN_TOTP_SECRET: setup.secret, ADMIN_SESSION_SECRET: setup.sessionSecret,
    ADMIN_RECOVERY_CODE_HASHES: JSON.stringify(setup.recoveryHashes),
  };
  return { setup, env, config: getAdminAuthConfig(env) };
}

async function localStore(t, config) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rowk-admin-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filename = path.join(directory, "state.json");
  const options = { key: config.sessionSecret, namespace: config.configId, hosted: false, filename };
  return { store: createAdminAuthStore(options), another: () => createAdminAuthStore(options), filename };
}

function githubFixture() {
  let stored = null;
  let version = 0;
  let writes = 0;
  let conflicts = 0;
  const request = async (url, options) => {
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    if (options.method === "PUT") {
      const payload = JSON.parse(options.body);
      assert.equal(payload.branch, "rowk-admin-auth");
      assert.match(payload.message, /skip ci/);
      if ((stored && payload.sha !== String(version)) || (!stored && payload.sha)) {
        conflicts += 1;
        return new Response(null, { status: 409 });
      }
      stored = payload.content;
      version += 1;
      writes += 1;
      return Response.json({ content: { sha: String(version) } }, { status: 200 });
    }
    if (url.includes("/git/ref/heads/")) return Response.json({ object: { sha: "branch-head" } });
    const snapshot = stored;
    const sha = String(version);
    // Let concurrent stores read the same SHA to exercise the conflict path.
    await new Promise((resolve) => setImmediate(resolve));
    return snapshot ? Response.json({ content: snapshot, sha, encoding: "base64" }) : new Response(null, { status: 404 });
  };
  return { request, get contents() { return stored ? Buffer.from(stored, "base64").toString() : ""; }, get writes() { return writes; }, get conflicts() { return conflicts; } };
}

test("requires configured MFA and a strong independent session secret", () => {
  const { env } = configuration();
  for (const key of ["ADMIN_TOTP_SECRET", "ADMIN_SESSION_SECRET", "ADMIN_RECOVERY_CODE_HASHES"]) {
    assert.throws(() => getAdminAuthConfig({ ...env, [key]: "" }), /not configured/);
  }
  assert.throws(() => getAdminAuthConfig({ ...env, ADMIN_SESSION_SECRET: "weak" }), /not configured/);
  assert.throws(() => getAdminAuthConfig({ ...env, ADMIN_RECOVERY_CODE_HASHES: "[]" }), /not configured/);
  assert.throws(() => getAdminAuthConfig({ ...env, NODE_ENV: "production", ADMIN_PASSWORD: "" }), /not configured/);
});

test("requires both password and TOTP, rejects malformed input and code replay", async (t) => {
  const { config } = configuration();
  const { store } = await localStore(t, config);
  const time = 1_800_000_000_000;
  const code = createAdminTotp(config.secret).generate({ timestamp: time });
  const verify = (credentials) => authenticateAdmin(credentials, { config, store, now: () => time });
  for (const credentials of [{ password: config.password }, { code }, { password: "wrong", code },
    { password: config.password, code: 123456 }, { password: config.password, code: "12345" },
    { password: config.password, code, recoveryCode: "extra" }]) {
    assert.equal((await verify(credentials)).status, 401);
  }
  assert.equal((await verify({ password: config.password, code })).ok, true);
  assert.equal((await verify({ password: config.password, code })).ok, false);
});

test("accepts narrow clock drift and rejects expired codes", async (t) => {
  const { config } = configuration();
  const { store } = await localStore(t, config);
  const time = 1_800_000_000_000;
  const totp = createAdminTotp(config.secret);
  assert.equal((await authenticateAdmin({ password: config.password, code: totp.generate({ timestamp: time - 120_000 }) },
    { config, store, now: () => time })).ok, false);
  assert.equal((await authenticateAdmin({ password: config.password, code: totp.generate({ timestamp: time - 30_000 }) },
    { config, store, now: () => time })).ok, true);
});

test("recovery codes require the password and are consumed once", async (t) => {
  const { setup, config } = configuration();
  const { store } = await localStore(t, config);
  const credentials = { password: config.password, recoveryCode: setup.recoveryCodes[0] };
  assert.equal((await authenticateAdmin({ ...credentials, password: "wrong" }, { config, store })).ok, false);
  assert.equal((await authenticateAdmin(credentials, { config, store })).ok, true);
  assert.equal((await authenticateAdmin(credentials, { config, store })).ok, false);
  const code = createAdminTotp(config.secret).generate();
  assert.equal((await authenticateAdmin({ password: config.password, code }, { config, store })).ok, true);
});

test("local file locks prevent two processes from consuming the same recovery code", async (t) => {
  const { setup, config } = configuration();
  const { store, another } = await localStore(t, config);
  const credentials = { password: config.password, recoveryCode: setup.recoveryCodes[0] };
  const results = await Promise.all([authenticateAdmin(credentials, { config, store }), authenticateAdmin(credentials, { config, store: another() })]);
  assert.equal(results.filter((result) => result.ok).length, 1);
});

test("encrypted state survives a new instance and rejects tampering", async (t) => {
  const { setup, config } = configuration();
  const { store, another, filename } = await localStore(t, config);
  const credentials = { password: config.password, recoveryCode: setup.recoveryCodes[0] };
  await authenticateAdmin(credentials, { config, store });
  const contents = await fs.readFile(filename, "utf8");
  for (const secret of [config.secret, config.password, setup.recoveryCodes[0], setup.recoveryHashes[0], "lastUsedStep"]) assert.ok(!contents.includes(secret));
  assert.equal((await fs.stat(filename)).mode & 0o777, 0o600);
  assert.equal((await authenticateAdmin(credentials, { config, store: another() })).ok, false);
  const envelope = JSON.parse(contents);
  envelope.tag = "00".repeat(16);
  await fs.writeFile(filename, JSON.stringify(envelope));
  await assert.rejects(authenticateAdmin(credentials, { config, store: another() }));
});

test("durable account limit persists between instances and expires", async (t) => {
  const { config } = configuration();
  const { store, another } = await localStore(t, config);
  let time = 1_800_000_000_000;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal((await authenticateAdmin({ password: "wrong", code: "123456" }, { config, store: another(), now: () => time })).status, 401);
  }
  let code = createAdminTotp(config.secret).generate({ timestamp: time });
  const blocked = await authenticateAdmin({ password: config.password, code }, { config, store, now: () => time });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.retryAfter, 600);
  time += 600_001;
  code = createAdminTotp(config.secret).generate({ timestamp: time });
  assert.equal((await authenticateAdmin({ password: config.password, code }, { config, store, now: () => time })).ok, true);
});

test("GitHub CAS permits only one concurrent TOTP login and stores only ciphertext", async () => {
  const { config } = configuration();
  const fixture = githubFixture();
  const options = { key: config.sessionSecret, namespace: config.configId, hosted: true, env: { GITHUB_TOKEN: "test-token" }, request: fixture.request };
  const time = 1_800_000_000_000;
  const code = createAdminTotp(config.secret).generate({ timestamp: time });
  const results = await Promise.all(Array.from({ length: 3 }, () => authenticateAdmin({ password: config.password, code },
    { config, store: createAdminAuthStore(options), now: () => time })));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.ok(fixture.conflicts > 0);
  assert.equal(fixture.writes, 3);
  assert.ok(!fixture.contents.includes(config.secret));
  assert.ok(!fixture.contents.includes("lastUsedStep"));
});

test("GitHub CAS consumes a recovery code exactly once across instances", async () => {
  const { setup, config } = configuration();
  const fixture = githubFixture();
  const options = { key: config.sessionSecret, namespace: config.configId, hosted: true, env: { GITHUB_TOKEN: "test-token" }, request: fixture.request };
  const credentials = { password: config.password, recoveryCode: setup.recoveryCodes[0] };
  const results = await Promise.all([0, 1].map(() => authenticateAdmin(credentials, { config, store: createAdminAuthStore(options) })));
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.ok(fixture.conflicts > 0);
});

test("hosted storage fails closed without credentials or on provider failure", async () => {
  const { config } = configuration();
  const credentials = { password: config.password, code: createAdminTotp(config.secret).generate() };
  const options = { key: config.sessionSecret, namespace: config.configId, hosted: true, env: {} };
  await assert.rejects(authenticateAdmin(credentials, { config, store: createAdminAuthStore(options) }), /credentials/);
  await assert.rejects(authenticateAdmin(credentials, { config, store: createAdminAuthStore({ ...options,
    env: { GITHUB_TOKEN: "test-token" }, request: async () => new Response(null, { status: 503 }) }) }), /storage/);
});

test("sessions reject password-only signatures, expiry, future dates, and configuration changes", () => {
  const { config } = configuration();
  const time = 1_800_000_000_000;
  const token = createAdminSessionToken(config, time);
  assert.ok(verifyAdminSessionToken(token, config, time));
  const payload = token.split(".").slice(0, 2).join(".");
  const legacy = `${payload}.${crypto.createHmac("sha256", config.password).update(payload).digest("base64url")}`;
  assert.equal(verifyAdminSessionToken(legacy, config, time), null);
  assert.equal(verifyAdminSessionToken(token, config, time + adminSessionMaxAgeSeconds * 1000), null);
  assert.equal(verifyAdminSessionToken(createAdminSessionToken(config, time + 1000), config, time), null);
  const { env } = configuration();
  for (const next of [getAdminAuthConfig(env), getAdminAuthConfig({ ...env, ADMIN_PASSWORD: "rotated" })]) {
    assert.equal(verifyAdminSessionToken(token, next, time), null);
  }
});

test("offline provisioning creates private QR/recovery files and refuses silent rotation", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rowk-mfa-setup-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const result = await writeAdminMfaSetup(directory);
  const env = parseEnv(await fs.readFile(result.envPath, "utf8"));
  const html = await fs.readFile(result.setupPath, "utf8");
  assert.equal(getAdminAuthConfig({ ...env, ADMIN_PASSWORD: "test" }).recoveryHashes.length, 10);
  assert.match(html, /data:image\/png;base64,/);
  assert.ok(html.includes(env.ADMIN_TOTP_SECRET));
  assert.equal((await fs.stat(result.envPath)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(result.setupPath)).mode & 0o777, 0o600);
  await assert.rejects(writeAdminMfaSetup(directory), /already exists/);
  await fs.unlink(result.envPath);
  await assert.rejects(writeAdminMfaSetup(directory), /already exists/);
  await assert.rejects(fs.access(result.envPath), { code: "ENOENT" });
});

test("admin API issues a cookie only after both factors and protects API routes", async (t) => {
  const { env, config } = configuration();
  const before = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const file = new URL(`../.admin-security/${config.configId}.json`, import.meta.url);
  t.after(() => fs.unlink(file).catch(() => {}));
  const app = express();
  app.use(express.json());
  registerAdminStylistRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (body) => fetch(`${base}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const passwordOnly = await login({ password: config.password });
  assert.equal(passwordOnly.status, 401);
  assert.match(passwordOnly.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await fetch(`${base}/api/admin/dashboard`)).status, 401);
  const code = createAdminTotp(config.secret).generate();
  const accepted = await login({ password: config.password, code });
  assert.equal(accepted.status, 200);
  const cookie = accepted.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly; SameSite=Lax/);
  assert.equal((await fetch(`${base}/api/admin/session`, { headers: { Cookie: cookie } })).status, 200);
  assert.equal((await login({ password: config.password, code })).status, 401);
  delete process.env.ADMIN_TOTP_SECRET;
  assert.equal((await fetch(`${base}/api/admin/session`, { headers: { Cookie: cookie } })).status, 503);
  assert.equal((await login({ password: config.password })).status, 503);
});
