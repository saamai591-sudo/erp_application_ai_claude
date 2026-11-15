#!/usr/bin/env node
// کلید امضای «نسخه‌های قابل نصب» (جدا از کلید لایسنس).
//   node scripts/release-sign.mjs keygen [--out <فایل کلید خصوصی>]   یک بار؛ کلید عمومی را چاپ می‌کند (باید در بک‌اند/updater گذاشته شود)
//   node scripts/release-sign.mjs pubkey [--key <فایل>]              کلید عمومی را از فایل کلید خصوصی می‌خواند
// کلید خصوصی با گذرواژه (scrypt + AES-256-GCM) رمز می‌شود و هرگز نباید داخل مخزن یا ایمیج برود.
// فایل ماژول: signText(text) را build-release.mjs صدا می‌زند.
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, scryptSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

export const DEFAULT_KEY_FILE = join(homedir(), ".erp-release", "release-key.json");

export function askHidden(question) {
  return new Promise((res) => {
    if (process.env.ERP_RELEASE_KEY_PASSPHRASE) return res(process.env.ERP_RELEASE_KEY_PASSPHRASE);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const orig = rl._writeToOutput;
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) orig.call(rl, s);
    };
    rl.question(question, (a) => {
      rl.close();
      process.stdout.write("\n");
      res(a);
    });
  });
}

function encrypt(pem, pass) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(pass, salt, 32);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(pem, "utf8"), c.final()]);
  return { v: 1, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}

function decrypt(box, pass) {
  const key = scryptSync(pass, Buffer.from(box.salt, "base64"), 32);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(box.iv, "base64"));
  d.setAuthTag(Buffer.from(box.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(box.data, "base64")), d.final()]).toString("utf8");
}

export const publicKeyB64 = (privateKey) => createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64");

export async function loadPrivateKey(file = process.env.ERP_RELEASE_KEY_FILE || DEFAULT_KEY_FILE) {
  if (!existsSync(file)) throw new Error(`Signing key file not found: ${file}\nRun "node scripts/release-sign.mjs keygen" once.`);
  const box = JSON.parse(readFileSync(file, "utf8"));
  const pass = await askHidden("Release signing key password: ");
  try {
    return createPrivateKey(decrypt(box, pass));
  } catch {
    throw new Error("Wrong signing key password");
  }
}

/** امضای Ed25519 روی «همان رشته‌ی متنی» (base64) */
export const signText = (privateKey, text) => sign(null, Buffer.from(text, "utf8"), privateKey).toString("base64");

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (n, d) => {
    const i = rest.indexOf(n);
    return i >= 0 && rest[i + 1] ? rest[i + 1] : d;
  };
  const file = resolve(opt(cmd === "keygen" ? "--out" : "--key", DEFAULT_KEY_FILE));
  if (cmd === "keygen") {
    if (existsSync(file)) {
      console.error(`✗ ${file} already exists; nothing was written so the previous key is not lost.`);
      process.exit(1);
    }
    const pass = await askHidden("New password for the signing key: ");
    if (pass.length < 8) {
      console.error("✗ Password must be at least 8 characters");
      process.exit(1);
    }
    const { privateKey } = generateKeyPairSync("ed25519");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(encrypt(privateKey.export({ type: "pkcs8", format: "pem" }).toString(), pass)), { mode: 0o600 });
    console.log(`✓ Encrypted private key: ${file}\n  (keep a safe backup; if it is lost, installable releases can no longer be signed)\n\nPublic key (for RELEASE_PUBLIC_KEY_B64):\n${publicKeyB64(privateKey)}`);
  } else if (cmd === "pubkey") {
    console.log(publicKeyB64(await loadPrivateKey(file)));
  } else {
    console.log("Usage: node scripts/release-sign.mjs keygen|pubkey");
  }
}
