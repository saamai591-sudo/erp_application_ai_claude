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
//
// طبق مستند «موتور قیمت‌گذاری در حالت برگشت»: وقتی به یک برگشت به تامین‌کننده می‌رسیم که به ردیف رسید
// مشخصی ارجاع دارد —
// ۱) اگر برگشت، کل مقدار آن رسید را برمی‌گرداند: مبلغ رسید مستقیماً «ست» (جایگزین، نه کم) می‌شود با
//    مبلغ تازه‌محاسبه‌شده‌ی برگشت (بر مبنای کاردکس در همان لحظه)، و کاردکس دوباره محاسبه می‌شود؛ این
//    فرایند تا همگرایی مبلغ برگشت با مبلغ رسید تکرار می‌شود.
// ۲) اگر برگشت فقط بخشی از مقدار رسید را برمی‌گرداند: رسید به دو «سهم» تقسیم می‌شود — سهم بازگشتی
//    (متناسب با مقدار برگشتی از مبلغ اصلی رسید، که مثل حالت ۱ در لوپ همگرا می‌شود) و سهم باقیمانده
//    (ثابت، بقیه‌ی مبلغ اصلی). این تقسیم فقط برای محاسبه‌ی کاردکس است؛ ردیف رسید در دیتابیس هیچ‌وقت
//    شکسته نمی‌شود — نتیجه‌ی نهایی (سهم باقیمانده + سهم(های) همگراشده‌ی برگشت) در همان یک ردیف نوشته
//    می‌شود. اگر چند برگشت جداگانه به یک رسید ارجاع داشته باشند، هرکدام سهم بازگشتی مستقل خودشان را
//    دارند (بر اساس مقدار خودشان) و همه‌ی سهم‌ها هم‌زمان با هم همگرا می‌شوند.
//
// قفل بودن دوره: طبق همان مستند، اگر ردیفی که این اجرا مقدارش را عوض می‌کند در دوره‌ی در حال
// قیمت‌گذاری باشد (هنوز قفل نشده)، مقدار جدید مستقیم روی amount/unitCost خودِ سند نوشته می‌شود. اگر در
// دوره‌ای زودتر (که طبق کنترل ترتیب، قبلاً قیمت‌گذاری شده) باشد، آن ستون خام دست‌نخورده می‌ماند و اثر
// فقط به‌صورت یک ردیف GoodsPricingAdjustment (با appliedToLine=false) ثبت می‌شود — قابل مشاهده در
// گزارش «اصلاحیه‌های قیمت‌گذاری»، بدون بازنویسی مبلغ سند اصلی.

