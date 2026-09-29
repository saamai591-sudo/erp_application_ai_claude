"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renumberJournalEntries = renumberJournalEntries;
const prisma_1 = require("../lib/prisma");
/**
 * شماره‌گذاری مجدد اسناد حسابداری — «تنها منبع حقیقت» این عملیات.
 * از دو مسیر صدا زده می‌شود و منطق آن در هیچ جای دیگری تکرار نشده است:
 *  ۱) عملیات «شماره‌گذاری مجدد» در منوی عملیات فهرست اسناد حسابداری (routes/journalEntries.ts)
 *  ۲) تایید اسناد (routes/documentConfirmation.ts) — درست قبل از تغییر وضعیت اسناد به «تایید»
 *
 * قاعده: همه‌ی اسناد دوره‌ی مالی با وضعیت «ثبت» (DRAFT) یا «بررسی» (REVIEW) بر اساس «تاریخ سند» و سپس «شماره روزانه»
 * مرتب می‌شوند (تساوی کامل با شناسه‌ی رکورد شکسته می‌شود تا نتیجه قطعی باشد) و شماره‌ی سند (number) آن‌ها از
 * «آخرین شماره‌ی اسناد تاییدشده‌ی همان دوره + ۱» به‌صورت پیوسته دوباره داده می‌شود. اسناد تاییدشده هرگز تغییر نمی‌کنند؛
 * شماره‌ی عطف (referenceNumber) و شماره‌ی روزانه شناسه‌ی ثابت سند هستند و دست نمی‌خورند.
 */
// قفل مشورتی Postgres (کلید اول ثابت، کلید دوم = شناسه‌ی دوره مالی): دو شماره‌گذاری مجدد هم‌زمان یک دوره را سریال می‌کند
const JOURNAL_RENUMBER_LOCK_KEY = 7100002;
async function run(db, fiscalPeriodId) {
    await db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${JOURNAL_RENUMBER_LOCK_KEY}, ${Number(fiscalPeriodId)})`);
    const [{ base }] = await db.$queryRawUnsafe(`SELECT COALESCE(MAX("number"), 0)::int AS base FROM "JournalEntry" WHERE "fiscalPeriodId" = $1 AND "status" = 'APPROVED'`, fiscalPeriodId);
    // مرحله‌ی اول: شماره‌ی موقت منفی (-id) تا در حین جابه‌جایی، قید یکتایی (دوره مالی، شماره) نقض نشود
    const count = await db.$executeRawUnsafe(`UPDATE "JournalEntry" SET "number" = -"id" WHERE "fiscalPeriodId" = $1 AND "status" IN ('DRAFT', 'REVIEW')`, fiscalPeriodId);
    if (count === 0)
        return { count: 0, firstNumber: null, lastNumber: null };
    // مرحله‌ی دوم: شماره‌ی نهایی = پایه + رتبه در ترتیب (تاریخ سند، شماره‌ی روزانه، شناسه)
    await db.$executeRawUnsafe(`UPDATE "JournalEntry" AS je SET "number" = $2::int + r.rn
       FROM (
         SELECT "id", ROW_NUMBER() OVER (ORDER BY "date", "dailyNumber", "id")::int AS rn
         FROM "JournalEntry"
         WHERE "fiscalPeriodId" = $1 AND "status" IN ('DRAFT', 'REVIEW')
       ) AS r
      WHERE je."id" = r."id"`, fiscalPeriodId, base);
    return { count, firstNumber: base + 1, lastNumber: base + count };
}
/**
 * اسناد «ثبت/بررسی» یک دوره‌ی مالی را شماره‌گذاری مجدد می‌کند.
 * @param tx اگر فراخوان خودش در یک تراکنش است (مثل تایید اسناد که شماره‌گذاری و تایید را اتمیک می‌خواهد) همان را بدهد؛ وگرنه تراکنش مستقل باز می‌شود.
 */
async function renumberJournalEntries(fiscalPeriodId, tx) {
    if (tx)
        return run(tx, fiscalPeriodId);
    return prisma_1.prisma.$transaction((t) => run(t, fiscalPeriodId), { timeout: 120000, maxWait: 20000 });
}
