import { findFormPrefix } from "../authz/registry";
import { prisma } from "../lib/prisma";
import { accountingApprovePayment, issuePaymentJournalEntry, previewPaymentIssuance } from "../services/paymentJournalEntryService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { isoToDate } from "./time";
import { defineJob } from "./types";

// «صدور سند حسابداری اعلامیه‌های پرداخت»: اعلامیه‌های پرداختِ ثبت‌شده (اثرگذار) در بازه که هنوز سند حسابداری ندارند را به ترتیب تاریخ/شماره
// پردازش می‌کند: (اختیاری) «تایید حسابداری» + «صدور سند حسابداری» — دقیقاً همان توابعی که دکمه‌های دستی فرم اعلامیه پرداخت صدا می‌زنند
// (services/paymentJournalEntryService.ts)، پس نتیجه با صدور دستی یکی است.
// هر اعلامیه‌ای که مانعی دارد (معین تعریف‌نشده در «تعیین حسابهای معین»، سطح تفصیلی که باید دستی وارد شود، …) «رد» می‌شود و با دلیل در
// تاریخچه می‌آید؛ هیچ تغییری روی آن داده نمی‌شود. اگر صدور بعد از «تایید حسابداریِ همین اجرا» شکست بخورد، تایید حسابداری برگردانده می‌شود
// تا اعلامیه به همان حالت قبل بماند.

const FORM = findFormPrefix("payments");

const fa = (iso: string) => formatJalaliDateForMessage(isoToDate(iso));

