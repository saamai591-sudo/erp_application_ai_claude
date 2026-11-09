import { Router } from "express";
import { requireManagement } from "./management";
import { applyRelease, getSettings, getUpdaterStatus, listReleases, saveSettings, UpdateError } from "../services/updateService";
import { audit } from "../services/backupService";

// به‌روزرسانی از داخل برنامه — فقط نشست مدیریت (مثل پشتیبان‌گیری)؛ قبل از requireAuth و دروازه‌ی لایسنس ثبت می‌شود تا قفل لایسنس جلوی نصب نسخه‌ی تازه را نگیرد
// (اهلیت لایسنس برای هر نسخه در updateService جدا بررسی می‌شود).

const router = Router();
router.use("/management/update", requireManagement);

const ip = (req: any) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.ip || null;

function fail(res: any, e: any) {
  if (e instanceof UpdateError) return res.status(400).json({ error: e.message });
  console.error("[update]", e);
  return res.status(500).json({ error: "خطای داخلی در به‌روزرسانی" });
}

router.get("/management/update/settings", async (_req, res) => {
  try {
    res.json(await getSettings());
  } catch (e) {
    fail(res, e);
  }
});

router.put("/management/update/settings", async (req, res) => {
  try {
    await saveSettings({ host: req.body?.host, user: req.body?.user, password: req.body?.password });
    await audit("UPDATE_SETTINGS", `ریجستری: ${String(req.body?.host || "")}`, ip(req));
    res.json(await getSettings());
  } catch (e) {
    fail(res, e);
  }
});

router.get("/management/update/versions", async (req, res) => {
  try {
    res.json(await listReleases(req.query.refresh === "1"));
  } catch (e) {
    fail(res, e);
  }
});

router.get("/management/update/status", async (_req, res) => {
  try {
    res.json(await getUpdaterStatus());
  } catch (e) {
    fail(res, e);
  }
});

router.post("/management/update/apply", async (req, res) => {
  try {
    const version = String(req.body?.version || "");
    await audit("UPDATE_APPLY", `شروع به‌روزرسانی به نسخه‌ی ${version}`, ip(req));
    await applyRelease(version);
    res.status(202).json({ started: true });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
