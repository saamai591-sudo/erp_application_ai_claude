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
import { sendBulkError } from "../lib/bulkError";

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

const CANDIDATE_INCLUDE = {
  line: {
    include: {
      document: { select: { date: true, documentType: true, number: true } },
      goodsItem: { select: { fullCode: true, title: true, accountingGroup: { select: { title: true } } } },
    },
  },
} as const;

function mapCandidateRow(r: any) {
  return {
    id: r.id,
    documentDate: r.line.document.date,
    accountingDate: r.effectiveDate,
    documentType: r.line.document.documentType,
    documentTypeTitle: DOC_TYPE_FA[r.line.document.documentType] ?? r.line.document.documentType,
    documentNumber: r.line.document.number,
    itemCode: r.line.goodsItem.fullCode,
    itemTitle: r.line.goodsItem.title,
    accountingGroupTitle: r.line.goodsItem.accountingGroup.title,
    priceType: r.priceType,
    priceTypeTitle: PRICE_TYPE_FA[r.priceType] ?? r.priceType,
    amount: Number(r.difference),
  };
}

interface CandidatesQueryInput {
  toDate?: string;
  accountingGroupIds?: string;
  filters?: string;
}

// ستون‌های فیلترپذیر مشترک بین پیش‌نمایش (candidates) و فهرست ردیف‌های ذخیره‌شده‌ی یک فرم (lines) — یک‌جا
// parse می‌شوند تا هر دو اندپوینت دقیقاً همان معنای فیلتر ستونی را داشته باشند.
function parseColumnFilters(filtersRaw?: string) {
  const colFilters = parseFilters(filtersRaw);
  return {
    documentDate: colFilters.documentDate ? dateWhere(colFilters.documentDate) : undefined,
    documentNumber: colFilters.documentNumber ? numberWhere(colFilters.documentNumber) : undefined,
    documentTypeKeys: enumKeysMatching(DOC_TYPE_FA, colFilters.documentTypeTitle),
    itemCode: colFilters.itemCode ? stringWhere(colFilters.itemCode) : undefined,
    itemTitle: colFilters.itemTitle ? stringWhere(colFilters.itemTitle) : undefined,
    accountingGroupTitle: colFilters.accountingGroupTitle ? stringWhere(colFilters.accountingGroupTitle) : undefined,
    accountingDate: colFilters.accountingDate ? dateWhere(colFilters.accountingDate) : undefined,
    amount: colFilters.amount ? numberWhere(colFilters.amount) : undefined,
    priceTypeKeys: enumKeysMatching(PRICE_TYPE_FA, colFilters.priceTypeTitle),
  };
}

