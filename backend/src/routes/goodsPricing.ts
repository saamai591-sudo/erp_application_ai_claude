import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { priceItem, revertItem, PRICING_DOC_TYPES, DOC_TYPE_FA } from "../services/goodsPricingService";
import { validatePriceOperation } from "../services/goodsPricingValidation";
import { parseFilters, matchesFilterValue } from "../utils/tableFilters";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("accounting-goods-pricing");

const router = Router();
const MAX_PAGE_SIZE = 100;

// نگاشت عنوان ستون (کلید فیلتر سمت کلاینت) به نوع فیلتر و مقدار خام هر ردیف — طبق تصمیم صریح کاربر:
// دیگر «جست‌وجوی کالا»/«گروه حساب» به‌عنوان دو فیلد جدا در بالای گرید وجود ندارند؛ همه‌ی ستون‌های گرید
// (از جمله گروه حساب) فیلتر ستونی عمومی دارند. چون «وضعیت»/«تاریخ محاسبه» ستون خام دیتابیس نیستند
// (از یک نگاشت pricedAtById محاسبه می‌شوند)، فیلتر روی کل مجموعه‌ی واجد شرایط (نه فقط صفحه‌ی جاری) در
// حافظه اعمال می‌شود — دقیقاً هم‌الگوی routes/reports.ts برای داده‌های تجمیع‌شده.
const FILTER_FIELDS: Record<string, { type: "string" | "date"; get: (r: any) => string | number | null }> = {
  fullCode: { type: "string", get: (r) => r.fullCode },
  title: { type: "string", get: (r) => r.title },
  accountingGroupTitle: { type: "string", get: (r) => r.accountingGroupTitle },
  status: { type: "string", get: (r) => (r.status === "CALCULATED" ? "محاسبه‌شده" : "محاسبه‌نشده") },
  calculatedAt: { type: "date", get: (r) => r.calculatedAt },
};

