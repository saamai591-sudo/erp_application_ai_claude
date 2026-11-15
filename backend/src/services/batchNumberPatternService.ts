import { prisma } from "../lib/prisma";
import type { Db } from "../lib/prisma";
import { toJalaliCompact } from "../utils/jalaliDate";
import { fail } from "./productionCommon";

// «الگوی شماره‌گذاری بچ» (تولید › تنظیمات): قالب شماره‌ی بچ‌هایی که هنگام «تایید آمار تولید» ساخته می‌شوند.
// تنها نقطه‌ی ساخت شماره: generateProductionBatchNumber (آمار تولید فقط آن را صدا می‌زند). کالای بدون الگو، قالب پیش‌فرض را می‌گیرد.
//
// قالب = متن ثابت + نشانه‌ها:
//   {ORDER} شماره‌ی دستور تولید (خالی اگر آمار دستور ندارد)   {STAT} شماره‌ی آمار تولید   {DATE} تاریخ آمار شمسی ۸ رقمی (14050820)
//   {YEAR} سال شمسی ۴ رقمی   {YY} دو رقم آخر سال   {MONTH} ماه ۲ رقمی   {DAY} روز ۲ رقمی   {ITEM} کد کالا   {SEQ} شمارنده
// گروه اختیاری [متن {ORDER} متن]: اگر نشانه‌ای داخلش خالی باشد کل گروه (با متن‌های ثابتش) حذف می‌شود؛ تو در تو نمی‌شود.
// شمارنده: بر حسب «محدوده» ALL | ITEM | FISCAL_YEAR | ITEM_FISCAL_YEAR با یک دستور SQL اتمی داخل همان تراکنش تایید گرفته می‌شود (برگشت تراکنش شماره را آزاد می‌کند)؛
// «برگشت از تایید» شماره را پس نمی‌دهد (حفره‌ی شمارنده پذیرفته است).

export const DEFAULT_BATCH_TEMPLATE = "[P{ORDER}-]S{STAT}-{DATE}";
const TOKENS = ["ORDER", "STAT", "DATE", "YEAR", "YY", "MONTH", "DAY", "ITEM", "SEQ"] as const;
type Token = (typeof TOKENS)[number];
const SCOPES = ["ALL", "ITEM", "FISCAL_YEAR", "ITEM_FISCAL_YEAR"] as const;
export const SCOPE_FA: Record<string, string> = { ALL: "یک شمارنده برای همه", ITEM: "جدا برای هر کالا", FISCAL_YEAR: "جدا برای هر سال مالی", ITEM_FISCAL_YEAR: "جدا برای هر کالا در هر سال مالی" };

interface Vals { order: number | null; stat: number; date: Date; itemCode: string; seq: string | null }

function tokenValue(t: Token, v: Vals): string {
  const compact = toJalaliCompact(v.date);
  switch (t) {
    case "ORDER": return v.order ? String(v.order) : "";
    case "STAT": return String(v.stat);
    case "DATE": return compact;
    case "YEAR": return compact.slice(0, 4);
    case "YY": return compact.slice(2, 4);
    case "MONTH": return compact.slice(4, 6);
    case "DAY": return compact.slice(6, 8);
    case "ITEM": return v.itemCode;
    case "SEQ": return v.seq ?? "";
  }
}

/** متن بدون گروه اختیاری را پر می‌کند؛ empty = یکی از نشانه‌ها مقدار خالی داشت */
function fill(text: string, v: Vals): { text: string; empty: boolean } {
  let empty = false;
  const out = text.replace(/\{([A-Z]+)\}/g, (_m, name: string) => {
    const s = tokenValue(name as Token, v);
    if (!s) empty = true;
    return s;
  });
  return { text: out, empty };
}

export function renderTemplate(template: string, v: Vals): string {
  const withGroups = template.replace(/\[([^\[\]]*)\]/g, (_m, inner: string) => {
    const r = fill(inner, v);
    return r.empty ? "" : r.text;
  });
  return fill(withGroups, v).text;
}

