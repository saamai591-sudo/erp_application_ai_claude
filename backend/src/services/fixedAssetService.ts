import { Prisma } from "@prisma/client";
import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { getLineAmounts } from "./documentItemAmountService";
import { getAssetLineAmounts, setAssetLineAmount } from "./assetAmountService";

// ماژول «دارایی ثابت» — مرحله ۱: گروه حسابداری دارایی، رسید دارایی، تعریف دارایی (پلاک) و موقعیت.
// همه‌ی قواعد این‌جاست؛ routes/fixedAssets.ts فقط مسیرها را وصل می‌کند.
//  • رسید دارایی سند حسابداری ندارد: نگه‌دارنده‌ی مقدار و بهای ردیف است (مبنا: حواله انبار «دارایی ثابت» یا مجوز تحویل یا بدون مبنا).
//  • تعریف دارایی از «مانده‌ی» ردیف‌های رسید پلاک می‌سازد: یک ردیف ← چند پلاک، یا چند ردیف (و بخشی از مقدار هر ردیف) ← یک پلاک مونتاژی.
//  • موقعیت (مرکز هزینه + پروژه اختیاری) تاریخ‌دار است؛ استهلاک در مرحله بعد بر مبنای همین موقعیت‌ها محاسبه می‌شود.

const D = (v: any) => new Prisma.Decimal(v ?? 0);
const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

import { AssetError, assetBulkFail } from "./assetError";
import { assertLocationSelectable } from "./assetLocationService";
import { lastAnyCalculatedEnd as lastCalculatedEnd } from "./assetDepreciationService";
import { getBaseCurrencyDecimals } from "./baseCurrencyService";
export { AssetError };
const fail = (msg: string): never => {
  throw new AssetError(msg);
};

function parseDate(v: unknown, label: string): Date {
  const d = new Date(String(v ?? ""));
  if (!v || Number.isNaN(d.getTime())) fail(`${label} نامعتبر است`);
  return d;
}

// ───────────── گروه حسابداری دارایی ─────────────

export async function saveAssetGroup(id: number | null, body: { title?: string; isActive?: boolean; depreciationStartRule?: string }) {
  const title = (body.title || "").trim();
  if (!title) fail("عنوان الزامی است");
  const dup = await prisma.assetGroup.findFirst({ where: { title, ...(id ? { id: { not: id } } : {}) } });
  if (dup) fail("عنوان تکراری است");
  if (id) {
    const existing = await prisma.assetGroup.findUnique({ where: { id } });
    if (!existing) return fail("گروه حسابداری دارایی یافت نشد");
    const ruleData: { depreciationStartRule?: any } = {};
    if (body.depreciationStartRule && body.depreciationStartRule !== existing!.depreciationStartRule) {
      if (!["DAILY", "MONTH_START", "NEXT_MONTH"].includes(body.depreciationStartRule)) fail("قاعده‌ی استهلاک ماه اول نامعتبر است");
      if (await prisma.assetDepreciationItem.findFirst({ where: { assetGroupId: id }, select: { id: true } })) fail("برای این گروه استهلاک محاسبه شده و قاعده‌ی ماه اول قابل تغییر نیست");
      ruleData.depreciationStartRule = body.depreciationStartRule;
    }
    return prisma.assetGroup.update({ where: { id }, data: { title, isActive: body.isActive ?? true, ...ruleData } });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.assetGroup.findFirst({ orderBy: { code: "desc" } });
    try {
      return await prisma.assetGroup.create({ data: { code: (last?.code ?? 0) + 1, title, isActive: body.isActive ?? true, ...(["DAILY", "MONTH_START", "NEXT_MONTH"].includes(String(body.depreciationStartRule)) ? { depreciationStartRule: body.depreciationStartRule as any } : {}) } });
    } catch (e: any) {
      if (e.code !== "P2002" || attempt === 4) throw e;
    }
  }
  return fail("خطا در صدور کد گروه");
}

// ───────────── رسید دارایی ─────────────

interface ReceiptLineInput {
  id?: number | null;
  goodsItemId?: number;
  unitId?: number;
  quantity?: number | string;
  description?: string | null;
  sourceInventoryLineId?: number | null;
  sourceDeliveryAuthorizationLineId?: number | null;
}

/** مقدار پلاک‌نشده/رسیدنشده: مجموع مقدار ردیف‌های رسید دارایی که به همین مبنا اشاره دارند (به‌جز رسید در حال ویرایش) */
async function receiptedQty(field: "sourceInventoryLineId" | "sourceDeliveryAuthorizationLineId", sourceId: number, excludeReceiptId: number | null) {
  const agg = await prisma.assetReceiptLine.aggregate({
    where: { [field]: sourceId, ...(excludeReceiptId ? { assetReceiptId: { not: excludeReceiptId } } : {}) },
    _sum: { quantity: true },
  });
  return D(agg._sum.quantity);
}

async function assertAssetGoodsItem(goodsItemId: number) {
  // نوع گروه حسابداری کالا محدود نمی‌شود: اجزای مونتاژ یک دارایی می‌توانند ملزومات، مواد یا کالای تجاری هم باشند (حساب دارایی از «گروه حسابداری دارایی» می‌آید)
  const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
  if (!item) return fail("کالا یافت نشد");
  if (item.kind !== "GOODS") fail(`«${item.title}» کالا نیست؛ فقط کالا در رسید دارایی می‌آید`);
  return item;
}

