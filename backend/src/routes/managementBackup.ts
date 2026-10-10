import fs from "fs";
import { Router } from "express";
import { requireManagement } from "./management";
import {
  audit,
  backupFilePath,
  BackupError,
  getBackupState,
  getPolicy,
  isBackupRunning,
  PolicyInput,
  runBackup,
  savePolicy,
  testRestore,
} from "../services/backupService";
import { prisma } from "../lib/prisma";

// پشتیبان‌گیری خودکار — فقط از «مدیریت» (/management) و فقط با نشست مدیریت (کلمه‌ی عبور لایسنس)؛ کاربران ERP و نقش‌هایشان هیچ دسترسی ندارند.
// قبل از requireAuth و دروازه‌ی لایسنس ثبت می‌شود (نگاه کنید به index.ts) تا انقضای لایسنس جلوی دیدن/دانلود پشتیبان را نگیرد.

const router = Router();
router.use("/management/backup", requireManagement);

function ipOf(req: any): string | null {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || null;
}

function policyJson(p: Awaited<ReturnType<typeof getPolicy>>) {
  return {
    enabled: p.enabled,
    frequency: p.frequency,
    intervalHours: p.intervalHours,
    timeOfDay: p.timeOfDay,
    weekdays: p.weekdays,
    keepRecent: p.keepRecent,
    keepMonthly: p.keepMonthly,
    nextRunAt: p.nextRunAt ? p.nextRunAt.toISOString() : null,
    externalDestination: p.externalDestination ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

function runJson(r: any) {
  return {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    fileName: r.fileName,
    sizeBytes: r.sizeBytes === null || r.sizeBytes === undefined ? null : Number(r.sizeBytes),
    appVersion: r.appVersion,
    errorMessage: r.errorMessage,
    fileDeleted: r.fileDeleted,
    testedAt: r.testedAt ? r.testedAt.toISOString() : null,
    testOk: r.testOk,
    testMessage: r.testMessage,
  };
}

router.get("/management/backup", async (_req, res) => {
  try {
    const [policy, state, runs] = await Promise.all([
      getPolicy(),
      getBackupState(),
      prisma.backupRun.findMany({ orderBy: { startedAt: "desc" }, take: 50 }),
    ]);
    const logs = await prisma.backupAuditLog.findMany({ orderBy: { at: "desc" }, take: 30 });
    res.json({
      policy: policyJson(policy),
      state,
      running: isBackupRunning(),
      runs: runs.map(runJson),
      audit: logs.map((l) => ({ id: l.id, at: l.at.toISOString(), action: l.action, detail: l.detail, ip: l.ip })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در خواندن وضعیت پشتیبان‌گیری" });
  }
});

router.put("/management/backup/policy", async (req, res) => {
  try {
    const b = req.body ?? {};
    const input: PolicyInput = {
      enabled: !!b.enabled,
      frequency: b.frequency,
      intervalHours: Number(b.intervalHours),
      timeOfDay: String(b.timeOfDay ?? ""),
      weekdays: Array.isArray(b.weekdays) ? b.weekdays.map(Number) : [],
      keepRecent: Number(b.keepRecent),
      keepMonthly: Number(b.keepMonthly ?? 0),
    };
    const before = await getPolicy();
    const saved = await savePolicy(input);
    const describe = (p: any) =>
      `${p.enabled ? "روشن" : "خاموش"}، ${p.frequency === "INTERVAL" ? `هر ${p.intervalHours} ساعت` : p.frequency === "DAILY" ? `روزانه ${p.timeOfDay}` : `هفتگی ${p.timeOfDay} روزها:${(p.weekdays || []).join(",")}`}، نگه‌داری ${p.keepRecent} اخیر + ${p.keepMonthly} ماهانه`;
    await audit("POLICY_UPDATED", `${describe(before)} ← ${describe(saved)}`, ipOf(req));
    res.json({ policy: policyJson(saved) });
  } catch (e: any) {
    res.status(e instanceof BackupError ? 400 : 500).json({ error: e.message || "خطا در ذخیره‌ی سیاست" });
  }
});

// اجرای دستی: فوراً 202 برمی‌گرداند و در پس‌زمینه ادامه می‌دهد (صفحه با GET /management/backup وضعیت را می‌خواند)
router.post("/management/backup/run", async (req, res) => {
  if (isBackupRunning()) return res.status(409).json({ error: "یک پشتیبان‌گیری دیگر در حال اجراست" });
  // runBackup پرچم «در حال اجرا» را هم‌زمان (قبل از اولین await) برمی‌دارد؛ پس درخواست هم‌زمان دوم 409 می‌گیرد
  const started = runBackup("MANUAL");
  started.catch((e) => console.error("[backup] اجرای دستی", e));
  await audit("RUN_MANUAL", undefined, ipOf(req));
  res.status(202).json({ started: true });
});

router.get("/management/backup/runs/:id/download", async (req, res) => {
  try {
    const row = await prisma.backupRun.findUnique({ where: { id: Number(req.params.id) } });
    if (!row || row.status !== "SUCCESS" || !row.fileName || row.fileDeleted) return res.status(404).json({ error: "فایل پشتیبان در دسترس نیست" });
    const file = backupFilePath(row.fileName);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "فایل پشتیبان روی دیسک پیدا نشد" });
    await audit("DOWNLOAD", row.fileName, ipOf(req));
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${row.fileName}"`);
    res.setHeader("Content-Length", String(fs.statSync(file).size));
    fs.createReadStream(file).pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در دانلود" });
  }
});

router.post("/management/backup/runs/:id/test-restore", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await audit("TEST_RESTORE", `ردیف ${id}`, ipOf(req));
    res.json(await testRestore(id));
  } catch (e: any) {
    res.status(e instanceof BackupError ? 400 : 500).json({ error: e.message || "خطا در تست بازگردانی" });
  }
});

export default router;