/** اعتبارسنجی قالب؛ خطا = fail با پیام فارسی */
export function assertTemplateValid(template: string) {
  if (!template) fail("قالب شماره‌ی بچ را وارد کنید");
  if (template.length > 100) fail("قالب شماره‌ی بچ حداکثر ۱۰۰ نویسه است");
  const names = [...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  for (const n of names) if (!(TOKENS as readonly string[]).includes(n)) fail(`نشانه‌ی «{${n}}» شناخته‌شده نیست؛ نشانه‌های مجاز: ${TOKENS.map((t) => `{${t}}`).join(" ")}`);
  if (/[{}]/.test(template.replace(/\{[^{}]*\}/g, ""))) fail("آکولادهای قالب باید جفت باشند");
  let depth = 0;
  for (const ch of template) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (depth > 1 || depth < 0) fail("گروه اختیاری [ ] تو در تو یا نامتوازن است");
  }
  if (depth !== 0) fail("گروه اختیاری [ ] بسته نشده است");
  for (const g of template.matchAll(/\[([^\[\]]*)\]/g)) if (!/\{[A-Z]+\}/.test(g[1])) fail("هر گروه اختیاری [ ] باید دست‌کم یک نشانه داشته باشد");
  if (!names.includes("STAT") && !names.includes("SEQ")) fail("قالب باید «{STAT}» (شماره‌ی آمار) یا «{SEQ}» (شمارنده) داشته باشد تا شماره‌ها یکتا بمانند");
  if (/\s/.test(template)) fail("قالب فاصله (space) نداشته باشد");
}

function clean(body: any) {
  const title = String(body?.title ?? "").trim();
  if (!title) fail("عنوان الگو را وارد کنید");
  if (title.length > 100) fail("عنوان الگو حداکثر ۱۰۰ نویسه است");
  const template = String(body?.template ?? "").trim();
  assertTemplateValid(template);
  const hasSeq = template.includes("{SEQ}");
  const scopeIn = String(body?.seqScope ?? "ALL");
  if (!(SCOPES as readonly string[]).includes(scopeIn)) fail("محدوده‌ی شمارنده نامعتبر است");
  const width = body?.seqWidth === undefined || body?.seqWidth === "" ? 1 : Number(body.seqWidth);
  if (!Number.isInteger(width) || width < 1 || width > 8) fail("تعداد ارقام شمارنده باید بین ۱ و ۸ باشد");
  // بدون {SEQ} شمارنده معنایی ندارد
  return { title, template, seqScope: (hasSeq ? scopeIn : "ALL") as (typeof SCOPES)[number], seqWidth: hasSeq ? width : 1 };
}

export function previewPattern(body: any) {
  const c = clean({ ...body, title: body?.title || "پیش‌نمایش" });
  const date = new Date();
  const v: Vals = { order: 12, stat: 345, date, itemCode: "1001002", seq: String(7).padStart(c.seqWidth, "0") };
  const withoutOrder: Vals = { ...v, order: null };
  return { example: renderTemplate(c.template, v), exampleWithoutOrder: renderTemplate(c.template, withoutOrder) };
}

const SHAPE_SELECT = { id: true, code: true, title: true, template: true, seqScope: true, seqWidth: true, _count: { select: { goodsItems: true } } } as const;
function shape(p: any) {
  const { _count, ...rest } = p;
  return { ...rest, seqScopeTitle: SCOPE_FA[p.seqScope] ?? p.seqScope, itemCount: _count?.goodsItems ?? 0, used: (_count?.goodsItems ?? 0) > 0 };
}

export async function listPatterns() {
  return (await prisma.batchNumberPattern.findMany({ orderBy: { code: "asc" }, select: SHAPE_SELECT })).map(shape);
}
export async function getPattern(id: number) {
  const p = await prisma.batchNumberPattern.findUnique({ where: { id }, select: SHAPE_SELECT });
  return p ? shape(p) : null;
}

export async function createPattern(body: any) {
  const c = clean(body);
  if (await prisma.batchNumberPattern.findUnique({ where: { title: c.title }, select: { id: true } })) fail("الگوی دیگری با همین عنوان هست");
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.batchNumberPattern.aggregate({ _max: { code: true } });
    try {
      return await prisma.batchNumberPattern.create({ data: { code: (last._max.code ?? 0) + 1, ...c } });
    } catch (e: any) {
      if (e?.code !== "P2002" || attempt === 4) throw e;
    }
  }
  return fail("ثبت انجام نشد؛ دوباره تلاش کنید");
}

export async function updatePattern(id: number, body: any) {
  const ex = await prisma.batchNumberPattern.findUnique({ where: { id }, select: { id: true } });
  if (!ex) return fail("الگوی بچ یافت نشد");
  const c = clean(body);
  if (await prisma.batchNumberPattern.findFirst({ where: { title: c.title, id: { not: id } }, select: { id: true } })) fail("الگوی دیگری با همین عنوان هست");
  // تغییر قالب/محدوده فقط روی بچ‌های بعدی اثر دارد؛ شمارنده‌ی موجود ادامه می‌یابد و برخورد با شماره‌ی قبلی با شمارنده‌ی بعدی رفع می‌شود
  return prisma.batchNumberPattern.update({ where: { id }, data: c });
}