export async function saveAssetReceipt(id: number | null, body: any) {
  const basis = body.basis as "NO_BASIS" | "WAREHOUSE_ISSUE" | "DELIVERY_AUTHORIZATION";
  if (!["NO_BASIS", "WAREHOUSE_ISSUE", "DELIVERY_AUTHORIZATION"].includes(basis)) fail("مبنای رسید نامعتبر است");
  const date = parseDate(body.date, "تاریخ");
  await assertDateWithinCurrentFiscalPeriod(date);
  const lines: ReceiptLineInput[] = Array.isArray(body.lines) ? body.lines : [];
  if (!lines.length) fail("حداقل یک ردیف لازم است");

  const existing = id ? await prisma.assetReceipt.findUnique({ where: { id }, include: { lines: { include: { components: true, purchaseInvoiceLine: { select: { id: true } } } } } }) : null;
  if (id && !existing) fail("رسید دارایی یافت نشد");
  if (existing && existing.basis !== basis) fail("مبنای رسید پس از ثبت قابل تغییر نیست");
  if (existing && existing.status === "FINALIZED") fail("رسید تایید‌شده قابل ویرایش نیست؛ ابتدا تایید آن را برگردانید");

  // ردیف‌ها را اعتبارسنجی و مقدار/بها را نهایی می‌کنیم
  const cleaned: { id: number | null; data: any }[] = [];
  const usedBySource = new Map<string, Prisma.Decimal>();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const row = `ردیف ${i + 1}: `;
    const qty = D(l.quantity);
    if (!qty.gt(0)) fail(row + "مقدار باید بزرگ‌تر از صفر باشد");
    let goodsItemId = Number(l.goodsItemId);
    let unitId = Number(l.unitId);
    let sourceInventoryLineId: number | null = null;
    let sourceDeliveryAuthorizationLineId: number | null = null;

    if (basis === "WAREHOUSE_ISSUE") {
      sourceInventoryLineId = Number(l.sourceInventoryLineId);
      const src = await prisma.inventoryDocumentLine.findUnique({ where: { id: sourceInventoryLineId }, include: { document: true } });
      if (!src || src.document.documentType !== "FIXED_ASSET_ISSUE") fail(row + "ردیف حواله دارایی ثابت نامعتبر است");
      goodsItemId = src!.goodsItemId;
      unitId = src!.unitId;
      if (src!.document.date > date) fail(row + `تاریخ حواله (${formatJalaliDateForMessage(src!.document.date)}) بعد از تاریخ رسید است`);
      const key = `I${sourceInventoryLineId}`;
      const already = (await receiptedQty("sourceInventoryLineId", sourceInventoryLineId, id)).add(usedBySource.get(key) ?? 0);
      if (already.add(qty).gt(src!.quantity)) fail(row + `مقدار از مانده‌ی حواله بیشتر است (مانده: ${src!.quantity.sub(already).toString()})`);
      usedBySource.set(key, (usedBySource.get(key) ?? D(0)).add(qty));
    } else if (basis === "DELIVERY_AUTHORIZATION") {
      sourceDeliveryAuthorizationLineId = Number(l.sourceDeliveryAuthorizationLineId);
      const src = await prisma.deliveryAuthorizationLine.findUnique({ where: { id: sourceDeliveryAuthorizationLineId }, include: { deliveryAuthorization: true } });
      if (!src) fail(row + "ردیف مجوز تحویل نامعتبر است");
      goodsItemId = src!.goodsItemId;
      unitId = src!.unitId;
      if (src!.deliveryAuthorization.date > date) fail(row + `تاریخ مجوز تحویل (${formatJalaliDateForMessage(src!.deliveryAuthorization.date)}) بعد از تاریخ رسید است`);
      const key = `A${sourceDeliveryAuthorizationLineId}`;
      const already = (await receiptedQty("sourceDeliveryAuthorizationLineId", sourceDeliveryAuthorizationLineId, id)).add(usedBySource.get(key) ?? 0);
      if (already.add(qty).gt(src!.quantity)) fail(row + `مقدار از مانده‌ی مجوز تحویل بیشتر است (مانده: ${src!.quantity.sub(already).toString()})`);
      usedBySource.set(key, (usedBySource.get(key) ?? D(0)).add(qty));
    } else {
      if (!goodsItemId || !unitId) fail(row + "کالا و واحد الزامی است");
    }
    await assertAssetGoodsItem(goodsItemId);

    const lineId = l.id ? Number(l.id) : null;
    if (lineId) {
      const old = existing?.lines.find((x) => x.id === lineId);
      if (!old) fail(row + "ردیف نامعتبر است");
      if (old!.purchaseInvoiceLine && (!qty.eq(old!.quantity) || goodsItemId !== old!.goodsItemId)) fail(row + "این ردیف در یک فاکتور خرید استفاده شده و مقدار/کالای آن قابل تغییر نیست");
      const defined = old!.components.reduce((s, c) => s.add(c.quantity), D(0));
      if (defined.gt(0)) {
        if (qty.lt(defined)) fail(row + `از این ردیف ${defined.toString()} به دارایی تبدیل شده و مقدار نمی‌تواند کمتر شود`);
        if (goodsItemId !== old!.goodsItemId || unitId !== old!.unitId) fail(row + "کالا/واحد ردیفِ تعریف‌شده قابل تغییر نیست");
      }
    }
    cleaned.push({
      id: lineId,
      data: { rowOrder: i, goodsItemId, unitId, quantity: qty, description: l.description?.toString().trim() || null, sourceInventoryLineId, sourceDeliveryAuthorizationLineId },
    });
  }
  const keptIds = new Set(cleaned.filter((c) => c.id).map((c) => c.id!));
  for (const old of existing?.lines ?? []) {
    if (!keptIds.has(old.id) && old.components.length) fail("ردیفی که به دارایی تبدیل شده قابل حذف نیست");
  }

  const fp = await getCurrentFiscalPeriod();
  if (!fp) fail("دوره مالی تعریف نشده است");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100060, ${fp!.id})`);
    let receiptId = id;
    if (id) {
      await tx.assetReceipt.update({ where: { id }, data: { date, description: body.description?.toString().trim() || null } });
      await tx.assetReceiptLine.deleteMany({ where: { assetReceiptId: id, id: { notIn: Array.from(keptIds) } } });
      for (const c of cleaned) {
        if (c.id) await tx.assetReceiptLine.update({ where: { id: c.id }, data: c.data });
        else await tx.assetReceiptLine.create({ data: { ...c.data, assetReceiptId: id } });
      }
    } else {
      const last = await tx.assetReceipt.findFirst({ where: { fiscalPeriodId: fp!.id }, orderBy: { number: "desc" } });
      const created = await tx.assetReceipt.create({
        data: {
          fiscalPeriodId: fp!.id,
          number: (last?.number ?? 0) + 1,
          date,
          basis,
          description: body.description?.toString().trim() || null,
          lines: { create: cleaned.map((c) => c.data) },
        },
      });
      receiptId = created.id;
    }
    return tx.assetReceipt.findUnique({ where: { id: receiptId! } });
  });
}

export async function deleteAssetReceipt(id: number) {
  const r = await prisma.assetReceipt.findUnique({ where: { id }, include: { lines: { include: { components: true } } } });
  if (!r) return fail("رسید دارایی یافت نشد");
  if (r.status === "FINALIZED") fail("رسید تایید‌شده قابل حذف نیست؛ ابتدا تایید آن را برگردانید");
  if (r.lines.some((l) => l.components.length)) fail("از این رسید دارایی تعریف شده است؛ ابتدا آن دارایی‌ها را حذف کنید");
  const inv = await prisma.purchaseInvoiceLine.findFirst({ where: { sourceAssetReceiptLine: { assetReceiptId: id } }, select: { purchaseInvoice: { select: { number: true } } } });
  if (inv) fail(`ردیف‌های این رسید در فاکتور خرید ${inv.purchaseInvoice.number} استفاده شده است؛ ابتدا آن فاکتور را حذف کنید`);
  await prisma.assetReceipt.delete({ where: { id } });
}

/** ردیف‌های رسید به همراه مقدار تعریف‌شده و مانده */
export async function receiptLinesWithRemaining(where: any) {
  const lines = await prisma.assetReceiptLine.findMany({
    where,
    include: {
      goodsItem: { select: { id: true, code: true, fullCode: true, title: true } },
      unit: { select: { id: true, title: true } },
      assetReceipt: { select: { id: true, number: true, date: true } },
      components: { select: { quantity: true } },
    },
    orderBy: [{ assetReceiptId: "asc" }, { rowOrder: "asc" }],
  });
  const amountMap = await getAssetLineAmounts(lines.map((l) => l.id));
  return lines.map((l) => {
    const defined = l.components.reduce((s, c) => s.add(c.quantity), D(0));
    return {
      id: l.id,
      receiptId: l.assetReceiptId,
      receiptNumber: l.assetReceipt.number,
      receiptDate: l.assetReceipt.date,
      goodsItemId: l.goodsItemId,
      goodsItemTitle: l.goodsItem.title,
      goodsItemCode: l.goodsItem.fullCode,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: l.quantity.toString(),
      amount: amountMap.has(l.id) ? amountMap.get(l.id)!.toString() : null,
      defined: defined.toString(),
      remaining: l.quantity.sub(defined).toString(),
      description: l.description,
      sourceInventoryLineId: l.sourceInventoryLineId,
      sourceDeliveryAuthorizationLineId: l.sourceDeliveryAuthorizationLineId,
    };
  });
}

// ───────────── تایید رسید دارایی (مبنای حواله انبار) ─────────────

/** سهم بهای یک ردیف مبنا برای هر ردیف مصرف‌کننده: به نسبت مقدار؛ اگر مجموع مقدارها کل ردیف مبنا را پوشش دهد، آخرین ردیف (بر اساس id) باقی‌مانده‌ی دقیق را می‌گیرد */
function allocateByQuantity(total: Prisma.Decimal, sourceQty: Prisma.Decimal, rows: { id: number; quantity: Prisma.Decimal }[], dec: number): Map<number, Prisma.Decimal> {
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  const sum = sorted.reduce((s, r) => s.add(r.quantity), D(0));
  const complete = sum.eq(sourceQty);
  const out = new Map<number, Prisma.Decimal>();
  let used = D(0);
  sorted.forEach((r, i) => {
    const isLast = complete && i === sorted.length - 1;
    const amount = isLast ? total.sub(used) : total.mul(r.quantity).div(sourceQty).toDecimalPlaces(dec);
    out.set(r.id, amount);
    used = used.add(amount);
  });
  return out;
}

export async function confirmAssetReceipt(id: number) {
  const r = await prisma.assetReceipt.findUnique({ where: { id }, include: { lines: { orderBy: { rowOrder: "asc" }, include: { goodsItem: { select: { title: true } } } } } });
  if (!r) return fail("رسید دارایی یافت نشد");
  if (r.status === "FINALIZED") fail("این رسید قبلاً تایید شده است");
  if (r.basis !== "WAREHOUSE_ISSUE") fail("این رسید همزمان با تایید فاکتور خرید تایید می‌شود؛ تایید دستی فقط برای رسید با مبنای حواله انبار است");
  const dec = await getBaseCurrencyDecimals();
  const problems: Record<string, unknown>[] = [];
  const amounts = new Map<number, Prisma.Decimal>();
  for (const [i, l] of r.lines.entries()) {
    const srcId = l.sourceInventoryLineId!;
    const src = await prisma.inventoryDocumentLine.findUnique({ where: { id: srcId }, select: { quantity: true } });
    const total = (await getLineAmounts([srcId])).get(srcId) ?? D(0);
    if (!src || !total.gt(0)) {
      problems.push({ "ردیف": i + 1, "کالا": l.goodsItem.title, "علت": "ردیف حواله‌ی مبنا هنوز قیمت‌گذاری نشده است" });
      continue;
    }
    const siblings = await prisma.assetReceiptLine.findMany({ where: { sourceInventoryLineId: srcId }, select: { id: true, quantity: true } });
    amounts.set(l.id, allocateByQuantity(total, src.quantity, siblings, dec).get(l.id)!);
  }
  if (problems.length) assetBulkFail("همه‌ی ردیف‌های رسید باید بها داشته باشند؛ تایید انجام نشد", problems);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.assetReceipt.updateMany({ where: { id, status: "REGISTERED" }, data: { status: "FINALIZED", finalizedAt: new Date() } });
    if (!claimed.count) fail("این رسید قبلاً تایید شده است");
    for (const [lineId, amount] of amounts) await setAssetLineAmount(tx, { lineId, priceType: "WAREHOUSE_PRICING", newAmount: amount });
  });
}

export async function unconfirmAssetReceipt(id: number) {
  const r = await prisma.assetReceipt.findUnique({ where: { id }, include: { lines: { include: { components: { include: { asset: { select: { detailCode: true, confirmedAt: true } } } } } } } });
  if (!r) return fail("رسید دارایی یافت نشد");
  if (r.status !== "FINALIZED") fail("این رسید تایید نشده است");
  if (r.basis !== "WAREHOUSE_ISSUE") fail("این رسید با برگشت از تایید فاکتور خرید به حالت ثبت برمی‌گردد");
  const confirmed = r.lines.flatMap((l) => l.components).filter((c) => c.asset.confirmedAt).map((c) => c.asset.detailCode);
  if (confirmed.length) fail(`پلاک‌های تاییدشده از این رسید ساخته شده‌اند (${Array.from(new Set(confirmed)).slice(0, 5).join("، ")}…)؛ ابتدا تایید آن دارایی‌ها را برگردانید`);
  await prisma.$transaction([
    prisma.assetReceiptLineAmount.deleteMany({ where: { assetReceiptLine: { assetReceiptId: id }, priceType: "WAREHOUSE_PRICING" } }),
    prisma.assetReceipt.update({ where: { id }, data: { status: "REGISTERED", finalizedAt: null } }),
  ]);
}

// ───────────── تعریف دارایی ─────────────

interface DepreciationInput {
  depreciationMethod?: string | null;
  usefulLifeYears?: number | string | null;
  depreciationRatePercent?: number | string | null;
  salvageValue?: number | string | null;
}

interface DefineInput extends DepreciationInput {
  /** فقط تعریف دستی (افتتاحیه): استهلاک انباشته تا قبل از اولین محاسبه‌ی سیستم */
  openingAccumulatedDepreciation?: number | string | null;
  title?: string;
  assetGroupId?: number;
  description?: string | null;
  acquisitionDate?: string;
  inServiceDate?: string;
  /** تعداد پلاک‌ها: وقتی فقط یک ردیف رسید انتخاب شده، هر پلاک «quantity» از آن ردیف را می‌گیرد */
  count?: number;
  components?: { receiptLineId?: number | null; quantity?: number | string; amount?: number | string }[];
  position?: { costCenterId?: number; projectId?: number | null; locationId?: number | null };
}

const blank = (v: unknown) => v === null || v === undefined || v === "";

/** ورودی‌های استهلاک (اختیاری هنگام تعریف؛ هنگام «تایید دارایی» الزامی می‌شوند) */
function cleanDepreciation(b: DepreciationInput) {
  const method = blank(b.depreciationMethod) ? null : String(b.depreciationMethod);
  if (method && !["STRAIGHT_LINE", "DECLINING", "NONE"].includes(method)) fail("روش استهلاک نامعتبر است");
  let life: number | null = null;
  if (!blank(b.usefulLifeYears)) {
    life = Math.floor(Number(b.usefulLifeYears));
    if (!(life > 0)) fail("عمر مفید باید بزرگ‌تر از صفر باشد");
  }
  let rate: Prisma.Decimal | null = null;
  if (!blank(b.depreciationRatePercent)) {
    rate = D(b.depreciationRatePercent);
    if (!(rate.gt(0) && rate.lte(100))) fail("نرخ استهلاک باید بین ۰ و ۱۰۰ درصد باشد");
  }
  let salvage: Prisma.Decimal | null = null;
  if (!blank(b.salvageValue)) {
    salvage = D(b.salvageValue);
    if (salvage.isNeg()) fail("ارزش اسقاط نمی‌تواند منفی باشد");
  }
  return {
    depreciationMethod: method as "STRAIGHT_LINE" | "DECLINING" | "NONE" | null,
    usefulLifeYears: method === "STRAIGHT_LINE" ? life : null,
    depreciationRatePercent: method === "DECLINING" ? rate : null,
    // «بدون استهلاک» (مثلاً زمین): عمر مفید، نرخ و ارزش اسقاط ندارد
    salvageValue: method === "NONE" ? null : salvage,
  };
}

async function checkPosition(p: DefineInput["position"]) {
  if (!p?.costCenterId) fail("مرکز هزینه‌ی موقعیت الزامی است");
  const cc = await prisma.costCenter.findUnique({ where: { id: Number(p!.costCenterId) } });
  if (!cc) fail("مرکز هزینه نامعتبر است");
  let projectId: number | null = null;
  if (p!.projectId) {
    const pr = await prisma.project.findUnique({ where: { id: Number(p!.projectId) } });
    if (!pr) fail("پروژه نامعتبر است");
    if (!pr!.isActive) fail(`پروژه «${pr!.title}» غیرفعال است`);
    projectId = pr!.id;
  }
  const locationId = p!.locationId ? await assertLocationSelectable(Number(p!.locationId)) : null;
  return { costCenterId: Number(p!.costCenterId), projectId, locationId };
}

/** کد پلاک: عدد ۶ رقمی ترتیبی (آخرین کد + ۱، شروع ۱۰۰۰۰۱)؛ کد تفصیلی نیست و هیچ نوع تفصیلی ندارد. زیر قفل ۷۱۰۰۰۶۱ صدا زده می‌شود تا پلاک‌های هم‌دسته کد متمایز بگیرند */
async function nextAssetCode(tx: Pick<typeof prisma, "fixedAsset">) {
  const last = await tx.fixedAsset.findFirst({ orderBy: { detailCode: "desc" }, select: { detailCode: true } });
  const next = Math.max(100001, last ? parseInt(last.detailCode, 10) + 1 : 100001);
  return { code: String(next).padStart(6, "0") };
}

export async function defineAssets(body: DefineInput, opts: { allowManual: boolean; tx?: any }) {
  const group = await prisma.assetGroup.findUnique({ where: { id: Number(body.assetGroupId) } });
  if (!group) fail("گروه حسابداری دارایی الزامی است");
  if (!group!.isActive) fail("گروه حسابداری دارایی غیرفعال است");
  const inServiceDate = parseDate(body.inServiceDate, "تاریخ بهره‌برداری");
  const pos = await checkPosition(body.position);
  const depr = cleanDepreciation(body);
  const comps = body.components ?? [];
  if (!comps.length) fail("حداقل یک جزء (ردیف رسید یا بهای دستی) لازم است");
  const opening = blank(body.openingAccumulatedDepreciation) ? null : D(body.openingAccumulatedDepreciation);
  if (opening && opening.isNeg()) fail("استهلاک انباشته‌ی افتتاحیه نمی‌تواند منفی باشد");
  const dec = await getBaseCurrencyDecimals();
  const count = Math.max(1, Math.min(500, Math.floor(Number(body.count ?? 1)) || 1));
  const manual = comps.every((c) => !c.receiptLineId);
  if (!manual && comps.some((c) => !c.receiptLineId)) fail("ردیف رسید و بهای دستی را نمی‌توان با هم ترکیب کرد");
  if (manual && !opts.allowManual) fail("شما مجوز «تعریف دستی (بدون رسید)» را ندارید");
  if (count > 1 && (manual ? false : comps.length !== 1)) fail("ساخت چند پلاک هم‌زمان فقط با انتخاب یک ردیف رسید ممکن است");
  if (count > 1 && manual) fail("تعریف دستی یک‌به‌یک انجام می‌شود");

  const baseTitle = (body.title || "").trim();

  const run = async (tx: any) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100061, 1)`);
    const created: any[] = [];
    // مانده‌ی مقداری هر ردیف، با احتساب پلاک‌هایی که در همین تراکنش ساخته می‌شود (بها لازم نیست؛ با «تایید دارایی» محاسبه می‌شود)
    const lineCache = new Map<number, { line: any; remaining: Prisma.Decimal }>();
    const loadLine = async (id: number) => {
      let e = lineCache.get(id);
      if (!e) {
        const line = await tx.assetReceiptLine.findUnique({ where: { id }, include: { assetReceipt: true, goodsItem: true, components: true } });
        if (!line) return fail("ردیف رسید دارایی یافت نشد");
        const defined = line!.components.reduce((s: Prisma.Decimal, c: { quantity: Prisma.Decimal }) => s.add(c.quantity), D(0));
        e = { line, remaining: line!.quantity.sub(defined) };
        lineCache.set(id, e);
      }
      return e;
    };

    for (let n = 1; n <= count; n++) {
      const compRows: { receiptLineId: number | null; quantity: Prisma.Decimal; amount: Prisma.Decimal | null }[] = [];
      let acquisitionDate: Date | null = null;
      let defaultTitle = baseTitle;
      for (const c of comps) {
        const qty = D(c.quantity);
        if (!qty.gt(0)) fail("مقدار جزء باید بزرگ‌تر از صفر باشد");
        if (manual) {
          const amount = D(c.amount);
          if (!amount.gt(0)) fail("بهای دارایی باید بزرگ‌تر از صفر باشد");
          compRows.push({ receiptLineId: null, quantity: qty, amount: amount.toDecimalPlaces(dec) });
          acquisitionDate = body.acquisitionDate ? parseDate(body.acquisitionDate, "تاریخ تحصیل") : inServiceDate;
          continue;
        }
        const e = await loadLine(Number(c.receiptLineId));
        if (e.line.assetReceipt.date > inServiceDate) {
          fail(`تاریخ بهره‌برداری نمی‌تواند قبل از تاریخ رسید دارایی ${e.line.assetReceipt.number} (${formatJalaliDateForMessage(e.line.assetReceipt.date)}) باشد`);
        }
        if (qty.gt(e.remaining)) fail(`مقدار «${e.line.goodsItem.title}» از مانده‌ی ردیف رسید (${e.remaining.toString()}) بیشتر است`);
        e.remaining = e.remaining.sub(qty);
        compRows.push({ receiptLineId: e.line.id, quantity: qty, amount: null });
        if (!acquisitionDate || e.line.assetReceipt.date > acquisitionDate) acquisitionDate = e.line.assetReceipt.date;
        if (!defaultTitle) defaultTitle = e.line.goodsItem.title;
      }
      if (!defaultTitle) fail("عنوان دارایی الزامی است");
      if (inServiceDate < acquisitionDate!) fail("تاریخ بهره‌برداری نمی‌تواند قبل از تاریخ تحصیل باشد");

      const { code } = await nextAssetCode(tx);
      const asset = await tx.fixedAsset.create({
        data: {
          detailCode: code,
          title: count > 1 ? `${defaultTitle} ${n}` : defaultTitle,
          assetGroupId: group!.id,
          acquisitionDate: acquisitionDate!,
          inServiceDate,
          description: body.description?.toString().trim() || null,
          ...depr,
          openingAccumulatedDepreciation: manual ? opening : null,
          components: { create: compRows },
          positions: { create: { fromDate: inServiceDate, costCenterId: pos.costCenterId, projectId: pos.projectId, locationId: pos.locationId } },
        },
      });
      created.push(asset);
    }
    return created;
  };
  return opts.tx ? run(opts.tx) : prisma.$transaction(run);
}

