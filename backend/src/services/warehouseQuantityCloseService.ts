import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { currentFiscalPeriod, lockWarehouseRow, buildSnapshotLines } from "./warehouseConfirmationService";
import { buildOpeningLineSpecs } from "./warehouseOpeningDetailService";
import { lockOpeningYearExclusive } from "./inventoryAccountingGuards";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// «بستن تعدادی موجودی انبار» (مدیریت موجودی و انبار › عملیات پایان دوره). به‌ازای هر انبار و برای دوره مالی جاری:
// موجودی نهایی تعدادی هر کالا تا پایان دوره محاسبه و به‌صورت یک سند «موجودی اول دوره»ی سیستمی (creationType=SYSTEM،
// فقط تعداد، بدون هیچ مبلغ) برای دوره مالی بعد ثبت می‌شود. همه‌ی قواعد در همین سرویس (بک‌اند) اعمال می‌شوند؛ فیلتر
// فرانت‌اند فقط راهنمای نمایش است.
//
// هم‌زمانی (طبق درخواست صریح کاربر): کل «اعتبارسنجی + ساخت سند + ثبت رکورد بسته‌شدن» در یک تراکنش دیتابیس و زیر قفل
// بدبینانه‌ی ردیف خودِ انبار (SELECT … FOR UPDATE — همان قفلی که «تایید انبار»/«برگشت از تایید» می‌گیرند) انجام می‌شود:
//  • وضعیت تایید انبار همیشه از روی ردیف قفل‌شده‌ی همین تراکنش دوباره خوانده می‌شود، نه آنچه UI قبلاً بارگذاری کرده؛
//  • تایید/برگشت هم‌زمان، یا قبل از ما کامل می‌شود (و ما نتیجه‌اش را می‌بینیم → در صورت ناتمام‌بودن تایید، کل تراکنش
//    rollback و خطای واضح)، یا تا پایان بستن منتظر می‌ماند و بعد از آن، برگشت از تاییدِ دوره‌ی بسته‌شده رد می‌شود
//    (assertNotQuantityClosedAfter در warehouseConfirmationService)؛
//  • هر خطایی در هر مرحله (از جمله ساخت سند) کل تراکنش را rollback می‌کند، پس هرگز سند/ردیف ناقص باقی نمی‌ماند؛
//  • یکتایی (warehouseId, fiscalPeriodId) در دیتابیس بستن مجدد/هم‌زمان را قطعاً رد می‌کند؛
//  • شماره‌ی سند جدید زیر قفل مشورتی (advisory) همان دوره‌ی مالی بعد گرفته می‌شود تا دو بستنِ هم‌زمانِ دو انبار
//    شماره‌ی تکراری نگیرند.
// =========================================================================

const QUANTITY_CLOSE_NUMBER_LOCK_KEY = 7100003;

export interface QuantityCloseContext {
  current: { id: number; title: string; fromDate: Date; toDate: Date };
  next: { id: number; title: string; fromDate: Date; toDate: Date } | null;
}

export async function getQuantityCloseContext(): Promise<QuantityCloseContext> {
  const current = await currentFiscalPeriod();
  if (!current) throw new Error("دوره مالی تعریف نشده است");
  const next = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { gt: current.toDate } }, orderBy: { fromDate: "asc" } });
  return { current, next };
}

export interface QuantityCloseRow {
  warehouseId: number;
  code: number;
  title: string;
  isActive: boolean;
  openingDate: Date;
  confirmedDate: Date | null;
  confirmedThroughYearEnd: boolean;
  closedAt: Date | null;
  closedByName: string | null;
  canClose: boolean;
  /** «باز کردن» (برگشت بستن تعدادی) فقط برای انبار بسته‌شده و وقتی شرط‌های reopenWarehouseQuantity برقرار باشد */
  canReopen: boolean;
  reopenBlockedReason: string | null;
}

