import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getRequestContext } from "../lib/requestContext";
import { recordAuditEvent } from "../services/auditService";
import {
  MigrationError,
  ensureReportingLevels,
  getMigrationState,
  importAccounts,
  importDetails,
  importDocumentTypes,
  importFiscalPeriods,
  importJournalEntries,
  periodTotals,
  type DetailKind,
} from "../services/dataMigrationService";

// API «ورود داده» برای برنامه‌ی مهاجرت از سیستم‌های قبلی (migrator/). همه‌ی قواعد در services/dataMigrationService.ts است؛
// فقط با کلید مجوز «تنظیمات › عملیات › مهاجرت داده › اجرای ورود داده» (مدیر سیستم خودکار دارد) در دسترس است.
const FORM = findFormPrefix("data-migration");
const RUN = can(`${FORM}.run`);
const router = Router();

const KINDS: DetailKind[] = ["PARTY", "COST_CENTER", "CASH_BOX", "PROJECT", "BANK_ACCOUNT"];

/** هر درخواست نوشتنی یک رویداد خلاصه در لاگ تغییرات می‌گذارد (نوشتن رکورد‌به‌رکورد عمداً لاگ نمی‌شود) */
async function logBatch(summary: string) {
  await recordAuditEvent({ action: "DATA_MIGRATION_BATCH", summary: summary.slice(0, 300), userId: getRequestContext()?.userId ?? null, ip: getRequestContext()?.ip ?? null }).catch(() => {});
}

function wrap(fn: (req: any) => Promise<unknown>) {
  return async (req: any, res: any) => {
    try {
      res.json(await fn(req));
    } catch (e: any) {
      res.status(400).json({ error: e instanceof MigrationError ? e.message : e?.message || "خطا در ورود داده" });
    }
  };
}

const arr = (v: unknown, label: string) => {
  if (!Array.isArray(v)) throw new MigrationError(`${label} باید آرایه باشد`);
  return v as any[];
};

router.get("/state", RUN, wrap(() => getMigrationState()));

router.post("/reporting-levels", RUN, wrap(async (req) => ensureReportingLevels(arr(req.body?.levels, "levels"))));

router.post("/fiscal-periods", RUN, wrap(async (req) => {
  const items = arr(req.body?.items, "items");
  const r = await importFiscalPeriods(items);
  await logBatch(`ورود دوره‌های مالی: ${r.filter((x) => x.created).length} جدید از ${r.length}`);
  return r;
}));

router.post("/document-types", RUN, wrap(async (req) => {
  const r = await importDocumentTypes(arr(req.body?.items, "items"));
  await logBatch(`ورود انواع سند: ${r.filter((x) => x.created).length} جدید از ${r.length}`);
  return r;
}));

router.post("/accounts", RUN, wrap(async (req) => {
  const r = await importAccounts(arr(req.body?.items, "items"));
  await logBatch(`ورود حساب‌ها: ${r.results.filter((x) => x.created).length} جدید، ${r.errors.length} خطا`);
  return r;
}));

router.post("/details", RUN, wrap(async (req) => {
  const kind = String(req.body?.kind) as DetailKind;
  if (!KINDS.includes(kind)) throw new MigrationError(`نوع تفصیل نامعتبر (${KINDS.join("، ")})`);
  const r = await importDetails(kind, arr(req.body?.items, "items"));
  await logBatch(`ورود تفصیل ${kind}: ${r.results.filter((x) => x.created).length} جدید، ${r.errors.length} خطا`);
  return r;
}));

router.post("/journal-entries", RUN, wrap(async (req) => {
  const r = await importJournalEntries(arr(req.body?.items, "items"));
  await logBatch(`ورود اسناد حسابداری: ${r.created} جدید، ${r.skipped} موجود، ${r.errors.length} خطا`);
  return r;
}));

router.get("/period-totals", RUN, wrap(async (req) => periodTotals(String(req.query.period ?? ""), req.query.accounts === "1")));

export default router;
