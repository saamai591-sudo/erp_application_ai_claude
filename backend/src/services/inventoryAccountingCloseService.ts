import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { getQuantityCloseContext } from "./warehouseQuantityCloseService";
import { computeItemKardex, pricingDocumentWhere, USER_PRICED_TYPES, DOC_TYPE_FA } from "./goodsPricingService";
import { getLineAmounts, setLineAmount } from "./documentItemAmountService";
import { lockOpeningYearExclusive } from "./inventoryAccountingGuards";

// =========================================================================
// «بستن حسابداری موجودی» و «برگشت بستن حسابداری موجودی» (مدیریت موجودی و انبار › عملیات پایان دوره).
//
// بستن: برای کل دوره مالی جاری و همه‌ی انبارهای مشمول (تاریخ راه‌اندازی ≤ پایان دوره) یک‌جا، فقط وقتی همه‌ی آن انبارها «بستن
// تعدادی» شده باشند. مبلغ هر ردیف «موجودی اول دوره»ی سیستمی‌ای که بستن تعدادی برای دوره‌ی بعد ساخته، از کاردکس پایان دوره
// مالی (میانگین موزون متحرک هر انبار — همان تابع computeItemKardex موتور قیمت‌گذاری) محاسبه و روی **همان ردیف موجود**
// (DocumentItemAmount با priceType=ACCOUNTING_CLOSING) ثبت می‌شود؛ هیچ سند/ردیف جدیدی ساخته نمی‌شود.
//
// اتمیک و هم‌زمانی: کل کار در یک تراکنش — قفل انحصاریِ «مبلغ افتتاحیه‌ی دوره‌ی بعد» (با قیمت‌گذاریِ آن دوره و برگشت ترتیب‌بندی
// می‌شود)، بعد قفل ردیف همه‌ی انبارهای مشمول (همان قفلی که تایید انبار/برگشت از تایید/بستن تعدادی می‌گیرند)، و بعد خواندن
// مجددِ دوره‌ها، وضعیت بستن تعدادی و تاییدِ هر انبار از دیتابیس همین تراکنش. هر خطا کل تراکنش را rollback می‌کند.
//
// برگشت: فقط اگر در دوره مالی بعد هیچ قیمت‌گذاری (GoodsPricingStatus) انجام نشده و بستن حسابداری آن دوره هم نباشد؛ زیر همان
// قفل انحصاری، پس قیمت‌گذاریِ هم‌زمان (که قفل مشترک می‌گیرد) یا قبل از برگشت کامل می‌شود (و برگشت رد می‌شود) یا بعد از آن
// شروع می‌شود (و نبودنِ بستن را می‌بیند).
// =========================================================================

const TX_OPTIONS = { maxWait: 15000, timeout: 600000 } as const;
const EPS = 1e-6;

interface LockedWarehouse {
  id: number;
  title: string;
  confirmedDate: Date | null;
  implementationDate: Date | null;
}

function round(value: number, decimalPlaces: number): number {
  const f = Math.pow(10, decimalPlaces);
  return Math.round(value * f) / f;
}

function namesList(names: string[], max = 8): string {
  return names.length <= max ? names.join("، ") : `${names.slice(0, max).join("، ")} و ${names.length - max} مورد دیگر`;
}

/**
 * تسهیم مبلغ کل یک کالا بین ردیف‌های افتتاحیه‌ی انبارها متناسب با مقدار هر ردیف؛ هر سهم طبق رقم اعشار ارز پایه گرد می‌شود و اختلاف
 * گرد‌کردن به یک ردیف (بیشترین مقدار؛ با تساوی کمترین id) اضافه/کم می‌شود تا مجموع سهم‌ها دقیقاً برابر مبلغ کل کالا شود (اگر کسر
 * همان ردیف منفی شود، باقی کسر به ردیف‌های بعدی به ترتیب مقدار نزولی می‌رود).
 */
