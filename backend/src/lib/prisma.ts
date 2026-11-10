import { assertLineAmountDecimals } from "../utils/amountDecimals";
import { Prisma } from "@prisma/client";
import { rawPrisma } from "./rawPrisma";
import { getRequestContext } from "./requestContext";
import { explainDeleteFailure } from "./deleteUsage";
import { auditChange, auditPre } from "../services/auditService";



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

// کنترل رقم اعشار مبالغ ردیف‌های سند حسابداری در «منبع» نوشتن (هر مسیری که ردیف سند می‌نویسد، از جمله ویرایش سند دستی):
// بدهکار/بستانکار ≤ اعشار ارز ردیف، بدهکار/بستانکار پایه ≤ اعشار ارز پایه. (منطق: utils/amountDecimals.ts؛ صدور سند هم قبل‌تر همین را با برچسب ردیف می‌زند)
const currencyDecimalsCache: { at: number; map: Map<number, { code: string; title: string; decimalPlaces: number; isBase: boolean }> } = { at: 0, map: new Map() };
async function currencyDecimalsMap() {
  if (Date.now() - currencyDecimalsCache.at > 30_000 || currencyDecimalsCache.map.size === 0) {
    const all = await rawPrisma.currency.findMany({ select: { id: true, code: true, title: true, decimalPlaces: true, isBase: true } });
    currencyDecimalsCache.map = new Map(all.map((c) => [c.id, c]));
    currencyDecimalsCache.at = Date.now();
  }
  return currencyDecimalsCache.map;
}
async function assertJournalLinesDecimals(lines: any[]) {
  if (!lines.length) return;
  const map = await currencyDecimalsMap();
  const base = [...map.values()].find((c) => c.isBase);
  if (!base) return;
  for (const [idx, l] of lines.entries()) {
    const cur = map.get(Number(l?.currencyId));
    if (!cur) continue;
    assertLineAmountDecimals(l, cur, base, `ردیف ${idx + 1}`);
  }
}
const nestedLines = (data: any): any[] => {
  const c = data?.lines?.create;
  const m = data?.lines?.createMany?.data;
  return [...(Array.isArray(c) ? c : c ? [c] : []), ...(Array.isArray(m) ? m : m ? [m] : [])];
};

// قفل «بستن سال مانده طرف‌حساب‌ها» (services/partyBalanceService.ts): وقتی مانده‌ی نقشی در یک سال مالی بسته شده، اسنادی که روی آن مانده اثر دارند (فاکتورها،
// دریافت/پرداخت، پرداخت تنخواه، وصول/برگشت چک) در همان سال نه ایجاد، نه ویرایش، نه حذف و نه تایید/برگشت از تایید می‌شوند — وگرنه مانده‌ی افتتاحیه‌ی سال بعد قدیمی می‌شد.
// نقطه‌ی مرکزی (مثل قفل حذف سند حسابداری): همه‌ی مسیرها از همین کلاینت مشترک می‌گذرند. فقط به‌روزرسانی‌هایی که صرفاً اطلاعات سند حسابداری را عوض می‌کنند آزادند.
const PARTY_LOCK_MODELS: Record<string, "CUSTOMER" | "SUPPLIER" | "ANY"> = {
  SalesInvoice: "CUSTOMER",
  SalesReturnInvoice: "CUSTOMER",
  PurchaseInvoice: "SUPPLIER",
  ServicePurchaseInvoice: "SUPPLIER",
  PurchaseReturn: "SUPPLIER",
  Receipt: "ANY",
  Payment: "ANY",
  PettyCashPayment: "ANY",
  ChequeClearingReceivable: "ANY",
  ChequeClearingPayable: "ANY",
};
const PARTY_LOCK_EXEMPT_KEYS = new Set(["journalEntryId", "journalEntry", "accountingStatus", "accountingApprovedAt", "accountingApprovedById", "updatedAt"]);
let partyCloseCache: { at: number; rows: { fiscalPeriodId: number; role: string }[] } | null = null;
export function invalidatePartyBalanceLockCache() {
  partyCloseCache = null;
}
async function loadPartyCloses() {
  if (!partyCloseCache || Date.now() - partyCloseCache.at > 5000) {
    partyCloseCache = { at: Date.now(), rows: await rawPrisma.partyBalanceYearClose.findMany({ select: { fiscalPeriodId: true, role: true } }) };
  }
  return partyCloseCache.rows;
}
/** نقش‌هایی که مانده‌شان در این دوره مالی بسته شده */
export async function closedPartyBalanceRoles(fiscalPeriodId: number): Promise<string[]> {
  return (await loadPartyCloses()).filter((r) => r.fiscalPeriodId === fiscalPeriodId).map((r) => r.role);
}
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
async function assertPartyBalanceYearOpen(model: string, operation: string, args: any) {
  const kind = PARTY_LOCK_MODELS[model];
  if (!kind) return;
  if (operation === "update" || operation === "updateMany") {
    const keys = Object.keys(args?.data || {});
    if (keys.length && keys.every((k) => PARTY_LOCK_EXEMPT_KEYS.has(k))) return;
  }
  // سریع: اگر هیچ بستنی در سیستم نیست، چیزی برای بررسی نیست
  if (!(await loadPartyCloses()).length) return;

  const periodIds = new Set<number>();
  const fromData = (d: any) => {
    const id = d?.fiscalPeriodId ?? d?.fiscalPeriod?.connect?.id;
    if (typeof id === "number") periodIds.add(id);
  };
  if (operation === "create" || operation === "upsert") fromData(args?.create ?? args?.data);
  if (operation === "createMany") for (const d of Array.isArray(args?.data) ? args.data : [args?.data]) fromData(d);
  if (operation === "update" || operation === "updateMany" || operation === "delete" || operation === "deleteMany" || operation === "upsert") {
    const rows: { fiscalPeriodId: number }[] = await (rawPrisma as any)[lowerFirst(model)].findMany({ where: args?.where || {}, select: { fiscalPeriodId: true } });
    for (const r of rows) periodIds.add(r.fiscalPeriodId);
  }
  for (const pid of periodIds) {
    const closed = await closedPartyBalanceRoles(pid);
    if (kind === "ANY" ? closed.length > 0 : closed.includes(kind)) {
      const fp = await rawPrisma.fiscalPeriod.findUnique({ where: { id: pid }, select: { title: true } });
      throw new Error(`مانده‌ی طرف‌حساب‌ها در سال مالی ${fp?.title ?? ""} بسته شده و تغییر این سند مجاز نیست؛ ابتدا در فرم «مانده اول دوره» (مشتریان یا تامین‌کنندگان) «بازگشایی بستن سال» را بزنید.`);
    }
  }
}

