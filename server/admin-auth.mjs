import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { createAdminAuthStore } from "./admin-auth-store.mjs";

export const adminSessionMaxAgeSeconds = 60 * 60 * 12;
const loginWindowMs = 10 * 60 * 1000;
const maxLoginAttempts = 10;

export function getAdminAuthConfig(env = process.env) {
  const hosted = env.NODE_ENV === "production" || env.VERCEL === "1";
  const password = (env.ADMIN_PASSWORD || env.ROWK_ADMIN_PASSWORD || (hosted ? "" : "rowk-admin")).trim();
  const secret = String(env.ADMIN_TOTP_SECRET || "").trim().toUpperCase();
  const sessionSecret = String(env.ADMIN_SESSION_SECRET || "").trim();
  let recoveryHashes;
  try { recoveryHashes = JSON.parse(env.ADMIN_RECOVERY_CODE_HASHES || "null"); } catch { /* Report a safe configuration error below. */ }
  if (!password || !/^[A-Z2-7]{32}$/.test(secret) || !/^[a-f0-9]{64}$/.test(sessionSecret) ||
      !Array.isArray(recoveryHashes) || !recoveryHashes.length || recoveryHashes.length > 20 ||
      recoveryHashes.some((hash) => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new Error("Admin MFA is not configured. Run the admin MFA setup and configure the server secrets.");
  }
  const configId = crypto.createHmac("sha256", sessionSecret).update(`rowk-mfa:${secret}`).digest("hex");
  const sessionKey = crypto.createHmac("sha256", sessionSecret).update(`rowk-mfa-session-v1:${password}:${secret}`).digest();
  return { password, secret, sessionSecret, recoveryHashes, configId, sessionKey, hosted };
}

export function createAdminTotp(secret) {
  return new OTPAuth.TOTP({ issuer: "ROW K", label: "Admin", algorithm: "SHA1", digits: 6, period: 30, secret });
}

function equal(left, right) {
  const a = crypto.createHash("sha256").update(String(left)).digest();
  const b = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

export function hashRecoveryCode(code) {
  return crypto.createHash("sha256").update(String(code).replace(/[-\s]/g, "").toUpperCase()).digest("hex");
}

export async function authenticateAdmin(credentials, { config = getAdminAuthConfig(), store, now = Date.now } = {}) {
  const persistence = store || createAdminAuthStore({ key: config.sessionSecret, namespace: config.configId, hosted: config.hosted });
  const passwordCorrect = typeof credentials.password === "string" && equal(credentials.password.trim(), config.password);
  return persistence.update((previous) => {
    const time = now();
    let state = previous;
    if (!state || state.configId !== config.configId) {
      state = { configId: config.configId, lastUsedStep: -1, usedRecoveryHashes: [], attempts: { count: 0, resetAt: time + loginWindowMs } };
    }
    if (!Number.isSafeInteger(state.lastUsedStep) || state.lastUsedStep < -1 ||
        !Array.isArray(state.usedRecoveryHashes) || !Number.isSafeInteger(state.attempts?.count) ||
        !Number.isSafeInteger(state.attempts?.resetAt) || state.attempts.count < 0) {
      throw new Error("Invalid admin security state.");
    }
    if (state.attempts.resetAt <= time) state.attempts = { count: 0, resetAt: time + loginWindowMs };
    if (state.attempts.count >= maxLoginAttempts) {
      return { state, changed: false, result: { ok: false, status: 429, retryAfter: Math.ceil((state.attempts.resetAt - time) / 1000) } };
    }
    state.attempts.count += 1;
    let accepted = false;
    if (passwordCorrect && typeof credentials.code === "string" && !credentials.recoveryCode && /^\d{6}$/.test(credentials.code)) {
      const delta = createAdminTotp(config.secret).validate({ token: credentials.code, timestamp: time, window: 1 });
      const step = Math.floor(time / 30_000) + (delta ?? 0);
      if (delta !== null && step > state.lastUsedStep) {
        state.lastUsedStep = step;
        accepted = true;
      }
    } else if (passwordCorrect && typeof credentials.recoveryCode === "string" && !credentials.code &&
               /^[A-Fa-f0-9\s-]{32,40}$/.test(credentials.recoveryCode)) {
      const hash = hashRecoveryCode(credentials.recoveryCode);
      if (config.recoveryHashes.some((candidate) => equal(hash, candidate)) && !state.usedRecoveryHashes.includes(hash)) {
        state.usedRecoveryHashes.push(hash);
        accepted = true;
      }
    }
    return { state, result: { ok: accepted, status: accepted ? 200 : 401 } };
  });
}

export function createAdminSessionToken(config = getAdminAuthConfig(), now = Date.now()) {
  const payload = `${now}.${crypto.randomBytes(16).toString("hex")}`;
  const signature = crypto.createHmac("sha256", config.sessionKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token, config = getAdminAuthConfig(), now = Date.now()) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || !/^\d{13}$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1])) return null;
  const createdAt = Number(parts[0]);
  if (createdAt > now || now - createdAt >= adminSessionMaxAgeSeconds * 1000) return null;
  const signature = crypto.createHmac("sha256", config.sessionKey).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  return equal(parts[2], signature) ? { createdAt } : null;
}
