import { prisma } from "../lib/prisma";
import { getJobDefinition } from "./registry";
import { JobBusyError, JobConfigError, ensureJobRows, rowSchedule, runJob } from "./runner";
import { computeNextRun, validateSchedule } from "./schedule";

// زمان‌بند داخل فرایند بک‌اند: هر دقیقه کارهای «سررسیدشده» را اجرا می‌کند. فقط وقتی SCHEDULER_ENABLED=true روشن می‌شود
// (پیش‌فرض خاموش، مثل TAX_TRANSPORT_ENABLED) — روی هر محیط جداگانه و آگاهانه روشن شود، چون کارها روی دیتابیسِ همان محیط اثر می‌گذارند.
// فرض: فقط یک نمونه‌ی بک‌اند زمان‌بند را اجرا می‌کند؛ قفل «یک اجرای RUNNING برای هر کار» (ایندکس یکتای جزئی) در برابر اجرای هم‌زمان محافظ است.

const TICK_MS = 60_000;
/** اجرایی که بیش از این RUNNING مانده، قطع‌شده فرض می‌شود */
const STALE_RUN_MS = 6 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let ticking = false;

export function isSchedulerEnabled(): boolean {
  return process.env.SCHEDULER_ENABLED === "true";
}

/** اجراهایی که با توقف سرور نیمه‌کاره مانده‌اند (RUNNING) به FAILED تبدیل می‌شوند تا قفل اجرا آزاد شود */
async function recoverStaleRuns(onlyOlderThanMs?: number) {
  const where: any = { status: "RUNNING" };
  if (onlyOlderThanMs) where.startedAt = { lt: new Date(Date.now() - onlyOlderThanMs) };
  const stale = await prisma.scheduledJobRun.findMany({ where, select: { id: true, jobId: true } });
  for (const r of stale) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.scheduledJobRun.update({ where: { id: r.id }, data: { status: "FAILED", finishedAt: new Date(), error: "اجرا با توقف سرور یا طولانی‌شدن بیش از حد قطع شد", summary: "قطع‌شده" } });
    // eslint-disable-next-line no-await-in-loop
    await prisma.scheduledJob.update({ where: { id: r.jobId }, data: { lastRunStatus: "FAILED" } });
  }
  if (stale.length > 0) console.warn(`[scheduler] ${stale.length} اجرای نیمه‌کاره به FAILED تبدیل شد`);
}

/** یک دور بررسی: کارهای سررسیدشده را اجرا می‌کند (زمان‌بند هر دقیقه همین را صدا می‌زند؛ برای تست هم export شده) */
export async function runDueJobs() {
  if (ticking) return;
  ticking = true;
  try {
    await recoverStaleRuns(STALE_RUN_MS);
    const now = new Date();
    const candidates = await prisma.scheduledJob.findMany({
      where: { mode: { not: "OFF" }, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
    });
    for (const job of candidates) {
      if (!getJobDefinition(job.key)) continue; // کاری که از کد حذف شده
      const spec = rowSchedule(job);
      if (validateSchedule(spec)) continue;
      if (!job.nextRunAt) {
        // فعال شده ولی هنوز موعدی ندارد: فقط موعد بعدی محاسبه می‌شود (اجرای فوری نمی‌کند)
        // eslint-disable-next-line no-await-in-loop
        await prisma.scheduledJob.update({ where: { id: job.id }, data: { nextRunAt: computeNextRun(spec, now) } });
        continue;
      }
      try {
        // سررسید گذشته (مثلاً کامپیوتر خاموش بوده): یک بار اجرا می‌شود و موعد بعدی از «حالا» محاسبه می‌شود، نه چندین اجرای عقب‌افتاده
        // eslint-disable-next-line no-await-in-loop
        const out = await runJob(job.key, { trigger: "SCHEDULE" });
        console.log(`[scheduler] ${job.key}: ${out.status} — ${out.summary}`);
      } catch (e: any) {
        if (e instanceof JobBusyError || e instanceof JobConfigError) {
          console.warn(`[scheduler] ${job.key}: ${e.message}`);
          // موعد بعدی را جلو ببریم تا هر دقیقه تکرار نشود
          // eslint-disable-next-line no-await-in-loop
          await prisma.scheduledJob.update({ where: { id: job.id }, data: { nextRunAt: computeNextRun(spec, new Date()) } });
        } else {
          console.error(`[scheduler] ${job.key}: خطای پیش‌بینی‌نشده`, e);
        }
      }
    }
  } catch (e) {
    console.error("[scheduler] خطا در بررسی کارها", e);
  } finally {
    ticking = false;
  }
}

export async function startScheduler(): Promise<void> {
  await ensureJobRows();
  if (!isSchedulerEnabled()) {
    console.log("[scheduler] خاموش است (SCHEDULER_ENABLED=true نیست)؛ کارها فقط به‌صورت دستی اجرا می‌شوند");
    return;
  }
  // فرایند تازه شروع شده؛ هر اجرای RUNNING از فرایند قبلی است
  await recoverStaleRuns();
  timer = setInterval(() => {
    void runDueJobs();
  }, TICK_MS);
  // فراخوانی اول با کمی تأخیر تا راه‌اندازی بک‌اند کامل شود
  setTimeout(() => void runDueJobs(), 5_000);
  console.log("[scheduler] روشن شد؛ هر یک دقیقه کارهای سررسیدشده بررسی می‌شوند");
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