export function allocateByQuantity(total: number, rows: { id: number; qty: number }[], decimalPlaces: number): Map<number, number> {
  const sumQty = rows.reduce((s, r) => s + r.qty, 0);
  const sorted = [...rows].sort((a, b) => b.qty - a.qty || a.id - b.id);
  const amt = new Map<number, number>(sorted.map((r) => [r.id, sumQty > 0 ? round((total * r.qty) / sumQty, decimalPlaces) : 0]));
  let diff = round(total - Array.from(amt.values()).reduce((s, v) => s + v, 0), decimalPlaces);
  for (const r of sorted) {
    if (Math.abs(diff) < Math.pow(10, -decimalPlaces) / 2) break;
    const cur = amt.get(r.id)!;
    const next = round(Math.max(0, cur + diff), decimalPlaces);
    diff = round(diff - (next - cur), decimalPlaces);
    amt.set(r.id, next);
  }
  return amt;
}

/**
 * شرط «کامل‌بودن قیمت‌گذاری سال»: هر کالایی که در دوره مالی گردش دارد (همان پنجره‌ی ارزش‌گذاری: [شروع سال، پایان سال]، شامل موجودی اول
 * دوره‌ی دستی/سیستمی)، باید در **آخرین دوره‌ی گزارشگری** آن سال رکورد قیمت‌گذاری (GoodsPricingStatus) داشته باشد. چون قیمت‌گذاری هر
 * دوره به قیمت‌گذاری دوره‌ی قبلِ دارای گردش وابسته است، وجود رکورد آخرین دوره یعنی کل سال برای آن کالا پردازش شده. دلیل شرط: بعد از
 * بستن، هیچ تغییر قیمتی در آن سال مجاز نیست؛ پس دوره‌ی قیمت‌گذاری‌نشده برای همیشه بی‌مبلغ می‌ماند. اگر آخرین دوره‌ی گزارشگری تا
 * پایان سال نرسد و بعد از آن گردشی باشد، آن گردش هرگز قیمت‌گذاری نمی‌شود و بستن رد می‌شود. null = مشکلی نیست.
 */
export async function getYearEndValuationProblem(fiscal: { id: number; fromDate: Date; toDate: Date; title: string }, db: any = prisma): Promise<{ message: string; missingCount: number } | null> {
  const rows = await db.inventoryDocumentLine.findMany({
    where: { document: pricingDocumentWhere(fiscal.fromDate, { lte: fiscal.toDate }) },
    select: { goodsItemId: true, document: { select: { date: true } } },
  });
  if (rows.length === 0) return null;
  const itemIds: number[] = Array.from(new Set<number>(rows.map((r: any) => r.goodsItemId)));

  const periods = await db.reportingPeriod.findMany({ where: { fiscalPeriodId: fiscal.id }, orderBy: { toDate: "desc" }, take: 1 });
  const last = periods[0];
  if (!last) {
    return { message: `برای دوره مالی «${fiscal.title}» هیچ دوره‌ی گزارشگری تعریف نشده است؛ کالاهای دارای گردش باید قبل از بستن قیمت‌گذاری شوند`, missingCount: itemIds.length };
  }
  if (rows.some((r: any) => r.document.date.getTime() > last.toDate.getTime())) {
    return { message: `آخرین دوره‌ی گزارشگری دوره مالی («${last.title}») تا پایان دوره مالی نمی‌رسد و بعد از آن گردش وجود دارد؛ دوره‌ی گزارشگری را اصلاح کنید تا قیمت‌گذاری کامل شود`, missingCount: itemIds.length };
  }
  const valued: { goodsItemId: number }[] = await db.goodsPricingStatus.findMany({
    where: { reportingPeriodId: last.id, goodsItemId: { in: itemIds } },
    select: { goodsItemId: true },
  });
  const valuedSet = new Set(valued.map((v) => v.goodsItemId));
  const missingIds = itemIds.filter((id) => !valuedSet.has(id));
  if (missingIds.length === 0) return null;
  const items: { fullCode: string; title: string }[] = await db.goodsItem.findMany({ where: { id: { in: missingIds } }, select: { fullCode: true, title: true }, orderBy: { fullCode: "asc" } });
  return {
    message: `برای بستن حسابداری موجودی، همه‌ی کالاهای دارای گردش باید در آخرین دوره‌ی گزارشگری («${last.title}») قیمت‌گذاری شده باشند؛ ${missingIds.length} کالا قیمت‌گذاری نشده است: ${namesList(items.map((i) => `«${i.title}»`), 8)}`,
    missingCount: missingIds.length,
  };
}

