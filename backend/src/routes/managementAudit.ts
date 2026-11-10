import { Router } from "express";
import { requireManagement } from "./management";
import { AuditError, AUDITED_MODELS, getAuditConfig, getAuditSetting, getAuditUsage, latestAuditEvents, maintainAudit, saveAuditSetting } from "../services/auditService";

// «لاگ تغییرات» — فقط از «مدیریت» (/management) و فقط با نشست مدیریت. قبل از requireAuth و دروازه‌ی لایسنس ثبت می‌شود (index.ts) تا انقضای لایسنس دیدنش را نبندد.
// قواعد (لایسنس × تنظیم، سقف‌ها، partition، پاک‌سازی) در services/auditService.ts است.

const router = Router();
router.use("/management/audit", requireManagement);

const ipOf = (req: any): string | null => (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || "").replace(/^::ffff:/, "") || null;

async function stateJson() {
  const [cfg, setting] = await Promise.all([getAuditConfig(), getAuditSetting()]);
  let usage = null as Awaited<ReturnType<typeof getAuditUsage>> | null;
  let events: Awaited<ReturnType<typeof latestAuditEvents>> = [];
  if (cfg.licensed) {
    try {
      usage = await getAuditUsage();
      events = await latestAuditEvents(50);
    } catch {
      // schema لاگ هنوز ساخته نشده (قبل از اولین نگهداری)؛ وضعیت خالی نشان داده می‌شود
    }
  }
  return {
    licensed: cfg.licensed,
    license: { level: cfg.licenseLevel, maxRetentionDays: cfg.maxRetentionDays, maxStorageMB: cfg.maxStorageMB },
    setting: { enabled: setting.enabled, level: setting.level, retentionDays: setting.retentionDays, lastMaintenanceAt: setting.lastMaintenanceAt ? setting.lastMaintenanceAt.toISOString() : null, lastMaintenanceMessage: setting.lastMaintenanceMessage },
    effective: { active: cfg.active, level: cfg.level, retentionDays: cfg.retentionDays },
    usage,
    events,
    models: Object.values(AUDITED_MODELS),
  };
}

router.get("/management/audit", async (_req, res) => {
  try {
    res.json(await stateJson());
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در خواندن وضعیت لاگ تغییرات" });
  }
});

router.put("/management/audit/setting", async (req, res) => {
  try {
    const b = req.body ?? {};
    await saveAuditSetting({ enabled: !!b.enabled, level: b.level, retentionDays: Number(b.retentionDays) }, ipOf(req) ? `IP ${ipOf(req)}` : undefined);
    res.json(await stateJson());
  } catch (e: any) {
    res.status(e instanceof AuditError ? 400 : 500).json({ error: e.message || "خطا در ذخیره‌ی تنظیم لاگ" });
  }
});

// اجرای دستی نگهداری (ساخت partition، حذف قدیمی‌ها، اعمال سقف حجم)
router.post("/management/audit/maintain", async (_req, res) => {
  try {
    const message = await maintainAudit();
    res.json({ message, ...(await stateJson()) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در نگهداری لاگ" });
  }
});

export default router;