// طبق «تغییرات قیمت‌گذاری اسناد انبار»: دیگر «نوع عملیات» به‌عنوان پیش‌فیلتر گرفته نمی‌شود — این
// اندپوینت همیشه همه‌ی کالاهای واجد شرایط (چه محاسبه‌شده چه محاسبه‌نشده در همین دوره) را با ستون
// «وضعیت»/«تاریخ محاسبه» برمی‌گرداند؛ خودِ صفحه با دو دکمه‌ی جدا (قیمت‌گذاری/برگشت از قیمت‌گذاری) روی
// ردیف‌های انتخاب‌شده تصمیم می‌گیرد کدام عملیات اجرا شود.
router.get("/candidates", can(`${FORM}.view`), async (req, res) => {
  const {
    reportingPeriodId: rpRaw,
    filters: filtersRaw,
    page: pageRaw,
    pageSize: pageSizeRaw,
    all: allRaw,
  } = req.query as {
    reportingPeriodId?: string;
    filters?: string;
    page?: string;
    pageSize?: string;
    all?: string;
  };

  const reportingPeriodId = Number(rpRaw);
  if (!reportingPeriodId) return res.status(400).json({ error: "دوره گزارشگری الزامی است" });

  const page = Math.max(1, parseInt(pageRaw as string, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw as string, 10) || MAX_PAGE_SIZE));
  // برای دکمه‌ی «انتخاب همه»: همه‌ی کالاهای مطابق همین فیلتر را (بدون صفحه‌بندی) برمی‌گرداند — طبق
  // تصمیم صریح کاربر، «انتخاب همه» باید کل نتایج مطابق فیلتر جاری را در بگیرد، نه فقط صفحه‌ی بارگذاری‌شده.
  const fetchAll = allRaw === "1" || allRaw === "true";
  const colFilters = parseFilters(filtersRaw);

  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, include: { fiscalPeriod: true } });
  if (!period) return res.status(400).json({ error: "دوره گزارشگری یافت نشد" });

  // طبق تصمیم صریح کاربر: بررسی «تایید انبار» دیگر اینجا (در لحظه‌ی لود اطلاعات) انجام نمی‌شود — به
  // لایه‌ی اعتبارسنجی مستقل (goodsPricingValidation.ts) منتقل شده که فقط وقتی کاربر ردیف‌ها را انتخاب
  // کرده و دکمه‌ی «قیمت‌گذاری» را می‌زند اجرا می‌شود (POST /validate).

  // فقط کالاهایی که از ابتدای سال مالی دوره گزارشگری انتخاب‌شده تا پایان خودِ آن دوره، حداقل یک سند
  // قطعی‌شده‌ی مؤثر در قیمت‌گذاری داشته‌اند نمایش داده می‌شوند. هم‌زمان، برای هر چنین کالایی، انبار(های)
  // مرتبط هم واکشی می‌شود — طبق تصمیم صریح کاربر، این نگاشت (کالا، انبار) در جدول موقت
  // GoodsPricingFlowWarehouse ذخیره می‌شود تا وقتی بعداً کاربر «قیمت‌گذاری» را می‌زند، لایه‌ی اعتبارسنجی
  // مجبور به کوئری دوباره‌ی InventoryDocumentLine نباشد.
  const flowLines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        documentType: { in: PRICING_DOC_TYPES as any },
        date: { gte: period.fiscalPeriod.fromDate, lte: period.toDate },
      },
    },
    select: { goodsItemId: true, document: { select: { warehouseId: true } } },
  });
  const flowIds = Array.from(new Set(flowLines.map((l) => l.goodsItemId)));

  // طبق تصمیم صریح کاربر: این جدول یک کش موقت است، نه تاریخچه — هر بار «لود اطلاعات» زده می‌شود، کل
  // جدول (نه فقط ردیف‌های همین دوره) پاک و از صفر با نگاشت تازه پر می‌شود.
  const flowPairs = new Map<string, { goodsItemId: number; warehouseId: number }>();
  for (const l of flowLines) {
    const warehouseId = l.document.warehouseId;
    if (!warehouseId) continue;
    flowPairs.set(`${l.goodsItemId}-${warehouseId}`, { goodsItemId: l.goodsItemId, warehouseId });
  }
  await prisma.$transaction([
    prisma.goodsPricingFlowWarehouse.deleteMany({}),
    prisma.goodsPricingFlowWarehouse.createMany({
      data: Array.from(flowPairs.values()).map((p) => ({ goodsItemId: p.goodsItemId, reportingPeriodId, warehouseId: p.warehouseId })),
    }),
  ]);

  const pricedStatuses = await prisma.goodsPricingStatus.findMany({
    where: { reportingPeriodId, goodsItemId: { in: flowIds.length ? flowIds : [-1] } },
    select: { goodsItemId: true, pricedAt: true },
  });
  const pricedAtById = new Map(pricedStatuses.map((s) => [s.goodsItemId, s.pricedAt]));

  // برخلاف قبل، اینجا کل مجموعه‌ی واجد شرایط (نه فقط یک صفحه) یک‌جا خوانده می‌شود — چون فیلتر ستونی
  // «وضعیت»/«تاریخ محاسبه» ستون خام دیتابیس نیست و باید بعد از محاسبه در حافظه اعمال شود؛ صفحه‌بندی
  // واقعی بعد از فیلتر (نه قبلش) روی همین آرایه انجام می‌شود. این مجموعه ذاتاً محدود به کالاهایی است
  // که در این دوره گردش داشته‌اند، نه کل کاتالوگ کالا.
  const items = await prisma.goodsItem.findMany({
    where: { id: { in: flowIds.length ? flowIds : [-1] } },
    include: { accountingGroup: true },
    orderBy: { fullCode: "asc" },
  });

  let rows = items.map((item) => {
    const pricedAt = pricedAtById.get(item.id) || null;
    return {
      id: item.id,
      code: item.code,
      fullCode: item.fullCode,
      title: item.title,
      accountingGroupTitle: item.accountingGroup.title,
      status: pricedAt ? "CALCULATED" : "NOT_CALCULATED",
      calculatedAt: pricedAt,
    };
  });

  for (const [field, f] of Object.entries(colFilters)) {
    const spec = FILTER_FIELDS[field];
    if (!spec) continue;
    rows = rows.filter((r) => matchesFilterValue(spec.get(r), spec.type, f));
  }

  const total = rows.length;
  if (!fetchAll) rows = rows.slice((page - 1) * pageSize, page * pageSize);

  res.json({ items: rows, total, page, pageSize });
});

