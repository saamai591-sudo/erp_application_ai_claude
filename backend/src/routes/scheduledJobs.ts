import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { JOBS, getJobDefinition } from "../jobs/registry";
import { beginRun, ensureJobRows, JobBusyError, JobConfigError, rowSchedule } from "../jobs/runner";
import { computeNextRun, maxGapDays, validateSchedule, ScheduleSpec } from "../jobs/schedule";
import { normalizeParams, paramWarnings, resolveParams, validateForLive } from "../jobs/params";
import { isSchedulerEnabled } from "../jobs/scheduler";
import { tehranDate } from "../jobs/time";
import type { JobDefinition } from "../jobs/types";

// «کارهای زمان‌بندی‌شده» (تنظیمات › عملیات): مدیریت زمان‌بندی/حالت/پارامترهای کارها، اجرای دستی و تاریخچه‌ی اجراها.
// خودِ کارها در کد تعریف می‌شوند (backend/src/jobs)؛ منطق اجرا: jobs/runner.ts، زمان‌بند: jobs/scheduler.ts.

const FORM = findFormPrefix("scheduled-jobs");
const router = Router();

const MODES = ["OFF", "DRY_RUN", "LIVE"] as const;

async function userNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((x): x is number => typeof x === "number")));
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
}

function serializeJob(def: JobDefinition, row: any, names: Map<number, string>) {
  const spec = rowSchedule(row);
  const { values } = normalizeParams(def.params, row.params);
  const today = tehranDate();
  return {
    key: def.key,
    title: def.title,
    description: def.description,
    supportsLive: def.supportsLive,
    paramDefs: def.params,
    mode: row.mode,
    schedule: { type: spec.type, intervalMinutes: spec.intervalMinutes ?? null, timeOfDay: spec.timeOfDay ?? null, weekdays: spec.weekdays ?? [] },
    params: values,
    /** بازه‌های نسبی با تاریخ‌های واقعیِ همین امروز (نمایش برای کاربر؛ هر اجرا دوباره محاسبه می‌شود) */
    resolvedParams: resolveParams(def.params, values, today),
    warnings: validateSchedule(spec) ? [] : paramWarnings(def.params, values, spec),
    maxGapDays: validateSchedule(spec) ? null : maxGapDays(spec),
    runAsUserId: row.runAsUserId,
    runAsUserDisplay: row.runAsUserId ? names.get(row.runAsUserId) ?? "" : "",
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    lastRunStatus: row.lastRunStatus,
    updatedAt: row.updatedAt,
  };
}

router.get("/scheduled-jobs/status", can(`${FORM}.view`), (_req, res) => {
  const now = new Date();
  res.json({ schedulerEnabled: isSchedulerEnabled(), serverTime: now, tehranToday: tehranDate(now) });
});

// فهرست سبک کاربران فعال برای انتخاب «کاربر اجراکننده» (بدون نیاز به مجوز فرم کاربران)
router.get("/scheduled-jobs/users", can(`${FORM}.edit`), async (_req, res) => {
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { id: "asc" } });
  res.json(users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() })));
});

router.get("/scheduled-jobs", can(`${FORM}.view`), async (_req, res) => {
  await ensureJobRows();
  const rows = await prisma.scheduledJob.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const names = await userNames(rows.map((r) => r.runAsUserId));
  res.json(JOBS.filter((d) => byKey.has(d.key)).map((d) => serializeJob(d, byKey.get(d.key), names)));
});

// تاریخچه‌ی اجراها (بدون ریز موارد)
router.get("/scheduled-jobs/:key/runs", can(`${FORM}.view`), async (req, res) => {
  const job = await prisma.scheduledJob.findUnique({ where: { key: req.params.key } });
  if (!job) return res.status(404).json({ error: "کار یافت نشد" });
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 200);
  const runs = await prisma.scheduledJobRun.findMany({
    where: { jobId: job.id },
    orderBy: { id: "desc" },
    take: limit,
    select: { id: true, trigger: true, dryRun: true, status: true, startedAt: true, finishedAt: true, startedById: true, runAsUserId: true, params: true, summary: true, counts: true, error: true },
  });
  const names = await userNames(runs.flatMap((r) => [r.startedById, r.runAsUserId]));
  res.json(runs.map((r) => ({ ...r, startedByDisplay: r.startedById ? names.get(r.startedById) ?? "" : "", runAsUserDisplay: r.runAsUserId ? names.get(r.runAsUserId) ?? "" : "" })));
});

// جزئیات یک اجرا (با ریز موارد)
router.get("/scheduled-jobs/runs/:id", can(`${FORM}.view`), async (req, res) => {
  const run = await prisma.scheduledJobRun.findUnique({ where: { id: Number(req.params.id) }, include: { job: { select: { key: true } } } });
  if (!run) return res.status(404).json({ error: "اجرا یافت نشد" });
  const def = getJobDefinition(run.job.key);
  const names = await userNames([run.startedById, run.runAsUserId]);
  res.json({
    ...run,
    jobKey: run.job.key,
    jobTitle: def?.title ?? run.job.key,
    /** برچسب‌ها و نوع پارامترها، برای نمایش خوانای params (مقدار واقعیِ همین اجرا) */
    paramDefs: def?.params ?? [],
    job: undefined,
    startedByDisplay: run.startedById ? names.get(run.startedById) ?? "" : "",
    runAsUserDisplay: run.runAsUserId ? names.get(run.runAsUserId) ?? "" : "",
  });
});

