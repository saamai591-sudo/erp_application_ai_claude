import { prisma } from "../lib/prisma";

// طبق مستند «قیمت‌گذاری اسناد انبار»: قیمت‌گذاری در سطح کالا انجام می‌شود (انبار بخشی از کلید نیست) و
// کل تاریخچه‌ی اسناد قطعی‌شده‌ی کالا (در تمام انبارها) را از ابتدا تا پایان دوره‌ی گزارشگری انتخاب‌شده
// پردازش می‌کند. طبقه‌بندی جهت هر نوع سند دقیقاً همان جدول SIGNED_TYPES موجود در
// warehouseStockService.ts است (WAREHOUSE_TRANSFER چون در سطح کالا خالص صفر است نادیده گرفته می‌شود).
//
// منبع مبلغ:
// - INITIAL_INVENTORY / WAREHOUSE_RECEIPT / PRODUCTION_RECEIPT: مبلغ «داده‌شده» (ستون amount سند) —
//   طبق تصمیم صریح کاربر، فرض می‌شود این دو نوع سند مبلغ واقعی خواهند داشت (حتی اگر امروز صفر باشد)؛
//   این سرویس کنترل/مسدودسازی خاصی روی صفر بودن آن‌ها اعمال نمی‌کند.
// - بقیه‌ی انواع (صادره‌ها، برگشت‌ها، انبارگردانی): مبلغ توسط همین موتور و بر اساس میانگین موزون متحرک
//   محاسبه می‌شود.
// - SUPPLIER_RETURN علاوه‌بر مقداردهی به مبلغ خودش، مبلغ محاسبه‌شده را از رسید مبنای خودش کم می‌کند
//   (بند ۱۰ مستند) — چون این کاهش خودش میانگین را عوض می‌کند، محاسبه با یک همگرایی نقطه‌ثابت انجام
//   می‌شود (برخلاف مستند که فقط یک برگشت را در نظر می‌گیرد، این پیاده‌سازی همه‌ی برگشت‌های تامین‌کننده‌ی
//   کل کاردکس کالا را هم‌زمان همگرا می‌کند تا برگشت‌های متعدد/زنجیره‌ای هم درست پوشش داده شوند).
//
// طبق بند ۹ مستند، هر اثر قیمت‌گذاری (چه اولین قیمت‌گذاری یک ردیف صادره، چه اصلاحیه‌ی یک رسید قدیمی
// به‌خاطر برگشت جدید) یک ردیف GoodsPricingAdjustment (برای تاریخچه/حسابرسی) ثبت می‌کند — و علاوه‌بر آن
// (برخلاف نسخه‌ی اول این سرویس) همان مبلغ به‌صورت مستقیم روی ستون amount/unitCost خود
// InventoryDocumentLine هم نوشته می‌شود؛ چون تمام صفحات نمایش سند (نمای «حسابداری انبار»، فرم خود سند
// و...) این ستون خام را می‌خوانند، نه جدول اصلاحیه‌ها را — بدون این نوشتن مستقیم، نتیجه‌ی قیمت‌گذاری در
// هیچ‌کجای برنامه دیده نمی‌شد (دقیقاً همان الگویی که «تایید فاکتور خرید» برای ردیف‌های رسید استفاده
// می‌کند). Rollback به‌صورت متقارن مقدار همان اصلاحیه‌ها را از amount/unitCost کم می‌کند.

const IN_GIVEN_TYPES = new Set(["INITIAL_INVENTORY", "WAREHOUSE_RECEIPT", "PRODUCTION_RECEIPT"]);
const IN_COMPUTED_TYPES = new Set(["SALES_RETURN", "CENTER_CONSUMPTION_RETURN", "PROJECT_CONSUMPTION_RETURN", "PRODUCTION_CONSUMPTION_RETURN"]);
const OUT_COMPUTED_TYPES = new Set(["SALES_DELIVERY", "CENTER_CONSUMPTION", "PROJECT_CONSUMPTION", "PRODUCTION_CONSUMPTION", "FIXED_ASSET_ISSUE"]);
const PRICING_DOC_TYPES = [
  ...IN_GIVEN_TYPES,
  ...IN_COMPUTED_TYPES,
  ...OUT_COMPUTED_TYPES,
  "SUPPLIER_RETURN",
  "WAREHOUSE_ADJUSTMENT",
];

const MAX_ITERATIONS = 25;

