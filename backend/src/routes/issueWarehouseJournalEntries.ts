import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { DOC_TYPE_FA } from "../services/goodsPricingService";
import { parseFilters, stringWhere, numberWhere, dateWhere, FilterSpec } from "../utils/tableFilters";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { OUTBOUND_DOC_TYPES } from "../services/warehouseMovementService";
import { resolveAccountDetailFields } from "../utils/detailValues";

const FORM = findFormPrefix("accounting-issue-journal-entries");

const router = Router();
const MAX_PAGE_SIZE = 100;

// طبق «تغییرات صدور سند حسابداری»: این دو نوع همیشه از این فرم مستثنی‌اند — نه چون سند انبار نیستند،
// بلکه چون سند حسابداری‌شان از فرم مبدأ خودشان (تایید فاکتور خرید / ثبت فاکتور خرید خدمات) صادر می‌شود،
// نه از این فرم عمومی. علاوه بر آن، «موجودی اول دوره» و دو نوع سند انتقالی بین انبار هم طبق تصمیم صریح
// کاربر هرگز در این فهرست ظاهر نمی‌شوند (انتقال بین انبارهای خودِ شرکت اثر حسابداری‌ای که این فرم صادر
// می‌کند را ندارد).
const EXCLUDED_PRICE_TYPES = ["CROSS_ENTITY", "INBOUND_RELATED_COST"] as const;
const EXCLUDED_DOC_TYPES = ["INITIAL_INVENTORY", "WAREHOUSE_TRANSFER_IN", "WAREHOUSE_TRANSFER_OUT"] as const;

// نگاشت priceType به عنوان فارسی طبق «تغییرات صدور سند حسابداری»: هر نامی که آن‌جا آمده دقیقاً معادل
// یکی از مقادیر enum فعلی DocumentAmountPriceType است. Standard_Price هنوز توسط هیچ جریانی تولید
// نمی‌شود (طبق تصمیم صریح کاربر: «بعدا موردش رو خواهم گفت») — پس فعلاً نگاشتی برایش لازم نیست.
const PRICE_TYPE_FA: Record<string, string> = {
  USER_ENTRY: "قیمت اولیه",
  MIGRATED: "قیمت اولیه",
  ENGINE_PRICING: "قیمت محاسباتی",
  ENGINE_CORRECTION: "اصلاح قیمت",
};

function enumKeysMatching(map: Record<string, string>, f: FilterSpec | undefined): string[] | undefined {
  if (!f) return undefined;
  const needle = (f.value ?? "").trim().toLowerCase();
  if (!needle) return undefined;
  const keys = Object.entries(map)
    .filter(([, label]) => label.toLowerCase().includes(needle))
    .map(([key]) => key);
  return f.operator === "notContains" ? Object.keys(map).filter((k) => !keys.includes(k)) : keys;
}

interface CandidatesQueryInput {
  toDate?: string;
  accountingGroupIds?: string;
  filters?: string;
}

