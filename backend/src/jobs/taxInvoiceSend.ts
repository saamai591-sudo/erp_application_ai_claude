import { findFormPrefix } from "../authz/registry";
import { prisma } from "../lib/prisma";
import { buildTaxInvoice, TAX_INVOICE_INCLUDE, TaxInvoiceOptions } from "../services/taxInvoiceBuilder";
import { refreshTaxInvoiceStatuses, sendTaxInvoices } from "../services/taxInvoiceSendService";
import { isTaxTransportEnabled } from "../services/taxTransport";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { isoToDate } from "./time";
import { defineJob } from "./types";

// «ارسال خودکار صورتحساب به سامانه مودیان» — همان تابع فرم دستی (services/taxInvoiceSendService.ts#sendTaxInvoices) را صدا می‌زند، پس همه‌ی
// کنترل‌ها (اعتبارسنجی، پیش‌بررسی ارتباط پیش از رزرو سریال، سریال اتمی، قفل فاکتور) یکی است. ارسال قانونی و برگشت‌ناپذیر است، بنابراین:
//  • فقط فاکتورهای «در مهلت» ارسال می‌شوند: سرِ قدیمیِ بازه‌ی تاریخ (و «حداقل تاریخ») برای حالت واقعی الزامی است و فاکتور قدیمی‌تر از آن هرگز
//    خودکار فرستاده نمی‌شود (ارسال «موضوع ماده ۹» همیشه دستی از فرم است)؛ نوع صورتحساب همیشه ۱ است و فاکتور دارای خطا (مثلاً خریدار بدون
//    شماره اقتصادی) هرگز به نوع ۲ تبدیل نمی‌شود، رد و با دلیل گزارش می‌شود.
//  • فاکتوری که قبلاً ردیف مالیاتی دارد (رد شده یا نتیجه‌ی نامعلوم) دوباره خودکار فرستاده نمی‌شود (هر ارسال مجدد یک سریال می‌سوزاند)؛ دستی بررسی شود.
//  • در حالت واقعی ابتدا وضعیت ارسال‌های «در حال بررسی» (نتیجه‌ی نامعلوم قبلی) از سامانه استعلام می‌شود.
//  • روش تسویه برای همه نقدی/نسیه‌ی ثابتِ پارامتر است (فاکتور فروش نشانه‌ای از نقدی یا نسیه بودن ندارد)؛ نسیه‌ها را دستی بفرستید.
// حالت آزمایشی همین گزارش را بدون ارسال می‌دهد.

const FORM = findFormPrefix("tax-invoice-submission");
const CONSECUTIVE_FAILURE_LIMIT = 3;

const fa = (iso: string) => formatJalaliDateForMessage(isoToDate(iso));

