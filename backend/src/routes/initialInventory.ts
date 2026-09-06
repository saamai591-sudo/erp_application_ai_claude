import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { validateTrackingFields, resolveTrackingRefs, fetchCurrentSerialSteps, trackingCreateData, trackingResponseFields, recomputeGoodsItemHasTransactions, recomputeWarehouseHasTransactions } from "../utils/warehouseTracking";
import { assertSafeToReverseEffects, assertSafeToApplyEffects, reverseDocumentEffects, applyDocumentEffects } from "../services/documentEffectsService";
import { assertWarehouseOpenForDate } from "../services/warehouseConfirmationService";
import { assertRecordNotStale } from "../utils/concurrency";
import { AuthedRequest } from "../middleware/auth";
import { userHasAction, can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts, setLineAmount, computeUnitCost } from "../services/documentItemAmountService";

const FORM = findFormPrefix("warehousing-initial-inventory");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
const CONFIRM_PERMISSION = `${FORM}.accountingConfirm`;
const REVERT_PERMISSION = `${FORM}.accountingConfirmRevert`;

// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=INITIAL_INVENTORY) ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
//
// مبلغ/فی: طبق تصمیم صریح کاربر، دقیقاً هم‌الگوی رسید تولید (productionReceipts.ts) — کاربر ابتدا
// دکمه‌ی «تایید حسابداری» (/accounting-confirm) را می‌زند که status را فوراً به FINALIZED می‌برد، سپس
// فی/مبلغ هر ردیف را از طریق همین PUT معمولی (که بعد از FINALIZED فقط تغییر فی را می‌پذیرد) وارد
// می‌کند. تا وقتی Finalized نشده، فیلدهای مبلغی اصلاً در پاسخ GET برنمی‌گردند. ورود اکسل «فی/مبلغ
// موجودی اول دوره» (updateInitialInventoryAccounting/importProcessors «initial-inventory-cost») هم از
// همین قانون پیروی می‌کند — فقط روی اسناد از‌قبل Finalized کار می‌کند.

const router = Router();

interface LineInput {
  goodsItemId: number;
  unitId: number;
  quantity: number;
  unitCost?: number;
  serialIds?: number[];
  batchAllocations?: { batchId: number; quantity: number }[];
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

async function validateLines(lines: LineInput[], existingSerialIds?: Set<number>) {
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
  await validateTrackingFields(lines, "INITIAL_INVENTORY", existingSerialIds);
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
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);

  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  await assertWarehouseOpenForDate(warehouseId, date);

  return { warehouse, fiscalPeriod };
}