/** فقط انبارهایی که تاریخ راه‌اندازی (OpeningDate) آن‌ها ≤ پایان دوره مالی جاری است (انبار بدون تاریخ راه‌اندازی قابل ارزیابی نیست و نمایش داده نمی‌شود). */
export async function listQuantityCloseStatus() {
  const { current, next } = await getQuantityCloseContext();
  const [warehouses, closes, accountingClose] = await Promise.all([
    prisma.warehouse.findMany({
      where: { implementationDate: { not: null, lte: current.toDate } },
      select: { id: true, code: true, title: true, isActive: true, implementationDate: true, confirmedDate: true },
      orderBy: { code: "asc" },
    }),
    // fiscalPeriodId صریح در where است، پس فیلتر خودکار دوره مالی دست‌نخورده می‌ماند
    prisma.warehouseQuantityClose.findMany({ where: { fiscalPeriodId: current.id }, include: { closedBy: { select: { firstName: true, lastName: true } } } }),
    prisma.inventoryAccountingClose.findUnique({ where: { fiscalPeriodId: current.id }, select: { id: true } }),
  ]);
  const closeByWarehouse = new Map(closes.map((c) => [c.warehouseId, c]));
  const rows: QuantityCloseRow[] = warehouses.map((w) => {
    const close = closeByWarehouse.get(w.id);
    const confirmedThroughYearEnd = !!w.confirmedDate && w.confirmedDate.getTime() >= current.toDate.getTime();
    // شرط‌های «باز کردن» (همان‌هایی که reopenWarehouseQuantity زیر قفل و داخل تراکنش دوباره کنترل می‌کند)
    let reopenBlockedReason: string | null = null;
    if (!close) reopenBlockedReason = "این انبار برای این دوره مالی بسته نشده است";
    else if (accountingClose) reopenBlockedReason = "بستن حسابداری موجودی این دوره مالی انجام شده است؛ ابتدا «برگشت بستن حسابداری موجودی» را انجام دهید";
    else if (next && w.confirmedDate && w.confirmedDate.getTime() >= next.fromDate.getTime()) reopenBlockedReason = "انبار در دوره مالی بعد تایید شده است؛ ابتدا «برگشت از تایید» انبار را انجام دهید";
    return {
      warehouseId: w.id,
      code: w.code,
      title: w.title,
      isActive: w.isActive,
      openingDate: w.implementationDate!,
      confirmedDate: w.confirmedDate,
      confirmedThroughYearEnd,
      closedAt: close?.closedAt ?? null,
      closedByName: close?.closedBy ? `${close.closedBy.firstName} ${close.closedBy.lastName}`.trim() : null,
      canClose: !close && confirmedThroughYearEnd && !!next,
      canReopen: !reopenBlockedReason,
      reopenBlockedReason,
    };
  });
  return { current, next, rows };
}

export interface QuantityCloseResult {
  warehouseId: number;
  title: string;
  lineCount: number;
  documentId: number;
  documentNumber: number;
  closedAt: Date;
}

