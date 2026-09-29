import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

// «درباره‌ی سیستم» — نسخه‌ی سیستم و نسخه‌ی پایگاه داده برای دیالوگ About در نوار بالای برنامه.
//
// نسخه‌ی سیستم: فیلد version در backend/package.json (تنها منبع حقیقتِ سمت سرور؛ frontend/package.json هم با همان مقدار
// نگه داشته می‌شود — هر دو با scripts/release.mjs یک‌جا به‌روز می‌شوند).
// نسخه‌ی پایگاه داده: «نسخه‌ی اسکیما» = آخرین مایگریشنِ Prisma که روی همین دیتابیس با موفقیت اجرا شده
// (جدول _prisma_migrations). نام هر مایگریشن با یک زمان‌مهر ۱۴رقمی شروع می‌شود (مثلاً 20261011100000_…) که همان شماره‌ی نسخه‌ی
// اسکیماست. برای تشخیص «دیتابیس عقب است» با آخرین مایگریشنِ همراه همین نسخه‌ی برنامه (پوشه‌ی prisma/migrations) مقایسه می‌شود.
// همه‌ی مسیرها فقط نیاز به ورود به سیستم دارند (هر کاربری می‌تواند نسخه را ببیند).

const router = Router();

// backend/src/routes → backend (هم در tsx و هم در build شده‌ی dist/routes دو سطح بالاتر است)
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

function readVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, "package.json"), "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

function latestBundledMigration(): string | null {
  try {
    const names = fs
      .readdirSync(path.join(BACKEND_ROOT, "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    return names.length ? names[names.length - 1] : null;
  } catch {
    return null;
  }
}

/** «20261011100000_treasury_opening_system_generated» → { schemaVersion: "20261011100000", title: "treasury_opening_system_generated" } */
function splitMigrationName(name: string | null) {
  if (!name) return { schemaVersion: null, title: null };
  const i = name.indexOf("_");
  return i > 0 ? { schemaVersion: name.slice(0, i), title: name.slice(i + 1) } : { schemaVersion: name, title: null };
}

router.get("/about", async (_req, res) => {
  const bundled = latestBundledMigration();
  let applied: { migration_name: string }[] = [];
  let appliedCount = 0;
  let engine: string | null = null;
  try {
    applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1`;
    const cnt = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    appliedCount = Number(cnt[0]?.n ?? 0);
    const v = await prisma.$queryRaw<{ server_version: string }[]>`SHOW server_version`;
    engine = v[0]?.server_version ? `PostgreSQL ${v[0].server_version.split(" ")[0]}` : null;
  } catch {
    // دیتابیس بدون جدول مایگریشن (مثلاً با db push ساخته شده): نسخه‌ی اسکیما نامشخص
  }
  const current = applied[0]?.migration_name ?? null;
  const cur = splitMigrationName(current);
  res.json({
    version: readVersion(),
    database: {
      schemaVersion: cur.schemaVersion,
      migration: cur.title,
      appliedMigrations: appliedCount,
      engine,
      expectedSchemaVersion: splitMigrationName(bundled).schemaVersion,
      // آخرین مایگریشنِ همراه برنامه هنوز روی دیتابیس اجرا نشده = دیتابیس از برنامه عقب است
      upToDate: current !== null && bundled !== null ? current >= bundled : null,
    },
  });
});

export default router;