// منطق مشترک ساخت where بین GET /candidates (پیش‌نمایش فرم تازه) و ذخیره/به‌روزرسانی یک پیش‌نویس (POST/PUT
// — بازه‌ی لود همیشه از اول سال مالیِ تاریخِ انتخاب‌شده تا خودِ آن تاریخ است؛ فیلد «از تاریخ» وجود ندارد.
// warehouseJournalEntryIssuanceId=null یعنی «هنوز داخل هیچ فرم صدور سندی ذخیره نشده» — طبق تصمیم صریح
// کاربر (۱۴۰۵/۰۶/۱۶) هر ردیف فقط می‌تواند همزمان متعلق به یک فرم باشد.
async function resolveCandidatesWhere(q: CandidatesQueryInput): Promise<{ error: string } | { where: any; fiscalPeriod: { id: number; fromDate: Date }; toDateDay: Date; toDate: Date }> {
  if (!q.toDate) return { error: "تاریخ الزامی است" };
  const toDateDay = new Date(`${q.toDate}T00:00:00.000Z`);
  if (isNaN(toDateDay.getTime())) return { error: "تاریخ نامعتبر است" };
  // effectiveDate یک DateTime کامل است (نه فقط تاریخ)، پس کران بالای بازه باید پایان همان روز باشد؛
  // اما تشخیص دوره مالی باید با خودِ تاریخ (نیمه‌شب UTC، هم‌الگوی FiscalPeriod.fromDate/toDate) مقایسه شود.
  const toDate = new Date(`${q.toDate}T23:59:59.999Z`);

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: toDateDay }, toDate: { gte: toDateDay } } });
  if (!fiscalPeriod) return { error: "این تاریخ در هیچ دوره مالی تعریف نشده است" };

  const cf = parseColumnFilters(q.filters);

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

  if (cf.documentDate) lineWhere.document.date = cf.documentDate;
  if (cf.documentNumber) lineWhere.document.number = cf.documentNumber;
  if (cf.documentTypeKeys) {
    lineWhere.document.documentType = { in: cf.documentTypeKeys.filter((k) => !EXCLUDED_DOC_TYPES.includes(k as any)) as any };
  }
  if (cf.itemCode || cf.itemTitle || cf.accountingGroupTitle) {
    lineWhere.goodsItem = {
      ...(lineWhere.goodsItem ?? {}),
      ...(cf.itemCode ? { fullCode: cf.itemCode } : {}),
      ...(cf.itemTitle ? { title: cf.itemTitle } : {}),
      ...(cf.accountingGroupTitle ? { accountingGroup: { title: cf.accountingGroupTitle } } : {}),
    };
  }

  const where: any = {
    effectiveDate: { gt: fiscalPeriod.fromDate, lte: toDate },
    warehouseJournalEntryIssuanceId: null,
    priceType: { notIn: EXCLUDED_PRICE_TYPES as any },
    line: lineWhere,
  };

  if (cf.accountingDate) where.effectiveDate = { ...where.effectiveDate, ...cf.accountingDate };
  if (cf.amount) where.difference = cf.amount;
  if (cf.priceTypeKeys) {
    where.priceType = { in: cf.priceTypeKeys.filter((k) => !EXCLUDED_PRICE_TYPES.includes(k as any)) as any };
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
      include: CANDIDATE_INCLUDE,
      orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ items: rows.map(mapCandidateRow), total });
});

// =========================================================================
// ذخیره (پیش‌نویس) — طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۶): این فرم دیگر مستقیماً از فیلتر به صدور نمی‌رود؛
// اول باید «ذخیره» شود (ردیف‌های مطابق فیلتر جاری با warehouseJournalEntryIssuanceId به این هدر قفل
// می‌شوند)، فقط بعد از آن دکمه‌ی «صدور سند حسابداری» فعال می‌شود. تا وقتی صادر نشده، ذخیره‌ی دوباره (PUT)
// مجاز است و قفل قبلی را آزاد و از نو محاسبه می‌کند.
// =========================================================================