/**
 * «ایجاد دارایی» از روی رسید: به ازای مانده‌ی صحیحِ هر ردیف انتخاب‌شده، به همان تعداد پلاک (هر پلاک ۱ واحد، عنوان = کالا + شماره) می‌سازد.
 * گروه/تاریخ بهره‌برداری/موقعیت اولیه/ورودی‌های استهلاک برای همه‌ی پلاک‌ها مشترک است؛ گروه هر ردیف جدا قابل تعیین است. همه‌یا‌هیچ.
 */
export async function createAssetsFromReceipt(
  receiptId: number,
  body: DefineInput & { lines?: { lineId: number; assetGroupId?: number }[] }
) {
  const receipt = await prisma.assetReceipt.findUnique({ where: { id: receiptId }, include: { lines: { orderBy: { rowOrder: "asc" }, include: { components: true, goodsItem: { select: { title: true } } } } } });
  if (!receipt) return fail("رسید دارایی یافت نشد");
  const picked = body.lines ?? [];
  if (!picked.length) fail("ردیفی انتخاب نشده است");
  const problems: Record<string, unknown>[] = [];
  const leftovers: string[] = [];
  let total = 0;
  await prisma.$transaction(async (tx) => {
    for (const p of picked) {
      const line = receipt.lines.find((l) => l.id === Number(p.lineId));
      const row = { "کالا": line?.goodsItem.title ?? String(p.lineId) };
      if (!line) {
        problems.push({ ...row, "علت": "ردیف به این رسید تعلق ندارد" });
        continue;
      }
      const remaining = line.quantity.sub(line.components.reduce((s, c) => s.add(c.quantity), D(0)));
      const count = Math.floor(Number(remaining));
      if (count < 1) {
        problems.push({ ...row, "علت": "مانده‌ی قابل پلاک‌شدن (حداقل ۱ واحد) ندارد" });
        continue;
      }
      const frac = remaining.sub(count);
      if (frac.gt(0)) leftovers.push(`${line.goodsItem.title}: ${frac.toString()}`);
      try {
        const made = await defineAssets(
          { ...body, title: undefined, assetGroupId: Number(p.assetGroupId || body.assetGroupId), count, components: [{ receiptLineId: line.id, quantity: 1 }] },
          { allowManual: false, tx }
        );
        total += made.length;
      } catch (e) {
        if (!(e instanceof AssetError)) throw e;
        problems.push({ ...row, "علت": e.message });
      }
    }
    if (problems.length) assetBulkFail("ایجاد دارایی انجام نشد", problems);
  });
  return { created: total, leftovers };
}

