import { PrismaClient, Prisma } from "@prisma/client";
import { getRequestContext } from "./requestContext";

const rawPrisma = new PrismaClient();

// همه‌ی مدل‌هایی که فیلد fiscalPeriodId دارند — پویا از DMMF خوانده می‌شود (نه یک لیست ثابت دستی) تا هر
// مدل تازه‌ای که بعداً به schema.prisma با فیلد fiscalPeriodId اضافه شود، بدون هیچ تغییری در همین فایل
// خودکار پوشش داده شود (طبق درخواست صریح کاربر: «در base انجام شود تا روی موجودیت‌های آینده هم اعمال شود»).
const FISCAL_SCOPED_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === "fiscalPeriodId" && f.kind === "scalar"))
    .map((m) => m.name)
);

/**
 * دوره مالی مؤثر برای این درخواست را برمی‌گرداند: همان چیزی که فرانت‌اند در هدر x-fiscal-period-id
 * فرستاده (middleware/fiscalScope.ts آن را در RequestContext گذاشته)، وگرنه «آخرین دوره مالی تعریف‌شده»
 * (دقیقاً همان قرارداد resolveFiscalPeriod در routes/reportingPeriods.ts). نتیجه روی خودِ RequestContext
 * کش می‌شود تا در طول یک درخواست (که ممکن است چند Query لیستی بزند) فقط یک‌بار محاسبه شود.
 */
async function resolveEffectiveFiscalPeriodId(): Promise<number | undefined> {
  const ctx = getRequestContext();
  if (!ctx || ctx.bypassFiscalScope) return undefined;
  if (ctx.fiscalPeriodId !== undefined) return ctx.fiscalPeriodId;
  if ("resolvedFallbackFiscalPeriodId" in ctx) return (ctx as any).resolvedFallbackFiscalPeriodId;

  const latest = await rawPrisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
  (ctx as any).resolvedFallbackFiscalPeriodId = latest?.id;
  return latest?.id;
}

/**
 * دوره مالی «جاری» مؤثر برای این درخواست (همان چیزی که withFiscalScope برای فیلتر لیست‌ها استفاده
 * می‌کند) — برای استفاده در اعتبارسنجی «تاریخ سند باید در بازه‌ی دوره مالی جاری باشد»
 * (نگاه کنید به utils/fiscalPeriodValidation.ts). اگر هیچ زمینه‌ی درخواستی در کار نباشد (مثلاً
 * اسکریپت‌های پس‌زمینه) یا bypassFiscalScope فعال باشد، null برمی‌گرداند — یعنی این کنترل نادیده
 * گرفته می‌شود، نه این‌که با خطا متوقف شود.
 */
export async function getCurrentFiscalPeriod() {
  const id = await resolveEffectiveFiscalPeriodId();
  if (id === undefined) return null;
  return rawPrisma.fiscalPeriod.findUnique({ where: { id } });
}

async function withFiscalScope(model: string, args: any, query: (args: any) => Promise<any>) {
  if (!FISCAL_SCOPED_MODELS.has(model)) return query(args);
  const ctx = getRequestContext();
  if (!ctx || ctx.bypassFiscalScope) return query(args);
  // اگر فراخوان خودش صراحتاً fiscalPeriodId را در where (سطح بالا) مشخص کرده، دست‌نخورده می‌ماند —
  // نه بازنویسی می‌شود و نه دوباره فیلتر اضافه می‌شود (مثال: routes/reportingPeriods.ts که خودش
  // fiscalPeriodId را resolve و در where می‌گذارد).
  if (args?.where && Object.prototype.hasOwnProperty.call(args.where, "fiscalPeriodId")) return query(args);

  const fiscalPeriodId = await resolveEffectiveFiscalPeriodId();
  if (fiscalPeriodId === undefined) return query(args);

  return query({ ...args, where: { ...(args?.where || {}), fiscalPeriodId } });
}

// «سرویس حذف سند حسابداری» (نقطه‌ی مرکزی): سند حسابداری «بررسی‌شده» (REVIEW) یا «تاییدشده» (APPROVED) هرگز قابل حذف نیست — مستقل از این‌که از کدام
// سند مبدأ (فاکتور فروش/خرید، خزانه، انبار، بستن حساب ...) حذف شده باشد. چون همه‌ی مسیرها با prisma.journalEntry.delete/deleteMany حذف می‌کنند، کنترل
// همین‌جا (روی کلاینت مشترک) انجام می‌شود تا هیچ مسیر فعلی یا آینده‌ای آن را دور نزند. ویرایش این اسناد هم فقط در وضعیت «ثبت» مجاز است (routes/journalEntries.ts).
export const JOURNAL_ENTRY_LOCKED_DELETE_MESSAGE = "سند حسابداری تایید یا بررسی شده است و قابل حذف نیست؛ ابتدا سند را از وضعیت تایید/بررسی برگردانید";
const LOCKED_JOURNAL_STATUSES = ["REVIEW", "APPROVED"] as const;

async function assertJournalEntryDeletable(where: any) {
  const locked = await rawPrisma.journalEntry.findFirst({ where: { AND: [where || {}, { status: { in: [...LOCKED_JOURNAL_STATUSES] as any } }] }, select: { id: true } });
  if (locked) throw new Error(JOURNAL_ENTRY_LOCKED_DELETE_MESSAGE);
}

export const prisma = rawPrisma.$extends({
  query: {
    journalEntry: {
      async delete({ args, query }) {
        await assertJournalEntryDeletable(args.where);
        return query(args);
      },
      async deleteMany({ args, query }) {
        await assertJournalEntryDeletable(args.where);
        return query(args);
      },
    },
    $allModels: {
      findMany({ model, args, query }) {
        return withFiscalScope(model, args, query);
      },
      count({ model, args, query }) {
        return withFiscalScope(model, args, query);
      },
    },
  },
});

/**
 * نوع مشترک برای توابعی که هم می‌توانند مستقیم روی prisma و هم داخل یک prisma.$transaction(tx=>...)
 * اجرا شوند. چون prisma دیگر PrismaClient خام نیست (بعد از $extends)، Prisma.TransactionClient
 * استاندارد دیگر با تایپ tx واقعی این کلاینت یکی نیست؛ به‌جایش مستقیماً از روی امضای خودِ
 * prisma.$transaction استخراج می‌شود تا همیشه با هم سازگار بمانند.
 */
type ExtendedTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | ExtendedTransactionClient;