// جزئیات یک کار (شامل updatedAt برای کنترل ویرایش هم‌زمان)
router.get("/scheduled-jobs/:key", can(`${FORM}.view`), async (req, res) => {
  const def = getJobDefinition(req.params.key);
  if (!def) return res.status(404).json({ error: "کار یافت نشد" });
  await ensureJobRows();
  const row = await prisma.scheduledJob.findUnique({ where: { key: def.key } });
  if (!row) return res.status(404).json({ error: "تنظیمات کار یافت نشد" });
  res.json(serializeJob(def, row, await userNames([row.runAsUserId])));
});

router.put("/scheduled-jobs/:key", can(`${FORM}.edit`), async (req, res) => {
  try {
    const def = getJobDefinition(req.params.key);
    if (!def) return res.status(404).json({ error: "کار یافت نشد" });
    await ensureJobRows();
    const existing = await prisma.scheduledJob.findUnique({ where: { key: def.key } });
    if (!existing) return res.status(404).json({ error: "تنظیمات کار یافت نشد" });
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این کار");

    const body = req.body ?? {};
    const mode = body.mode;
    if (!MODES.includes(mode)) return res.status(400).json({ error: "حالت کار نامعتبر است" });
    if (mode === "LIVE" && !def.supportsLive) return res.status(400).json({ error: "این کار حالت «واقعی» ندارد؛ فقط خاموش یا آزمایشی ممکن است" });

    const s = body.schedule ?? {};
    const spec: ScheduleSpec = {
      type: s.type,
      intervalMinutes: s.type === "INTERVAL" ? Number(s.intervalMinutes) : null,
      timeOfDay: s.type === "DAILY" || s.type === "WEEKLY" ? String(s.timeOfDay ?? "") : null,
      weekdays: s.type === "WEEKLY" ? (Array.isArray(s.weekdays) ? s.weekdays.map(Number) : []) : [],
    };
    const scheduleError = validateSchedule(spec);
    if (scheduleError) return res.status(400).json({ error: scheduleError });

    const { values, errors: paramErrors } = normalizeParams(def.params, body.params);
    const errors = [...paramErrors, ...(mode === "LIVE" ? validateForLive(def.params, values) : [])];

    let runAsUserId: number | null = null;
    if (body.runAsUserId !== null && body.runAsUserId !== undefined && body.runAsUserId !== "") {
      runAsUserId = Number(body.runAsUserId);
      const user = await prisma.user.findUnique({ where: { id: runAsUserId }, select: { isActive: true } });
      if (!user) errors.push("کاربر اجراکننده یافت نشد");
      else if (!user.isActive) errors.push("کاربر اجراکننده غیرفعال است");
    }
    if (mode === "LIVE" && !runAsUserId) errors.push("برای حالت «واقعی»، کاربر اجراکننده را انتخاب کنید");
    if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

    const updated = await prisma.scheduledJob.update({
      where: { id: existing.id },
      data: {
        mode,
        scheduleType: spec.type,
        intervalMinutes: spec.intervalMinutes ?? null,
        timeOfDay: spec.timeOfDay ?? null,
        weekdays: spec.weekdays ?? [],
        params: values,
        runAsUserId,
        // هر تغییر تنظیمات، موعد بعدی را از «حالا» دوباره محاسبه می‌کند (فعال‌کردنِ دوباره، اجرای فوریِ عقب‌افتاده نمی‌سازد)
        nextRunAt: mode === "OFF" ? null : computeNextRun(spec, new Date()),
      },
    });
    res.json(serializeJob(def, updated, await userNames([updated.runAsUserId])));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره‌ی تنظیمات کار" });
  }
});

// اجرای دستی. اجرا در پس‌زمینه ادامه می‌یابد و runId برگردانده می‌شود؛ کلاینت وضعیت را با GET /scheduled-jobs/runs/:id پیگیری می‌کند.
router.post("/scheduled-jobs/:key/run", can(`${FORM}.run`), async (req: AuthedRequest, res) => {
  const def = getJobDefinition(req.params.key);
  if (!def) return res.status(404).json({ error: "کار یافت نشد" });
  const mode = req.body?.mode === "LIVE" ? "LIVE" : "DRY_RUN";
  try {
    const { runId, execute } = await beginRun(def.key, { trigger: "MANUAL", startedById: req.user?.id ?? null, mode });
    void execute().catch((e) => console.error(`[scheduled-jobs] اجرای دستی ${def.key}`, e));
    res.status(202).json({ runId });
  } catch (e: any) {
    if (e instanceof JobBusyError) return res.status(409).json({ error: e.message });
    if (e instanceof JobConfigError) return res.status(400).json({ error: e.message });
    res.status(400).json({ error: e.message || "خطا در شروع اجرا" });
  }
});

export default router;