export default defineJob({
  key: "payment-journal-entries",
  title: "صدور سند حسابداری اعلامیه‌های پرداخت",
  description:
    "اعلامیه‌های پرداختِ ثبت‌شده‌ی داخل بازه که هنوز سند حسابداری ندارند را بررسی می‌کند و (در حالت واقعی) تایید حسابداری و صدور سند را مثل دکمه‌های دستی فرم انجام می‌دهد. اعلامیه‌ای که مانع دارد (مثلاً تفصیل دستی لازم یا معین تعریف‌نشده) رد می‌شود و دلیلش در تاریخچه می‌آید.",
  supportsLive: true,
  // همان دسترسی‌های دکمه‌های «تایید حسابداری» (فقط وقتی پارامتر آن روشن است) و «صدور سند حسابداری» فرم اعلامیه پرداخت
  requiredActions: (p) => [...(p.autoAccountingApprove ? [`${FORM}.accountingApprove`] : []), `${FORM}.issueJournalEntry`],
  defaultSchedule: { type: "DAILY", timeOfDay: "21:00" },
  params: [
    {
      key: "paymentDate",
      type: "dateWindow",
      label: "تاریخ اعلامیه پرداخت",
      help: "بازه‌ی نسبی به امروز؛ مثلاً «تا ۷ روز قبل» یعنی فقط اعلامیه‌هایی که حداقل ۷ روز از تاریخشان گذشته. خالی گذاشتن یک سر یعنی بدون محدودیت آن سر.",
      default: { fromDaysAgo: null, toDaysAgo: 7 },
      requiredForLive: true,
    },
    {
      key: "minDate",
      type: "date",
      label: "حداقل تاریخ اعلامیه",
      help: "اعلامیه‌های قبل از این تاریخ هرگز بررسی نمی‌شوند (مثلاً شروع دوره‌ی مالی یا تاریخ راه‌اندازی خودکارسازی). از پردازش ناخواسته‌ی اسناد قدیمی جلوگیری می‌کند.",
      default: null,
      requiredForLive: true,
    },
    {
      key: "autoAccountingApprove",
      type: "boolean",
      label: "تایید حسابداری را هم خودکار انجام بده",
      help: "روشن: اعلامیه‌ای که هنوز «تایید حسابداری» نشده، همین‌جا تایید حسابداری و بعد سند صادر می‌شود (اعلامیه قفل می‌شود). خاموش: فقط اعلامیه‌هایی که حسابدار تایید حسابداری کرده‌ است سند می‌گیرند. اعلامیه‌ای که تفصیل دستی لازم دارد در هر دو حالت رد می‌شود.",
      default: true,
    },
    {
      key: "maxPerRun",
      type: "number",
      label: "حداکثر تعداد اعلامیه در هر اجرا",
      help: "برای ایمنی: بیش از این تعداد در یک اجرا پردازش نمی‌شود؛ بقیه در اجرای بعدی می‌آیند.",
      integer: true,
      min: 1,
      max: 500,
      default: 100,
    },
  ],
  async run(ctx) {
    const win = ctx.params.paymentDate as { from: string | null; to: string | null };
    const minDate = ctx.params.minDate as string | null;
    const autoApprove = !!ctx.params.autoAccountingApprove;
    const maxPerRun = Number(ctx.params.maxPerRun) || 100;
    const from = [win.from, minDate].filter((x): x is string => !!x).sort().pop() ?? null; // دیرتر از دو حد پایین
    const to = win.to;
    if (from && to && from > to) {
      ctx.summary(`بازه‌ی مؤثر خالی است (از ${fa(from)} تا ${fa(to)})`);
      return;
    }

    const candidates = await ctx.withoutFiscalScope(() =>
      prisma.payment.findMany({
        where: {
          status: "APPROVED",
          journalEntryId: null,
          ...(from || to ? { date: { ...(from ? { gte: isoToDate(from) } : {}), ...(to ? { lte: isoToDate(to) } : {}) } } : {}),
        },
        include: { party: true, instrumentLines: { select: { baseAmount: true } } },
        // ترتیب تاریخ ← شماره: شماره‌ی سندهای حسابداریِ صادرشده با ترتیب تاریخ اعلامیه‌ها هم‌خوان بماند
        orderBy: [{ date: "asc" }, { number: "asc" }],
        take: maxPerRun + 1,
      })
    );
    const payments = candidates.slice(0, maxPerRun);
    const hasMore = candidates.length > maxPerRun;

    let issued = 0;
    for (const p of payments) {
      const ref = `اعلامیه پرداخت ${p.number}`;
      const partyTitle = p.party.category === "LEGAL" ? p.party.name ?? "" : `${p.party.firstName ?? ""} ${p.party.lastName ?? ""}`.trim();
      const total = p.instrumentLines.reduce((s, l) => s + Number(l.baseAmount), 0);
      const label = `${partyTitle} — ${formatJalaliDateForMessage(p.date)} — ${total.toLocaleString("fa-IR")}`;
      const needsApprove = p.accountingStatus !== "APPROVED";

      if (needsApprove && !autoApprove) {
        ctx.item({ ref, label, result: "SKIPPED", message: "تایید حسابداری نشده است (تایید حسابداریِ خودکار خاموش است)" });
        continue;
      }
      try {
        // هر اعلامیه در دوره‌ی مالی خودش پردازش می‌شود (کار خارج از درخواست کاربر است؛ «دوره‌ی جاری» معنی ندارد)
        const outcome = await ctx.withFiscalPeriod(p.fiscalPeriodId, async () => {
          const problems = await previewPaymentIssuance(p.id);
          if (problems.length > 0) return { kind: "blocked" as const, message: problems.join(" | ") };
          if (ctx.dryRun) return { kind: "would" as const };
          if (needsApprove) await accountingApprovePayment(p.id, ctx.userId);
          try {
            const entry = await issuePaymentJournalEntry(p.id);
            return { kind: "done" as const, number: entry.number, reference: entry.referenceNumber };
          } catch (e) {
            // تایید حسابداریِ همین اجرا برگردانده می‌شود تا اعلامیه به حالت قبل بماند
            if (needsApprove) await prisma.payment.update({ where: { id: p.id }, data: { accountingStatus: "NONE", accountingApprovedAt: null, accountingApprovedById: null } });
            throw e;
          }
        });
        if (outcome.kind === "blocked") ctx.item({ ref, label, result: "SKIPPED", message: outcome.message });
        else if (outcome.kind === "would") ctx.item({ ref, label, result: "WOULD_DO", message: needsApprove ? "تایید حسابداری + صدور سند" : "صدور سند" });
        else {
          issued += 1;
          ctx.item({ ref, label, result: "DONE", message: `سند حسابداری شماره ${outcome.number}${needsApprove ? " (با تایید حسابداری)" : ""}` });
        }
      } catch (e: any) {
        ctx.item({ ref, label, result: "FAILED", message: e?.message ? String(e.message) : String(e) });
      }
    }
    const range = `${from ? fa(from) : "…"} تا ${to ? fa(to) : "…"}`;
    ctx.summary(
      `بازه ${range}: ${payments.length} اعلامیه بررسی شد${ctx.dryRun ? "" : `، ${issued} سند صادر شد`}${hasMore ? ` (بیش از ${maxPerRun} مورد وجود دارد؛ بقیه در اجرای بعدی)` : ""}`
    );
  },
});
