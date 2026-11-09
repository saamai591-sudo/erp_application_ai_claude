import { findFormPrefix } from "../authz/registry";
import { getRequestContext, runWithRequestContext } from "../lib/requestContext";
import { IssueDryRunSignal } from "../services/journalEntryService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { getIssuer, ISSUERS } from "./issuers";
import type { IssuerCandidate, JournalIssuer } from "./issuers/types";
import { isoToDate } from "./time";
import { defineJob } from "./types";

// «صدور سند حسابداری»: فرم‌هایی که کاربر در تنظیمات کار تیک زده را به ترتیب تاریخ سند (و بعد ترتیب فرم، شماره) پردازش می‌کند و برای هر رکوردِ
// بدون سند: (اختیاری، فقط فرم‌های دارای مرحله‌ی «تایید حسابداری») تایید حسابداری + صدور سند — دقیقاً همان توابعی که دکمه‌های دستی فرم صدا می‌زنند
// (jobs/issuers)، پس نتیجه با صدور دستی یکی است.
// رکوردی که مانعی دارد (معین تعریف‌نشده در تنظیمات، تفصیلی که باید دستی وارد شود، …) «رد» می‌شود و با دلیل در تاریخچه می‌آید؛ هیچ تغییری روی آن
// داده نمی‌شود. اگر صدور بعد از «تایید حسابداریِ همین اجرا» شکست بخورد، آن تایید برگردانده می‌شود تا رکورد به حالت قبل بماند.
// پیش‌بررسی (و حالت آزمایشی) هیچ‌چیز نمی‌نویسد: برای رکوردِ هنوز تایید‌نشده، preview فقط‌خواندنی؛ برای بقیه، تابع صدور با زمینه‌ی dryRunIssue اجرا می‌شود که
// بعد از همه‌ی اعتبارسنجی‌ها و قبل از نوشتن سند متوقف می‌شود (IssueDryRunSignal).
// کلید کار «payment-journal-entries» ماند تا ردیف تنظیمات و تاریخچه‌ی قبلی از بین نرود (قبلاً فقط اعلامیه‌های پرداخت را پردازش می‌کرد).

const fa = (iso: string) => formatJalaliDateForMessage(isoToDate(iso));
const oneLine = (m: string) => m.replace(/\s*\n+\s*/g, " | ");

/** بدون نوشتن: تابع صدور را تا لحظه‌ی نوشتن سند اجرا می‌کند؛ موانع را برمی‌گرداند (خالی = صدور موفق می‌شود) */
async function dryRunProblems(issuer: JournalIssuer, c: IssuerCandidate): Promise<string[]> {
  try {
    await runWithRequestContext({ ...(getRequestContext() ?? {}), dryRunIssue: true }, () => issuer.issue(c));
    return [];
  } catch (e: any) {
    if (e instanceof IssueDryRunSignal) return [];
    return [oneLine(e?.message ? String(e.message) : String(e))];
  }
}