router.get("/", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const items = await prisma.inventoryDocument.findMany({
    where: { documentType: "INITIAL_INVENTORY" },
    include: { warehouse: true, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  const amountByLineId = await getLineAmounts(items.flatMap((d) => d.lines.map((l: any) => l.id)));
  res.json(
    items.map((d: any) => {
      // طبق تصمیم صریح کاربر: فیلدهای مبلغی تا وقتی سند Finalized نشده، اصلاً نمایش داده نمی‌شوند —
      // حتی برای کاربر دارای دسترسی «مشاهده اطلاعات حسابداری».
      const showAmount = canViewAccounting && d.status === "FINALIZED";
      return {
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
        ...(showAmount ? { totalAmount: d.lines.reduce((s: number, l: any) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
      };
    })
  );
});

router.get("/:id", can(`${FORM}.view`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const canViewAccounting = await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION);
  const d = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "INITIAL_INVENTORY" },
    include: {
      warehouse: true,
      fiscalPeriod: true,
      lines: {
        include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
  const showAmount = canViewAccounting && d.status === "FINALIZED";
  const amountByLineId = await getLineAmounts(d.lines.map((l) => l.id));
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
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      ...(showAmount ? { unitCost: computeUnitCost(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
      ...trackingResponseFields(l),
      physicalLocation: l.physicalLocation?.title ?? null,
    })),
  });
});

// منطق واقعیِ ایجاد سند — هم از مسیر POST معمولی (ثبت دستی) و هم از پردازشگر ورود اکسل
// (importProcessors/index.ts، entity «initial-inventory») صدا زده می‌شود تا هر دو مسیر دقیقاً یک
// قانون اعتبارسنجی/ایجاد داشته باشند، نه دو پیاده‌سازی که ممکن است با زمان از هم واگرا شوند.
export async function createInitialInventory(body: HeaderBody) {
  if (!body.warehouseId || !body.date) throw new Error("انبار و تاریخ سند الزامی است");

  await validateLines(body.lines);
  const date = new Date(body.date);
  const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
  const refs = await resolveTrackingRefs(body.lines, warehouse.id);
  const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

  // قانون ۲: حداکثر یک سند موجودی اول دوره برای هر انبار در هر دوره مالی
  const dup = await prisma.inventoryDocument.findFirst({
    where: { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, fiscalPeriodId: fiscalPeriod.id },
  });
  if (dup) throw new Error("برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است");

  const lastNumber = await prisma.inventoryDocument.findFirst({
    where: { documentType: "INITIAL_INVENTORY", fiscalPeriodId: fiscalPeriod.id },
    orderBy: { number: "desc" },
  });
  const number = lastNumber ? lastNumber.number + 1 : 1;

  const effectLines = body.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
  await assertSafeToApplyEffects(prisma, { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);

  // سند همان لحظه‌ی ذخیره اثر واقعی می‌گذارد (روی موجودی)، اما با status=REGISTERED — نه FINALIZED.
  // فقط با «تایید حسابداری» (اندپوینت جدا، بعد از این‌که کاربر حسابداری فی/مبلغ را وارد کرد) FINALIZED
  // می‌شود؛ پس فی/مبلغ همیشه صفر ثبت می‌شود، صرف‌نظر از آنچه در body آمده (دقیقاً هم‌الگوی
  // createWarehouseReceipt/createProductionReceipt).
  return prisma.$transaction(async (tx) => {
    const doc = await tx.inventoryDocument.create({
      data: {
        documentType: "INITIAL_INVENTORY",
        warehouseId: warehouse.id,
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        creationType: "MANUAL",
        status: "REGISTERED",
        lines: {
          create: body.lines.map((l, idx) => ({
            goodsItemId: l.goodsItemId,
            unitId: l.unitId,
            quantity: Number(l.quantity),
            rowOrder: idx,
            ...trackingCreateData(refs[idx], serialSteps),
          })),
        },
      },
    });
    await applyDocumentEffects(tx, { id: doc.id, documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, date }, effectLines);
    return doc;
  });
}

router.post("/", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  try {
    const created = await createInitialInventory(body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.inventoryDocument.findFirst({
    where: { id, documentType: "INITIAL_INVENTORY" },
    include: { lines: { include: { serials: true } }, warehouse: true },
  });
  if (!existing) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
  if (existing.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل ویرایش نیست" });
  const existingSerialIds = new Set(existing.lines.flatMap((l: any) => l.serials.map((s: any) => s.serialId)));

  // بعد از «تایید حسابداری» (status=FINALIZED)، این PUT دیگر امکان تغییر سرصفحه/مقدار/کالای ردیف‌ها را
  // نمی‌دهد — فقط فی هر ردیف (بر اساس ترتیب، نه id) قابل تغییر است؛ هر تفاوت دیگری رد می‌شود. دقیقاً
  // هم‌الگوی PUT در warehouseReceipts.ts/productionReceipts.ts.
  if (existing.status === "FINALIZED") {
    if (!(await userHasAction(req.user!.id, VIEW_ACCOUNTING_PERMISSION))) {
      return res.status(403).json({ error: "دسترسی لازم برای ویرایش فی/مبلغ این سند را ندارید" });
    }
    try {
      assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
      const headerChanged =
        Number(body.warehouseId) !== existing.warehouseId ||
        new Date(body.date).getTime() !== existing.date.getTime() ||
        (body.description || null) !== existing.description ||
        !Array.isArray(body.lines) ||
        body.lines.length !== existing.lines.length;
      if (headerChanged) {
        throw new Error("این سند تایید حسابداری شده است؛ فقط فی/مبلغ ردیف‌ها قابل ویرایش است، نه سرصفحه یا مقدار");
      }
      const sortedExisting = [...existing.lines].sort((a: any, b: any) => a.rowOrder - b.rowOrder);
      for (const [idx, l] of sortedExisting.entries()) {
        const incoming = body.lines[idx];
        if (
          Number(incoming.goodsItemId) !== l.goodsItemId ||
          Number(incoming.unitId) !== l.unitId ||
          Number(incoming.quantity) !== Number(l.quantity)
        ) {
          throw new Error(`این سند تایید حسابداری شده است؛ کالا/واحد/مقدار ردیف ${idx + 1} قابل تغییر نیست`);
        }
      }
      const decimalPlaces = await getBaseCurrencyDecimalPlaces();
      await prisma.$transaction(async (tx) => {
        for (const [idx, l] of sortedExisting.entries()) {
          const unitCost = Number((body.lines[idx] as any).unitCost) || 0;
          await setLineAmount(tx, {
            lineId: l.id,
            newAmount: computeAmount(Number(l.quantity), unitCost, decimalPlaces),
            priceType: "USER_ENTRY",
            createdById: req.user!.id,
          });
        }
      });
      return res.json({ id });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
  }

  if (!body.warehouseId || !body.date) return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    await assertWarehouseOpenForDate(existing.warehouseId!, existing.date);

    // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
    // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
    // کنترل‌های ایمنی انجام می‌دهد.
    const oldEffectLines = existing.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId!, date: existing.date };
    await assertSafeToReverseEffects(prisma, oldDoc, oldEffectLines, existing.warehouse!.stockControl);

    await validateLines(body.lines, existingSerialIds);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await resolveTrackingRefs(body.lines, warehouse.id);
    const serialSteps = await fetchCurrentSerialSteps(refs.flatMap((r) => r.serialIds));

    if (warehouse.id !== existing.warehouseId || fiscalPeriod.id !== existing.fiscalPeriodId) {
      const dup = await prisma.inventoryDocument.findFirst({
        where: { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, fiscalPeriodId: fiscalPeriod.id, NOT: { id } },
      });
      if (dup) return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    }

    const newEffectLines = body.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    // ⚠️ برخلاف ایجاد سند تازه، این‌جا excludeSelfId الزامی است: سطرهای قدیمِ همین سند هنوز در
    // پایگاه‌داده و هنوز «قطعی» هستند، پس در محاسبه‌ی موجودی جاری لحاظ می‌شوند.
    await assertSafeToApplyEffects(prisma, { documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, oldDoc);
      await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
      await tx.inventoryDocument.update({
        where: { id },
        data: {
          warehouseId: warehouse.id,
          fiscalPeriodId: fiscalPeriod.id,
          date,
          description: body.description || null,
          lines: {
            create: body.lines.map((l, idx) => ({
              goodsItemId: l.goodsItemId,
              unitId: l.unitId,
              quantity: Number(l.quantity),
              rowOrder: idx,
              ...trackingCreateData(refs[idx], serialSteps),
            })),
          },
        },
      });
      await applyDocumentEffects(tx, { id, documentType: "INITIAL_INVENTORY", warehouseId: warehouse.id, date }, newEffectLines);
      const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
      await recomputeGoodsItemHasTransactions(goodsItemIds, tx);
      await recomputeWarehouseHasTransactions([existing.warehouseId!, warehouse.id], tx);
    });

    res.json({ id });
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این انبار در این دوره مالی، قبلاً سند موجودی اول دوره ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

// ویرایش «فقط مبلغی» — امروز فقط توسط واردکننده‌ی اکسل «فی/مبلغ موجودی اول دوره»
// (importProcessors/index.ts، entity=initial-inventory-cost) صدا زده می‌شود، نه مسیر HTTP جداگانه‌ای
// (که با یکسان‌سازی به الگوی رسید انبار خرید/رسید تولید حذف شده — فرم دستی حالا از همان PUT معمولی،
// بعد از «تایید حسابداری»، استفاده می‌کند). دقیقاً هم‌قانون آن‌ها: فقط روی سند از‌قبل Finalized کار
// می‌کند، چون فی/مبلغ فقط بعد از تایید حسابداری معنا دارد.
export async function updateInitialInventoryAccounting(id: number, lines: { id: number; unitCost: number }[]) {
  const existing = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" }, include: { lines: true } });
  if (!existing) throw new Error("سند موجودی اول دوره یافت نشد");
  if (existing.creationType === "SYSTEM") throw new Error("این سند سیستمی است و از این فرم قابل ویرایش نیست");
  if (existing.status !== "FINALIZED") throw new Error("این سند هنوز تایید حسابداری نشده است؛ ابتدا باید تایید حسابداری شود");

  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("فهرست ردیف‌ها الزامی است");
  }

  await assertDateNotConfirmed(prisma, existing.date, existing.fiscalPeriodId);
  // طبق تصمیم صریح کاربر، «تایید انبار» فقط ویرایش اطلاعات مقداری را قفل می‌کند، نه مبلغی — این تابع
  // فقط unitCost/amount می‌نویسد (هیچ مقداری تغییر نمی‌کند)، پس assertWarehouseOpenForDate عمداً اینجا
  // فراخوانی نمی‌شود؛ دقیقاً هم‌قانون شاخه‌ی FINALIZED در PUT بالا.
  const decimalPlaces = await getBaseCurrencyDecimalPlaces();

  const existingLineIds = new Set(existing.lines.map((l: any) => l.id));
  for (const [idx, l] of lines.entries()) {
    if (!existingLineIds.has(l.id)) throw new Error(`ردیف ${idx + 1} متعلق به این سند نیست`);
    const cost = Number(l.unitCost);
    if (!(cost >= 0)) throw new Error(`فی واحد ردیف ${idx + 1} نمی‌تواند منفی باشد`);
  }

  const lineById = new Map<number, any>(existing.lines.map((l: any) => [l.id, l]));

  await prisma.$transaction(async (tx) => {
    for (const l of lines) {
      const line = lineById.get(l.id)!;
      const unitCost = Number(l.unitCost) || 0;
      await setLineAmount(tx, {
        lineId: l.id,
        newAmount: computeAmount(Number(line.quantity), unitCost, decimalPlaces),
        priceType: "USER_ENTRY",
      });
    }
  });
}

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" }, include: { lines: true, warehouse: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل حذف نیست" });
  if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل حذف نیست" });

  try {
    await assertWarehouseOpenForDate(d.warehouseId!, d.date);

    const effectLines = d.lines.map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
    const doc = { id: d.id, documentType: d.documentType, warehouseId: d.warehouseId!, date: d.date };
    await assertSafeToReverseEffects(prisma, doc, effectLines, d.warehouse!.stockControl);

    await prisma.$transaction(async (tx) => {
      await reverseDocumentEffects(tx, doc);
      await tx.inventoryDocument.delete({ where: { id } });
      // این recompute باید بعد از حذف سند اجرا شود، نه قبلش — وگرنه هنوز خودِ همین سند را می‌بیند و
      // پاسخ اشتباه («هنوز گردش دارد») می‌دهد.
      await recomputeGoodsItemHasTransactions(effectLines.map((l) => l.goodsItemId), tx);
      await recomputeWarehouseHasTransactions([d.warehouseId!], tx);
    });

    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

// «تایید حسابداری» — دقیقاً هم‌الگوی warehouseReceipts.ts/productionReceipts.ts.
router.post(
  "/:id/accounting-confirm",
  can(CONFIRM_PERMISSION),
  async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" } });
    if (!d) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
    if (d.creationType === "SYSTEM") return res.status(400).json({ error: "این سند سیستمی است و از این فرم قابل تایید نیست" });
    if (d.status === "FINALIZED") return res.status(400).json({ error: "این سند قبلاً تایید حسابداری شده است" });
    const updated = await prisma.inventoryDocument.update({
      where: { id },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
    res.json({ id: updated.id, status: updated.status, finalizedAt: updated.finalizedAt });
  }
);

router.post(
  "/:id/accounting-confirm-revert",
  can(REVERT_PERMISSION),
  async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma.inventoryDocument.findFirst({ where: { id, documentType: "INITIAL_INVENTORY" } });
    if (!d) return res.status(404).json({ error: "سند موجودی اول دوره یافت نشد" });
    if (d.status !== "FINALIZED") return res.status(400).json({ error: "این سند تایید حسابداری نشده است" });
    const updated = await prisma.inventoryDocument.update({
      where: { id },
      data: { status: "REGISTERED", finalizedAt: null },
    });
    res.json({ id: updated.id, status: updated.status });
  }
);

export default router;