// منطق مشترک ساخت where بین GET /candidates (صفحه‌بندی‌شده) و POST /issue (بدون صفحه‌بندی — همه‌ی
// ردیف‌های مطابق همین فیلترها یک‌جا صادر می‌شوند، طبق تصمیم صریح کاربر: انتخاب ردیف به‌ردیف حذف شد،
// «صدور سند حسابداری» یعنی همه‌ی ردیف‌های همین گرید/فیلتر). بازه‌ی لود همیشه از اول سال مالیِ تاریخِ
// انتخاب‌شده تا خودِ آن تاریخ است؛ فیلد «از تاریخ» وجود ندارد.
async function resolveCandidatesWhere(q: CandidatesQueryInput): Promise<{ error: string } | { where: any; fiscalPeriod: { id: number; fromDate: Date }; toDateDay: Date; toDate: Date }> {
  if (!q.toDate) return { error: "تاریخ الزامی است" };
  const toDateDay = new Date(`${q.toDate}T00:00:00.000Z`);
  if (isNaN(toDateDay.getTime())) return { error: "تاریخ نامعتبر است" };
  // effectiveDate یک DateTime کامل است (نه فقط تاریخ)، پس کران بالای بازه باید پایان همان روز باشد؛
  // اما تشخیص دوره مالی باید با خودِ تاریخ (نیمه‌شب UTC، هم‌الگوی FiscalPeriod.fromDate/toDate) مقایسه شود.
  const toDate = new Date(`${q.toDate}T23:59:59.999Z`);

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: toDateDay }, toDate: { gte: toDateDay } } });
  if (!fiscalPeriod) return { error: "این تاریخ در هیچ دوره مالی تعریف نشده است" };

  const colFilters = parseFilters(q.filters);

  const accountingGroupIds = (q.accountingGroupIds ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);

  const lineWhere: any = {
    document: {
      documentType: { notIn: EXCLUDED_DOC_TYPES as any },
    },
  };
  if (accountingGroupIds.length > 0) {
    lineWhere.goodsItem = { accountingGroupId: { in: accountingGroupIds } };
  }

  const docDateFilter = colFilters.documentDate ? dateWhere(colFilters.documentDate) : undefined;
  if (docDateFilter) lineWhere.document.date = docDateFilter;

  const docNumberFilter = colFilters.documentNumber ? numberWhere(colFilters.documentNumber) : undefined;
  if (docNumberFilter) lineWhere.document.number = docNumberFilter;

  const docTypeKeys = enumKeysMatching(DOC_TYPE_FA, colFilters.documentTypeTitle);
  if (docTypeKeys) {
    lineWhere.document.documentType = { in: docTypeKeys.filter((k) => !EXCLUDED_DOC_TYPES.includes(k as any)) as any };
  }

  const itemCodeFilter = colFilters.itemCode ? stringWhere(colFilters.itemCode) : undefined;
  const itemTitleFilter = colFilters.itemTitle ? stringWhere(colFilters.itemTitle) : undefined;
  if (itemCodeFilter || itemTitleFilter) {
    lineWhere.goodsItem = {
      ...(lineWhere.goodsItem ?? {}),
      ...(itemCodeFilter ? { fullCode: itemCodeFilter } : {}),
      ...(itemTitleFilter ? { title: itemTitleFilter } : {}),
    };
  }

  const where: any = {
    effectiveDate: { gt: fiscalPeriod.fromDate, lte: toDate },
    journalEntryId: null,
    priceType: { notIn: EXCLUDED_PRICE_TYPES as any },
    line: lineWhere,
  };

  const accountingDateFilter = colFilters.accountingDate ? dateWhere(colFilters.accountingDate) : undefined;
  if (accountingDateFilter) where.effectiveDate = { ...where.effectiveDate, ...accountingDateFilter };

  const amountFilter = colFilters.amount ? numberWhere(colFilters.amount) : undefined;
  if (amountFilter) where.difference = amountFilter;

  const priceTypeKeys = enumKeysMatching(PRICE_TYPE_FA, colFilters.priceTypeTitle);
  if (priceTypeKeys) {
    where.priceType = { in: priceTypeKeys.filter((k) => !EXCLUDED_PRICE_TYPES.includes(k as any)) as any };
  }

  return { where, fiscalPeriod, toDateDay, toDate };
}

