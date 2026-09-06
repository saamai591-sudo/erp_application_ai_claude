import { Router } from "express";
import { prisma } from "../lib/prisma";
import { startImportJob, isImportEntityRegistered } from "../services/importJobService";
import { userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";

// ورود اکسل مستقیماً تابع ایجاد/به‌روزرسانی همان موجودیت را صدا می‌زند (نه route محافظت‌شده‌ی خودش)،
// پس can() روی router.post آن route اصلاً از این مسیر رد نمی‌شود — یعنی بدون این نگاشت، ورود اکسل
// یک دور زدن (bypass) کامل احراز دسترسی برای همه‌ی انواع سند/موجودیت بود. هر entityType این‌جا به
// همان Form ثبت‌شده در Registry و همان عملیات پایه‌ای که معادلش را نمایندگی می‌کند نگاشت می‌شود.
const ENTITY_TYPE_TO_ACTION: Record<string, string> = {
  party: `${findFormPrefix("parties")}.create`,
  "cash-box": `${findFormPrefix("cash-boxes")}.create`,
  "bank-branch": `${findFormPrefix("bank-branches")}.create`,
  "bank-account": `${findFormPrefix("bank-accounts")}.create`,
  "org-unit": `${findFormPrefix("org-units")}.create`,
  "cost-center": `${findFormPrefix("cost-centers")}.create`,
  "accounting-group": `${findFormPrefix("accounting-groups")}.create`,
  "unit-of-measure": `${findFormPrefix("units-of-measure")}.create`,
  warehouse: `${findFormPrefix("warehouses")}.create`,
  currency: `${findFormPrefix("currencies")}.create`,
  account: `${findFormPrefix("accounts")}.create`,
  "goods-item": `${findFormPrefix("goods-items")}.create`,
  "journal-entry": `${findFormPrefix("journal-entries")}.create`,
  "initial-inventory": `${findFormPrefix("warehousing-initial-inventory")}.create`,
  // فقط فی/مبلغ اسناد از‌قبل ایجادشده را وارد می‌کند — از نظر Registry یک «ویرایش» است، نه ایجاد سند تازه.
  "initial-inventory-cost": `${findFormPrefix("warehousing-initial-inventory")}.edit`,
  "production-receipt": `${findFormPrefix("production-receipts")}.create`,
  "warehouse-receipt": `${findFormPrefix("warehousing-warehouse-receipts")}.create`,
  "production-consumption": `${findFormPrefix("production-consumptions")}.create`,
  "sales-delivery": `${findFormPrefix("sales-deliveries")}.create`,
  "center-consumption": `${findFormPrefix("center-consumptions")}.create`,
  "warehouse-adjustment": `${findFormPrefix("warehousing-warehouse-adjustments")}.create`,
  "inventory-counting-shortage": `${findFormPrefix("inventory-counting-shortages")}.create`,
};

const router = Router();

router.post("/", async (req: AuthedRequest, res) => {
  const { entityType, rows, allowDuplicates } = req.body as {
    entityType: string;
    rows: Record<string, string>[];
    allowDuplicates?: boolean;
  };
  if (!entityType || !isImportEntityRegistered(entityType)) {
    return res.status(400).json({ error: `نوع ورودی «${entityType}» پشتیبانی نمی‌شود` });
  }
  const requiredAction = ENTITY_TYPE_TO_ACTION[entityType];
  if (!requiredAction) {
    throw new Error(`خطای معماری: نوع ورودی «${entityType}» در ENTITY_TYPE_TO_ACTION (importJobs.ts) نگاشت نشده است`);
  }
  if (!(await userHasAction(req.user!.id, requiredAction))) {
    return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "هیچ ردیفی برای ورود اطلاعات ارسال نشده است" });
  }
  try {
    const jobId = await startImportJob(entityType, rows, !!allowDuplicates);
    res.status(201).json({ jobId });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در شروع پردازش" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ error: "یافت نشد" });
  res.json({
    id: job.id,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successCount: job.successCount,
    errorCount: job.errorCount,
    resultData: job.status === "DONE" ? job.resultData : undefined,
  });
});

export default router;