export default defineJob({
  key: "tax-invoice-send",
  title: "ارسال خودکار صورتحساب به سامانه مودیان",
  description:
    "فاکتورهای فروشِ ارسال‌نشده‌ی داخل بازه (مثلاً از ۱۲ روز قبل تا ۵ روز قبل) را با نوع ۱ و روش تسویه‌ی انتخابی به سامانه مودیان می‌فرستد. فاکتور دارای خطا، خارج از بازه یا با ارسال قبلی رد می‌شود و دلیلش در تاریخچه می‌آید. در حالت آزمایشی فقط گزارش می‌دهد و چیزی ارسال نمی‌شود.",
  supportsLive: true,
  // همان دسترسی دکمه‌ی «ارسال» فرم ارسال صورتحساب به سامانه مودیان
  requiredActions: () => [`${FORM}.send`],
  defaultSchedule: { type: "WEEKLY", timeOfDay: "08:00", weekdays: [0] },
  params: [
    {
      key: "invoiceDate",
      type: "dateWindow",
      label: "تاریخ فاکتور",
      help: "بازه‌ی نسبی به امروز، مثلاً «از ۱۲ روز قبل تا ۵ روز قبل». سرِ قدیمیِ بازه همان مهلت مجاز ارسال است: فاکتور قدیمی‌تر از آن هرگز خودکار فرستاده نمی‌شود (باید دستی با «موضوع ماده ۹» ارسال شود). برای حالت واقعی الزامی است. بازه را نه کوتاه‌تر از فاصله‌ی اجراها بگیرید تا فاکتوری جا نیفتد.",
      default: { fromDaysAgo: 12, toDaysAgo: 5 },
      requiredForLive: true,
    },
    {
      key: "minDate",
      type: "date",
      label: "حداقل تاریخ فاکتور",
      help: "فاکتورهای قبل از این تاریخ هرگز بررسی نمی‌شوند (مثلاً تاریخ آخرین ارسال با سامانه‌ی قبلی «سام»، تا فاکتور تکراری نرود). برای حالت واقعی الزامی است.",
      default: null,
      requiredForLive: true,
    },
    {
      key: "settlementMethod",
      type: "select",
      label: "روش تسویه",
      help: "برای همه‌ی فاکتورهای این اجرا یکسان اعمال می‌شود (فاکتور فروش نشانه‌ای از نقدی یا نسیه بودن ندارد). اگر فاکتور نسیه دارید، آن‌ها را دستی از فرم ارسال با روش «نسیه» بفرستید.",
      options: [
        { value: "1", label: "نقدی" },
        { value: "2", label: "نسیه" },
      ],
      default: "1",
      requiredForLive: true,
    },
    {
      key: "maxPerRun",
      type: "number",
      label: "حداکثر تعداد فاکتور در هر اجرا",
      help: "برای ایمنی: بیش از این تعداد در یک اجرا ارسال نمی‌شود؛ بقیه در اجرای بعدی (اگر هنوز در بازه باشند) می‌آیند.",
      integer: true,
      min: 1,
      max: 200,
      default: 20,
    },
  ],
  async run(ctx) {
    const win = ctx.params.invoiceDate as { from: string | null; to: string | null };
    const minDate = ctx.params.minDate as string | null;
    const settlement = (ctx.params.settlementMethod === "2" ? 2 : 1) as 1 | 2;
    const maxPerRun = Number(ctx.params.maxPerRun) || 20;
    const from = [win.from, minDate].filter((x): x is string => !!x).sort().pop() ?? null; // دیرتر از دو حد پایین
    const to = win.to;
    if (from && to && from > to) {
      ctx.summary(`بازه‌ی مؤثر خالی است (از ${fa(from)} تا ${fa(to)})`);
      return;
    }

    if (!ctx.dryRun) {
      if (!isTaxTransportEnabled()) throw new Error("ارسال به سامانه مودیان روی این سرور فعال نیست (TAX_TRANSPORT_ENABLED)");
      // نتیجه‌ی نامعلومِ ارسال‌های قبلی ابتدا روشن شود (هرگز دوباره ارسال نمی‌شوند؛ فقط استعلام)
      try {
        const r = await refreshTaxInvoiceStatuses();
        if (r.checked > 0) ctx.item({ ref: "استعلام وضعیت", label: "ارسال‌های در حال بررسی", result: "DONE", message: `${r.checked} مورد استعلام شد، ${r.updated} مورد به‌روز شد` });
      } catch (e: any) {
        throw new Error(`استعلام ارسال‌های در حال بررسی ناموفق بود؛ برای جلوگیری از ارسال تکراری ارسال جدیدی انجام نشد: ${e?.message ?? e}`);
      }
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
        // ترتیب تاریخ ← شماره: سریال‌های مالیاتی هم‌ترتیب با فاکتورها تخصیص یابد
        orderBy: [{ date: "asc" }, { number: "asc" }],
        take: maxPerRun + 1,
      })
    );
    const batch = invoices.slice(0, maxPerRun);
    const hasMore = invoices.length > maxPerRun;
    const options: Partial<TaxInvoiceOptions> = { invoiceType: 1, isArticle9: false, settlementMethod: settlement };

    let sent = 0;
    let consecutiveFailures = 0;
    for (let i = 0; i < batch.length; i += 1) {
      const inv = batch[i];
      const ref = `فاکتور فروش ${inv.number}`;
      // eslint-disable-next-line no-await-in-loop
      const built = await buildTaxInvoice(inv, options, { nowMs: ctx.now.getTime(), skipTaxId: true });
      const label = `${built.meta.customerTitle ?? ""} — ${formatJalaliDateForMessage(inv.date)}`;

      if (inv.taxInvoices.length > 0) {
        ctx.item({ ref, label, result: "SKIPPED", message: "قبلاً ارسال شده و رد شده یا نتیجه‌اش نامعلوم مانده؛ دستی از فرم بررسی و ارسال شود" });
        continue;
      }
      if (built.errorCount > 0) {
        const reasons = built.problems.filter((p) => p.severity === "error").slice(0, 3).map((p) => p.message);
        ctx.item({ ref, label, result: "SKIPPED", message: reasons.join(" | ") });
        continue;
      }
      if (ctx.dryRun) {
        ctx.item({ ref, label, result: "WOULD_DO", message: `ارسال با نوع ۱، ${settlement === 2 ? "نسیه" : "نقدی"}` });
        continue;
      }
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
        ctx.item({ ref, label, result: "SKIPPED", message: `بعد از ${CONSECUTIVE_FAILURE_LIMIT} شکست پشت‌سرهم، ادامه‌ی اجرا متوقف شد (در اجرای بعدی دوباره بررسی می‌شود)` });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const [r] = await sendTaxInvoices([{ salesInvoiceId: inv.id, ...options }]);
      if (r?.ok) {
        sent += 1;
        consecutiveFailures = 0;
        ctx.item({ ref, label, result: "DONE", message: r.message || `ارسال شد${r.taxId ? ` — ${r.taxId}` : ""}` });
      } else {
        consecutiveFailures += 1;
        ctx.item({ ref, label, result: "FAILED", message: r?.message || "ارسال ناموفق بود" });
      }
    }
    const range = `${from ? fa(from) : "…"} تا ${to ? fa(to) : "…"}`;
    ctx.summary(
      `بازه ${range}: ${batch.length} فاکتور بررسی شد${ctx.dryRun ? "" : `، ${sent} فاکتور ارسال شد`}${hasMore ? ` (بیش از ${maxPerRun} فاکتور وجود دارد؛ بقیه در اجرای بعدی)` : ""}`
    );
  },
});
