import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { priceItem, revertItem, getLastPricedPeriod } from "../services/goodsPricingService";

const router = Router();
const MAX_PAGE_SIZE = 100;

// جست‌وجوی سمت سرور کالا برای Dialog انتخاب کالا — طبق مستند: کل کالاهای سیستم یکجا به کلاینت
// ارسال نمی‌شود، حداکثر ۱۰۰ ردیف در هر صفحه
router.get("/candidates", async (req, res) => {
  const { reportingPeriodId: rpRaw, operation, search, accountingGroupId: agRaw, page: pageRaw, pageSize: pageSizeRaw } = req.query as {
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

  if (operation === "PRICE") {
    where.id = { notIn: pricedIds.length ? pricedIds : [-1] };
  } else {
    where.id = { in: pricedIds.length ? pricedIds : [-1] };
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
