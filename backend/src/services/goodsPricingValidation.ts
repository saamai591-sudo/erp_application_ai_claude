import { prisma } from "../lib/prisma";
import { USER_PRICED_TYPES, DOC_TYPE_FA, findPreviousValuationProblems } from "./goodsPricingService";
import { getPreviousYearAccountingCloseProblem } from "./inventoryAccountingGuards";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { getLineAmounts } from "./documentItemAmountService";
import { CARRY_FORWARD_OPENING_WHERE } from "./warehouseStockService";

export interface ValidationDetailRow {
  code: string;
  title: string;
  reason: string;
}

export interface PricingValidationResult {
  valid: boolean;
  messages: string[];
  details: ValidationDetailRow[];
}

// لایه‌ی اعتبارسنجیِ مستقل از خودِ priceItem — طبق تصمیم صریح کاربر، دیگر در لحظه‌ی لود اطلاعات
// (GET /candidates) اجرا نمی‌شود؛ فقط وقتی کاربر ردیف‌ها را انتخاب کرده و دکمه‌ی «قیمت‌گذاری» را می‌زند
// (POST /validate، پیش از POST /run) صدا زده می‌شود. این فقط یک پیش‌بررسیِ سریعِ دسته‌ای است — تضمین
// نهاییِ صحت همچنان در لحظه‌ی اجرای priceItem/revertItem (با داده‌ی کاملاً زنده‌ی همان لحظه) انجام
// می‌شود؛ نگاه کنید به یادداشت‌های goodsPricingService.ts برای جزئیات این معماری دو‌لایه.
//
// همه‌ی بررسی‌ها روی کل مجموعه‌ی انتخاب‌شده اجرا می‌شوند (نه اینکه با اولین خطا متوقف شود) تا کاربر در
// یک‌بار تلاش، همه‌ی مشکلات را ببیند؛ خروجی یک لیست messages (یک پیام کلی به‌ازای هر بررسیِ ناموفق) به‌علاوه
// details (ردیف‌های قابل‌خروجی به اکسل، شامل کد/عنوان کالا و دلیل دقیق) است.
export async function validatePriceOperation(reportingPeriodId: number, goodsItemIds: number[]): Promise<PricingValidationResult> {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
  if (!period) return { valid: false, messages: ["دوره گزارشگری یافت نشد"], details: [] };

  const items = await prisma.goodsItem.findMany({ where: { id: { in: goodsItemIds } }, select: { id: true, fullCode: true, title: true } });
  const itemById = new Map(items.map((i) => [i.id, i]));

  const messages: string[] = [];
  const details: ValidationDetailRow[] = [];

  // ۱) پیش‌نیاز دوره مالی قبل: طبق تصمیم صریح کاربر، تنها کنترلِ دوره‌ی قبل این است که «بستن حسابداری موجودی» دوره مالیِ قبلِ
  // این دوره‌ی گزارشگری انجام شده باشد — دیگر هیچ کنترل سطح‌کالای «در دوره‌ی قبل قیمت‌گذاری شده؟» وجود ندارد (priceItem خودش هم
  // همین یک کنترل را، داخل تراکنش و زیر قفل، دوباره انجام می‌دهد).
  const previousYearProblem = await getPreviousYearAccountingCloseProblem(period.fiscalPeriodId);
  if (previousYearProblem) messages.push(previousYearProblem);

  // ۱-ب) ارزش‌گذاری دوره‌ی گزارشگری قبل (سطح کالا، طبق تصمیم صریح کاربر): کالایی که قبل از شروع این دوره گردش داشته، باید در آخرین دوره‌ی
  // گزارشگریِ قبلیِ دارای گردشش (همان سال مالی) رکورد ارزش‌گذاری داشته باشد؛ نبودنش خطا است و ادامه نمی‌دهد.
  const previousValuationProblems = await findPreviousValuationProblems(goodsItemIds, period);
  if (previousValuationProblems.length > 0) {
    messages.push("برخی از کالاهای انتخاب‌شده در دوره‌ی گزارشگریِ قبلیِ دارای گردشِ خود ارزش‌گذاری نشده‌اند.");
    for (const pr of previousValuationProblems) {
      const item = itemById.get(pr.goodsItemId);
      if (item) details.push({ code: item.fullCode, title: item.title, reason: `این کالا در دوره‌ی گزارشگری «${pr.period.title}» گردش داشته ولی در آن دوره قیمت‌گذاری نشده است.` });
    }
  }

  // ۲) تایید انبار: انبارهای مرتبط با کالاهای انتخاب‌شده از جدول موقت GoodsPricingFlowWarehouse خوانده
  // می‌شوند (طبق تصمیم صریح کاربر، بدون کوئری دوباره‌ی InventoryDocumentLine) — این جدول هر بار که
  // «لود اطلاعات» زده می‌شود کامل بازسازی می‌شود. اما وضعیتِ خودِ تاییدِ انبار (confirmedDate) همیشه
  // زنده خوانده می‌شود، نه از این کش؛ اگر بین لود و کلیک قیمت‌گذاری کسی تاییدِ انباری را برگرداند، همین‌جا
  // گرفته می‌شود.
  const flows = await prisma.goodsPricingFlowWarehouse.findMany({
    where: { reportingPeriodId, goodsItemId: { in: goodsItemIds } },
    select: { goodsItemId: true, warehouseId: true },
  });
  const warehouseIds = Array.from(new Set(flows.map((f) => f.warehouseId)));
  if (warehouseIds.length > 0) {
    const unconfirmedWarehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: warehouseIds },
        implementationDate: { not: null, lt: period.toDate },
        OR: [{ confirmedDate: null }, { confirmedDate: { lt: period.toDate } }],
      },
      select: { id: true, title: true, confirmedDate: true },
    });
    if (unconfirmedWarehouses.length > 0) {
      messages.push("برخی از انبارهای مرتبط با کالاهای انتخاب‌شده تا پایان این دوره تایید نشده‌اند.");
      const unconfirmedIds = new Set(unconfirmedWarehouses.map((w) => w.id));
      const warehouseById = new Map(unconfirmedWarehouses.map((w) => [w.id, w]));
      for (const f of flows) {
        if (!unconfirmedIds.has(f.warehouseId)) continue;
        const item = itemById.get(f.goodsItemId);
        const wh = warehouseById.get(f.warehouseId);
        if (item && wh) {
          details.push({
            code: item.fullCode,
            title: item.title,
            reason: `انبار «${wh.title}» تا پایان این دوره تایید نشده است (${
              wh.confirmedDate ? `تایید تا ${formatJalaliDateForMessage(wh.confirmedDate)}` : "هرگز تایید نشده"
            }).`,
          });
        }
      }
    }
  }

  // ۳) مبلغ اسناد کاربر-قیمت‌گذار: موجودی اول دوره/رسید انبار خرید/رسید تولید/اضافات انبارگردانی باید
  // مبلغ واقعی (بزرگ‌تر از صفر) داشته باشند — چون کاردکس این چهار نوع را عیناً (بدون محاسبه) به‌عنوان
  // مبنا می‌گیرد؛ اگر صفر مانده باشند، کل محاسبه‌ی بعدی غلط خواهد شد.
  // پنجره‌ی ارزش‌گذاری: از شروع دوره مالی تا پایان این دوره‌ی گزارشگری (اسناد سال‌های قبل در محاسبه نمی‌آیند و بررسی نمی‌شوند)
  const fiscal = await prisma.fiscalPeriod.findUnique({ where: { id: period.fiscalPeriodId } });
  const windowFrom = fiscal!.fromDate;
  const candidateLines = await prisma.inventoryDocumentLine.findMany({
    where: {
      goodsItemId: { in: goodsItemIds },
      // سند انتقال مانده‌ی «بستن تعدادی» عمداً بدون مبلغ است و در قیمت‌گذاری شمرده نمی‌شود
      document: { documentType: { in: Array.from(USER_PRICED_TYPES) as any }, date: { gte: windowFrom, lte: period.toDate }, NOT: CARRY_FORWARD_OPENING_WHERE },
    },
    select: { id: true, goodsItemId: true, document: { select: { documentType: true, number: true, date: true } } },
  });
  // مبلغ دیگر ستون خام نیست — SUM(Difference) هر ردیف باید محاسبه شود تا «مبلغ ندارد» (<= 0) تشخیص داده شود
  const amountByLineId = await getLineAmounts(candidateLines.map((l) => l.id));
  const unpricedLines = candidateLines.filter((l) => Number(amountByLineId.get(l.id) ?? 0) <= 0);
  if (unpricedLines.length > 0) {
    messages.push("برخی از اسناد انبار مبلغ ندارند.");
    for (const l of unpricedLines) {
      const item = itemById.get(l.goodsItemId);
      if (item) {
        details.push({
          code: item.fullCode,
          title: item.title,
          reason: `سند «${DOC_TYPE_FA[l.document.documentType] || l.document.documentType}» شماره ${l.document.number} مورخ ${formatJalaliDateForMessage(
            l.document.date
          )} مبلغ ندارد.`,
        });
      }
    }
  }

  return { valid: messages.length === 0, messages, details };
}
