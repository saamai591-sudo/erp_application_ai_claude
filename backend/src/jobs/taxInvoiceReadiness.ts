import { prisma } from "../lib/prisma";
import { buildTaxInvoice, DEFAULT_TAX_OPTIONS, TAX_INVOICE_INCLUDE } from "../services/taxInvoiceBuilder";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { isoToDate } from "./time";

const fa = (iso: string) => formatJalaliDateForMessage(isoToDate(iso));
import { defineJob } from "./types";

// «گزارش فاکتورهای آماده‌ی ارسال به سامانه مودیان» — فقط گزارش؛ هیچ‌چیز به سامانه ارسال نمی‌شود و حالت «واقعی» ندارد (supportsLive = false).
// همان فاکتورهایی را می‌یابد که فرم «ارسال صورتحساب به سامانه مودیان» (routes/taxInvoices.ts#candidates) در تب «آماده‌ی ارسال» نشان می‌دهد
// و با گزینه‌های پیش‌فرض (نوع ۱، نقدی) اعتبارسنجی می‌کند: بدون خطا ⇒ «آماده» (WOULD_DO)، دارای خطا ⇒ «رد» (SKIPPED) با دلیل.
// این کار نمونه‌ی مرجع زیرساخت است: برای ساخت کار تازه همین فایل را الگو بگیرید.

const MAX_INVOICES = 1000;

export default defineJob({
  key: "tax-invoice-readiness",
  title: "گزارش فاکتورهای آماده‌ی ارسال به سامانه مودیان",
  description: "فاکتورهای فروشِ ارسال‌نشده‌ی داخل بازه را اعتبارسنجی می‌کند و می‌گوید کدام‌ها آماده‌ی ارسال هستند و کدام‌ها چه خطایی دارند. هیچ‌چیزی ارسال نمی‌شود.",
  supportsLive: false,
  defaultSchedule: { type: "WEEKLY", timeOfDay: "08:00", weekdays: [0] },
  params: [
    {
      key: "invoiceDate",
      type: "dateWindow",
      label: "تاریخ فاکتور",
      help: "بازه‌ی نسبی به امروز، مثلاً «از ۱۲ روز قبل تا ۵ روز قبل». خالی گذاشتن یک سر یعنی بدون محدودیت آن سر.",
      default: { fromDaysAgo: 12, toDaysAgo: 5 },
      requiredForLive: true,
    },
    {
      key: "minDate",
      type: "date",
      label: "حداقل تاریخ فاکتور",
      help: "فاکتورهای قبل از این تاریخ هرگز بررسی نمی‌شوند (مثلاً تاریخ آخرین ارسال با سامانه‌ی قبلی).",
      default: null,
      requiredForLive: true,
    },
  ],
  async run(ctx) {
    const win = ctx.params.invoiceDate as { from: string | null; to: string | null };
    const minDate = ctx.params.minDate as string | null;
    const from = [win.from, minDate].filter((x): x is string => !!x).sort().pop() ?? null; // دیرتر از دو حد پایین
    const to = win.to;
    if (from && to && from > to) {
      ctx.summary(`بازه‌ی مؤثر خالی است (از ${fa(from)} تا ${fa(to)})`);
      return;
    }
    const invoices = await ctx.withoutFiscalScope(() =>
      prisma.salesInvoice.findMany({
        where: {
          status: { not: "VOIDED" },
          ...(from || to ? { date: { ...(from ? { gte: isoToDate(from) } : {}), ...(to ? { lte: isoToDate(to) } : {}) } } : {}),
          numberingPattern: { hasTaxMemory: true },
          taxInvoices: { none: { status: { in: ["IN_PROGRESS", "SUCCESS"] } } },
        },
        include: TAX_INVOICE_INCLUDE,
        orderBy: [{ date: "asc" }, { number: "asc" }],
        take: MAX_INVOICES,
      })
    );
    const nowMs = ctx.now.getTime();
    let ready = 0;
    let blocked = 0;
    for (const inv of invoices) {
      // eslint-disable-next-line no-await-in-loop
      const built = await buildTaxInvoice(inv, DEFAULT_TAX_OPTIONS, { nowMs, skipTaxId: true });
      const ref = `فاکتور فروش ${inv.number}`;
      const label = `${built.meta.customerTitle ?? ""} — ${formatJalaliDateForMessage(inv.date)}`;
      if (built.errorCount > 0) {
        blocked += 1;
        const reasons = built.problems.filter((p) => p.severity === "error").slice(0, 3).map((p) => p.message);
        ctx.item({ ref, label, result: "SKIPPED", message: reasons.join(" | ") });
      } else {
        ready += 1;
        ctx.item({ ref, label, result: "WOULD_DO", message: built.warningCount > 0 ? `آماده (${built.warningCount} هشدار)` : "آماده‌ی ارسال" });
      }
    }
    const range = `${from ? fa(from) : "…"} تا ${to ? fa(to) : "…"}`;
    ctx.summary(`بازه ${range}: ${ready} فاکتور آماده، ${blocked} فاکتور دارای خطا${invoices.length >= MAX_INVOICES ? ` (فقط ${MAX_INVOICES} مورد اول بررسی شد)` : ""}`);
  },
});