export async function updateAsset(id: number, body: DepreciationInput & { title?: string; description?: string | null; assetGroupId?: number; inServiceDate?: string }) {
  const a = await prisma.fixedAsset.findUnique({ where: { id }, include: { positions: true } });
  if (!a) return fail("دارایی یافت نشد");
  if (a.confirmedAt) fail("دارایی تاییدشده قابل ویرایش نیست؛ ابتدا تایید آن را برگردانید");
  const title = (body.title ?? a.title).trim();
  if (!title) fail("عنوان الزامی است");
  const data: any = { title, description: body.description?.toString().trim() || null, ...cleanDepreciation(body) };
  if (body.assetGroupId && body.assetGroupId !== a.assetGroupId) {
    const g = await prisma.assetGroup.findUnique({ where: { id: Number(body.assetGroupId) } });
    if (!g || !g.isActive) fail("گروه حسابداری دارایی نامعتبر یا غیرفعال است");
    data.assetGroupId = g!.id;
  }
  if (body.inServiceDate) {
    const d = parseDate(body.inServiceDate, "تاریخ بهره‌برداری");
    if (d.getTime() !== a.inServiceDate.getTime()) {
      if (d < a.acquisitionDate) fail("تاریخ بهره‌برداری نمی‌تواند قبل از تاریخ تحصیل باشد");
      if (a.positions.length > 1) fail("این دارایی بیش از یک موقعیت دارد و تاریخ بهره‌برداری قابل تغییر نیست");
      data.inServiceDate = d;
    }
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.fixedAsset.update({ where: { id }, data });
    if (data.inServiceDate && a.positions.length === 1) await tx.assetPosition.update({ where: { id: a.positions[0].id }, data: { fromDate: data.inServiceDate } });
    return updated;
  });
}