// فرم «اصلاحیه‌های قیمت‌گذاری» طبق تصمیم صریح کاربر حذف شده (نگاه کنید به تاریخچه‌ی این فایل در گیت
// برای نسخه‌ی قبلی) — قرار است بعداً با طرح دیگری از نو ساخته شود. رکوردهای priceType=ENGINE_CORRECTION
// همچنان در DocumentItemAmount ثبت می‌شوند (نگاه کنید به goodsPricingService.ts)، فقط دیگر گزارش/فرم
// جداگانه‌ای برایشان وجود ندارد.

// لایه‌ی اعتبارسنجی مستقل — طبق تصمیم صریح کاربر، فقط وقتی کاربر ردیف‌ها را انتخاب کرده و دکمه‌ی
// «قیمت‌گذاری» را می‌زند صدا زده می‌شود (نه در لحظه‌ی لود اطلاعات). فرانت‌اند پیش از POST /run این
// اندپوینت را صدا می‌زند؛ اگر valid=false باشد، /run اصلاً صدا زده نمی‌شود و پیام‌ها/جزئیات مستقیم در
// دیالوگ خطا نمایش داده می‌شوند. فعلاً فقط برای عملیات «قیمت‌گذاری» است، نه «برگشت از قیمت‌گذاری».
router.post("/validate", can(`${FORM}.pricing`), async (req, res) => {
  const { reportingPeriodId: rpRaw, goodsItemIds } = req.body as { reportingPeriodId: number; goodsItemIds: number[] };
  const reportingPeriodId = Number(rpRaw);
  if (!reportingPeriodId) return res.status(400).json({ error: "دوره گزارشگری الزامی است" });
  if (!Array.isArray(goodsItemIds) || goodsItemIds.length === 0) {
    return res.status(400).json({ error: "حداقل یک کالا باید انتخاب شده باشد" });
  }
  const result = await validatePriceOperation(reportingPeriodId, goodsItemIds);
  res.json(result);
});

router.post("/run", async (req: AuthedRequest, res) => {
  const { reportingPeriodId: rpRaw, operation, goodsItemIds } = req.body as {
    reportingPeriodId: number;
    operation: "PRICE" | "REVERT";
    goodsItemIds: number[];
  };

  // این مسیر یک اندپوینت واحد است که بسته به operation در بدنه‌ی درخواست، بین دو عملیات دسترسیِ متفاوت
  // (قیمت‌گذاری/برگشت قیمت‌گذاری) دیسپچ می‌کند؛ چون middleware سطح router نمی‌تواند بر اساس بدنه‌ی
  // درخواست شاخه برود، این بررسی به‌عنوان اولین خط داخل خودِ handler انجام می‌شود.
  const requiredKey = operation === "REVERT" ? `${FORM}.revertPricing` : `${FORM}.pricing`;
  if (!(await userHasAction(req.user!.id, requiredKey))) {
    return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
  }

  const reportingPeriodId = Number(rpRaw);
  if (!reportingPeriodId) return res.status(400).json({ error: "دوره گزارشگری الزامی است" });
  if (operation !== "PRICE" && operation !== "REVERT") return res.status(400).json({ error: "نوع عملیات نامعتبر است" });
  if (!Array.isArray(goodsItemIds) || goodsItemIds.length === 0) {
    return res.status(400).json({ error: "حداقل یک کالا باید انتخاب شده باشد" });
  }

  const items = await prisma.goodsItem.findMany({ where: { id: { in: goodsItemIds } }, select: { id: true, title: true } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const results: { goodsItemId: number; title: string; ok: boolean; error?: string }[] = [];
  for (const id of goodsItemIds) {
    const title = itemById.get(id)?.title || `#${id}`;
    try {
      if (operation === "PRICE") {
        await priceItem(id, reportingPeriodId, req.user?.id ?? undefined);
      } else {
        await revertItem(id, reportingPeriodId);
      }
      results.push({ goodsItemId: id, title, ok: true });
    } catch (e: any) {
      results.push({ goodsItemId: id, title, ok: false, error: e.message || "خطا" });
    }
  }

  res.json({ results });
});

export default router;