export async function deletePattern(id: number) {
  const p = await prisma.batchNumberPattern.findUnique({ where: { id }, select: { id: true, title: true, _count: { select: { goodsItems: true } } } });
  if (!p) return fail("الگوی بچ یافت نشد");
  if (p!._count.goodsItems) fail(`الگوی «${p!.title}» روی ${p!._count.goodsItems} کالا تعیین شده است؛ ابتدا آن را از کالاها بردارید`);
  await prisma.batchNumberPattern.delete({ where: { id } });
}

/** الگو فقط برای کالای بچ‌دارِ نیمه‌ساخته/محصول معنا دارد (خارج از آن، سرور آن را نادیده می‌گیرد) */
export function patternAllowed(trackingMethod: string | null | undefined, goodsType: string | null | undefined) {
  return trackingMethod === "BATCH" && (goodsType === "SEMI_FINISHED" || goodsType === "PRODUCT");
}

/** فقط الگوی موجود پذیرفته می‌شود؛ null/خالی = بدون الگو */
export async function resolvePatternId(raw: unknown): Promise<number | null> {
  if (raw === undefined || raw === null || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return fail("الگوی شماره‌گذاری بچ نامعتبر است");
  const p = await prisma.batchNumberPattern.findUnique({ where: { id }, select: { id: true } });
  if (!p) return fail("الگوی شماره‌گذاری بچ یافت نشد");
  return id;
}

async function nextSeq(tx: Db, patternId: number, scope: string, itemId: number, fiscalPeriodId: number): Promise<number> {
  const scopeKey = scope === "ALL" ? "ALL" : scope === "ITEM" ? `I${itemId}` : scope === "FISCAL_YEAR" ? `F${fiscalPeriodId}` : `I${itemId}F${fiscalPeriodId}`;
  const rows: { lastNumber: number }[] = await (tx as any).$queryRaw`
    INSERT INTO "BatchNumberCounter" ("patternId", "scopeKey", "lastNumber")
    VALUES (${patternId}, ${scopeKey}, 1)
    ON CONFLICT ("patternId", "scopeKey")
    DO UPDATE SET "lastNumber" = "BatchNumberCounter"."lastNumber" + 1
    RETURNING "lastNumber"`;
  return rows[0].lastNumber;
}

/**
 * شماره‌ی بچ تولیدی برای یک ردیف آمار: الگوی کالا (یا قالب پیش‌فرض) را پر می‌کند.
 * با {SEQ}: در برخورد با شماره‌ی موجود، شمارنده‌ی بعدی گرفته می‌شود؛ بدون {SEQ}: پسوند «-۲»، «-۳» … (مثلاً دو ردیف هم‌کالا در یک آمار).
 */
export async function generateProductionBatchNumber(
  tx: Db,
  a: { goodsItemId: number; itemCode: string; patternId: number | null; orderNumber: number | null; statNumber: number; date: Date; fiscalPeriodId: number },
): Promise<string> {
  const pattern = a.patternId ? await tx.batchNumberPattern.findUnique({ where: { id: a.patternId } }) : null;
  const template = pattern?.template ?? DEFAULT_BATCH_TEMPLATE;
  const hasSeq = template.includes("{SEQ}");
  const exists = async (n: string) => !!(await tx.batch.findUnique({ where: { goodsItemId_batchNumber: { goodsItemId: a.goodsItemId, batchNumber: n } }, select: { id: true } }));
  const base: Vals = { order: a.orderNumber, stat: a.statNumber, date: a.date, itemCode: a.itemCode, seq: null };

  if (hasSeq && pattern) {
    for (let i = 0; i < 200; i++) {
      // eslint-disable-next-line no-await-in-loop
      const seq = await nextSeq(tx, pattern.id, pattern.seqScope, a.goodsItemId, a.fiscalPeriodId);
      const candidate = renderTemplate(template, { ...base, seq: String(seq).padStart(pattern.seqWidth, "0") });
      // eslint-disable-next-line no-await-in-loop
      if (!(await exists(candidate))) return candidate;
    }
    return fail("ساخت شماره‌ی یکتای بچ با الگوی کالا ممکن نشد؛ قالب یا شمارنده را بررسی کنید");
  }
  const root = renderTemplate(template, base);
  let candidate = root;
  for (let n = 2; ; n++) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${n}`;
  }
}