const IN_GIVEN_TYPES = new Set(["INITIAL_INVENTORY", "WAREHOUSE_RECEIPT", "PRODUCTION_RECEIPT"]);
const IN_COMPUTED_TYPES = new Set(["SALES_RETURN", "CENTER_CONSUMPTION_RETURN", "PROJECT_CONSUMPTION_RETURN", "PRODUCTION_CONSUMPTION_RETURN"]);
const OUT_COMPUTED_TYPES = new Set(["SALES_DELIVERY", "CENTER_CONSUMPTION", "PROJECT_CONSUMPTION", "PRODUCTION_CONSUMPTION", "FIXED_ASSET_ISSUE"]);
export const PRICING_DOC_TYPES = [
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

// یک بار کامل کاردکس را (با یک تخمین فعلی از سهم‌های بازگشتی هر برگشت تامین‌کننده) طی می‌کند
function walkKardex(
  lines: Line[],
  returningLinesByReceipt: Map<number, Line[]>,
  fixedRemainingAmount: Map<number, number>,
  returnWorkingValue: Map<number, number>,
  decimalPlaces: number
) {
  let runningQty = 0;
  let runningValue = 0;
  const computed = new Map<number, number>();
  const newReturnWorkingValue = new Map<number, number>();

  for (const line of lines) {
    const qty = Number(line.quantity);
    const type = line.document.documentType;

    if (IN_GIVEN_TYPES.has(type)) {
      const returningLines = returningLinesByReceipt.get(line.id);
      if (!returningLines || returningLines.length === 0) {
        runningQty += qty;
        runningValue += Number(line.amount);
      } else {
        const returnedQty = returningLines.reduce((s, r) => s + Number(r.quantity), 0);
        const remainingQty = qty - returnedQty;
        runningQty += remainingQty;
        runningValue += fixedRemainingAmount.get(line.id) || 0;
        for (const r of returningLines) {
          runningQty += Number(r.quantity);
          runningValue += returnWorkingValue.get(r.id) || 0;
        }
      }
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
    if (type === "SUPPLIER_RETURN") {
      newReturnWorkingValue.set(line.id, amt);
    }
  }

  return { computed, newReturnWorkingValue };
}

function mapsEqual(a: Map<number, number>, b: Map<number, number>, epsilon: number): boolean {
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

  // پیش‌پردازش برگشت‌های تامین‌کننده: برای هر رسیدی که برگشت(های) به آن ارجاع دارند، سهم ثابتِ
  // «باقیمانده» و سهم اولیه‌ی هر برگشت (متناسب با مقدار خودش از مبلغ اصلی رسید) یک‌بار محاسبه می‌شود؛
  // این سهم‌ها هرگز در طول همگرایی دوباره از amount اصلی بازمحاسبه نمی‌شوند
  const returningLinesByReceipt = new Map<number, Line[]>();
  for (const l of lines) {
    if (l.document.documentType === "SUPPLIER_RETURN" && l.sourceWarehouseReceiptLineId) {
      const arr = returningLinesByReceipt.get(l.sourceWarehouseReceiptLineId) || [];
      arr.push(l);
      returningLinesByReceipt.set(l.sourceWarehouseReceiptLineId, arr);
    }
  }
  const fixedRemainingAmount = new Map<number, number>();
  const initialReturnShare = new Map<number, number>();
  for (const [receiptId, returningLines] of returningLinesByReceipt) {
    const receipt = lines.find((l) => l.id === receiptId);
    if (!receipt) continue; // رسید خارج از بازه‌ی این اجرا (نباید معمولاً پیش بیاید)
    const originalAmount = Number(receipt.amount);
    const originalQty = Number(receipt.quantity);
    let sumShares = 0;
    for (const r of returningLines) {
      const share = originalQty > 0 ? round((originalAmount * Number(r.quantity)) / originalQty, decimalPlaces) : 0;
      initialReturnShare.set(r.id, share);
      sumShares += share;
    }
    fixedRemainingAmount.set(receiptId, round(originalAmount - sumShares, decimalPlaces));
  }

  let returnWorkingValue = new Map<number, number>(initialReturnShare);
  let computed = new Map<number, number>();
  let converged = false;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = walkKardex(lines, returningLinesByReceipt, fixedRemainingAmount, returnWorkingValue, decimalPlaces);
    computed = result.computed;
    if (mapsEqual(result.newReturnWorkingValue, returnWorkingValue, epsilon)) {
      returnWorkingValue = result.newReturnWorkingValue;
      converged = true;
      break;
    }
    returnWorkingValue = result.newReturnWorkingValue;
  }
  if (!converged) throw new Error("محاسبه قیمت‌گذاری همگرا نشد؛ لطفاً اسناد کالا را بررسی کنید");

  // مجموع اصلاحیه‌های قبلیِ ردیف‌های قفل‌شده (برای محاسبه‌ی مبلغ «مؤثر فعلی» آن‌ها) — یک کوئری واحد
  // به‌جای یک کوئری جداگانه به ازای هر ردیف
  const lockedLineIds = lines.filter((l) => l.document.date < period.fromDate).map((l) => l.id);
  const priorAdjustments = lockedLineIds.length
    ? await prisma.goodsPricingAdjustment.groupBy({
        by: ["lineId"],
        where: { lineId: { in: lockedLineIds }, appliedToLine: false },
        _sum: { amount: true },
      })
    : [];
  const priorAdjMap = new Map(priorAdjustments.map((a) => [a.lineId, Number(a._sum.amount || 0)]));

  // نهایی‌سازی: خودِ رسید هرگز توسط قیمت‌گذاری اصلاح نمی‌شود (همیشه با مبلغ اصلی خودش باقی می‌ماند) —
  // سهم ثابت باقیمانده و همگرایی لوپ فقط برای محاسبه‌ی درستِ سایر ردیف‌های بین رسید و برگشت (مثلاً
  // مصرف) به کار می‌روند. مبلغ نهایی خودِ برگشت هم مقدار همگراشده‌ی کاردکس نیست؛ سهم متناسب از مبلغ
  // اصلی رسید است (همان initialReturnShare). بقیه‌ی ردیف‌های محاسبه‌شده از computed خوانده می‌شوند.
  const changes: { lineId: number; delta: number; newTotal: number; quantity: number; locked: boolean }[] = [];
  for (const line of lines) {
    let newTotal: number | undefined;
    if (line.document.documentType === "SUPPLIER_RETURN" && line.sourceWarehouseReceiptLineId && initialReturnShare.has(line.id)) {
      newTotal = initialReturnShare.get(line.id)!;
    } else if (computed.has(line.id)) {
      newTotal = computed.get(line.id)!;
    }
    if (newTotal === undefined) continue;

    // مبلغ «مؤثر فعلی»: اگر ردیف قفل نشده (در همین دوره است)، amount خام همان مقدار مؤثر است (چون
    // فقط قیمت‌گذاری‌های همین دوره مستقیم می‌نویسند)؛ اگر قفل شده (دوره‌ای زودتر که قبلاً قیمت‌گذاری
    // شده)، باید مجموع اصلاحیه‌های قبلی هم به amount خام اضافه شود
    const locked = line.document.date < period.fromDate;
    const currentEffective = Number(line.amount) + (locked ? priorAdjMap.get(line.id) || 0 : 0);

    const delta = round(newTotal - currentEffective, decimalPlaces);
    if (Math.abs(delta) > epsilon) {
      changes.push({ lineId: line.id, delta, newTotal, quantity: Number(line.quantity), locked });
    }
  }

  const status = await prisma.$transaction(async (tx) => {
    const created = await tx.goodsPricingStatus.create({
      data: { goodsItemId, reportingPeriodId, createdById: userId },
    });
    for (const c of changes) {
      await tx.goodsPricingAdjustment.create({
        data: { statusId: created.id, lineId: c.lineId, amount: c.delta, appliedToLine: !c.locked },
      });
      if (!c.locked) {
        await tx.inventoryDocumentLine.update({
          where: { id: c.lineId },
          data: { amount: c.newTotal, unitCost: c.quantity > 0 ? c.newTotal / c.quantity : 0 },
        });
      }
    }
    return created;
  });

  return { status, adjustmentCount: changes.length };
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
      if (!adj.appliedToLine) continue; // فقط اصلاحیه‌هایی که مستقیم روی amount نوشته شده بودند باید کم شوند
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