// «موارد استفاده» هنگام شکست حذف (lib/deleteUsage.ts): خطای کلید خارجی (P2003) در delete/deleteMany به پیامی با رکوردهای دقیقِ ارجاع‌دهنده تبدیل می‌شود
async function deleteWithUsage(model: string, args: any, query: (a: any) => Promise<any>) {
  try {
    return await query(args);
  } catch (e) {
    throw await explainDeleteFailure(rawPrisma, model, args?.where, e);
  }
}

export const prisma = rawPrisma.$extends({
  query: {
    journalEntryLine: {
      async create({ args, query }) {
        await assertJournalLinesDecimals([args.data]);
        return query(args);
      },
      async createMany({ args, query }) {
        await assertJournalLinesDecimals(Array.isArray(args.data) ? args.data : [args.data]);
        return query(args);
      },
    },
    journalEntry: {
      // نکته: hookهای اختصاصی مدل و $allModels هر دو اجرا می‌شوند (لاگ تغییرات فقط در $allModels صدا زده می‌شود؛ اینجا دوباره صدا نزنید وگرنه دوبار ثبت می‌شود)
      async create({ args, query }) {
        await assertJournalLinesDecimals(nestedLines(args.data));
        return query(args);
      },
      async update({ args, query }) {
        await assertJournalLinesDecimals(nestedLines(args.data));
        return query(args);
      },
      async delete({ args, query }) {
        await assertJournalEntryDeletable(args.where);
        return deleteWithUsage("JournalEntry", args, query);
      },
      async deleteMany({ args, query }) {
        await assertJournalEntryDeletable(args.where);
        return deleteWithUsage("JournalEntry", args, query);
      },
    },
    $allModels: {
      async create({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "create", args);
        const r = await query(args);
        await auditChange(model, "create", args, r);
        return r;
      },
      async createMany({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "createMany", args);
        const r = await query(args);
        await auditChange(model, "createMany", args, r);
        return r;
      },
      async update({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "update", args);
        const pre = await auditPre(model, "update", args);
        const r = await query(args);
        await auditChange(model, "update", args, r, pre);
        return r;
      },
      async updateMany({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "updateMany", args);
        const r = await query(args);
        await auditChange(model, "updateMany", args, r);
        return r;
      },
      async upsert({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "upsert", args);
        const pre = await auditPre(model, "upsert", args);
        const r = await query(args);
        await auditChange(model, "upsert", args, r, pre);
        return r;
      },
      async delete({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "delete", args);
        const pre = await auditPre(model, "delete", args);
        const r = await deleteWithUsage(model, args, query);
        await auditChange(model, "delete", args, r, pre);
        return r;
      },
      async deleteMany({ model, args, query }) {
        await assertPartyBalanceYearOpen(model, "deleteMany", args);
        const r = await deleteWithUsage(model, args, query);
        await auditChange(model, "deleteMany", args, r);
        return r;
      },
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
