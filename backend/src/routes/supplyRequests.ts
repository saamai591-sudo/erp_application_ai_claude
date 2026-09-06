import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("supply-requests");

// =========================================================================
// سند «درخواست تامین» — طبق مستند پروژه «درخواست تامین» (که در فایل مبدا با عنوان داخلی
// «درخواست خرید» ذخیره شده). جزئیات تصمیم‌های تفسیری (فیلد «مسیر تامین»، وضعیت‌های ۵گانه، ...)
// در claude/سرویس-درخواست-کالا-و-تامین.md مستند شده است.
// =========================================================================

const router = Router();

interface LineInput {
  sourceGoodsRequestLineId?: number | null;
  goodsItemId: number;
  unitId: number;
  quantity: number;
  description?: string | null;
}

interface HeaderBody {
  date: string;
  basis: "FROM_GOODS_REQUEST" | "NO_BASIS";
  route: "TRANSFER" | "PURCHASE";
  orgUnitId: number;
  description?: string;
  lines: LineInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function validateAndCleanLines(lines: LineInput[], basis: string) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("درخواست تامین باید حداقل یک ردیف کالا داشته باشد");
  }
  const cleaned: LineInput[] = [];
  for (const [idx, l] of lines.entries()) {
    if (!l.unitId) throw new Error(`واحد سنجش برای ردیف ${idx + 1} الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار درخواست ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId;
    let sourceGoodsRequestLineId: number | null = null;

    if (basis === "FROM_GOODS_REQUEST") {
      if (!l.sourceGoodsRequestLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف درخواست کالای مبدا الزامی است`);
      const source = await prisma.goodsRequestLine.findUnique({ where: { id: l.sourceGoodsRequestLineId } });
      if (!source) throw new Error(`ردیف درخواست کالای مبدا برای ردیف ${idx + 1} یافت نشد`);
      sourceGoodsRequestLineId = source.id;
      goodsItemId = source.goodsItemId; // طبق مستند: با انتخاب ردیف، کد کالا/واحد از ردیف مبدا می‌آید
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است (نه خدمت)`);
    if (!item.isActive) throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);

    cleaned.push({
      sourceGoodsRequestLineId,
      goodsItemId,
      unitId: l.unitId,
      quantity: qty,
      description: l.description || null,
    });
  }
  return cleaned;
}

async function hasDownstreamUsage(supplyRequestId: number) {
  // طبق مستند «درخواست خرید» (زنجیره تامین > عملیات): ردیف درخواست تامین می‌تواند مبنای ردیف
  // درخواست خرید قرار بگیرد. رسید انبار/حواله انبار هنوز ساخته نشده‌اند (جای آماده برای آینده).
  const count = await prisma.purchaseRequestLine.count({ where: { sourceSupplyRequestLine: { supplyRequestId } } });
  return count > 0;
}

// گردش جایگزین «انتخابگر درخواست تامین»: برای استفاده در فرم «درخواست خرید» (زنجیره تامین > عملیات)
// که ردیف‌های تایید‌شده‌ی درخواست تامین با مسیر «خرید» و مانده مثبت را برای انتخاب نمایش می‌دهد.
router.get("/pickable-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;

  const lines = await prisma.supplyRequestLine.findMany({
    where: {
      supplyRequest: { status: "APPROVED", route: "PURCHASE", ...(destDate ? { date: { lte: destDate } } : {}) },
    },
    include: {
      supplyRequest: true,
      goodsItem: true,
      unit: true,
      purchaseRequestLines: true,
    },
    orderBy: { id: "desc" },
  });

  const result = lines
    .map((l: any) => {
      const done = l.purchaseRequestLines.reduce((s: number, pl: any) => s + Number(pl.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        supplyRequestLineId: l.id,
        supplyRequestId: l.supplyRequest.id,
        number: l.supplyRequest.number,
        rowOrder: l.rowOrder,
        date: l.supplyRequest.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity,
        done,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);

  res.json(result);
});

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.supplyRequest.findMany({
    include: { orgUnit: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      basis: d.basis,
      route: d.route,
      orgUnitId: d.orgUnitId,
      orgUnitTitle: d.orgUnit.title,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
    }))
  );
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({
    where: { id },
    include: {
      orgUnit: true,
      reviewer: true,
      approver: true,
      lines: {
        include: { goodsItem: true, unit: true, sourceGoodsRequestLine: { include: { goodsRequest: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "درخواست تامین یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    basis: d.basis,
    route: d.route,
    orgUnitId: d.orgUnitId,
    orgUnitTitle: d.orgUnit.title,
    description: d.description,
    status: d.status,
    reviewerId: d.reviewerId,
    reviewerName: d.reviewer ? `${d.reviewer.firstName} ${d.reviewer.lastName}`.trim() : null,
    reviewedAt: d.reviewedAt,
    approverId: d.approverId,
    approverName: d.approver ? `${d.approver.firstName} ${d.approver.lastName}`.trim() : null,
    approvedAt: d.approvedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
      sourceGoodsRequestNumber: l.sourceGoodsRequestLine?.goodsRequest?.number ?? null,
      sourceGoodsRequestRowOrder: l.sourceGoodsRequestLine?.rowOrder ?? null,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      description: l.description,
    })),
  });
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date || !body.basis || !body.route || !body.orgUnitId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مسیر تامین و واحد سازمانی الزامی است" });
  }

  try {
    const orgUnit = await prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } });
    if (!orgUnit) throw new Error("واحد سازمانی یافت نشد");

    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const lines = await validateAndCleanLines(body.lines, body.basis);

    const lastNumber = await prisma.supplyRequest.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.supplyRequest.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        basis: body.basis,
        route: body.route,
        orgUnitId: orgUnit.id,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت درخواست تامین" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.supplyRequest.findUnique({ where: { id }, include: { lines: true } });
  if (!existing) return res.status(404).json({ error: "درخواست تامین یافت نشد" });
  if (await hasDownstreamUsage(id)) return res.status(400).json({ error: "این درخواست گردش دارد و قابل ویرایش نیست" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل ویرایش هستند" });
  // کنترل ۳: با درج آیتم، امکان ویرایش هدر وجود ندارد (سخت‌گیرانه‌تر از درخواست کالا)
  if (existing.lines.length > 0) {
    const headerChanged =
      body.basis !== existing.basis ||
      body.route !== existing.route ||
      body.orgUnitId !== existing.orgUnitId ||
      new Date(body.date).toISOString().slice(0, 10) !== existing.date.toISOString().slice(0, 10);
    if (headerChanged) return res.status(400).json({ error: "این درخواست ردیف کالا دارد؛ امکان ویرایش هدر وجود ندارد" });
  }

  if (!body.date || !body.basis || !body.route || !body.orgUnitId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مسیر تامین و واحد سازمانی الزامی است" });
  }

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این درخواست تامین");
    const orgUnit = await prisma.orgUnit.findUnique({ where: { id: body.orgUnitId } });
    if (!orgUnit) throw new Error("واحد سازمانی یافت نشد");

    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const lines = await validateAndCleanLines(body.lines, body.basis);

    await prisma.$transaction([
      prisma.supplyRequestLine.deleteMany({ where: { supplyRequestId: id } }),
      prisma.supplyRequest.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          route: body.route,
          orgUnitId: orgUnit.id,
          description: body.description || null,
          lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (await hasDownstreamUsage(id)) return res.status(400).json({ error: "این درخواست گردش دارد و قابل حذف نیست" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل حذف هستند" });
  await prisma.supplyRequest.delete({ where: { id } });
  res.status(204).send();
});

// بررسی: از ثبت → بررسی‌شده (طبق تصمیم پروژه: مطابق درخواست کالا، ۵ وضعیت کامل پیاده شد)
router.post("/:id/review", can(`${FORM}.review`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل بررسی هستند" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "REVIEWED" } });
  res.json({ id, status: "REVIEWED" });
});

router.post("/:id/unreview", can(`${FORM}.unreview`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "REVIEWED") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «بررسی شده» قابل برگشت هستند" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ id, status: "DRAFT" });
});

// تایید: از ثبت یا بررسی‌شده → تایید
router.post("/:id/approve", can(`${FORM}.approve`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT" && d.status !== "REVIEWED") {
    return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» یا «بررسی شده» قابل تایید هستند" });
  }
  if (d.lines.length === 0) return res.status(400).json({ error: "درخواست باید حداقل یک ردیف کالا داشته باشد" });

  await prisma.supplyRequest.update({
    where: { id },
    data: { status: "APPROVED", approverId: req.user?.id, approvedAt: new Date() },
  });
  res.json({ id, status: "APPROVED" });
});

// برگشت از تایید: از تایید → بررسی‌شده
router.post("/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل برگشت هستند" });
  if (await hasDownstreamUsage(id)) return res.status(400).json({ error: "این درخواست گردش دارد و امکان برگشت تایید وجود ندارد" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "REVIEWED" } });
  res.json({ id, status: "REVIEWED" });
});

// رد درخواست: از ثبت → رد
router.post("/:id/reject", can(`${FORM}.reject`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «ثبت» قابل رد هستند" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "REJECTED" } });
  res.json({ id, status: "REJECTED" });
});

router.post("/:id/unreject", can(`${FORM}.unreject`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "REJECTED") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «رد» قابل برگشت هستند" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "DRAFT" } });
  res.json({ id, status: "DRAFT" });
});

// پایان درخواست: از تایید → پایان
router.post("/:id/close", can(`${FORM}.close`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.supplyRequest.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط درخواست‌های در وضعیت «تایید» قابل پایان دادن هستند" });
  await prisma.supplyRequest.update({ where: { id }, data: { status: "CLOSED" } });
  res.json({ id, status: "CLOSED" });
});

export default router;
