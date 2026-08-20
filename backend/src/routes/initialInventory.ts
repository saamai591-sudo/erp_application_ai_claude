import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertNoNegativeStockAfterChange } from "../services/warehouseStockService";
import { validateTrackingFields, resolveTrackingRefs, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertWarehouseOpenForDate } from "../services/inventoryClosingService";

// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=INITIAL_INVENTORY) ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId: number;
  quantity: number;
  unitCost?: number;
  serialNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  physicalLocation?: string | null;
}

interface HeaderBody {
  warehouseId: number;
  date: string;
  description?: string;
  lines: LineInput[];
}

// مبلغ همیشه توسط بک‌اند از روی مقدار × فی محاسبه می‌شود (نه از ورودی کاربر) تا این قانون
// («مقدار هرگز از مبلغ/فی مشتق نمی‌شود، ولی مبلغ همیشه از مقدار×فی به دست می‌آید») همیشه برقرار باشد؛
// تصمیم اینکه کاربر «فی» را وارد کرده یا «مبلغ» را (و بازمحاسبه‌ی فی از مبلغ) به عهده‌ی فرانت‌اند است،
// چون فقط رابطه‌ی نهایی (مقدار، فی) برای بک‌اند اهمیت دارد.
// طبق بند ۳-۴ «مستند عمومی عملیات انبار»: «مبلغ بر اساس تعداد ارقام اعشار ارز پایه(مبنا) گرد و ذخیره
// می‌شود» — یعنی این عدد رند (۲ رقم) نباید هاردکد باشد، بلکه باید از فیلد decimalPlaces ارز پایه خوانده
// شود.
function computeAmount(quantity: number, unitCost: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(quantity * unitCost * factor) / factor;
}

// ارز پایه (isBase=true) طبق همان الگوی مورد استفاده در بقیه‌ی ماژول‌های پروژه (سند حسابداری،
// افتتاحیه/اختتامیه، بانکداری و ...) پیدا می‌شود؛ اگر ارز پایه تعریف نشده باشد، خطای واضح داده می‌شود
// تا سند ناقص/نادرست ذخیره نشود.
async function getBaseCurrencyDecimalPlaces(): Promise<number> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

async function validateLines(lines: LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("سند باید حداقل یک ردیف کالا داشته باشد");
  }
  for (const [idx, l] of lines.entries()) {
    if (!l.goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    if (!l.unitId) throw new Error(`واحد سنجش برای ردیف ${idx + 1} الزامی است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد (مقدار منفی یا صفر مجاز نیست)`);
    const cost = Number(l.unitCost) || 0;
    if (cost < 0) throw new Error(`فی واحد ردیف ${idx + 1} نمی‌تواند منفی باشد`);
  }
  // کلید تکراری‌بودن شامل سریال/بچ هم می‌شود تا کالای سریال‌پذیر/بچ‌پذیر بتواند با سریال/بچ متفاوت
  // بیش از یک‌بار در سند تکرار شود
  const seen = new Set<string>();
  for (const [idx, l] of lines.entries()) {
    const key = `${l.goodsItemId}|${l.serialNumber || ""}|${l.batchNumber || ""}`;
    if (seen.has(key)) throw new Error(`کالای ردیف ${idx + 1} تکراری است؛ هر کالا (با همان سریال/بچ) فقط یک‌بار در سند مجاز است`);
    seen.add(key);
  }
  await validateTrackingFields(lines);
}

// انبار فعال و دوره مالیِ باز طبق قوانین ۱۱ و ۱۲ مستند موجودی اول دوره؛ کنترل دوره مالی باز با همان
// سرویس مرکزی assertDateNotConfirmed انجام می‌شود که در کل سیستم برای «قفل شدن دوره پس از تایید اسناد»
// استفاده می‌شود، چون این پروژه فیلد صریح باز/بسته‌ی جداگانه‌ای برای دوره مالی ندارد.
async function validateWarehouseAndPeriod(warehouseId: number, date: Date) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error("انبار یافت نشد");
  if (!warehouse.isActive) throw new Error("این انبار غیرفعال است و امکان ثبت موجودی اول دوره برای آن وجود ندارد");

  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