export async function getAccountingCloseStatus() {
  const { current, next } = await getQuantityCloseContext();
  const [warehouses, qcloses, close, nextClose, pricingInNext] = await Promise.all([
    prisma.warehouse.findMany({
      where: { implementationDate: { not: null, lte: current.toDate } },
      select: { id: true, code: true, title: true },
      orderBy: { code: "asc" },
    }),
    // fiscalPeriodId صریح در where است، پس فیلتر خودکار دوره مالی دست‌نخورده می‌ماند
    prisma.warehouseQuantityClose.findMany({ where: { fiscalPeriodId: current.id }, select: { warehouseId: true, closedAt: true } }),
    prisma.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: current.id }, include: { closedBy: { select: { firstName: true, lastName: true } } } }),
    next ? prisma.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: next.id } }) : Promise.resolve(null),
    next ? prisma.goodsPricingStatus.count({ where: { reportingPeriod: { fiscalPeriodId: next.id } } }) : Promise.resolve(0),
  ]);
  const qcloseByWarehouse = new Map(qcloses.map((q) => [q.warehouseId, q.closedAt]));
  const rows = warehouses.map((w) => ({ warehouseId: w.id, code: w.code, title: w.title, quantityClosedAt: qcloseByWarehouse.get(w.id) ?? null }));
  const allQuantityClosed = rows.every((r) => r.quantityClosedAt);

  let closeBlockedReason: string | null = null;
  if (close) closeBlockedReason = "بستن حسابداری موجودی این دوره مالی قبلاً انجام شده است";
  else if (!next) closeBlockedReason = "دوره مالی بعد تعریف نشده است";
  else if (!allQuantityClosed) closeBlockedReason = "بستن تعدادی همه‌ی انبارهای مشمول انجام نشده است";
  const valuationProblem = !close && next ? await getYearEndValuationProblem(current) : null;
  if (!closeBlockedReason && valuationProblem) closeBlockedReason = valuationProblem.message;

  let reverseBlockedReason: string | null = null;
  if (!close) reverseBlockedReason = "بستن حسابداری موجودی این دوره مالی انجام نشده است";
  else if (nextClose) reverseBlockedReason = "بستن حسابداری موجودی دوره مالی بعد انجام شده است؛ ابتدا آن را برگردانید";
  else if (pricingInNext > 0) reverseBlockedReason = "در دوره مالی بعد قیمت‌گذاری موجودی انجام شده است؛ این بستن غیرقابل برگشت است";

  return {
    current,
    next,
    warehouses: rows,
    close: close
      ? {
          closedAt: close.closedAt,
          closedByName: close.closedBy ? `${close.closedBy.firstName} ${close.closedBy.lastName}`.trim() : null,
          warehouseCount: close.warehouseCount,
          lineCount: close.lineCount,
          totalAmount: Number(close.totalAmount),
        }
      : null,
    canClose: !closeBlockedReason,
    closeBlockedReason,
    canReverse: !reverseBlockedReason,
    reverseBlockedReason,
  };
}

export interface AccountingCloseResult {
  fiscalPeriodTitle: string;
  warehouseCount: number;
  lineCount: number;
  totalAmount: number;
  closedAt: Date;
}

