import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import lockfile from "proper-lockfile";

export const adminAuthBranch = "rowk-admin-auth";
export function createAdminAuthStore({ key, namespace, hosted, env = process.env, filename, request = fetch }) {
  if (!/^[a-f0-9]{64}$/.test(namespace) || !/^[a-f0-9]{64}$/.test(key)) throw new Error("Invalid admin security storage configuration.");
  const statePath = `data/admin-auth/${namespace}.json`;
  const localStatePath = filename || new URL(`../.admin-security/${namespace}.json`, import.meta.url);
  const encryptionKey = Buffer.from(key, "hex");
  function encode(state) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
    return JSON.stringify({ version: 1, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("base64") });
  }
  function decode(value) {
    if (!value) return null;
    const envelope = JSON.parse(value);
    if (envelope.version !== 1 || !/^[a-f0-9]{24}$/.test(envelope.iv) || !/^[a-f0-9]{32}$/.test(envelope.tag)) {
      throw new Error("Invalid admin security state.");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(envelope.iv, "hex"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  }
  async function localUpdate(mutate) {
    const target = localStatePath instanceof URL ? fileURLToPath(localStatePath) : path.resolve(localStatePath);
    const directory = path.dirname(target);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(target, "", { flag: "wx", mode: 0o600 }).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
    const release = await lockfile.lock(target, { realpath: false, retries: { retries: 20, minTimeout: 10, maxTimeout: 100 } });
    try {
      const change = mutate(decode(await fs.readFile(target, "utf8")));
      if (change.changed !== false) {
        const temporary = `${target}.${crypto.randomUUID()}.tmp`;
        try {
          await fs.writeFile(temporary, encode(change.state), { mode: 0o600, flag: "wx" });
          await fs.rename(temporary, target);
        } finally {
          await fs.unlink(temporary).catch(() => {});
        }
      }
      return change.result;
    } finally {
      await release();
    }
  }
  async function githubUpdate(mutate) {
    const token = (env.GITHUB_TOKEN || env.ROWK_GITHUB_TOKEN || "").trim();
    if (!token) throw new Error("GitHub credentials are required for hosted admin security.");
    const repo = (env.GITHUB_REPOSITORY || env.ROWK_GITHUB_REPOSITORY || "annodu/row-k").trim();
    const sourceBranch = (env.GITHUB_BRANCH || env.ROWK_GITHUB_BRANCH || "main").trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || sourceBranch === adminAuthBranch) throw new Error("Invalid admin security repository.");
    const base = `https://api.github.com/repos/${repo}`;
    const url = `${base}/contents/${statePath}`;
    const deadline = AbortSignal.timeout(20_000);
    const send = (endpoint, options = {}) => request(endpoint, {
      ...options,
      signal: deadline,
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await send(`${url}?ref=${adminAuthBranch}`);
      let file = null;
      if (current.status === 404) {
        const branch = await send(`${base}/git/ref/heads/${adminAuthBranch}`);
        if (branch.status === 404) {
          const source = await send(`${base}/git/ref/heads/${encodeURIComponent(sourceBranch)}`);
          if (!source.ok) throw new Error("Could not initialize admin security storage.");
          const sha = (await source.json()).object?.sha;
          if (!sha) throw new Error("Could not initialize admin security storage.");
          const created = await send(`${base}/git/refs`, {
            method: "POST", body: JSON.stringify({ ref: `refs/heads/${adminAuthBranch}`, sha }),
          });
          if (!created.ok && created.status !== 422) throw new Error("Could not initialize admin security storage.");
          continue;
        }
        if (!branch.ok) throw new Error("Could not read admin security storage.");
      } else {
        if (!current.ok) throw new Error("Could not read admin security storage.");
        file = await current.json();
        if (!file.sha || !file.content || file.encoding !== "base64") throw new Error("Invalid admin security file.");
      }
      const state = file ? decode(Buffer.from(file.content, "base64").toString("utf8")) : null;
      const change = mutate(state);
      if (change.changed === false) return change.result;
      // GitHub's blob SHA is a compare-and-swap guard across Vercel instances.
      const saved = await send(url, {
        method: "PUT",
        body: JSON.stringify({
          branch: adminAuthBranch, message: "Update encrypted admin security state [skip ci]",
          content: Buffer.from(encode(change.state)).toString("base64"),
          ...(file ? { sha: file.sha } : {}),
        }),
      });
      if (saved.ok) return change.result;
      if (![409, 422].includes(saved.status)) throw new Error("Could not save admin security storage.");
    }
    throw new Error("Admin security storage is busy.");
  }
  return { update: hosted ? githubUpdate : localUpdate };
}