router.get("/", async (_req, res) => {
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "INITIAL_INVENTORY" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      warehouseId: d.warehouseId,
      warehouseTitle: d.warehouse.title,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      creationType: d.creationType,
      status: d.status,
      lineCount: d.lines.length,
      totalQuantity: d.lines.reduce((s: number, l: any) => s + Number(l.quantity), 0),
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "INITIAL_INVENTORY" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batch: true, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    warehouseId: d.warehouseId,
    warehouseTitle: d.warehouse!.title,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    creationType: d.creationType,
    status: d.status,
    finalizedAt: d.finalizedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitCost: Number(l.unitCost),
      amount: Number(l.amount),
      serialNumber: l.serials[0]?.serial.serialNumber ?? null,
      batchNumber: l.batch?.batchNumber ?? null,
      expiryDate: l.batch?.expiryDate ?? null,
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

router.post("/", async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    await validateLines(body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();
    const refs = await resolveTrackingRefs(body.lines, warehouse.id);

    // قانون ۲: حداکثر یک سند موجودی اول دوره برای هر انبار در هر دوره مالی
    const dup = await prisma.inventoryDocument.findFirst({
      where: { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, fiscalPeriodId: fiscalPeriod.id },
    });
    if (dup) return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });

    const lastNumber = await prisma.inventoryDocument.findFirst({
      where: { documentType: "INITIAL_INVENTORY", fiscalPeriodId: fiscalPeriod.id },
      orderBy: { number: "desc" },
    });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.inventoryDocument.create({
      data: {
        documentType: "INITIAL_INVENTORY",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        creationType: "MANUAL",
        status: "DRAFT",
        lines: {
          create: body.lines.map((l, idx) => {
            const quantity = Number(l.quantity);
            const unitCost = Number(l.unitCost) || 0;
            return {
              goodsItemId: l.goodsItemId,
              unitId: l.unitId,
              quantity,
              unitCost,
              amount: computeAmount(quantity, unitCost, decimalPlaces),
              rowOrder: idx,
              batchId: refs[idx].batchId,
              physicalLocationId: refs[idx].physicalLocationId,
              serials: refs[idx].serialId ? { create: [{ serialId: refs[idx].serialId! }] } : undefined,
            };
          }),
        },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" } });
  if (!existing) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
  if (existing.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل ویرایش نیست" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    await validateLines(body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();
    const refs = await resolveTrackingRefs(body.lines, warehouse.id);

    if (warehouse.id !== existing.warehouseId || fiscalPeriod.id !== existing.fiscalPeriodId) {
      const dup = await prisma.inventoryDocument.findFirst({
        where: { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, fiscalPeriodId: fiscalPeriod.id, NOT: { id } },
      });
      if (dup) return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    }

    await prisma.$transaction([
      prisma.inventoryDocumentLine.deleteMany({ where: { documentId: id } }),
      prisma.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          description: body.description || null,
          lines: {
            create: body.lines.map((l, idx) => {
              const quantity = Number(l.quantity);
              const unitCost = Number(l.unitCost) || 0;
              return {
                goodsItemId: l.goodsItemId,
                unitId: l.unitId,
                quantity,
                unitCost,
                amount: computeAmount(quantity, unitCost, decimalPlaces),
                rowOrder: idx,
                batchId: refs[idx].batchId,
                physicalLocationId: refs[idx].physicalLocationId,
                serials: refs[idx].serialId ? { create: [{ serialId: refs[idx].serialId! }] } : undefined,
              };
            }),
          },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

// ویرایش «فقط مبلغی» از ماژول حسابداری انبار: طبق تصمیم کاربر، در حسابداری انبار امکان ثبت سند جدید
// نیست و ویرایش هم فقط باید فی/مبلغ ردیف‌های موجود را تغییر دهد (مقدار، کالا، واحد، انبار، تاریخ و
// شماره‌ی سند دست‌نخورده می‌مانند). برخلاف PUT معمولی (که فقط روی DRAFT کار می‌کند)، این مسیر روی
// اسناد FINALIZED هم کار می‌کند چون قیمت‌گذاری معمولاً بعد از قطعی‌شدن سند (با فاکتور خرید یا مشابه)
// انجام می‌شود؛ فقط اسناد سیستمی و ابطال‌شده مسدود هستند.
router.put("/:id/accounting", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { lines: { id: number; unitCost: number }[] };

  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" }, include: { lines: true } });
  if (!existing) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
  if (existing.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل ویرایش نیست" });
  if (existing.status === "VOID") return res.status(400).json({ error: "سند ابطال‌شده قابل ویرایش نیست" });

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return res.status(400).json({ error: "فهرست ردیف‌ها الزامی است" });
  }

  try {
    await assertDateNotConfirmed(prisma, existing.date, existing.fiscalPeriodId);
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);
    const decimalPlaces = await getBaseCurrencyDecimalPlaces();

    const existingLineIds = new Set(existing.lines.map((l: any) => l.id));
    for (const [idx, l] of body.lines.entries()) {
      if (!existingLineIds.has(l.id)) throw new Error(`ردیف ${idx + 1} متعلق به این سند نیست`);
      const cost = Number(l.unitCost);
      if (!(cost >= 0)) throw new Error(`فی واحد ردیف ${idx + 1} نمی‌تواند منفی باشد`);
    }

    const lineById = new Map<number, any>(existing.lines.map((l: any) => [l.id, l]));

    await prisma.$transaction(
      body.lines.map((l) => {
        const line = lineById.get(l.id)!;
        const unitCost = Number(l.unitCost) || 0;
        return prisma.inventoryDocumentLine.update({
          where: { id: l.id },
          data: {
            unitCost,
            amount: computeAmount(Number(line.quantity), unitCost, decimalPlaces),
          },
        });
      })
    );

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل حذف نیست" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «قطعی» برگردانید" });
  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  await prisma.inventoryDocument.delete({ where: { id } });
  res.status(204).send();
});

// قطعی کردن: از این لحظه سند در موجودی انبار اثر می‌گذارد (طبق مستند عمومی عملیات انبار)
router.post("/:id/finalize", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل قطعی‌کردن نیست" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل قطعی‌کردن هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف کالا داشته باشد" });

  try {
    // بازبینی مجدد قوانین ۱۱ و ۱۲ در لحظه‌ی قطعی‌کردن (ممکن است از زمان ثبت پیش‌نویس، انبار غیرفعال
    // یا دوره مالی بسته شده باشد)
    await validateWarehouseAndPeriod(d.warehouseId!, d.date);

    await prisma.$transaction([
      prisma.inventoryDocument.update({ where: { id }, data: { status: "FINALIZED", finalizedAt: new Date() } }),
      prisma.warehouse.update({ where: { id: d.warehouseId! }, data: { hasTransactions: true } }),
      ...d.lines.map((l: any) => prisma.goodsItem.update({ where: { id: l.goodsItemId }, data: { hasTransactions: true } })),
    ]);

    res.json({ id, status: "FINALIZED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در قطعی‌کردن سند" });
  }
});

// برگشت از قطعی: طبق قانون ۹، پیش از برگشت باید مطمئن شویم موجودی کالا در انبار (از تاریخ سند به بعد)
// منفی نمی‌شود؛ این کنترل از طریق سرویس مرکزی مشترک warehouseStockService انجام می‌شود
router.post("/:id/revert", async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" }, include: { lines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل برگشت نیست" });
  if (d.status !== "FINALIZED") return res.status(400).json({ error: "فقط اسناد «قطعی» قابل برگشت هستند" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);

    for (const l of d.lines) {
      // eslint-disable-next-line no-await-in-loop
      // توجه: سند در این لحظه هنوز «قطعی» است (پیش‌شرط بالا)، پس قبلاً در محاسبه‌ی موجودی جاری لحاظ
      // شده — نباید با excludeInitialInventoryId دوباره از محاسبه کنار گذاشته شود، وگرنه اثر برگشت
      // (کم‌شدن این مقدار) دوبار اعمال می‌شود و خطای کاذب «موجودی منفی می‌شود» می‌دهد.
      await assertNoNegativeStockAfterChange({
        warehouseId: d.warehouseId!,
        goodsItemId: l.goodsItemId,
        asOfDate: d.date,
        delta: -Number(l.quantity),
      });
    }

    await prisma.inventoryDocument.update({ where: { id }, data: { status: "DRAFT", finalizedAt: null } });
    await recomputeGoodsItemHasTransactions(d.lines.map((l: any) => l.goodsItemId));
    await recomputeWarehouseHasTransactions([d.warehouseId!]);
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از قطعی" });
  }
});

export default router;