export async function closeInventoryAccounting(userId: number | null): Promise<AccountingCloseResult> {
  const { current: ctxCurrent, next: ctxNext } = await getQuantityCloseContext();
  if (!ctxNext) throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");

  try {
    return await prisma.$transaction(async (tx) => {
      // ۱) قفل انحصاریِ مبلغ افتتاحیه‌ی دوره‌ی بعد، سپس بازخوانی دوره‌ها از همین تراکنش
      await lockOpeningYearExclusive(tx, ctxNext.id);
      const current = await tx.fiscalPeriod.findUnique({ where: { id: ctxCurrent.id } });
      if (!current) throw new Error("دوره مالی جاری یافت نشد");
      const next = await tx.fiscalPeriod.findFirst({ where: { fromDate: { gt: current.toDate } }, orderBy: { fromDate: "asc" } });
      if (!next) throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");
      if (next.id !== ctxNext.id) throw new Error("دوره‌های مالی هم‌زمان تغییر کرده‌اند؛ صفحه را بازآوری کنید");

      const already = await tx.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: current.id } });
      if (already) {
        throw new Error(`بستن حسابداری موجودی دوره مالی «${current.title}» قبلاً انجام شده است (${formatJalaliDateForMessage(already.closedAt)})`);
      }

      // ۲) قفل ردیف همه‌ی انبارهای مشمول (مرتب بر اساس id) و خواندن وضعیت آن‌ها از همین قفل
      const warehouses = await tx.$queryRaw<LockedWarehouse[]>`
        SELECT "id", "title", "confirmedDate", "implementationDate" FROM "Warehouse"
        WHERE "implementationDate" IS NOT NULL AND "implementationDate" <= ${current.toDate}
        ORDER BY "id" FOR UPDATE`;

      // ۳) بستن تعدادی همه‌ی انبارهای مشمول — دوباره و داخل تراکنش
      const qcloses = await tx.warehouseQuantityClose.findMany({ where: { fiscalPeriodId: current.id } });
      const qcloseByWarehouse = new Map(qcloses.map((q) => [q.warehouseId, q]));
      const notClosed = warehouses.filter((w) => !qcloseByWarehouse.has(w.id));
      if (notClosed.length > 0) {
        throw new Error(
          `برای انبارهای زیر «بستن تعدادی موجودی» انجام نشده است؛ ابتدا همه‌ی انبارهای مشمول را ببندید: ${namesList(notClosed.map((w) => `«${w.title}»`))}`
        );
      }
      const notConfirmed = warehouses.filter((w) => !w.confirmedDate || w.confirmedDate.getTime() < current.toDate.getTime());
      if (notConfirmed.length > 0) {
        throw new Error(`انبارهای زیر تا پایان دوره مالی تایید نیستند: ${namesList(notConfirmed.map((w) => `«${w.title}»`))}`);
      }

      // ۳-ب) شرط کامل‌بودن قیمت‌گذاری سال (قیمت‌گذاری‌ها زیر قفل مشترکِ همین کلیدِ انحصاری انجام می‌شوند، پس اینجا نتیجه‌ی قطعی را می‌بینیم)
      const valuationProblem = await getYearEndValuationProblem(current, tx);
      if (valuationProblem) throw new Error(valuationProblem.message);

      // ۴) اسناد «موجودی اول دوره»ی سیستمی دوره‌ی بعد (همان‌هایی که بستن تعدادی ساخته؛ هیچ سندی ساخته نمی‌شود)
      const targets: { warehouse: LockedWarehouse; docId: number; lines: { id: number; goodsItemId: number; quantity: number }[] }[] = [];
      for (const w of warehouses) {
        const q = qcloseByWarehouse.get(w.id)!;
        const doc = q.openingDocumentId
          ? await tx.inventoryDocument.findFirst({
              where: { id: q.openingDocumentId, documentType: "INITIAL_INVENTORY", creationType: "SYSTEM", warehouseId: w.id, fiscalPeriodId: next.id },
              include: { lines: true },
            })
          : null;
        if (!doc) throw new Error(`سند موجودی اول دوره‌ی دوره مالی بعد برای انبار «${w.title}» یافت نشد؛ بستن تعدادی این انبار ناقص است`);
        targets.push({ warehouse: w, docId: doc.id, lines: doc.lines.map((l) => ({ id: l.id, goodsItemId: l.goodsItemId, quantity: Number(l.quantity) })) });
      }

      const allLineIds = targets.flatMap((t) => t.lines.map((l) => l.id));
      const existingAmounts = await getLineAmounts(allLineIds, tx);
      if (allLineIds.some((id) => Number(existingAmounts.get(id) ?? 0) !== 0)) {
        throw new Error("ردیف‌های موجودی اول دوره‌ی سیستمی دوره‌ی بعد از قبل مبلغ دارند؛ وضعیت غیرمنتظره است");
      }

      // ۵) کاردکس پایان دوره مالی برای هر کالا (یک‌بار، برای همه‌ی انبارها) و تعیین مبلغ هر ردیف
      const itemIds = Array.from(new Set(allLineIds.length ? targets.flatMap((t) => t.lines.map((l) => l.goodsItemId)) : []));
      const items = await tx.goodsItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, fullCode: true, title: true } });
      const itemById = new Map(items.map((i) => [i.id, i]));

      const unpriced: string[] = [];
      const valueByLine = new Map<number, number>();
      let decimalPlaces = 2;
      for (const itemId of itemIds) {
        // طبق تصمیم صریح کاربر ارزش‌گذاری فقط سطح کالا است: یک کاردکس برای کالا در همه‌ی انبارها، روی کل پنجره‌ی [شروع دوره مالی،
        // پایان دوره مالی] (periodFrom=windowFrom ⇒ بازمحاسبه‌ی کل سال)
        // eslint-disable-next-line no-await-in-loop
        const k = await computeItemKardex(itemId, { windowFrom: current.fromDate, periodFrom: current.fromDate, toDate: current.toDate }, tx);
        decimalPlaces = k.decimalPlaces;
        // مثل لایه‌ی اعتبارسنجی قیمت‌گذاری: سند کاربر-قیمت‌گذار بدون مبلغ، کاردکس را (و در نتیجه مبلغ افتتاحیه را) غلط می‌کند
        for (const l of k.lines) {
          const isSystemOpening = l.document.documentType === "INITIAL_INVENTORY" && l.document.creationType === "SYSTEM";
          if (USER_PRICED_TYPES.has(l.document.documentType) && !isSystemOpening && Number(l.amount) <= 0) {
            const it = itemById.get(itemId)!;
            unpriced.push(`«${it.title}» — ${DOC_TYPE_FA[l.document.documentType] || l.document.documentType} شماره ${l.document.number ?? "؟"} (${formatJalaliDateForMessage(l.document.date)})`);
          }
        }

        // مبلغ کل پایان دوره‌ی کالا (همه‌ی انبارها) بین ردیف‌های افتتاحیه‌ی انبارها، متناسب با مقدار هر ردیف، تسهیم می‌شود
        const itemLines = targets.flatMap((t) => t.lines.filter((x) => x.goodsItemId === itemId));
        const sumQty = itemLines.reduce((sum, l) => sum + l.quantity, 0);
        if (Math.abs(k.state.qty - sumQty) > EPS) {
          throw new Error(
            `مانده‌ی تعدادیِ کاردکس کالای «${itemById.get(itemId)!.title}» (${k.state.qty}) با مجموع ردیف‌های موجودی اول دوره‌ی انبارها (${sumQty}) برابر نیست؛ اسناد را بررسی کنید`
          );
        }
        const total = round(k.state.value, k.decimalPlaces);
        if (total < -k.epsilon) {
          throw new Error(`ارزش پایان دوره‌ی کالای «${itemById.get(itemId)!.title}» منفی (${total}) محاسبه شد؛ مبلغ اسناد را بررسی کنید`);
        }
        const allocated = allocateByQuantity(Math.max(0, total), itemLines.map((l) => ({ id: l.id, qty: l.quantity })), k.decimalPlaces);
        for (const [lineId, amt] of allocated) valueByLine.set(lineId, amt);
      }
      if (unpriced.length > 0) {
        throw new Error(`برخی اسناد انبار مبلغ ندارند و ارزش پایان دوره قابل محاسبه نیست: ${namesList(Array.from(new Set(unpriced)), 6)}`);
      }

      // ۶) ثبت مبلغ روی ردیف‌های موجود
      let totalAmount = 0;
      for (const [lineId, value] of valueByLine) {
        // eslint-disable-next-line no-await-in-loop
        await setLineAmount(tx, { lineId, newAmount: value, priceType: "ACCOUNTING_CLOSING", effectiveDate: current.toDate, createdById: userId });
        totalAmount += value;
      }
      totalAmount = round(totalAmount, decimalPlaces);

      // ۶-ب) تایید اسناد «موجودی اول دوره»ی دوره‌ی بعد — بعد از مبلغ‌دارشدن، مثل «تایید حسابداری» یک سند موجودی اول دوره به FINALIZED می‌روند
      // (تا مبلغ در فرم/گزارش‌ها نمایش داده شود و دیگر «ثبت‌شده» نمانند). fiscalPeriodId صریح است چون این اسناد در دوره‌ی بعدند.
      await tx.inventoryDocument.updateMany({
        where: { id: { in: targets.map((t) => t.docId) }, fiscalPeriodId: next.id, documentType: "INITIAL_INVENTORY", creationType: "SYSTEM" },
        data: { status: "FINALIZED", finalizedAt: new Date() },
      });

      // ۷) رکورد بستن + لاگ ممیزی (زمان/کاربر)
      const close = await tx.inventoryAccountingClose.create({
        data: {
          fiscalPeriodId: current.id,
          nextFiscalPeriodId: next.id,
          openingDate: next.fromDate,
          closedById: userId,
          warehouseCount: warehouses.length,
          lineCount: valueByLine.size,
          totalAmount,
        },
      });
      await tx.inventoryAccountingCloseLog.create({ data: { fiscalPeriodId: current.id, action: "CLOSE", userId } });

      return { fiscalPeriodTitle: current.title, warehouseCount: warehouses.length, lineCount: valueByLine.size, totalAmount, closedAt: close.closedAt };
    }, TX_OPTIONS);
  } catch (e: any) {
    if (e?.code === "P2002") throw new Error("بستن حسابداری موجودی هم‌زمان توسط عملیات دیگری انجام شد؛ صفحه را بازآوری کنید");
    throw e;
  }
}