router.get("/issue-warehouse-journal-entries/candidates", can(`${FORM}.view`), async (req, res) => {
  const { page: pageRaw, pageSize: pageSizeRaw } = req.query as { page?: string; pageSize?: string };

  const resolved = await resolveCandidatesWhere(req.query as CandidatesQueryInput);
  if ("error" in resolved) return res.status(400).json({ error: resolved.error });
  const { where } = resolved;

  const page = Math.max(1, parseInt(pageRaw as string, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw as string, 10) || 25));

  const [total, rows] = await Promise.all([
    prisma.documentItemAmount.count({ where }),
    prisma.documentItemAmount.findMany({
      where,
      include: {
        line: {
          include: {
            document: { select: { date: true, documentType: true, number: true } },
            goodsItem: { select: { fullCode: true, title: true } },
          },
        },
      },
      orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = rows.map((r: any) => ({
    id: r.id,
    documentDate: r.line.document.date,
    accountingDate: r.effectiveDate,
    documentType: r.line.document.documentType,
    documentTypeTitle: DOC_TYPE_FA[r.line.document.documentType] ?? r.line.document.documentType,
    documentNumber: r.line.document.number,
    itemCode: r.line.goodsItem.fullCode,
    itemTitle: r.line.goodsItem.title,
    priceType: r.priceType,
    priceTypeTitle: PRICE_TYPE_FA[r.priceType] ?? r.priceType,
    amount: Number(r.difference),
  }));

  res.json({ items, total });
});

// صدور واقعی سند حسابداری — طبق Documents/صدور سند حسابداری.md + تصمیم صریح کاربر (بدون انتخاب
// ردیف‌به‌ردیف): یک سند واحد برای همه‌ی ردیف‌های مطابق همان فیلترهای «تا تاریخ»/گروه‌های حسابداری/فیلتر
// ستونی که برای GET /candidates استفاده می‌شود صادر می‌شود (resolveCandidatesWhere مشترک است — یعنی این
// اندپوینت هرگز به فهرست ids از سمت کلاینت متکی نیست، خودش دوباره همان کوئریِ کامل را می‌زند). هر ردیف
// دقیقاً دو خط تولید می‌کند (بدهکار+بستانکار). حساب معین «موجودی کالا» بر مبنای (گروه حسابداری کالای
// ردیف + گروه انبارِ انبار سند) از تنظیمات «حسابداری کالا و خدمت» خوانده می‌شود؛ حساب طرف مقابل
// («بستانکار رسید انبار» برای ردیف‌های ورودی به انبار، «بدهکار حواله انبار» برای ردیف‌های خروجی) بر
// مبنای همان گروه حسابداری + warehouseDocType برابر نوع سند ردیف. تفصیل۱/۲/۳ فقط وقتی روی هرکدام از این
// دو معین ست می‌شود که آن معین، در یکی از سه اسلات خودش (detailType1/2/3Id)، به نوع تفصیلِ کدِ تفصیل سند
// (InventoryDocument.detailCode — طرف حساب/مرکز هزینه/پروژه، بسته به نوع سند) وصل باشد.
router.post("/issue-warehouse-journal-entries/issue", can(`${FORM}.issue`), async (req, res) => {
  const resolved = await resolveCandidatesWhere(req.body as CandidatesQueryInput);
  if ("error" in resolved) return res.status(400).json({ error: resolved.error });
  const { where, toDateDay } = resolved;

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return res.status(400).json({ error: "ارز پایه تعریف نشده است" });

  const validRows = await prisma.documentItemAmount.findMany({
    where,
    include: {
      line: {
        include: {
          document: true,
          goodsItem: { select: { id: true, title: true, accountingGroupId: true } },
        },
      },
    },
    orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
  });

  if (validRows.length === 0) return res.status(400).json({ error: "موردی برای صدور یافت نشد" });

  const errors: string[] = [];
  const warehouseIds = Array.from(new Set(validRows.map((r) => r.line.document.warehouseId).filter((x): x is number => !!x)));
  const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
  const warehouseGroupById = new Map(warehouses.map((w) => [w.id, w.warehouseGroupId]));

  const accountingGroupIds = Array.from(new Set(validRows.map((r) => r.line.goodsItem.accountingGroupId)));
  const settings = await prisma.goodsServiceAccountingSetting.findMany({
    where: { accountingGroupId: { in: accountingGroupIds } },
    include: { account: true },
  });

  const detailCodes = Array.from(new Set(validRows.map((r) => r.line.document.detailCode).filter((x): x is string => !!x)));
  const usages = await prisma.detailCodeUsage.findMany({ where: { code: { in: detailCodes } } });
  const detailTypeByCode = new Map(usages.map((u) => [u.code, u.detailTypeId]));

  // این تابع فقط داخل همین درخواست معنا دارد؛ چون errors بالا پیش از این نقطه، در صورت غیرخالی بودن،
  // قبلاً پاسخ 400 برگردانده — از اینجا به بعد errors دوباره از صفر برای خطاهای «تنظیمات ناقص» پر می‌شود.
  function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
    return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
  }

  const lines: IssueLineInput[] = [];
  for (const r of validRows) {
    const doc = r.line.document;
    const goodsItem = r.line.goodsItem;
    const direction = OUTBOUND_DOC_TYPES.has(doc.documentType) ? "OUT" : "IN";
    const warehouseGroupId = doc.warehouseId != null ? warehouseGroupById.get(doc.warehouseId) ?? null : null;

    const inventorySetting =
      warehouseGroupId != null
        ? findSetting(goodsItem.accountingGroupId, "INVENTORY", (s) => s.warehouseGroupId === warehouseGroupId)
        : undefined;
    const contraSetting = findSetting(
      goodsItem.accountingGroupId,
      direction === "IN" ? "WAREHOUSE_RECEIPT_CREDIT" : "WAREHOUSE_ISSUE_DEBIT",
      (s) => s.warehouseDocType === doc.documentType
    );

    if (!inventorySetting) {
      errors.push(`برای کالای «${goodsItem.title}»، حساب «موجودی کالا» در حسابداری کالا و خدمت تعریف نشده است`);
      continue;
    }
    if (!contraSetting) {
      const natureTitle = direction === "IN" ? "بستانکار رسید انبار" : "بدهکار حواله انبار";
      const docTypeTitle = DOC_TYPE_FA[doc.documentType] ?? doc.documentType;
      errors.push(`برای کالای «${goodsItem.title}» و نوع سند «${docTypeTitle}»، حساب «${natureTitle}» در حسابداری کالا و خدمت تعریف نشده است`);
      continue;
    }

    const amount = Number(r.difference);
    const detailCode = doc.detailCode ?? null;
    const detailTypeId = detailCode ? detailTypeByCode.get(detailCode) ?? null : null;
    const description = `بابت ${DOC_TYPE_FA[doc.documentType] ?? doc.documentType} شماره سند ${doc.number} تاریخ سند ${formatJalaliDateForMessage(doc.date)}`;

    const inventoryDetails = resolveAccountDetailFields(inventorySetting.account, detailTypeId, detailCode);
    const contraDetails = resolveAccountDetailFields(contraSetting.account, detailTypeId, detailCode);

    if (direction === "IN") {
      lines.push({ accountId: inventorySetting.accountId, ...inventoryDetails, currencyId: baseCurrency.id, debit: amount, credit: 0, fxRate: 1, description });
      lines.push({ accountId: contraSetting.accountId, ...contraDetails, currencyId: baseCurrency.id, debit: 0, credit: amount, fxRate: 1, description });
    } else {
      lines.push({ accountId: contraSetting.accountId, ...contraDetails, currencyId: baseCurrency.id, debit: amount, credit: 0, fxRate: 1, description });
      lines.push({ accountId: inventorySetting.accountId, ...inventoryDetails, currencyId: baseCurrency.id, debit: 0, credit: amount, fxRate: 1, description });
    }
  }

  if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

  try {
    const docType = await prisma.documentType.findFirst({ where: { systemKey: "WAREHOUSE_DOCUMENTS" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «اسناد انبار» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: toDateDay,
      documentTypeId: docType.id,
      description: `سند حسابداری اسناد انبار تا تاریخ ${formatJalaliDateForMessage(toDateDay)}`,
      issuingSystem: "WAREHOUSE",
      isManual: false,
      lines,
      sources: [{ label: "صدور سند حسابداری اسناد انبار", path: "/warehouse-accounting/issue-journal-entries" }],
    });

    await prisma.documentItemAmount.updateMany({
      where: { id: { in: validRows.map((r) => r.id) } },
      data: { journalEntryId: entry.id },
    });

    res.json({
      journalEntryId: entry.id,
      number: entry.number,
      referenceNumber: entry.referenceNumber,
      rowCount: validRows.length,
      lineCount: lines.length,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند" });
  }
});

export default router;
