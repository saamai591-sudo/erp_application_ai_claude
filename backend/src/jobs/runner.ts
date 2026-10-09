import { prisma } from "../lib/prisma";
import { runWithRequestContext, withoutFiscalPeriodScope } from "../lib/requestContext";
import { JOBS, getJobDefinition } from "./registry";
import { computeNextRun, ScheduleSpec, validateSchedule } from "./schedule";
import { defaultParamValue, normalizeParams, resolveParams, validateForLive } from "./params";
import { tehranDate } from "./time";
import type { JobContext, JobDefinition, JobItem } from "./types";

// اجرای یک کار زمان‌بندی‌شده: رکورد اجرا (با قفل اتمی «یک اجرای RUNNING برای هر کار») → اجرای تابع کار → ثبت نتیجه.
// هم زمان‌بند (scheduler.ts) و هم اجرای دستی (routes/scheduledJobs.ts) فقط از همین‌جا اجرا می‌کنند.

export class JobBusyError extends Error {}
export class JobConfigError extends Error {}

/** سقف تعداد ریز موارد ذخیره‌شده در یک اجرا (شمارش کل همیشه دقیق است) */
const MAX_STORED_ITEMS = 2000;
const MAX_MESSAGE_LENGTH = 500;

export interface RunCounts {
  done: number;
  wouldDo: number;
  skipped: number;
  failed: number;
}

export interface RunOutcome {
  runId: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  summary: string;
}

export function rowSchedule(row: { scheduleType: string; intervalMinutes: number | null; timeOfDay: string | null; weekdays: number[] }): ScheduleSpec {
  return { type: row.scheduleType as ScheduleSpec["type"], intervalMinutes: row.intervalMinutes, timeOfDay: row.timeOfDay, weekdays: row.weekdays };
}

/** برای هر کار ثبت‌شده در کد، اگر ردیف تنظیمات ندارد با پیش‌فرض‌های تعریف کار ساخته می‌شود (حالت: خاموش) */
export async function ensureJobRows(): Promise<void> {
  for (const def of JOBS) {
    // eslint-disable-next-line no-await-in-loop
    const existing = await prisma.scheduledJob.findUnique({ where: { key: def.key }, select: { id: true } });
    if (existing) continue;
    const params: Record<string, any> = {};
    for (const p of def.params) params[p.key] = defaultParamValue(p);
    const s = def.defaultSchedule;
    // eslint-disable-next-line no-await-in-loop
    await prisma.scheduledJob.create({
      data: {
        key: def.key,
        mode: "OFF",
        scheduleType: s.type,
        intervalMinutes: s.intervalMinutes ?? null,
        timeOfDay: s.timeOfDay ?? null,
        weekdays: s.weekdays ?? [],
        params,
      },
    });
  }
}

function defaultSummary(counts: RunCounts, dryRun: boolean): string {
  const parts: string[] = [];
  if (dryRun) {
    parts.push(`${counts.wouldDo} مورد انجام می‌شد`);
  } else {
    parts.push(`${counts.done} مورد انجام شد`);
  }
  if (counts.skipped) parts.push(`${counts.skipped} مورد رد شد`);
  if (counts.failed) parts.push(`${counts.failed} مورد خطا داد`);
  return (dryRun ? "آزمایشی: " : "") + parts.join("، ");
}

export interface BeginOptions {
  trigger: "SCHEDULE" | "MANUAL";
  /** کاربری که اجرای دستی را شروع کرده */
  startedById?: number | null;
  /** فقط برای اجرای دستی: حالت همین اجرا (پیش‌فرض آزمایشی) — برای اجرای زمان‌بندی‌شده حالت از تنظیمات کار می‌آید */
  mode?: "DRY_RUN" | "LIVE";
}

/**
 * اجرا را شروع می‌کند: تنظیمات را می‌خواند/اعتبارسنجی می‌کند و رکورد اجرا (RUNNING) را می‌سازد. اگر همان کار هم‌اکنون در حال اجراست
 * JobBusyError پرتاب می‌شود. execute() خودِ کار را اجرا و نتیجه را ثبت می‌کند و هرگز پرتاب نمی‌کند (خطا ⇒ وضعیت FAILED).
 */