async function getBaseCurrencyDecimalPlaces(): Promise<number> {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

type Line = {
  id: number;
  quantity: any;
  amount: any;
  sourceWarehouseReceiptLineId: number | null;
  document: { documentType: string; date: Date };
};

// یک بار کامل کاردکس را (با یک تخمین فعلی از کاهش رسیدها به‌خاطر برگشت‌های تامین‌کننده) طی می‌کند و
// مقدار محاسبه‌شده‌ی هر ردیف «موتور-محاسبه» + تخمین جدید کاهش هر رسید را برمی‌گرداند
function walkKardex(lines: Line[], reductionByReceiptLineId: Map<number, number>, decimalPlaces: number) {
  let runningQty = 0;
  let runningValue = 0;
  const computed = new Map<number, number>();
  const newReduction = new Map<number, number>();

  for (const line of lines) {
    const qty = Number(line.quantity);
    const type = line.document.documentType;

    if (IN_GIVEN_TYPES.has(type)) {
      const reduction = reductionByReceiptLineId.get(line.id) || 0;
      const value = Number(line.amount) - reduction;
      runningQty += qty;
      runningValue += value;
      continue;
    }

    if (type === "WAREHOUSE_ADJUSTMENT") {
      // qty خودش امضادار است (مثبت=مازاد/ورود، منفی=کسری/خروج)
      const avgCost = runningQty > 0 ? runningValue / runningQty : 0;
      const amt = round(qty * avgCost, decimalPlaces);
      computed.set(line.id, amt);
      runningQty += qty;
      runningValue += amt;
      continue;
    }

    if (IN_COMPUTED_TYPES.has(type)) {
      const avgCost = runningQty > 0 ? runningValue / runningQty : 0;
      const amt = round(qty * avgCost, decimalPlaces);
      computed.set(line.id, amt);
      runningQty += qty;
      runningValue += amt;
      continue;
    }

    // OUT_COMPUTED_TYPES + SUPPLIER_RETURN
    const avgCost = runningQty > 0 ? runningValue / runningQty : 0;
    const amt = round(qty * avgCost, decimalPlaces);
    computed.set(line.id, amt);
    runningQty -= qty;
    runningValue -= amt;
    if (type === "SUPPLIER_RETURN" && line.sourceWarehouseReceiptLineId) {
      newReduction.set(line.sourceWarehouseReceiptLineId, (newReduction.get(line.sourceWarehouseReceiptLineId) || 0) + amt);
    }
  }

  return { computed, newReduction };
}

function reductionMapsEqual(a: Map<number, number>, b: Map<number, number>, epsilon: number): boolean {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    if (Math.abs((a.get(k) || 0) - (b.get(k) || 0)) > epsilon) return false;
  }
  return true;
}

async function findPredecessorPeriod(reportingPeriodId: number) {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
  if (!period) throw new Error("دوره گزارشگری یافت نشد");
  const predecessor = await prisma.reportingPeriod.findFirst({
    where: { toDate: { lt: period.fromDate } },
    orderBy: { toDate: "desc" },
  });
  return { period, predecessor };
}

async function findSuccessorPeriod(reportingPeriodId: number) {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
  if (!period) throw new Error("دوره گزارشگری یافت نشد");
  const successor = await prisma.reportingPeriod.findFirst({
    where: { fromDate: { gt: period.toDate } },
    orderBy: { fromDate: "asc" },
  });
  return { period, successor };
}

// این کالا در این دوره (یا هر دوره‌ی دیگری) قیمت‌گذاری شده یا نه
export async function getPricingStatusMap(goodsItemIds: number[], reportingPeriodId: number) {
  const rows = await prisma.goodsPricingStatus.findMany({
    where: { goodsItemId: { in: goodsItemIds }, reportingPeriodId },
    select: { goodsItemId: true },
  });
  return new Set(rows.map((r) => r.goodsItemId));
}

export async function getLastPricedPeriod(goodsItemId: number) {
  const last = await prisma.goodsPricingStatus.findFirst({
    where: { goodsItemId },
    orderBy: { reportingPeriod: { toDate: "desc" } },
    include: { reportingPeriod: true },
  });
  return last?.reportingPeriod || null;
}