router.post("/issue-warehouse-journal-entries", can(`${FORM}.create`), async (req, res) => {
  const resolved = await resolveCandidatesWhere(req.body as CandidatesQueryInput);
  if ("error" in resolved) return res.status(400).json({ error: resolved.error });
  const { where, fiscalPeriod, toDateDay } = resolved;

  const matched = await prisma.documentItemAmount.findMany({ where, select: { id: true } });
  if (matched.length === 0) return res.status(400).json({ error: "موردی برای ذخیره یافت نشد" });

  try {
    const issuance = await prisma.$transaction(async (tx: any) => {
      const lastNumber = await tx.warehouseJournalEntryIssuance.findFirst({
        where: { fiscalPeriodId: fiscalPeriod.id },
        orderBy: { number: "desc" },
      });
      const created = await tx.warehouseJournalEntryIssuance.create({
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          number: lastNumber ? lastNumber.number + 1 : 1,
          toDate: toDateDay,
          accountingGroupIds: (req.body as CandidatesQueryInput).accountingGroupIds || null,
          rowCount: matched.length,
          status: "DRAFT",
        },
      });
      await tx.documentItemAmount.updateMany({
        where: { id: { in: matched.map((r: { id: number }) => r.id) } },
        data: { warehouseJournalEntryIssuanceId: created.id },
      });
      return created;
    });

    res.json({ id: issuance.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/issue-warehouse-journal-entries/:id(\\d+)", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.warehouseJournalEntryIssuance.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "این مورد قبلا صادر شده و قابل ویرایش نیست" });

  const resolved = await resolveCandidatesWhere(req.body as CandidatesQueryInput);
  if ("error" in resolved) return res.status(400).json({ error: resolved.error });
  const { where, toDateDay } = resolved;

  try {
    await prisma.$transaction(async (tx: any) => {
      // ابتدا قفل فعلی همین پیش‌نویس آزاد می‌شود تا اگر فیلتر جدید همان ردیف‌های قبلی را هم دربر بگیرد،
      // به‌اشتباه به‌عنوان «متعلق به فرم دیگر» مستثنی نشوند.
      await tx.documentItemAmount.updateMany({ where: { warehouseJournalEntryIssuanceId: id }, data: { warehouseJournalEntryIssuanceId: null } });

      const matched = await tx.documentItemAmount.findMany({ where, select: { id: true } });
      if (matched.length === 0) throw new Error("موردی برای ذخیره یافت نشد");

      await tx.documentItemAmount.updateMany({
        where: { id: { in: matched.map((r: { id: number }) => r.id) } },
        data: { warehouseJournalEntryIssuanceId: id },
      });
      await tx.warehouseJournalEntryIssuance.update({
        where: { id },
        data: {
          toDate: toDateDay,
          accountingGroupIds: (req.body as CandidatesQueryInput).accountingGroupIds || null,
          rowCount: matched.length,
        },
      });
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

// صدور واقعی سند حسابداری — دقیقاً روی همان ردیف‌هایی عمل می‌کند که با «ذخیره» به این هدر قفل شده‌اند
// (warehouseJournalEntryIssuanceId=id)، نه یک کوئری تازه بر مبنای فیلتر — طبق تصمیم صریح کاربر
// (۱۴۰۵/۰۶/۱۶: «برای اینکه سیستم بتواند تشخیص دهد این رکوردها متعلق به این فرم هستند»). هر ردیف دقیقاً دو
// خط تولید می‌کند (بدهکار+بستانکار). حساب معین «موجودی کالا» بر مبنای (گروه حسابداری کالای ردیف + گروه
// انبارِ انبار سند) از تنظیمات «حسابداری کالا و خدمت» خوانده می‌شود؛ حساب طرف مقابل («بستانکار رسید انبار»
// برای ردیف‌های ورودی به انبار، «بدهکار حواله انبار» برای ردیف‌های خروجی) بر مبنای همان گروه حسابداری +
// warehouseDocType برابر نوع سند ردیف. تفصیل۱/۲/۳ فقط وقتی روی هرکدام از این دو معین ست می‌شود که آن معین،
// در یکی از سه اسلات خودش (detailType1/2/3Id)، به نوع تفصیلِ کدِ تفصیل سند (InventoryDocument.detailCode —
// طرف حساب/مرکز هزینه/پروژه، بسته به نوع سند) وصل باشد.
router.post("/issue-warehouse-journal-entries/:id(\\d+)/issue", can(`${FORM}.issue`), async (req, res) => {
  const id = Number(req.params.id);
  const issuance = await prisma.warehouseJournalEntryIssuance.findUnique({ where: { id } });
  if (!issuance) return res.status(404).json({ error: "یافت نشد" });
  if (issuance.status !== "DRAFT") return res.status(400).json({ error: "این مورد قبلا صادر شده است" });

  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) return res.status(400).json({ error: "ارز پایه تعریف نشده است" });

  const validRows = await prisma.documentItemAmount.findMany({
    where: { warehouseJournalEntryIssuanceId: id },
    include: {
      line: {
        include: {
          document: true,
          goodsItem: { select: { id: true, fullCode: true, title: true, accountingGroupId: true } },
        },
      },
    },
    orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
  });

  if (validRows.length === 0) return res.status(400).json({ error: "موردی برای صدور یافت نشد" });

  // طبق فرمت استاندارد خطای عملیات دسته‌ای (lib/bulkError.ts): هر شکست، یک ردیف ساختاریافته با ستون‌های
  // قابل‌نمایش/دانلود (نه یک رشته‌ی از‌قبل‌فرمت‌شده) — تا فرانت‌اند بتواند آن‌ها را در قالب اکسل دانلودپذیر نشان دهد
  const errors: { itemCode: string; itemTitle: string; documentType: string; documentNumber: number; reason: string }[] = [];
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

    const docTypeTitle = DOC_TYPE_FA[doc.documentType] ?? doc.documentType;
    if (!inventorySetting) {
      errors.push({
        itemCode: goodsItem.fullCode,
        itemTitle: goodsItem.title,
        documentType: docTypeTitle,
        documentNumber: doc.number,
        reason: "حساب «موجودی کالا» در حسابداری کالا و خدمت تعریف نشده است",
      });
      continue;
    }
    if (!contraSetting) {
      const natureTitle = direction === "IN" ? "بستانکار رسید انبار" : "بدهکار حواله انبار";
      errors.push({
        itemCode: goodsItem.fullCode,
        itemTitle: goodsItem.title,
        documentType: docTypeTitle,
        documentNumber: doc.number,
        reason: `حساب «${natureTitle}» در حسابداری کالا و خدمت تعریف نشده است`,
      });
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

  if (errors.length > 0) {
    return sendBulkError(res, 400, `${errors.length} ردیف قادر به صدور نبودند؛ برای مشاهده‌ی علت هر مورد، جزئیات خطا را دانلود کنید.`, errors);
  }

  try {
    const docType = await prisma.documentType.findFirst({ where: { systemKey: "WAREHOUSE_DOCUMENTS" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «اسناد انبار» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: issuance.toDate,
      documentTypeId: docType.id,
      description: `سند حسابداری اسناد انبار تا تاریخ ${formatJalaliDateForMessage(issuance.toDate)}`,
      issuingSystem: "WAREHOUSE",
      isManual: false,
      lines,
      sources: [{ label: "صدور سند حسابداری اسناد انبار", path: "/warehouse-accounting/issue-journal-entries" }],
    });

    await prisma.$transaction([
      prisma.documentItemAmount.updateMany({
        where: { id: { in: validRows.map((r) => r.id) } },
        data: { journalEntryId: entry.id },
      }),
      prisma.warehouseJournalEntryIssuance.update({
        where: { id },
        data: { journalEntryId: entry.id, status: "ISSUED" },
      }),
    ]);

    res.json({
      id,
      journalEntryId: entry.id,
      referenceNumber: entry.referenceNumber,
      rowCount: validRows.length,
      lineCount: lines.length,
      message: entry.message,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند" });
  }
});

// =========================================================================
// فهرست/مشاهده/ردیف‌ها/حذف — طبق تصمیم صریح کاربر: این فرم دیگر صرفاً یک فرم واسط بی‌سابقه نیست؛ هر
// «ذخیره» یک ردیف هدر ثبت می‌کند که ردیف‌های قفل‌شده‌ی خودش را دارد و از همین‌جا قابل ویرایش/صدور/حذف است.
// =========================================================================

router.get("/issue-warehouse-journal-entries", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.warehouseJournalEntryIssuance.findMany({
    include: { journalEntry: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((i: any) => ({
      id: i.id,
      number: i.number,
      toDate: i.toDate,
      status: i.status,
      rowCount: i.rowCount,
      journalEntryId: i.journalEntryId,
      journalEntryReferenceNumber: i.journalEntry?.referenceNumber ?? null,
      createdAt: i.createdAt,
    }))
  );
});

router.get("/issue-warehouse-journal-entries/:id(\\d+)", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const i = await prisma.warehouseJournalEntryIssuance.findUnique({ where: { id }, include: { journalEntry: true } });
  if (!i) return res.status(404).json({ error: "یافت نشد" });

  const groupIds = (i.accountingGroupIds ?? "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
  const groups = groupIds.length ? await prisma.accountingGroup.findMany({ where: { id: { in: groupIds } } }) : [];

  res.json({
    id: i.id,
    number: i.number,
    toDate: i.toDate,
    status: i.status,
    accountingGroupIds: i.accountingGroupIds,
    accountingGroupTitles: groups.map((g) => g.title),
    rowCount: i.rowCount,
    journalEntryId: i.journalEntryId,
    journalEntryReferenceNumber: i.journalEntry?.referenceNumber ?? null,
    journalEntryNumber: i.journalEntry?.number ?? null,
    journalEntryStatus: i.journalEntry?.status ?? null,
    createdAt: i.createdAt,
  });
});

// ردیف‌های ذخیره‌شده‌ی همین هدر (چه پیش‌نویس چه صادرشده) — طبق تصمیم صریح کاربر: بازکردن فرم برای ویرایش
// باید دقیقاً همان مواردی را نشان دهد که قبلاً لود/ذخیره شده‌اند، نه یک کوئری تازه‌ی candidates.
router.get("/issue-warehouse-journal-entries/:id(\\d+)/lines", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const { page: pageRaw, pageSize: pageSizeRaw, filters } = req.query as { page?: string; pageSize?: string; filters?: string };
  const cf = parseColumnFilters(filters);

  const lineWhere: any = {};
  if (cf.documentDate || cf.documentNumber || cf.documentTypeKeys) {
    lineWhere.document = {
      ...(cf.documentDate ? { date: cf.documentDate } : {}),
      ...(cf.documentNumber ? { number: cf.documentNumber } : {}),
      ...(cf.documentTypeKeys ? { documentType: { in: cf.documentTypeKeys } } : {}),
    };
  }
  if (cf.itemCode || cf.itemTitle || cf.accountingGroupTitle) {
    lineWhere.goodsItem = {
      ...(cf.itemCode ? { fullCode: cf.itemCode } : {}),
      ...(cf.itemTitle ? { title: cf.itemTitle } : {}),
      ...(cf.accountingGroupTitle ? { accountingGroup: { title: cf.accountingGroupTitle } } : {}),
    };
  }

  const where: any = { warehouseJournalEntryIssuanceId: id };
  if (Object.keys(lineWhere).length > 0) where.line = lineWhere;
  if (cf.accountingDate) where.effectiveDate = cf.accountingDate;
  if (cf.amount) where.difference = cf.amount;
  if (cf.priceTypeKeys) where.priceType = { in: cf.priceTypeKeys };

  const page = Math.max(1, parseInt(pageRaw as string, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw as string, 10) || 25));

  const [total, rows] = await Promise.all([
    prisma.documentItemAmount.count({ where }),
    prisma.documentItemAmount.findMany({
      where,
      include: CANDIDATE_INCLUDE,
      orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ items: rows.map(mapCandidateRow), total });
});

// حذف فقط سند حسابداری صادرشده — ردیف‌های قفل‌شده و خودِ هدر باقی می‌مانند (برمی‌گردد به وضعیت پیش‌نویس)
// تا کاربر بتواند دوباره ویرایش/صدور کند؛ دقیقاً هم‌الگوی «حذف سند حسابداری» در فاکتور خرید.
router.delete("/issue-warehouse-journal-entries/:id(\\d+)/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const i = await prisma.warehouseJournalEntryIssuance.findUnique({ where: { id } });
  if (!i) return res.status(404).json({ error: "یافت نشد" });
  if (!i.journalEntryId) return res.status(400).json({ error: "برای این مورد سندی صادر نشده است" });

  try {
    await prisma.$transaction([
      prisma.documentItemAmount.updateMany({
        where: { warehouseJournalEntryIssuanceId: id },
        data: { journalEntryId: null },
      }),
      prisma.warehouseJournalEntryIssuance.update({ where: { id }, data: { journalEntryId: null, status: "DRAFT" } }),
      prisma.journalEntry.delete({ where: { id: i.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند" });
  }
});

// حذف کامل هدر — فقط تا وقتی هنوز صادر نشده (پیش‌نویس)؛ برای موارد صادرشده اول باید سند حسابداری حذف شود.
router.delete("/issue-warehouse-journal-entries/:id(\\d+)", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const i = await prisma.warehouseJournalEntryIssuance.findUnique({ where: { id } });
  if (!i) return res.status(404).json({ error: "یافت نشد" });
  if (i.status !== "DRAFT") return res.status(400).json({ error: "این مورد سند حسابداری صادرشده دارد؛ ابتدا از داخل فرم، «حذف سند حسابداری» را بزنید" });

  await prisma.$transaction([
    prisma.documentItemAmount.updateMany({ where: { warehouseJournalEntryIssuanceId: id }, data: { warehouseJournalEntryIssuanceId: null } }),
    prisma.warehouseJournalEntryIssuance.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
