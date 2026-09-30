import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { createAdminTotp, hashRecoveryCode } from "../server/admin-auth.mjs";

export function generateAdminMfaSetup() {
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  const sessionSecret = crypto.randomBytes(32).toString("hex");
  const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(16).toString("hex").toUpperCase().match(/.{8}/g).join("-"));
  return { secret, sessionSecret, recoveryCodes, recoveryHashes: recoveryCodes.map(hashRecoveryCode), uri: createAdminTotp(secret).toString() };
}

export async function writeAdminMfaSetup(directory) {
  const envPath = path.join(directory, ".env.admin-mfa.local");
  const setupPath = path.join(directory, ".env.admin-mfa-setup.html");
  for (const filename of [envPath, setupPath]) {
    try {
      await fs.access(filename);
      throw new Error("MFA setup already exists. Reuse the private setup page; do not rotate working credentials accidentally.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const setup = generateAdminMfaSetup();
  const qr = await QRCode.toDataURL(setup.uri, { width: 320, margin: 4, errorCorrectionLevel: "M" });
  const env = `ADMIN_TOTP_SECRET=${setup.secret}\nADMIN_SESSION_SECRET=${setup.sessionSecret}\nADMIN_RECOVERY_CODE_HASHES='${JSON.stringify(setup.recoveryHashes)}'\n`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>ROW K - Private Authenticator Setup</title>
<style>body{font:16px system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;background:#fff;color:#181818}h1{font-size:26px}img{display:block;width:320px;max-width:100%;height:auto}code{font-family:monospace;overflow-wrap:anywhere}li{margin:12px 0}p{line-height:1.6}.codes{padding:16px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;line-height:2}</style>
</head><body><h1>ROW K Admin</h1><h2>Google Authenticator setup</h2>
<ol><li>In Google Authenticator, choose Add code, then Scan a QR code.</li><li>Scan this QR code and confirm the entry is ROW K: Admin.</li><li>Sign in to the admin portal with your password and the current six-digit code.</li></ol>
<img src="${qr}" alt="Private ROW K authenticator enrollment QR code">
<p>Manual setup key: <code>${setup.secret}</code></p>
<h2>Recovery codes</h2><p>Store these in your password manager. Each works once, together with your admin password.</p>
<div class="codes">${setup.recoveryCodes.map((code) => `<code>${code}</code>`).join("<br>")}</div>
<p>This private page contains your authenticator secret and recovery codes. Do not publish or share it. No information is sent to Google or any other service.</p>
</body></html>`;
  await fs.writeFile(envPath, env, { mode: 0o600, flag: "wx" });
  try {
    await fs.writeFile(setupPath, html, { mode: 0o600, flag: "wx" });
  } catch (error) {
    await fs.unlink(envPath);
    throw error;
  }
  return { envPath, setupPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = fileURLToPath(new URL("..", import.meta.url));
  try {
    const result = await writeAdminMfaSetup(directory);
    console.log(`Private QR setup page: ${result.setupPath}\nServer-only configuration: ${result.envPath}\nNo credentials were uploaded. Configure these server variables before deploying MFA.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
