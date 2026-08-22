import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { priceItem, revertItem, getLastPricedPeriod, PRICING_DOC_TYPES } from "../services/goodsPricingService";

const router = Router();
const MAX_PAGE_SIZE = 100;

// جست‌وجوی سمت سرور کالا برای Dialog انتخاب کالا — طبق مستند: کل کالاهای سیستم یکجا به کلاینت
// ارسال نمی‌شود، حداکثر ۱۰۰ ردیف در هر صفحه
router.get("/candidates", async (req, res) => {
  const {
    reportingPeriodId: rpRaw,
    operation,
    search,
    accountingGroupId: agRaw,
    page: pageRaw,
    pageSize: pageSizeRaw,
  } = req.query as {
    reportingPeriodId?: string;
    operation?: string;
    search?: string;
    accountingGroupId?: string;
    page?: string;
    pageSize?: string;
  };

  const reportingPeriodId = Number(rpRaw);
  if (!reportingPeriodId) return res.status(400).json({ error: "دوره گزارشگری الزامی است" });
  if (operation !== "PRICE" && operation !== "REVERT") return res.status(400).json({ error: "نوع عملیات نامعتبر است" });

  const page = Math.max(1, parseInt(pageRaw as string, 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw as string, 10) || MAX_PAGE_SIZE));

  const where: any = {};
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [{ title: { contains: q, mode: "insensitive" } }, { fullCode: { contains: q, mode: "insensitive" } }];
  }
  if (agRaw) where.accountingGroupId = Number(agRaw);

  const pricedStatuses = await prisma.goodsPricingStatus.findMany({
    where: { reportingPeriodId },
    select: { goodsItemId: true },
  });
  const pricedIds = pricedStatuses.map((s) => s.goodsItemId);

  // فقط کالاهایی که از ابتدای سال مالی دوره گزارشگری انتخاب‌شده تا پایان خودِ آن دوره، حداقل یک سند
  // قطعی‌شده‌ی مؤثر در قیمت‌گذاری داشته‌اند نمایش داده می‌شوند
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, include: { fiscalPeriod: true } });
  if (!period) return res.status(400).json({ error: "دوره گزارشگری یافت نشد" });
  const flowLines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        status: "FINALIZED",
        documentType: { in: PRICING_DOC_TYPES as any },
        date: { gte: period.fiscalPeriod.fromDate, lte: period.toDate },
      },
    },
    select: { goodsItemId: true },
    distinct: ["goodsItemId"],
  });
  const flowIds = flowLines.map((l) => l.goodsItemId);

  if (operation === "PRICE") {
    const excluded = pricedIds.length ? pricedIds : [-1];
    where.id = { notIn: excluded, in: flowIds.length ? flowIds : [-1] };
  } else {
    const eligible = pricedIds.filter((id) => flowIds.includes(id));
    where.id = { in: eligible.length ? eligible : [-1] };
  }

  const [total, items] = await Promise.all([
    prisma.goodsItem.count({ where }),
    prisma.goodsItem.findMany({
      where,
      include: { accountingGroup: true },
      orderBy: { fullCode: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const rows = await Promise.all(
    items.map(async (item) => {
      const lastPeriod = await getLastPricedPeriod(item.id);
      return {
        id: item.id,
        code: item.code,
        fullCode: item.fullCode,
        title: item.title,
        accountingGroupTitle: item.accountingGroup.title,
        priced: operation === "REVERT" ? true : false,
        lastPricedPeriodTitle: lastPeriod?.title || null,
      };
    })
  );

  res.json({ items: rows, total, page, pageSize });
});

const DOC_TYPE_FA: Record<string, string> = {
  INITIAL_INVENTORY: "موجودی اول دوره",
  WAREHOUSE_RECEIPT: "رسید انبار خرید",
  WAREHOUSE_ADJUSTMENT: "انبارگردانی / تعدیل موجودی",
  SALES_DELIVERY: "حواله فروش",
  SALES_RETURN: "برگشت از فروش",
  SUPPLIER_RETURN: "برگشت به تامین‌کننده",
  PRODUCTION_RECEIPT: "رسید تولید",
  CENTER_CONSUMPTION: "مصرف مرکز هزینه",
  PROJECT_CONSUMPTION: "مصرف پروژه",
  PRODUCTION_CONSUMPTION: "مصرف تولید",
  CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
  PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
  PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
  FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
};

// گزارش «اصلاحیه‌های قیمت‌گذاری» — طبق مستند «موتور قیمت‌گذاری در حالت برگشت»: وقتی ردیفی که یک اجرای
// قیمت‌گذاری باید مقدارش را عوض کند، در دوره‌ای زودتر و قبلاً قیمت‌گذاری‌شده (قفل) باشد، آن اصلاحیه
// مستقیم روی amount سند نوشته نمی‌شود — پس تنها راه دیدن آن همین گزارش است
router.get("/corrections", async (req, res) => {
  const { goodsItemId, reportingPeriodId } = req.query as { goodsItemId?: string; reportingPeriodId?: string };

  const adjustments = await prisma.goodsPricingAdjustment.findMany({
    where: {
      ...(reportingPeriodId ? { status: { reportingPeriodId: Number(reportingPeriodId) } } : {}),
      ...(goodsItemId ? { status: { goodsItemId: Number(goodsItemId) } } : {}),
    },
    include: {
      status: { include: { goodsItem: true, reportingPeriod: true } },
      line: { include: { document: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  res.json(
    adjustments.map((a) => ({
      id: a.id,
      amount: Number(a.amount),
      appliedToLine: a.appliedToLine,
      createdAt: a.createdAt,
      goodsItemId: a.status.goodsItemId,
      goodsItemTitle: a.status.goodsItem.title,
      reportingPeriodId: a.status.reportingPeriodId,
      reportingPeriodTitle: a.status.reportingPeriod.title,
      documentType: a.line.document.documentType,
      documentTypeTitle: DOC_TYPE_FA[a.line.document.documentType] || a.line.document.documentType,
      documentNumber: a.line.document.number,
      documentDate: a.line.document.date,
    }))
  );
});

router.post("/run", async (req: AuthedRequest, res) => {
  const { reportingPeriodId: rpRaw, operation, goodsItemIds } = req.body as {
    reportingPeriodId: number;
    operation: "PRICE" | "REVERT";
    goodsItemIds: number[];
  };

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