export async function deleteAsset(id: number) {
  const a = await prisma.fixedAsset.findUnique({ where: { id } });
  if (!a) return fail("دارایی یافت نشد");
  if (a.confirmedAt) fail("دارایی تاییدشده قابل حذف نیست؛ ابتدا تایید آن را برگردانید");
  await prisma.$transaction([
    prisma.fixedAsset.delete({ where: { id } }),
  ]);
}

// ───────────── تایید دارایی ─────────────

/**
 * «تایید دارایی» (تکی یا گروهی؛ همه‌یا‌هیچ): ۱) بهای ردیف‌های رسیدِ اجزا باید مشخص باشد؛ ۲) سهم هر جزء از بهای ردیف محاسبه و روی جزء نوشته می‌شود؛
 * ۳) بهای پلاک = جمع اجزا؛ ۴) روش استهلاک، عمر مفید/نرخ و ارزش اسقاط (کمتر از بها) وارد شده باشد؛ گروه فعال باشد.
 */
export async function confirmAssets(idsIn: number[], userId: number | null) {
  const ids = Array.from(new Set(idsIn.map(Number).filter(Number.isFinite)));
  if (!ids.length) fail("دارایی‌ای انتخاب نشده است");
  const dec = await getBaseCurrencyDecimals();
  const calcEnd = await lastCalculatedEnd();
  const assets = await prisma.fixedAsset.findMany({
    where: { id: { in: ids } },
    include: { assetGroup: true, components: { orderBy: { id: "asc" }, include: { receiptLine: { include: { goodsItem: { select: { title: true } }, assetReceipt: { select: { number: true } } } } } } },
  });
  const lineIds = Array.from(new Set(assets.flatMap((a) => a.components.map((c) => c.receiptLineId)).filter((x): x is number => !!x)));
  const lines = await prisma.assetReceiptLine.findMany({ where: { id: { in: lineIds } }, include: { components: { select: { id: true, quantity: true } } } });
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const lineAmounts = await getAssetLineAmounts(lineIds);

  const problems: Record<string, unknown>[] = [];
  const writes: { assetId: number; cost: Prisma.Decimal; comps: { id: number; amount: Prisma.Decimal }[] }[] = [];
  for (const id of ids) {
    const a = assets.find((x) => x.id === id);
    if (!a) {
      problems.push({ "پلاک": String(id), "علت": "دارایی یافت نشد" });
      continue;
    }
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    const bad = (reason: string) => problems.push({ ...row, "علت": reason });
    if (a.confirmedAt) { bad("قبلاً تایید شده است"); continue; }
    if (a.status !== "ACTIVE") { bad("دارایی فعال نیست"); continue; }
    if (calcEnd && a.depreciationMethod !== "NONE" && day(a.inServiceDate) <= day(calcEnd)) { bad(`تاریخ بهره‌برداری (${formatJalaliDateForMessage(a.inServiceDate)}) در دوره‌ای است که استهلاکش محاسبه شده (تا ${formatJalaliDateForMessage(calcEnd)}) و استهلاک آن دوره‌ها برای این پلاک محاسبه نمی‌شود`); continue; }
    if (!a.assetGroup.isActive) { bad(`گروه «${a.assetGroup.title}» غیرفعال است`); continue; }
    let ok = true;
    const comps: { id: number; amount: Prisma.Decimal }[] = [];
    for (const c of a.components) {
      if (!c.receiptLineId) {
        comps.push({ id: c.id, amount: D(c.amount) });
        continue;
      }
      const line = lineById.get(c.receiptLineId)!;
      const lineAmount = lineAmounts.get(line.id);
      if (!lineAmount) {
        bad(`بهای ردیف «${c.receiptLine!.goodsItem.title}» در رسید دارایی ${c.receiptLine!.assetReceipt.number} مشخص نیست`);
        ok = false;
        continue;
      }
      const share = allocateByQuantity(lineAmount, line.quantity, line.components, dec).get(c.id);
      // جزء این پلاک همیشه جزو line.components است؛ سهم باید موجود باشد
      comps.push({ id: c.id, amount: share ?? D(0) });
    }
    if (!ok) continue;
    const cost = comps.reduce((s, c) => s.add(c.amount), D(0));
    if (!cost.gt(0)) { bad("بهای دارایی صفر است"); continue; }
    if (!a.depreciationMethod) bad("روش استهلاک وارد نشده است");
    else if (a.depreciationMethod === "NONE") writes.push({ assetId: a.id, cost, comps });
    else if (a.depreciationMethod === "STRAIGHT_LINE" && !a.usefulLifeYears) bad("عمر مفید (سال) برای روش خط مستقیم وارد نشده است");
    else if (a.depreciationMethod === "DECLINING" && !a.depreciationRatePercent) bad("نرخ استهلاک برای روش نزولی وارد نشده است");
    else if (a.salvageValue === null) bad("ارزش اسقاط وارد نشده است (در صورت نداشتن، صفر وارد کنید)");
    else if (a.salvageValue.gte(cost)) bad(`ارزش اسقاط باید کمتر از بهای دارایی (${cost.toString()}) باشد`);
    else writes.push({ assetId: a.id, cost, comps });
  }
  if (problems.length) assetBulkFail("تایید دارایی انجام نشد", problems);

  await prisma.$transaction(async (tx) => {
    for (const w of writes) {
      const claimed = await tx.fixedAsset.updateMany({ where: { id: w.assetId, confirmedAt: null }, data: { cost: w.cost, confirmedAt: new Date(), confirmedById: userId } });
      if (!claimed.count) fail("وضعیت یکی از دارایی‌ها هم‌زمان تغییر کرد؛ دوباره تلاش کنید");
      for (const c of w.comps) await tx.fixedAssetComponent.update({ where: { id: c.id }, data: { amount: c.amount } });
    }
  });
}

