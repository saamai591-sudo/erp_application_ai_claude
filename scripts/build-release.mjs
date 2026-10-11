#!/usr/bin/env node
// ساخت ایمیج‌های «تحویل» (backend بایت‌کد V8 + frontend استاتیک nginx)، ذخیره‌ی tar و checksum و استخراج source map‌ها.
//   node scripts/build-release.mjs [--out E:\backups] [--registry reg.greenbits.ir]
// نسخه از backend/package.json خوانده می‌شود (قبل از آن: node scripts/release.mjs … و کامیت/تگ).
// tar هر دو تگ را دارد: accounting-erp-<backend|frontend>:<نسخه> و :latest (لایه‌ها مشترک است؛ حجم اضافه نمی‌شود).
// source map‌ها در <out>\sourcemaps-<نسخه> می‌مانند و داخل ایمیج نیستند؛ فقط برای خواندن stack trace هنگام پشتیبانی.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const out = resolve(opt("--out", "E:\\backups"));
const registry = opt("--registry", "reg.greenbits.ir");
const version = JSON.parse(readFileSync(join(root, "backend", "package.json"), "utf8")).version;

function run(cmd, cmdArgs, cwd = root) {
  console.log(`\n$ ${cmd} ${cmdArgs.join(" ")}`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit", shell: false });
  if (r.status !== 0) {
    console.error(`\n✗ شکست: ${cmd} (کد ${r.status})`);
    process.exit(r.status ?? 1);
  }
}

const be = `${registry}/accounting-erp-backend`;
const fe = `${registry}/accounting-erp-frontend`;
mkdirSync(out, { recursive: true });

console.log(`ساخت نسخه‌ی ${version}`);
run("docker", ["build", "-f", "Dockerfile.release", "-t", `${be}:${version}`, "-t", `${be}:latest`, "."], join(root, "backend"));
run("docker", ["build", "-f", "Dockerfile.release", "-t", `${fe}:${version}`, "-t", `${fe}:latest`, "."], join(root, "frontend"));

const maps = join(out, `sourcemaps-${version}`);
run("docker", ["build", "-f", "Dockerfile.release", "--target", "maps", "--output", `type=local,dest=${maps}`, "."], join(root, "backend"));

const tar = join(out, `erp-${version}-images.tar`);
run("docker", ["save", "-o", tar, `${be}:${version}`, `${be}:latest`, `${fe}:${version}`, `${fe}:latest`]);

const hash = createHash("sha256");
await new Promise((res, rej) => {
  createReadStream(tar).on("data", (d) => hash.update(d)).on("end", res).on("error", rej);
});
const sha = hash.digest("hex");
console.log(`\n✓ ${tar}\n  حجم: ${(statSync(tar).size / 1048576).toFixed(0)} MB\n  sha256: ${sha}\n  شروع checksum: ${sha.slice(0, 16)}\n  source map‌ها: ${maps}`);