export async function reverseInventoryAccountingClose(userId: number | null): Promise<{ fiscalPeriodTitle: string; removedLineCount: number }> {
  const { current: ctxCurrent } = await getQuantityCloseContext();

  return prisma.$transaction(async (tx) => {
    const current = await tx.fiscalPeriod.findUnique({ where: { id: ctxCurrent.id } });
    if (!current) throw new Error("دوره مالی جاری یافت نشد");

    // شناسه‌ی دوره‌ی بعد برای قفل از خودِ رکورد بستن خوانده می‌شود، بعد زیر قفل دوباره خوانده می‌شود
    const pre = await tx.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: current.id } });
    if (!pre) throw new Error(`بستن حسابداری موجودی دوره مالی «${current.title}» انجام نشده است`);
    await lockOpeningYearExclusive(tx, pre.nextFiscalPeriodId);
    const close = await tx.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: current.id } });
    if (!close) throw new Error("این بستن هم‌زمان توسط عملیات دیگری برگشت خورد؛ صفحه را بازآوری کنید");

    // برگشت‌ناپذیر اگر در دوره مالی بعد قیمت‌گذاری انجام شده باشد (قیمت‌گذاریِ هم‌زمان با قفل مشترک قبل از این نقطه کامل شده است)
    const pricingInNext = await tx.goodsPricingStatus.count({ where: { reportingPeriod: { fiscalPeriodId: close.nextFiscalPeriodId } } });
    if (pricingInNext > 0) {
      throw new Error("در دوره مالی بعد قیمت‌گذاری موجودی انجام شده است؛ بستن حسابداری موجودی دوره مالی جاری غیرقابل برگشت است");
    }
    const nextClose = await tx.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: close.nextFiscalPeriodId } });
    if (nextClose) throw new Error("بستن حسابداری موجودی دوره مالی بعد انجام شده است؛ ابتدا آن را برگردانید");

    const qcloses = await tx.warehouseQuantityClose.findMany({ where: { fiscalPeriodId: current.id }, select: { openingDocumentId: true } });
    const docIds = qcloses.map((q) => q.openingDocumentId).filter((x): x is number => x != null);
    const lines = await tx.inventoryDocumentLine.findMany({ where: { documentId: { in: docIds } }, select: { id: true } });
    const removed = await tx.documentItemAmount.deleteMany({ where: { lineId: { in: lines.map((l) => l.id) }, priceType: "ACCOUNTING_CLOSING" } });
    // اسناد افتتاحیه به حالت «ثبت‌شده» برمی‌گردند (بدون مبلغ/تایید)
    await tx.inventoryDocument.updateMany({
      where: { id: { in: docIds }, fiscalPeriodId: close.nextFiscalPeriodId, documentType: "INITIAL_INVENTORY", creationType: "SYSTEM" },
      data: { status: "REGISTERED", finalizedAt: null },
    });

    await tx.inventoryAccountingClose.delete({ where: { id: close.id } });
    await tx.inventoryAccountingCloseLog.create({ data: { fiscalPeriodId: current.id, action: "REVERSE", userId } });
    return { fiscalPeriodTitle: current.title, removedLineCount: removed.count };
  }, TX_OPTIONS);
}