/** برگشت از تایید: بهای پلاک و سهم اجزای مبتنی بر رسید پاک می‌شود (تعریف دستی بهای خودش را نگه می‌دارد). مرحله‌ی استهلاک یک قفل به همین‌جا اضافه می‌کند. */
export async function unconfirmAssets(idsIn: number[]) {
  const ids = Array.from(new Set(idsIn.map(Number).filter(Number.isFinite)));
  if (!ids.length) fail("دارایی‌ای انتخاب نشده است");
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: ids } } });
  const problems: Record<string, unknown>[] = [];
  for (const id of ids) {
    const a = assets.find((x) => x.id === id);
    if (!a) problems.push({ "پلاک": String(id), "علت": "دارایی یافت نشد" });
    else if (!a.confirmedAt) problems.push({ "پلاک": a.detailCode, "عنوان": a.title, "علت": "تایید نشده است" });
    else if (a.acquisitionJournalEntryId) problems.push({ "پلاک": a.detailCode, "عنوان": a.title, "علت": "سند حسابداری تحصیل دارد؛ ابتدا سند را حذف کنید" });
    else if (await prisma.assetDepreciationItem.findFirst({ where: { assetId: a.id }, select: { id: true } })) problems.push({ "پلاک": a.detailCode, "عنوان": a.title, "علت": "برای این پلاک استهلاک محاسبه شده است" });
  }
  if (problems.length) assetBulkFail("برگشت از تایید انجام نشد", problems);
  await prisma.$transaction([
    prisma.fixedAssetComponent.updateMany({ where: { assetId: { in: ids }, receiptLineId: { not: null } }, data: { amount: null } }),
    prisma.fixedAsset.updateMany({ where: { id: { in: ids } }, data: { cost: null, confirmedAt: null, confirmedById: null } }),
  ]);
}