/** بستن تعدادی یک انبار — تمام قواعد زیر قفل ردیف انبار و داخل یک تراکنش (همه‌یا‌هیچ). */
export async function closeWarehouseQuantity(warehouseId: number, userId: number | null): Promise<QuantityCloseResult> {
  const { current, next } = await getQuantityCloseContext();
  if (!next) throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");

  try {
    return await prisma.$transaction(async (tx) => {
      // ۱) قفل ردیف انبار و خواندن مجدد وضعیت از همین تراکنش (نه از UI)
      const w = await lockWarehouseRow(tx, warehouseId);
      if (!w) throw new Error("انبار یافت نشد");

      // ۲) شرط نمایش/اهلیت: تاریخ راه‌اندازی ≤ پایان دوره مالی جاری
      if (!w.implementationDate || w.implementationDate.getTime() > current.toDate.getTime()) {
        throw new Error(`تاریخ راه‌اندازی انبار «${w.title}» بعد از پایان دوره مالی جاری است؛ این انبار در این دوره قابل بستن نیست`);
      }

      // ۳) بستن مجدد ممنوع (علاوه بر یکتایی دیتابیس، پیام روشن)
      const already = await tx.warehouseQuantityClose.findUnique({ where: { warehouseId_fiscalPeriodId: { warehouseId: w.id, fiscalPeriodId: current.id } } });
      if (already) {
        throw new Error(`انبار «${w.title}» قبلاً برای دوره مالی «${current.title}» بسته شده است (${formatJalaliDateForMessage(already.closedAt)})`);
      }

      // ۴) تایید انبار تا پایان دوره مالی — دوباره و زیر قفل
      if (!w.confirmedDate || w.confirmedDate.getTime() < current.toDate.getTime()) {
        const confirmed = w.confirmedDate ? `تا تاریخ ${formatJalaliDateForMessage(w.confirmedDate)} تایید شده است` : "هنوز تایید نشده است";
        throw new Error(
          `انبار «${w.title}» ${confirmed}؛ برای بستن تعدادی باید ابتدا از «تایید انبار» تا پایان دوره مالی (${formatJalaliDateForMessage(current.toDate)}) تایید شود`
        );
      }

      // ۵) قفل شماره‌گذاری اسناد «موجودی اول دوره»ی دوره‌ی بعد (تا پایان تراکنش)
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${QUANTITY_CLOSE_NUMBER_LOCK_KEY}, ${Number(next.id)})`);

      // ۶) برای هر انبار در هر دوره حداکثر یک سند موجودی اول دوره (قانون ۲ فرم موجودی اول دوره)
      const dup = await tx.inventoryDocument.findFirst({
        where: { documentType: "INITIAL_INVENTORY", warehouseId: w.id, fiscalPeriodId: next.id },
        select: { number: true },
      });
      if (dup) {
        throw new Error(
          `برای انبار «${w.title}» در دوره مالی بعد (${next.title}) قبلاً سند موجودی اول دوره (شماره ${dup.number}) ثبت شده است؛ ابتدا آن را حذف کنید`
        );
      }

      // ۷) موجودی نهایی تعدادی تا پایان دوره، مستقیم از اسناد و داخل همین تراکنش
      const balances = await buildSnapshotLines(w.id, current.toDate, tx);
      const goodsItems = await tx.goodsItem.findMany({
        where: { id: { in: balances.map((b) => b.goodsItemId) } },
        select: { id: true, title: true, mainUnitId: true },
      });
      const itemById = new Map(goodsItems.map((g) => [g.id, g]));
      const negative = balances.find((b) => b.quantity < 0);
      if (negative) {
        throw new Error(`موجودی کالای «${itemById.get(negative.goodsItemId)?.title ?? negative.goodsItemId}» در انبار «${w.title}» منفی است (${negative.quantity})؛ ابتدا اسناد را اصلاح کنید`);
      }
      // ردیف‌های سند: به‌ازای هر (کالا، محل فیزیکی) با بچ/سریال‌های همان ردیف (فقط توصیفی؛ نگاه کنید به warehouseOpeningDetailService)
      const lines = await buildOpeningLineSpecs(w.id, current.toDate, balances, tx);

      // ۸) سند موجودی اول دوره‌ی سیستمی — فقط تعداد؛ هیچ ردیف DocumentItemAmount ساخته نمی‌شود (مبلغ نامشخص)
      const last = await tx.inventoryDocument.findFirst({
        where: { documentType: "INITIAL_INVENTORY", fiscalPeriodId: next.id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const number = (last?.number ?? 0) + 1;
      const doc = await tx.inventoryDocument.create({
        data: {
          documentType: "INITIAL_INVENTORY",
          warehouseId: w.id,
          fiscalPeriodId: next.id,
          number,
          date: next.fromDate,
          description: `انتقال مانده تعدادی پایان دوره مالی ${current.title}`,
          creationType: "SYSTEM",
          status: "REGISTERED",
          lines: {
            create: lines.map((l, idx) => ({
              goodsItemId: l.goodsItemId,
              unitId: l.unitId,
              quantity: l.quantity,
              rowOrder: idx,
              physicalLocationId: l.physicalLocationId,
              batches: l.batches.length ? { create: l.batches.map((b) => ({ batchId: b.batchId, quantity: b.quantity })) } : undefined,
              serials: l.serials.length ? { create: l.serials.map((x) => ({ serialId: x.serialId, serialStep: x.serialStep })) } : undefined,
            })),
          },
        },
      });

      // ۹) رکورد بسته‌شدن + ممیزی (زمان/کاربر)
      const close = await tx.warehouseQuantityClose.create({
        data: { warehouseId: w.id, fiscalPeriodId: current.id, closedById: userId, openingDocumentId: doc.id, lineCount: lines.length },
      });

      return { warehouseId: w.id, title: w.title, lineCount: lines.length, documentId: doc.id, documentNumber: number, closedAt: close.closedAt };
    });
  } catch (e: any) {
    // رقابتی که هیچ‌کدام از کنترل‌های بالا نگرفت، آخرین سد یکتایی دیتابیس است
    if (e?.code === "P2002") throw new Error("این انبار هم‌زمان توسط عملیات دیگری بسته شد؛ صفحه را بازآوری کنید");
    throw e;
  }
}

export interface QuantityReopenResult {
  warehouseId: number;
  title: string;
  removedDocumentNumber: number | null;
}

/**
 * «باز کردن» انبارِ بسته‌شده‌ی تعدادی (برگشت بستن تعدادی): سند «موجودی اول دوره»ی سیستمی دوره‌ی بعد و رکورد بسته‌شدن حذف می‌شود تا
 * انبار دوباره قابل بستن شود (و «برگشت از تایید» انبار، که بعد از بستن ممنوع بود، دوباره ممکن می‌شود). قواعد (طبق درخواست صریح کاربر)،
 * همه زیر قفل و داخل یک تراکنش:
 *  • در دوره مالی بعد تایید انبار وجود نداشته باشد (confirmedDate < شروع دوره‌ی بعد)؛
 *  • «بستن حسابداری موجودی» همان دوره مالی انجام نشده باشد (اگر شده، ابتدا برگشت آن)؛
 *  • انبار برای همین دوره بسته شده باشد و سند افتتاحیه‌اش هنوز همان سند سیستمی ثبت‌شده‌ی بدون مبلغ باشد.
 * ترتیب قفل‌ها هم‌ترتیب «بستن حسابداری موجودی» است (قفل انحصاری مبلغ افتتاحیه‌ی دوره‌ی بعد → قفل ردیف انبار)، پس با آن بن‌بست نمی‌شود و
 * بستن حسابداری هم‌زمان یا قبل از ما کامل می‌شود (و ما آن را می‌بینیم و رد می‌کنیم) یا بعد از ما شروع می‌شود و نبودنِ بستن تعدادی را می‌بیند؛
 * تایید هم‌زمان انبار هم چون قفل ردیف انبار را می‌گیرد، پیش از ما یا پس از ما کامل می‌شود.
 */
export async function reopenWarehouseQuantity(warehouseId: number, userId: number | null): Promise<QuantityReopenResult> {
  const { current, next } = await getQuantityCloseContext();
  if (!next) throw new Error("دوره مالی بعد تعریف نشده است");

  return prisma.$transaction(
    async (tx) => {
      await lockOpeningYearExclusive(tx, next.id);
      const w = await lockWarehouseRow(tx, warehouseId);
      if (!w) throw new Error("انبار یافت نشد");

      const close = await withoutFiscalPeriodScope(() => tx.warehouseQuantityClose.findFirst({ where: { warehouseId: w.id, fiscalPeriodId: current.id } }));
      if (!close) throw new Error(`انبار «${w.title}» برای دوره مالی «${current.title}» بسته نشده است`);

      if (w.confirmedDate && w.confirmedDate.getTime() >= next.fromDate.getTime()) {
        throw new Error(
          `انبار «${w.title}» در دوره مالی بعد («${next.title}») تایید شده است (تا ${formatJalaliDateForMessage(w.confirmedDate)})؛ ابتدا «برگشت از تایید» انبار را انجام دهید`
        );
      }
      const accountingClose = await withoutFiscalPeriodScope(() => tx.inventoryAccountingClose.findFirst({ where: { fiscalPeriodId: current.id }, select: { id: true } }));
      if (accountingClose) {
        throw new Error(`بستن حسابداری موجودی دوره مالی «${current.title}» انجام شده است؛ ابتدا «برگشت بستن حسابداری موجودی» را انجام دهید`);
      }

      let removedNumber: number | null = null;
      if (close.openingDocumentId) {
        const doc = await withoutFiscalPeriodScope(() =>
          tx.inventoryDocument.findFirst({
            where: { id: close.openingDocumentId!, documentType: "INITIAL_INVENTORY", creationType: "SYSTEM", warehouseId: w.id },
            include: { lines: { select: { id: true } } },
          })
        );
        if (doc) {
          // سند افتتاحیه باید هنوز دست‌نخورده باشد: مبلغ ندارد (بستن حسابداری انجام نشده) و تاییدشده هم نیست
          const amounts = await tx.documentItemAmount.count({ where: { lineId: { in: doc.lines.map((l) => l.id) } } });
          if (amounts > 0 || doc.status !== "REGISTERED") {
            throw new Error("سند موجودی اول دوره‌ی این انبار دیگر در وضعیت اولیه نیست (مبلغ دارد یا تایید شده)؛ باز کردن ممکن نیست");
          }
          removedNumber = doc.number;
        }
      }

      // رکورد بسته‌شدن اول حذف می‌شود (کلید خارجی openingDocumentId)، بعد خودِ سند (ردیف‌ها/سریال/بچ با cascade)
      await tx.warehouseQuantityClose.delete({ where: { id: close.id } });
      if (close.openingDocumentId) await tx.inventoryDocument.deleteMany({ where: { id: close.openingDocumentId, documentType: "INITIAL_INVENTORY", creationType: "SYSTEM" } });
      return { warehouseId: w.id, title: w.title, removedDocumentNumber: removedNumber };
    },
    { maxWait: 15000, timeout: 60000 }
  );
}
