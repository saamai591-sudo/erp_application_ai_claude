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
const registry = opt("--registry", process.env.ERP_REGISTRY || "reg.greenbits.ir");
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

const up = `${registry}/accounting-erp-updater`;
run("docker", ["build", "-t", `${up}:${version}`, "-t", `${up}:latest`, "."], join(root, "updater"));

const maps = join(out, `sourcemaps-${version}`);
run("docker", ["build", "-f", "Dockerfile.release", "--target", "maps", "--output", `type=local,dest=${maps}`, "."], join(root, "backend"));

if (!args.includes("--no-tar")) {
const tar = join(out, `erp-${version}-images.tar`);
run("docker", ["save", "-o", tar, `${be}:${version}`, `${be}:latest`, `${fe}:${version}`, `${fe}:latest`, `${up}:${version}`, `${up}:latest`]);

const hash = createHash("sha256");
await new Promise((res, rej) => {
  createReadStream(tar).on("data", (d) => hash.update(d)).on("end", res).on("error", rej);
});
const sha = hash.digest("hex");
console.log(`\n✓ ${tar}\n  حجم: ${(statSync(tar).size / 1048576).toFixed(0)} MB\n  sha256: ${sha}\n  شروع checksum: ${sha.slice(0, 16)}\n  source map‌ها: ${maps}`);

}

// ───────────── انتشار در ریجستری + manifest امضاشده (فقط با --push) ─────────────
//   node scripts/build-release.mjs --push [--min-from 1.40.0] [--manual-note "..."] [--no-tar]
// 1) ایمیج‌های backend/frontend با تگ نسخه push می‌شوند (تگ :latest عمداً push نمی‌شود؛ نصب‌ها فقط با نسخه‌ی مشخص بالا می‌آیند)
// 2) manifest (نسخه، digest ایمیج‌ها، توضیح تغییرات، compose این نسخه، حداقل نسخه‌ی مبدأ) ساخته و با کلید امضای نسخه امضا می‌شود
// 3) یک ایمیج خالی accounting-erp-release:<نسخه> فقط با LABEL‌های manifest و امضا push می‌شود؛ فهرست نسخه‌ها = tags/list همین ریپازیتوری
//    و خواندن manifest با HTTP ساده‌ی ریجستری ممکن است (نیازی به docker pull نیست).
if (args.includes("--push")) {
  const { loadPrivateKey, signText } = await import("./release-sign.mjs");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");

  const digestOf = (image) => {
    const r = spawnSync("docker", ["inspect", "--format", "{{json .RepoDigests}}", image], { encoding: "utf8" });
    const list = JSON.parse(r.stdout || "[]").filter((d) => d.startsWith(image.slice(0, image.lastIndexOf(":")) + "@"));
    if (!list.length) throw new Error(`digest برای ${image} پیدا نشد (push موفق نبود؟)`);
    return list[0].split("@")[1];
  };

  const key = await loadPrivateKey(); // قبل از هر push گذرواژه را بپرسد تا وسط کار شکست نخورد

  run("docker", ["push", `${be}:${version}`]);
  run("docker", ["push", `${fe}:${version}`]);
  run("docker", ["push", `${up}:${version}`]);

  const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");
  const sec = changelog.split(/^## /m).find((s) => s.startsWith(`[${version}]`));
  const manifest = {
    format: "ERP-RELEASE",
    version,
    releasedAt: new Date().toISOString(),
    minFromVersion: opt("--min-from", null),
    manualNote: opt("--manual-note", null),
    images: {
      backend: { repo: be, tag: version, digest: digestOf(`${be}:${version}`) },
      frontend: { repo: fe, tag: version, digest: digestOf(`${fe}:${version}`) },
      updater: { repo: up, tag: version, digest: digestOf(`${up}:${version}`) },
    },
    changelog: sec ? sec.replace(/^[^\n]*\n/, "").trim() : "",
    compose: readFileSync(join(root, "docker-compose.prod.yml"), "utf8").replace(/\r\n/g, "\n"),
  };
  const payload = JSON.stringify(manifest);
  const signature = signText(key, payload);

  const dir = mkdtempSync(join(tmpdir(), "erp-release-"));
  writeFileSync(
    join(dir, "Dockerfile"),
    `FROM scratch\nLABEL erp.release.version="${version}"\nLABEL erp.release.manifest="${Buffer.from(payload).toString("base64")}"\nLABEL erp.release.signature="${signature}"\n`
  );
  const rel = `${registry}/accounting-erp-release`;
  run("docker", ["build", "--provenance=false", "--sbom=false", "-t", `${rel}:${version}`, dir]);
  run("docker", ["push", `${rel}:${version}`]);
  console.log(`\n✓ نسخه‌ی ${version} در ${registry} منتشر شد (manifest امضاشده: ${rel}:${version})`);
}