export default defineJob({
  key: "payment-journal-entries",
  title: "صدور سند حسابداری",
  description:
    "اسناد ثبت‌شده‌ی فرم‌هایی که شما تیک می‌زنید (اعلامیه پرداخت، رسید دریافت، فاکتورها، چک‌ها، …) و هنوز سند حسابداری ندارند را به ترتیب تاریخ بررسی می‌کند و (در حالت واقعی) صدور سند — و در فرم‌هایی که «تایید حسابداری» دارند، اگر پارامترش روشن باشد، تایید حسابداری — را مثل دکمه‌های دستی همان فرم انجام می‌دهد. سندی که مانع دارد (مثلاً تفصیل دستی لازم یا معین تعریف‌نشده) رد می‌شود و دلیلش در تاریخچه می‌آید.",
  supportsLive: true,
  // همان دسترسی‌های دکمه‌های «صدور سند حسابداری» هر فرمِ انتخاب‌شده و (فقط وقتی پارامتر آن روشن است) «تایید حسابداری» فرم‌هایی که این مرحله را دارند
  requiredActions: (p) => {
    const keys: string[] = [];
    for (const k of (p.forms as string[]) ?? []) {
      const issuer = getIssuer(k);
      if (!issuer) continue;
      const prefix = findFormPrefix(issuer.form);
      keys.push(`${prefix}.issueJournalEntry`);
      if (issuer.accountingApprove && p.autoAccountingApprove) keys.push(`${prefix}.accountingApprove`);
    }
    return keys;
  },
  defaultSchedule: { type: "DAILY", timeOfDay: "21:00" },
  params: [
    {
      key: "forms",
      type: "multiselect",
      label: "فرم‌هایی که سند می‌گیرند",
      help: "هر فرمِ تیک‌خورده در هر اجرا بررسی می‌شود؛ ترتیب صدور بین فرم‌ها بر اساس تاریخ سند است تا شماره‌ی اسناد حسابداری با ترتیب تاریخ رویدادها هم‌خوان بماند. فرمی که در فهرست نیست (مثلاً حقوق یا سند انبار) هنوز به این کار وصل نشده است.",
      options: ISSUERS.map((i) => ({ value: i.key, label: i.title, group: i.group })),
      default: ["payments"],
      requiredForLive: true,
    },
    {
      key: "documentDate",
      legacyKey: "paymentDate",
      type: "dateWindow",
      label: "تاریخ سند",
      help: "بازه‌ی نسبی به امروز؛ مثلاً «تا ۷ روز قبل» یعنی فقط اسنادی که حداقل ۷ روز از تاریخشان گذشته. خالی گذاشتن یک سر یعنی بدون محدودیت آن سر. برای همه‌ی فرم‌های انتخاب‌شده یکسان اعمال می‌شود.",
      default: { fromDaysAgo: null, toDaysAgo: 7 },
      requiredForLive: true,
    },
    {
      key: "minDate",
      type: "date",
      label: "حداقل تاریخ سند",
      help: "اسناد قبل از این تاریخ هرگز بررسی نمی‌شوند (مثلاً شروع دوره‌ی مالی یا تاریخ راه‌اندازی خودکارسازی). از پردازش ناخواسته‌ی اسناد قدیمی جلوگیری می‌کند.",
      default: null,
      requiredForLive: true,
    },
    {
      key: "autoAccountingApprove",
      type: "boolean",
      label: "تایید حسابداری را هم خودکار انجام بده",
      help: "فقط برای فرم‌هایی که مرحله‌ی «تایید حسابداری» دارند (اعلامیه پرداخت، رسید دریافت، اعلامیه بدهکار بستانکار). روشن: سندی که هنوز تایید حسابداری نشده، همین‌جا تایید حسابداری و بعد سند صادر می‌شود (سند قفل می‌شود). خاموش: فقط اسنادی که حسابدار تایید حسابداری کرده سند می‌گیرند. سندی که تفصیل دستی لازم دارد در هر دو حالت رد می‌شود. فرم‌های دیگر مرحله‌ی تایید حسابداری ندارند و فقط وقتی «تایید/ثبت» عملیاتی شده باشند سند می‌گیرند.",
      default: true,
    },
    {
      key: "maxPerRun",
      type: "number",
      label: "حداکثر تعداد سند در هر اجرا",
      help: "برای ایمنی: بیش از این تعداد (جمع همه‌ی فرم‌ها) در یک اجرا پردازش نمی‌شود؛ بقیه در اجرای بعدی می‌آیند.",
      integer: true,
      min: 1,
      max: 500,
      default: 100,
    },
  ],
  async run(ctx) {
    const selected = ISSUERS.filter((i) => ((ctx.params.forms as string[]) ?? []).includes(i.key));
    if (selected.length === 0) {
      ctx.summary("هیچ فرمی انتخاب نشده است");
      return;
    }
    const win = ctx.params.documentDate as { from: string | null; to: string | null };
    const minDate = ctx.params.minDate as string | null;
    const autoApprove = !!ctx.params.autoAccountingApprove;
    const maxPerRun = Number(ctx.params.maxPerRun) || 100;
    const from = [win.from, minDate].filter((x): x is string => !!x).sort().pop() ?? null; // دیرتر از دو حد پایین
    const to = win.to;
    if (from && to && from > to) {
      ctx.summary(`بازه‌ی مؤثر خالی است (از ${fa(from)} تا ${fa(to)})`);
      return;
    }
    const range = { from: from ? isoToDate(from) : null, to: to ? isoToDate(to) : null };

    // کاندیداهای هر فرم (هر کدام تا maxPerRun+1) ← ادغام بر اساس تاریخ، بعد ترتیب فرم در فهرست، بعد شماره؛ شماره‌ی اسناد حسابداری با ترتیب تاریخ هم‌خوان بماند
    const all: { issuer: JournalIssuer; order: number; c: IssuerCandidate }[] = [];
    for (const [order, issuer] of selected.entries()) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rows = await ctx.withoutFiscalScope(() => issuer.find(range, maxPerRun + 1));
        for (const c of rows) all.push({ issuer, order, c });
      } catch (e: any) {
        ctx.item({ ref: issuer.title, result: "FAILED", message: `خواندن فهرست این فرم ناموفق بود: ${e?.message ? String(e.message) : String(e)}` });
      }
    }
    all.sort((a, b) => a.c.date.getTime() - b.c.date.getTime() || a.order - b.order || a.c.number - b.c.number);
    const picked = all.slice(0, maxPerRun);
    const hasMore = all.length > maxPerRun;

    let issued = 0;
    const perForm = new Map<string, number>();
    for (const { issuer, c } of picked) {
      perForm.set(issuer.title, (perForm.get(issuer.title) ?? 0) + 1);
      const ref = `${issuer.title} ${c.number}`;
      const label = c.label;

      if (c.needsApprove && !autoApprove) {
        ctx.item({ ref, label, result: "SKIPPED", message: "تایید حسابداری نشده است (تایید حسابداریِ خودکار خاموش است)" });
        continue;
      }
      try {
        // هر سند در دوره‌ی مالی خودش پردازش می‌شود (کار خارج از درخواست کاربر است؛ «دوره‌ی جاری» معنی ندارد)
        const outcome = await ctx.withFiscalPeriod(c.fiscalPeriodId, async () => {
          const problems = c.needsApprove && issuer.preview ? await issuer.preview(c) : await dryRunProblems(issuer, c);
          if (problems.length > 0) return { kind: "blocked" as const, message: problems.join(" | ") };
          if (ctx.dryRun) return { kind: "would" as const };
          if (c.needsApprove) await issuer.approve!(c, ctx.userId);
          try {
            const r = await issuer.issue(c);
            return { kind: "done" as const, number: r.number, reference: r.referenceNumber };
          } catch (e) {
            // تایید حسابداریِ همین اجرا برگردانده می‌شود تا سند به حالت قبل بماند
            if (c.needsApprove) await issuer.unapprove!(c);
            throw e;
          }
        });
        if (outcome.kind === "blocked") ctx.item({ ref, label, result: "SKIPPED", message: outcome.message });
        else if (outcome.kind === "would") ctx.item({ ref, label, result: "WOULD_DO", message: c.needsApprove ? "تایید حسابداری + صدور سند" : "صدور سند" });
        else {
          issued += 1;
          const entryText = outcome.number != null ? `سند حسابداری شماره ${outcome.number}` : outcome.reference != null ? `سند حسابداری با شماره عطف ${outcome.reference}` : "سند حسابداری صادر شد";
          ctx.item({ ref, label, result: "DONE", message: `${entryText}${c.needsApprove ? " (با تایید حسابداری)" : ""}` });
        }
      } catch (e: any) {
        ctx.item({ ref, label, result: "FAILED", message: e?.message ? String(e.message) : String(e) });
      }
    }
    const rangeText = `${from ? fa(from) : "…"} تا ${to ? fa(to) : "…"}`;
    const breakdown = perForm.size > 1 ? ` (${Array.from(perForm, ([t, n]) => `${t}: ${n}`).join("، ")})` : "";
    ctx.summary(
      `بازه ${rangeText}: ${picked.length} سند بررسی شد${breakdown}${ctx.dryRun ? "" : `، ${issued} سند صادر شد`}${hasMore ? ` (بیش از ${maxPerRun} مورد وجود دارد؛ بقیه در اجرای بعدی)` : ""}`
    );
  },
});
