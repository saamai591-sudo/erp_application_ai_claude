#!/usr/bin/env node
// مدیریت نسخه‌ی سیستم — تنها راه درست عوض‌کردن شماره‌ی نسخه.
//
//   node scripts/release.mjs patch|minor|major     نسخه‌ی بعدی را حساب می‌کند
//   node scripts/release.mjs 1.4.0                 نسخه‌ی صریح
//   node scripts/release.mjs --check               فقط بررسی هم‌خوانی (بدون تغییر)
//
// نسخه‌ی سیستم (semver: major.minor.patch) در چهار فایل نگه داشته می‌شود و این اسکریپت هر چهار را با هم تغییر می‌دهد تا هیچ‌وقت
// از هم جدا نشوند:  backend/package.json · backend/package-lock.json · frontend/package.json · frontend/package-lock.json
// (backend/package.json منبع اصلی است: دیالوگ «درباره» نسخه را از GET /api/about می‌خواند، که همین را برمی‌گرداند.)
// در CHANGELOG.md همه‌ی تغییرات بعد از آخرین انتشار زیر «[Unreleased]» نوشته می‌شوند؛ هنگام انتشار، آن بخش با نسخه و تاریخ نام‌گذاری
// می‌شود و یک «[Unreleased]» خالی بالای آن ساخته می‌شود. اگر Unreleased خالی باشد، انتشار انجام نمی‌شود (--allow-empty برای استثنا).
//
// قاعده‌ی انتخاب نسخه: patch = فقط رفع خطا · minor = قابلیت جدید سازگار با قبل · major = تغییر ناسازگار / مهاجرت دستی لازم.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = {
  backendPkg: "backend/package.json",
  backendLock: "backend/package-lock.json",
  frontendPkg: "frontend/package.json",
  frontendLock: "frontend/package-lock.json",
};
const CHANGELOG = "CHANGELOG.md";
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

function versionsIn() {
  const pkgVersion = (rel) => JSON.parse(read(rel)).version;
  const lockVersions = (rel) => {
    const j = JSON.parse(read(rel));
    return [j.version, j.packages?.[""]?.version];
  };
  return {
    [FILES.backendPkg]: pkgVersion(FILES.backendPkg),
    [FILES.frontendPkg]: pkgVersion(FILES.frontendPkg),
    [`${FILES.backendLock} (top)`]: lockVersions(FILES.backendLock)[0],
    [`${FILES.backendLock} (packages[""])`]: lockVersions(FILES.backendLock)[1],
    [`${FILES.frontendLock} (top)`]: lockVersions(FILES.frontendLock)[0],
    [`${FILES.frontendLock} (packages[""])`]: lockVersions(FILES.frontendLock)[1],
  };
}

function currentVersion() {
  const v = versionsIn();
  const distinct = new Set(Object.values(v));
  if (distinct.size !== 1) {
    console.error("✗ Versions do not match:");
    for (const [k, val] of Object.entries(v)) console.error(`    ${k}: ${val}`);
    process.exit(1);
  }
  return [...distinct][0];
}

function changelogState(version) {
  const text = read(CHANGELOG);
  const hasHeading = new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(text);
  const m = /^## \[Unreleased\]\s*\n([\s\S]*?)(?=^## \[)/m.exec(text);
  const unreleasedBody = m ? m[1].trim() : null;
  return { text, hasHeading, unreleasedBody };
}

function check() {
  const version = currentVersion();
  if (!SEMVER.test(version)) fail(`Version "${version}" is not valid semver (x.y.z)`);
  const { hasHeading, unreleasedBody } = changelogState(version);
  if (!hasHeading) fail(`CHANGELOG.md has no section for version ${version} (## [${version}])`);
  if (unreleasedBody === null) fail("CHANGELOG.md has no \"## [Unreleased]\" section");
  console.log(`✓ Version ${version} is the same in all four files and is listed in CHANGELOG.md.`);
  if (unreleasedBody) console.log("  Note: there are unreleased changes under [Unreleased]; they get versioned by the next release.");
}

function bump(current, arg) {
  if (SEMVER.test(arg)) return arg;
  const [maj, min, pat] = current.split(".").map(Number);
  if (arg === "major") return `${maj + 1}.0.0`;
  if (arg === "minor") return `${maj}.${min + 1}.0`;
  if (arg === "patch") return `${maj}.${min}.${pat + 1}`;
  return fail(`Invalid argument "${arg}" (patch | minor | major | x.y.z | --check)`);
}

// فقط مقدار version را جایگزین می‌کند، بدون بازنویسی/فرمت‌دهی دوباره‌ی کل فایل
function replaceVersion(rel, oldV, newV, occurrences) {
  let n = 0;
  const out = read(rel).replace(new RegExp(`("version":\\s*")${oldV.replace(/\./g, "\\.")}(")`, "g"), (m, a, b) => (++n <= occurrences ? `${a}${newV}${b}` : m));
  if (n < occurrences) fail(`${rel}: version value not found`);
  write(rel, out);
}

function release(arg, opts) {
  const current = currentVersion();
  const next = bump(current, arg);
  if (next === current) fail(`Version ${next} is already the current version`);
  const { text, unreleasedBody } = changelogState(current);
  if (unreleasedBody === null) fail("CHANGELOG.md بخش «## [Unreleased]» ندارد");
  if (!unreleasedBody && !opts.allowEmpty) fail("The [Unreleased] section of CHANGELOG.md is empty; write this release's changes first (or use --allow-empty)");

  replaceVersion(FILES.backendPkg, current, next, 1);
  replaceVersion(FILES.frontendPkg, current, next, 1);
  replaceVersion(FILES.backendLock, current, next, 2);
  replaceVersion(FILES.frontendLock, current, next, 2);

  const date = opts.date || new Date().toISOString().slice(0, 10);
  const updated = text.replace(/^## \[Unreleased\]\s*\n/m, `## [Unreleased]\n\n## [${next}] - ${date}\n`);
  write(CHANGELOG, updated);

  console.log(`✓ Version changed from ${current} to ${next} (four files + CHANGELOG.md).`);
  console.log("\nNext steps:");
  console.log(`  git add -A && git commit -m "Release v${next}"`);
  console.log(`  git tag v${next} && git push origin main --tags`);
  console.log(`  Build images: node scripts/build-release.mjs --registry <registry> --push`);
}

const args = process.argv.slice(2);
const flags = { allowEmpty: args.includes("--allow-empty") };
const dateArg = args.find((a) => a.startsWith("--date="));
if (dateArg) flags.date = dateArg.slice(7);
const positional = args.filter((a) => !a.startsWith("--"));

if (args.includes("--check")) check();
else if (positional.length === 1) release(positional[0], flags);
else fail("Usage: node scripts/release.mjs <patch|minor|major|x.y.z> [--date=YYYY-MM-DD] [--allow-empty]   or   --check");