// ───────────── موقعیت ─────────────

/** تغییر گروهی موقعیت: همه یا هیچ؛ خطاها به‌ازای هر دارایی برمی‌گردد */
export async function changePositions(body: { assetIds?: number[]; fromDate?: string; costCenterId?: number; projectId?: number | null; locationId?: number | null }) {
  const ids = Array.from(new Set((body.assetIds ?? []).map(Number).filter(Number.isFinite)));
  if (!ids.length) fail("دارایی‌ای انتخاب نشده است");
  const fromDate = parseDate(body.fromDate, "تاریخ تغییر موقعیت");
  const calcEnd = await lastCalculatedEnd();
  if (calcEnd && day(fromDate) <= day(calcEnd)) fail(`استهلاک تا ${formatJalaliDateForMessage(calcEnd)} محاسبه شده؛ تاریخ تغییر موقعیت باید بعد از آن باشد`);
  const pos = await checkPosition(body);
  const assets = await prisma.fixedAsset.findMany({ where: { id: { in: ids } }, include: { positions: { orderBy: { fromDate: "desc" }, take: 1 }, depreciationItems: { select: { toDate: true } } } });
  const problems: Record<string, unknown>[] = [];
  for (const id of ids) {
    const a = assets.find((x) => x.id === id);
    if (!a) {
      problems.push({ "پلاک": String(id), "علت": "دارایی یافت نشد" });
      continue;
    }
    const row = { "پلاک": a.detailCode, "عنوان": a.title };
    if (a.status !== "ACTIVE") problems.push({ ...row, "علت": "دارایی فعال نیست" });
    else if (fromDate < a.inServiceDate) problems.push({ ...row, "علت": "تاریخ قبل از تاریخ بهره‌برداری است" });
    else if (a.depreciationItems.some((x) => day(x.toDate) >= day(fromDate))) problems.push({ ...row, "علت": "برای این پلاک استهلاک تا بعد از این تاریخ محاسبه/ثبت شده است" });
    else if (a.positions[0] && fromDate <= a.positions[0].fromDate) {
      problems.push({ ...row, "علت": `تاریخ باید بعد از آخرین موقعیت (${formatJalaliDateForMessage(a.positions[0].fromDate)}) باشد` });
    }
  }
  if (problems.length) {
    const err = new AssetError("تغییر موقعیت برای برخی دارایی‌ها ممکن نیست");
    err.details = problems;
    throw err;
  }
  await prisma.$transaction(
    ids.map((assetId) => prisma.assetPosition.create({ data: { assetId, fromDate, costCenterId: pos.costCenterId, projectId: pos.projectId, locationId: pos.locationId } }))
  );
}

export async function deletePosition(id: number) {
  const p = await prisma.assetPosition.findUnique({ where: { id } });
  if (!p) return fail("موقعیت یافت نشد");
  const all = await prisma.assetPosition.findMany({ where: { assetId: p!.assetId }, orderBy: { fromDate: "asc" } });
  if (all.length === 1) fail("موقعیت اولِ دارایی (هنگام تعریف) قابل حذف نیست");
  if (all[all.length - 1].id !== id) fail("فقط آخرین موقعیت دارایی قابل حذف است");
  if (await prisma.assetDepreciationItem.findFirst({ where: { positionId: id }, select: { id: true } })) fail("برای این موقعیت استهلاک محاسبه شده و قابل حذف نیست");
  await prisma.assetPosition.delete({ where: { id } });
}