export async function priceItem(goodsItemId: number, reportingPeriodId: number, userId?: number) {
  const { period, predecessor } = await findPredecessorPeriod(reportingPeriodId);

  const already = await prisma.goodsPricingStatus.findUnique({
    where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
  });
  if (already) throw new Error("این کالا قبلاً در این دوره قیمت‌گذاری شده است");

  if (predecessor) {
    const predecessorPriced = await prisma.goodsPricingStatus.findUnique({
      where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId: predecessor.id } },
    });
    if (!predecessorPriced) {
      throw new Error(`ابتدا باید دوره‌ی «${predecessor.title}» برای این کالا قیمت‌گذاری شود`);
    }
  }

  const decimalPlaces = await getBaseCurrencyDecimalPlaces();
  const epsilon = Math.pow(10, -decimalPlaces) / 2;

  const lines = (await prisma.inventoryDocumentLine.findMany({
    where: {
      goodsItemId,
      document: { status: "FINALIZED", date: { lte: period.toDate }, documentType: { in: PRICING_DOC_TYPES as any } },
    },
    select: {
      id: true,
      quantity: true,
      amount: true,
      sourceWarehouseReceiptLineId: true,
      document: { select: { documentType: true, date: true } },
    },
    orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
  })) as Line[];

  let reduction = new Map<number, number>();
  let computed = new Map<number, number>();
  let converged = false;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = walkKardex(lines, reduction, decimalPlaces);
    computed = result.computed;
    if (reductionMapsEqual(result.newReduction, reduction, epsilon)) {
      reduction = result.newReduction;
      converged = true;
      break;
    }
    reduction = result.newReduction;
  }
  if (!converged) throw new Error("محاسبه قیمت‌گذاری همگرا نشد؛ لطفاً اسناد کالا را بررسی کنید");

  // line.amount در این لحظه همان «مبلغ مؤثر فعلی» است (چون هر اجرای قبلی قیمت‌گذاری مستقیماً همین
  // ستون را به‌روزرسانی کرده)؛ برای هر ردیفی که مقدار تازه‌محاسبه‌شده با آن فرق دارد، هم یک اصلاحیه
  // (برای تاریخچه) و هم مقدار نهایی ستون amount/unitCost ثبت می‌شود
  const deltas: { lineId: number; amount: number; newAmount: number; quantity: number }[] = [];
  for (const line of lines) {
    let newTotal: number | undefined;
    if (computed.has(line.id)) {
      newTotal = computed.get(line.id)!;
    } else if (IN_GIVEN_TYPES.has(line.document.documentType) && reduction.has(line.id)) {
      newTotal = Number(line.amount) - (reduction.get(line.id) || 0);
    }
    if (newTotal === undefined) continue;
    const delta = round(newTotal - Number(line.amount), decimalPlaces);
    if (Math.abs(delta) > epsilon) deltas.push({ lineId: line.id, amount: delta, newAmount: newTotal, quantity: Number(line.quantity) });
  }

  const status = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsPricingStatus.create({
      data: { goodsItemId, reportingPeriodId, createdById: userId },
    });
    for (const d of deltas) {
      await tx.goodsPricingAdjustment.create({ data: { statusId: created.id, lineId: d.lineId, amount: d.amount } });
      await tx.inventoryDocumentLine.update({
        where: { id: d.lineId },
        data: { amount: d.newAmount, unitCost: d.quantity > 0 ? d.newAmount / d.quantity : 0 },
      });
    }
    return created;
  });

  return { status, adjustmentCount: deltas.length };
}

export async function revertItem(goodsItemId: number, reportingPeriodId: number) {
  const status = await prisma.goodsPricingStatus.findUnique({
    where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
  });
  if (!status) throw new Error("این کالا در این دوره قیمت‌گذاری نشده است");

  const { successor } = await findSuccessorPeriod(reportingPeriodId);
  if (successor) {
    const successorPriced = await prisma.goodsPricingStatus.findUnique({
      where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId: successor.id } },
    });
    if (successorPriced) {
      throw new Error(`ابتدا باید برگشت قیمت‌گذاری دوره‌ی «${successor.title}» برای این کالا انجام شود`);
    }
  }

  const decimalPlaces = await getBaseCurrencyDecimalPlaces();
  const adjustments = await prisma.goodsPricingAdjustment.findMany({
    where: { statusId: status.id },
    include: { line: { select: { id: true, quantity: true, amount: true } } },
  });

  await prisma.$transaction(async (tx) => {
    for (const adj of adjustments) {
      const newAmount = round(Number(adj.line.amount) - Number(adj.amount), decimalPlaces);
      const qty = Number(adj.line.quantity);
      await tx.inventoryDocumentLine.update({
        where: { id: adj.lineId },
        data: { amount: newAmount, unitCost: qty > 0 ? newAmount / qty : 0 },
      });
    }
    // حذف status، به‌خاطر onDelete: Cascade روی GoodsPricingAdjustment.statusId، خودش اصلاحیه‌های
    // بالا را هم حذف می‌کند
    await tx.goodsPricingStatus.delete({ where: { id: status.id } });
  });
}