export async function beginRun(key: string, opts: BeginOptions): Promise<{ runId: number; execute: () => Promise<RunOutcome> }> {
  const def = getJobDefinition(key);
  if (!def) throw new JobConfigError("کار یافت نشد");
  await ensureJobRows();
  const row = await prisma.scheduledJob.findUnique({ where: { key } });
  if (!row) throw new JobConfigError("تنظیمات کار یافت نشد");

  const mode = opts.trigger === "MANUAL" ? opts.mode ?? "DRY_RUN" : row.mode;
  if (mode === "OFF") throw new JobConfigError("این کار خاموش است");
  if (mode === "LIVE" && !def.supportsLive) throw new JobConfigError("این کار حالت «واقعی» ندارد؛ فقط اجرای آزمایشی ممکن است");
  const dryRun = mode !== "LIVE";

  const now = new Date();
  const today = tehranDate(now);
  const { values, errors: paramErrors } = normalizeParams(def.params, row.params);
  const configErrors = [...paramErrors, ...(dryRun ? [] : validateForLive(def.params, values))];
  if (!dryRun && !row.runAsUserId) configErrors.push("برای حالت «واقعی»، کاربر اجراکننده باید انتخاب شده باشد");
  const resolved = resolveParams(def.params, values, today);

  let run;
  try {
    run = await prisma.scheduledJobRun.create({
      data: {
        jobId: row.id,
        trigger: opts.trigger,
        dryRun,
        startedById: opts.startedById ?? null,
        runAsUserId: row.runAsUserId,
        params: resolved,
        // تنظیمات نامعتبر: اجرا ثبت می‌شود ولی بلافاصله FAILED است تا در تاریخچه دیده شود (اجرای دستی خطا می‌گیرد)
        ...(configErrors.length > 0 && opts.trigger === "SCHEDULE" ? { status: "FAILED" as const, finishedAt: now, error: configErrors.join(" | ") } : {}),
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") throw new JobBusyError("این کار هم‌اکنون در حال اجراست");
    throw e;
  }

  if (configErrors.length > 0) {
    if (opts.trigger === "MANUAL") {
      await prisma.scheduledJobRun.delete({ where: { id: run.id } });
      throw new JobConfigError(configErrors.join("\n"));
    }
    await finishJobRow(row.id, now, "FAILED", opts.trigger);
    return { runId: run.id, execute: async () => ({ runId: run.id, status: "FAILED" as const, summary: configErrors.join(" | ") }) };
  }

  const execute = async (): Promise<RunOutcome> => {
    const items: (JobItem & { label?: string })[] = [];
    const counts: RunCounts = { done: 0, wouldDo: 0, skipped: 0, failed: 0 };
    let summaryText: string | undefined;
    let error: string | undefined;
    const ctx: JobContext = {
      jobKey: key,
      dryRun,
      trigger: opts.trigger,
      userId: row.runAsUserId,
      now,
      today,
      params: resolved,
      item(i) {
        if (i.result === "DONE") counts.done += 1;
        else if (i.result === "WOULD_DO") counts.wouldDo += 1;
        else if (i.result === "SKIPPED") counts.skipped += 1;
        else counts.failed += 1;
        if (items.length < MAX_STORED_ITEMS) items.push({ ...i, message: i.message ? String(i.message).slice(0, MAX_MESSAGE_LENGTH) : undefined });
      },
      summary(text) {
        summaryText = text;
      },
      withFiscalPeriod: async (fiscalPeriodId, fn) => await runWithRequestContext({ fiscalPeriodId }, fn),
      withoutFiscalScope: (fn) => withoutFiscalPeriodScope(fn),
    };
    try {
      // زمینه‌ی درخواست خالی: «دوره مالی» از درخواست‌کننده‌ی دستی به کار نشت نکند (اجرای دستی و زمان‌بندی‌شده رفتار یکسان داشته باشند)
      await runWithRequestContext({}, () => def.run(ctx));
    } catch (e: any) {
      error = e?.message ? String(e.message) : String(e);
    }
    const status: RunOutcome["status"] = error ? "FAILED" : counts.failed > 0 ? "PARTIAL" : "SUCCESS";
    const summary = summaryText ?? (error ? `خطا: ${error}` : defaultSummary(counts, dryRun));
    const finishedAt = new Date();
    await prisma.scheduledJobRun.update({
      where: { id: run.id },
      data: { status, finishedAt, summary, counts: counts as any, items: items as any, error: error ?? null },
    });
    await finishJobRow(row.id, now, status, opts.trigger);
    return { runId: run.id, status, summary };
  };

  return { runId: run.id, execute };
}

/** آخرین اجرا/وضعیت را روی ردیف تنظیمات می‌نویسد؛ بعد از اجرای زمان‌بندی‌شده، زمان اجرای بعدی از تنظیمات «فعلی» محاسبه می‌شود */
async function finishJobRow(jobId: number, startedAt: Date, status: RunOutcome["status"], trigger: "SCHEDULE" | "MANUAL") {
  const current = await prisma.scheduledJob.findUnique({ where: { id: jobId } });
  if (!current) return;
  const data: Record<string, any> = { lastRunAt: startedAt, lastRunStatus: status };
  if (trigger === "SCHEDULE") {
    const spec = rowSchedule(current);
    data.nextRunAt = current.mode !== "OFF" && !validateSchedule(spec) ? computeNextRun(spec, new Date()) : null;
  }
  await prisma.scheduledJob.update({ where: { id: jobId }, data });
}

/** یک کار را کامل اجرا می‌کند و نتیجه را برمی‌گرداند (برای زمان‌بند) */
export async function runJob(key: string, opts: BeginOptions): Promise<RunOutcome> {
  const { execute } = await beginRun(key, opts);
  return execute();
}

export type { JobDefinition };
