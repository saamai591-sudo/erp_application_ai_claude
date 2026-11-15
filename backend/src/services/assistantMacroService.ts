import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { norm } from "../assistant/text";
import { EntityRef } from "../assistant/types";

// «دستور میانبر دستیار»: عبارتی که کاربر می‌نویسد ← یک کار موجود دستیار + مقدارهای از پیش‌تعیین‌شده. تنها جای قواعد ثبت/خواندن ماکرو همین فایل است.
// نقش‌ها: خالی = همه‌ی کاربرانِ دارای دسترسی خودِ کار؛ پر = فقط کاربرانِ دارای یکی از آن نقش‌ها (مدیر سیستم، نقش کد ۱، همیشه مجاز است).
// ماکرو هیچ دسترسی اضافه‌ای نمی‌دهد: موتور دستیار کارهای بدون مجوز کاربر را اصلاً نمی‌شناسد.

export class AssistantMacroError extends Error {}

/** کارهایی که ماکرو می‌تواند به آن‌ها وصل شود. مقدارهای قابل‌پیش‌تعیین هر کار در MACRO_PRESETS است */
export const MACRO_ACTIONS: { key: string; title: string }[] = [
  { key: "sales-quote", title: "پیش‌فاکتور جدید" },
  { key: "receipt", title: "ثبت رسید دریافت" },
  { key: "payment", title: "ثبت اعلامیه پرداخت" },
];

/** فیلدهای قابل‌پیش‌تعیین هر کار: پیش‌فاکتور همه، رسید دریافت و اعلامیه پرداخت شرح + ابزار/موضوعات (بقیه‌ی فرم را کاربر در فرم پر می‌کند) */
export const MACRO_PRESETS: Record<string, readonly string[]> = {
  "sales-quote": ["salesType", "salesCenter", "description", "discountPercent", "lines"],
  receipt: ["description", "receiptPreset"],
  payment: ["description", "paymentPreset"],
};

/** شکل نرمال عبارت برای مقایسه: نرمال‌سازی ارقام/حروف؛ نیم‌فاصله و فاصله یکی‌اند («پیش‌فاکتور» = «پیش فاکتور») و فاصله‌های اضافه حذف می‌شود */
export const macroKey = (s: string): string => norm(s).replace(/‌/g, " ").replace(/\s+/g, " ").trim();

const include = {
  salesType: { select: { id: true, title: true } },
  salesCenter: { select: { id: true, title: true } },
  roles: { include: { role: { select: { id: true, title: true } } } },
} as const;

/** quantity = null ⇒ مقدار این قلم هر بار از کاربر پرسیده می‌شود */
interface PresetLine {
  goodsItemId: number;
  quantity: number | null;
}
/** فیلدهای قابل «حتماً بپرس» */
const ASKABLE_FIELDS = ["salesType", "salesCenter", "description", "discountPercent"] as const;
/** پیش‌تعیین ابزار و موضوعات رسید دریافت (فقط برای کار «receipt») */
export interface ReceiptPreset {
  instruments: { type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS"; cashBoxId: number | null; bankAccountId: number | null; cardReaderId: number | null }[];
  /** instrument = شماره‌ی ردیف ابزار (از ۰) که این موضوع از آن تسویه می‌شود */
  subjects: { receiptTypeId: number; instrument: number }[];
  /** مشتریِ ثابتِ دستور (Customer.id)؛ خالی = از کاربر پرسیده می‌شود */
  customerId?: number | null;
}
const INSTRUMENT_TYPES = ["CASH", "BANK_TRANSFER", "CHEQUE", "POS"] as const;
const receiptPresetOf = (m: any): ReceiptPreset | null => {
  const p = m?.receiptPreset;
  return p && typeof p === "object" && ((Array.isArray(p.instruments) && p.instruments.length) || p.customerId) ? ({ instruments: [], subjects: [], ...p } as ReceiptPreset) : null;
};

/** پیش‌تعیین ابزار و موضوعات اعلامیه پرداخت (فقط برای کار «payment»)؛ ابزار چک/چک انتقالی جزئیاتش را کاربر در فرم می‌نویسد */
export interface PaymentPreset {
  instruments: { type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "CHEQUE_TRANSFER"; cashBoxId: number | null; bankAccountId: number | null }[];
  /** instrument = شماره‌ی ردیف ابزار (از ۰) که این موضوع با آن پرداخت می‌شود */
  subjects: { paymentTypeId: number; instrument: number }[];
  /** طرف حسابِ ثابتِ دستور (Party.id)؛ خالی = از کاربر پرسیده می‌شود */
  partyId?: number | null;
}
const PAYMENT_INSTRUMENT_TYPES = ["CASH", "BANK_TRANSFER", "CHEQUE", "CHEQUE_TRANSFER"] as const;
const paymentPresetOf = (m: any): PaymentPreset | null => {
  const p = m?.paymentPreset;
  return p && typeof p === "object" && ((Array.isArray(p.instruments) && p.instruments.length) || p.partyId) ? ({ instruments: [], subjects: [], ...p } as PaymentPreset) : null;
};

const askFieldsOf = (m: any): string[] => (Array.isArray(m.askFields) ? (m.askFields as string[]).filter((f) => (ASKABLE_FIELDS as readonly string[]).includes(f)) : []);
const presetLinesOf = (m: any): PresetLine[] => (Array.isArray(m.presetLines) ? (m.presetLines as PresetLine[]) : []);

/** عنوان کالاهای اقلام ثابت (یک پرس‌وجو برای همه‌ی ماکروها) */
async function itemTitles(macros: any[]): Promise<Map<number, string>> {
  const ids = Array.from(new Set(macros.flatMap((m) => presetLinesOf(m).map((l) => l.goodsItemId))));
  if (!ids.length) return new Map();
  const items = await prisma.goodsItem.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
  return new Map(items.map((i) => [i.id, i.title]));
}

function macroShape(m: any, titles: Map<number, string> = new Map()) {
  return {
    id: m.id,
    phrase: m.phrase,
    actionKey: m.actionKey,
    actionTitle: MACRO_ACTIONS.find((a) => a.key === m.actionKey)?.title ?? m.actionKey,
    salesTypeId: m.salesTypeId,
    salesTypeTitle: m.salesType?.title ?? null,
    salesCenterId: m.salesCenterId,
    salesCenterTitle: m.salesCenter?.title ?? null,
    description: m.description ?? "",
    discountPercent: m.discountPercent === null || m.discountPercent === undefined ? null : Number(m.discountPercent),
    lines: presetLinesOf(m).map((l) => ({ goodsItemId: l.goodsItemId, title: titles.get(l.goodsItemId) ?? "", quantity: l.quantity, askQuantity: l.quantity === null })),
    askFields: askFieldsOf(m),
    receiptPreset: receiptPresetOf(m),
    paymentPreset: paymentPresetOf(m),
    isActive: m.isActive,
    roleIds: m.roles.map((r: any) => r.roleId),
    roleTitles: m.roles.map((r: any) => r.role.title),
    updatedAt: m.updatedAt,
  };
}

export async function listMacros() {
  const rows = await prisma.assistantMacro.findMany({ include, orderBy: { id: "asc" } });
  const titles = await itemTitles(rows);
  return rows.map((r) => macroShape(r, titles));
}

export async function getMacro(id: number) {
  const m = await prisma.assistantMacro.findUnique({ where: { id }, include });
  if (!m) throw new AssistantMacroError("دستور میانبر یافت نشد");
  return macroShape(m, await itemTitles([m]));
}

async function cleanReceiptPreset(raw: any): Promise<ReceiptPreset | null> {
  const ins: any[] = Array.isArray(raw?.instruments) ? raw.instruments : [];
  const subs: any[] = Array.isArray(raw?.subjects) ? raw.subjects : [];
  const customerId = raw?.customerId ? Number(raw.customerId) : null;
  if (customerId && !(await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) throw new AssistantMacroError("مشتریِ ثابت یافت نشد");
  if (!ins.length && !subs.length && !customerId) return null;
  if (!ins.length && subs.length) throw new AssistantMacroError("برای موضوعات، دست‌کم یک ابزار تعریف کنید");
  if (ins.length > 5 || subs.length > 10) throw new AssistantMacroError("حداکثر ۵ ابزار و ۱۰ موضوع مجاز است");
  const instruments: ReceiptPreset["instruments"] = [];
  for (const [i, r] of ins.entries()) {
    const type = String(r?.type ?? "");
    if (!(INSTRUMENT_TYPES as readonly string[]).includes(type)) throw new AssistantMacroError(`نوع ابزار ردیف ${i + 1} نامعتبر است`);
    const cashBoxId = type === "CASH" && r?.cashBoxId ? Number(r.cashBoxId) : null;
    const bankAccountId = type === "BANK_TRANSFER" && r?.bankAccountId ? Number(r.bankAccountId) : null;
    const cardReaderId = type === "POS" && r?.cardReaderId ? Number(r.cardReaderId) : null;
    if (cashBoxId && !(await prisma.cashBox.findUnique({ where: { id: cashBoxId }, select: { id: true } }))) throw new AssistantMacroError(`صندوق ردیف ${i + 1} یافت نشد`);
    if (bankAccountId && !(await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true } }))) throw new AssistantMacroError(`حساب بانکی ردیف ${i + 1} یافت نشد`);
    if (cardReaderId && !(await prisma.cardReader.findUnique({ where: { id: cardReaderId }, select: { id: true } }))) throw new AssistantMacroError(`کارتخوان ردیف ${i + 1} یافت نشد`);
    instruments.push({ type: type as any, cashBoxId, bankAccountId, cardReaderId });
  }
  const subjects: ReceiptPreset["subjects"] = [];
  for (const [i, r] of subs.entries()) {
    const receiptTypeId = Number(r?.receiptTypeId);
    if (!receiptTypeId) throw new AssistantMacroError(`نوع دریافت موضوع ${i + 1} را انتخاب کنید`);
    const t = await prisma.receiptType.findUnique({ where: { id: receiptTypeId }, select: { isActive: true, title: true } });
    if (!t) throw new AssistantMacroError(`نوع دریافت موضوع ${i + 1} یافت نشد`);
    if (!t.isActive) throw new AssistantMacroError(`نوع دریافت «${t.title}» غیرفعال است`);
    const instrument = Number.isInteger(Number(r?.instrument)) ? Number(r.instrument) : 0;
    if (instrument < 0 || instrument >= instruments.length) throw new AssistantMacroError(`ابزار موضوع ${i + 1} نامعتبر است`);
    subjects.push({ receiptTypeId, instrument });
  }
  return { instruments, subjects, customerId };
}

async function cleanPaymentPreset(raw: any): Promise<PaymentPreset | null> {
  const ins: any[] = Array.isArray(raw?.instruments) ? raw.instruments : [];
  const subs: any[] = Array.isArray(raw?.subjects) ? raw.subjects : [];
  const partyId = raw?.partyId ? Number(raw.partyId) : null;
  if (partyId) {
    const p = await prisma.party.findUnique({ where: { id: partyId }, select: { isActive: true } });
    if (!p) throw new AssistantMacroError("طرف حسابِ ثابت یافت نشد");
    if (!p.isActive) throw new AssistantMacroError("طرف حسابِ ثابت غیرفعال است");
  }
  if (!ins.length && !subs.length && !partyId) return null;
  if (!ins.length && subs.length) throw new AssistantMacroError("برای موضوعات، دست‌کم یک ابزار تعریف کنید");
  if (ins.length > 5 || subs.length > 10) throw new AssistantMacroError("حداکثر ۵ ابزار و ۱۰ موضوع مجاز است");
  const instruments: PaymentPreset["instruments"] = [];
  for (const [i, r] of ins.entries()) {
    const type = String(r?.type ?? "");
    if (!(PAYMENT_INSTRUMENT_TYPES as readonly string[]).includes(type)) throw new AssistantMacroError(`نوع ابزار ردیف ${i + 1} نامعتبر است`);
    const cashBoxId = type === "CASH" && r?.cashBoxId ? Number(r.cashBoxId) : null;
    // حساب بانکی: حواله و صدور چک تازه (چک انتقالی، چک دریافتی موجود را خرج می‌کند و حساب بانکی ندارد)
    const bankAccountId = (type === "BANK_TRANSFER" || type === "CHEQUE") && r?.bankAccountId ? Number(r.bankAccountId) : null;
    if (cashBoxId && !(await prisma.cashBox.findUnique({ where: { id: cashBoxId }, select: { id: true } }))) throw new AssistantMacroError(`صندوق ردیف ${i + 1} یافت نشد`);
    if (bankAccountId && !(await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true } }))) throw new AssistantMacroError(`حساب بانکی ردیف ${i + 1} یافت نشد`);
    instruments.push({ type: type as any, cashBoxId, bankAccountId });
  }
  const subjects: PaymentPreset["subjects"] = [];
  for (const [i, r] of subs.entries()) {
    const paymentTypeId = Number(r?.paymentTypeId);
    if (!paymentTypeId) throw new AssistantMacroError(`نوع پرداخت موضوع ${i + 1} را انتخاب کنید`);
    const t = await prisma.paymentType.findUnique({ where: { id: paymentTypeId }, select: { isActive: true, title: true } });
    if (!t) throw new AssistantMacroError(`نوع پرداخت موضوع ${i + 1} یافت نشد`);
    if (!t.isActive) throw new AssistantMacroError(`نوع پرداخت «${t.title}» غیرفعال است`);
    const instrument = Number.isInteger(Number(r?.instrument)) ? Number(r.instrument) : 0;
    if (instrument < 0 || instrument >= instruments.length) throw new AssistantMacroError(`ابزار موضوع ${i + 1} نامعتبر است`);
    subjects.push({ paymentTypeId, instrument });
  }
  return { instruments, subjects, partyId };
}

async function clean(body: any, excludeId?: number) {
  const phrase = String(body?.phrase ?? "").replace(/\s+/g, " ").trim();
  if (phrase.length < 3) throw new AssistantMacroError("عبارت دستور حداقل ۳ حرف باشد");
  if (phrase.length > 100) throw new AssistantMacroError("عبارت دستور حداکثر ۱۰۰ حرف باشد");
  const key = macroKey(phrase);
  const all = await prisma.assistantMacro.findMany({ select: { id: true, phrase: true } });
  if (all.some((m) => m.id !== excludeId && macroKey(m.phrase) === key)) throw new AssistantMacroError("این عبارت قبلاً تعریف شده است");
  const actionKey = String(body?.actionKey ?? "");
  if (!MACRO_ACTIONS.some((a) => a.key === actionKey)) throw new AssistantMacroError("کار انتخاب‌شده برای دستور میانبر پشتیبانی نمی‌شود");

  // فیلدی که این کار پشتیبانی نمی‌کند (مثلاً نوع فروش برای رسید دریافت) نادیده گرفته می‌شود
  const presets = MACRO_PRESETS[actionKey] ?? [];
  const supports = (f: string) => presets.includes(f);
  // «حتماً بپرس»: مقدار ثابتِ همان فیلد نادیده گرفته می‌شود
  const askFields: string[] = Array.from(new Set<string>((Array.isArray(body?.askFields) ? body.askFields : []).map(String).filter((f: string) => (ASKABLE_FIELDS as readonly string[]).includes(f) && supports(f))));
  const asked = (f: string) => askFields.includes(f);
  const salesTypeId = supports("salesType") && !asked("salesType") && body?.salesTypeId ? Number(body.salesTypeId) : null;
  const salesCenterId = supports("salesCenter") && !asked("salesCenter") && body?.salesCenterId ? Number(body.salesCenterId) : null;
  if (salesTypeId && !(await prisma.salesType.findUnique({ where: { id: salesTypeId }, select: { id: true } }))) throw new AssistantMacroError("نوع فروش یافت نشد");
  if (salesCenterId) {
    const c = await prisma.salesCenter.findUnique({ where: { id: salesCenterId }, select: { isActive: true } });
    if (!c) throw new AssistantMacroError("مرکز فروش یافت نشد");
    if (!c.isActive) throw new AssistantMacroError("مرکز فروش انتخاب‌شده غیرفعال است");
  }
  const description = asked("description") ? null : String(body?.description ?? "").trim().slice(0, 500) || null;
  let discountPercent: number | null = null;
  if (supports("discountPercent") && !asked("discountPercent") && body?.discountPercent !== null && body?.discountPercent !== undefined && body.discountPercent !== "") {
    discountPercent = Number(body.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new AssistantMacroError("درصد تخفیف باید بین ۰ و ۱۰۰ باشد");
    if (discountPercent === 0) discountPercent = null;
  }
  const rawLines: any[] = supports("lines") && Array.isArray(body?.lines) ? body.lines.filter((l: any) => l?.goodsItemId) : [];
  if (rawLines.length > 30) throw new AssistantMacroError("حداکثر ۳۰ قلم ثابت مجاز است");
  const lines: PresetLine[] = rawLines.map((l) => ({ goodsItemId: Number(l.goodsItemId), quantity: l.askQuantity ? null : Number(l.quantity) }));
  for (const l of lines) if (l.quantity !== null && (!Number.isFinite(l.quantity) || l.quantity <= 0 || l.quantity >= 1e9)) throw new AssistantMacroError("مقدار هر قلم ثابت باید عددی مثبت باشد (یا «مقدار را بپرس» را بزنید)");
  if (lines.length) {
    const found = await prisma.goodsItem.findMany({ where: { id: { in: lines.map((l) => l.goodsItemId) } }, select: { id: true, isActive: true, title: true } });
    for (const l of lines) {
      const g = found.find((x) => x.id === l.goodsItemId);
      if (!g) throw new AssistantMacroError("کالای یکی از اقلام یافت نشد");
      if (!g.isActive) throw new AssistantMacroError(`کالای «${g.title}» غیرفعال است`);
    }
  }
  const receiptPreset = supports("receiptPreset") ? await cleanReceiptPreset(body?.receiptPreset) : null;
  const paymentPreset = supports("paymentPreset") ? await cleanPaymentPreset(body?.paymentPreset) : null;
  if (!salesTypeId && !salesCenterId && !description && !discountPercent && !lines.length && !askFields.length && !receiptPreset && !paymentPreset)
    throw new AssistantMacroError(
      actionKey === "receipt"
        ? "شرح را «ثابت» یا «حتماً بپرس» کنید یا ابزار/موضوعات را پیش‌تعیین کنید (وگرنه دستور تفاوتی با «ثبت رسید دریافت» معمولی ندارد)"
        : actionKey === "payment"
        ? "شرح را «ثابت» یا «حتماً بپرس» کنید یا طرف حساب/ابزار/موضوعات را پیش‌تعیین کنید (وگرنه دستور تفاوتی با «ثبت اعلامیه پرداخت» معمولی ندارد)"
        :"دست‌کم یکی از «نوع فروش»، «مرکز فروش»، شرح، تخفیف یا اقلام ثابت را مشخص کنید (وگرنه دستور تفاوتی با پیش‌فاکتور معمولی ندارد)"
    );

  const roleIds: number[] = Array.from(new Set<number>((Array.isArray(body?.roleIds) ? body.roleIds : []).map(Number).filter((n: number) => n > 0)));
  if (roleIds.length) {
    const found = await prisma.role.count({ where: { id: { in: roleIds } } });
    if (found !== roleIds.length) throw new AssistantMacroError("نقش انتخاب‌شده یافت نشد");
  }
  return { phrase, actionKey, salesTypeId, salesCenterId, description, discountPercent, lines, askFields, receiptPreset, paymentPreset, roleIds, isActive: body?.isActive !== false };
}

export async function createMacro(body: any) {
  const d = await clean(body);
  const m = await prisma.assistantMacro.create({
    data: { phrase: d.phrase, actionKey: d.actionKey, salesTypeId: d.salesTypeId, salesCenterId: d.salesCenterId, description: d.description, discountPercent: d.discountPercent, presetLines: d.lines.length ? d.lines : Prisma.DbNull, askFields: d.askFields.length ? d.askFields : Prisma.DbNull, receiptPreset: d.receiptPreset ?? Prisma.DbNull, paymentPreset: d.paymentPreset ?? Prisma.DbNull, isActive: d.isActive, roles: { create: d.roleIds.map((roleId) => ({ roleId })) } },
    include,
  });
  return macroShape(m, await itemTitles([m]));
}

export async function updateMacro(id: number, body: any) {
  if (!(await prisma.assistantMacro.findUnique({ where: { id }, select: { id: true } }))) throw new AssistantMacroError("دستور میانبر یافت نشد");
  const d = await clean(body, id);
  const m = await prisma.$transaction(async (tx) => {
    await tx.assistantMacroRole.deleteMany({ where: { macroId: id } });
    return tx.assistantMacro.update({
      where: { id },
      data: { phrase: d.phrase, actionKey: d.actionKey, salesTypeId: d.salesTypeId, salesCenterId: d.salesCenterId, description: d.description, discountPercent: d.discountPercent, presetLines: d.lines.length ? d.lines : Prisma.DbNull, askFields: d.askFields.length ? d.askFields : Prisma.DbNull, receiptPreset: d.receiptPreset ?? Prisma.DbNull, paymentPreset: d.paymentPreset ?? Prisma.DbNull, isActive: d.isActive, roles: { create: d.roleIds.map((roleId) => ({ roleId })) } },
      include,
    });
  });
  return macroShape(m, await itemTitles([m]));
}

export async function deleteMacro(id: number) {
  if (!(await prisma.assistantMacro.findUnique({ where: { id }, select: { id: true } }))) throw new AssistantMacroError("دستور میانبر یافت نشد");
  await prisma.assistantMacro.delete({ where: { id } });
}

export interface MatchedMacro {
  id: number;
  actionKey: string;
  /** عبارت نرمال‌شده (برای بریدن از ابتدای متن) */
  key: string;
  salesType: EntityRef | null;
  salesCenter: EntityRef | null;
  description: string | null;
  discountPercent: number | null;
  /** اقلام ثابت (فقط کالاهای فعال) */
  lines: { ref: EntityRef; quantity: number | null }[];
  /** فیلدهایی که باید حتماً از کاربر پرسیده شوند */
  askFields: string[];
  /** ماکروی رسید دارای ابزار/موضوعات پیش‌تعیین‌شده است */
  hasReceiptPreset: boolean;
  /** مشتریِ ثابتِ ماکروی رسید (فقط اگر هنوز وجود دارد) */
  receiptCustomer: EntityRef | null;
  /** ماکروی پرداخت دارای ابزار/موضوعات پیش‌تعیین‌شده است */
  hasPaymentPreset: boolean;
  /** طرف حسابِ ثابتِ ماکروی پرداخت (فقط اگر هنوز وجود دارد و فعال است) */
  paymentParty: EntityRef | null;
}

/**
 * طولانی‌ترین ماکروی فعالِ مجاز برای این کاربر که متن (به شکل macroKey) با آن شروع می‌شود (کل متن یا عبارت + فاصله).
 * مرکز فروشِ غیرفعال‌شده بعد از تعریف نادیده گرفته می‌شود (پیش‌فرض نمی‌شود).
 */
export async function findMacroForUser(userId: number, probe: string): Promise<MatchedMacro | null> {
  const macros = await prisma.assistantMacro.findMany({
    where: { isActive: true },
    include: { salesType: { select: { id: true, title: true } }, salesCenter: { select: { id: true, title: true, isActive: true } }, roles: { select: { roleId: true } } },
  });
  const hits = macros
    .map((m) => ({ m, key: macroKey(m.phrase) }))
    .filter(({ key }) => probe === key || probe.startsWith(key + " "))
    .sort((a, b) => b.key.length - a.key.length);
  if (!hits.length) return null;
  const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true, role: { select: { code: true } } } });
  const isAdmin = roles.some((r) => r.role.code === 1);
  const mine = new Set(roles.map((r) => r.roleId));
  const hit = hits.find(({ m }) => isAdmin || m.roles.length === 0 || m.roles.some((r) => mine.has(r.roleId)));
  if (!hit) return null;
  const { m, key } = hit;
  const ids = presetLinesOf(m).map((l) => l.goodsItemId);
  const items = new Map((ids.length ? await prisma.goodsItem.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, isActive: true } }) : []).map((i) => [i.id, i]));
  return {
    id: m.id,
    actionKey: m.actionKey,
    key,
    salesType: m.salesType ? { id: m.salesType.id, label: m.salesType.title } : null,
    salesCenter: m.salesCenter && m.salesCenter.isActive ? { id: m.salesCenter.id, label: m.salesCenter.title } : null,
    description: m.description,
    discountPercent: m.discountPercent === null ? null : Number(m.discountPercent),
    askFields: askFieldsOf(m),
    hasReceiptPreset: !!receiptPresetOf(m)?.instruments.length,
    receiptCustomer: await receiptCustomerOf(m),
    hasPaymentPreset: !!paymentPresetOf(m)?.instruments.length,
    paymentParty: await paymentPartyOf(m),
    lines: presetLinesOf(m)
      .map((l) => ({ item: items.get(l.goodsItemId), quantity: l.quantity }))
      .filter((l) => l.item?.isActive)
      .map((l) => ({ ref: { id: l.item!.id, label: l.item!.title }, quantity: l.quantity })),
  };
}

/** پیش‌نویس دستور از روی یک پیش‌فاکتور ذخیره‌شده (چیزی ذخیره نمی‌شود؛ فرم دستور با آن پر می‌شود و مدیر انتخاب می‌کند چه چیزی ثابت بماند) */
export async function draftFromQuote(quoteId: number) {
  const q = await prisma.salesQuote.findUnique({
    where: { id: quoteId },
    select: { number: true, salesTypeId: true, salesCenterId: true, description: true, lines: { orderBy: { rowOrder: "asc" }, select: { goodsItemId: true, quantity: true, goodsItem: { select: { title: true, isActive: true } } } } },
  });
  if (!q) throw new AssistantMacroError("پیش‌فاکتور یافت نشد");
  return {
    quoteNumber: q.number,
    salesTypeId: q.salesTypeId,
    salesCenterId: q.salesCenterId,
    description: q.description ?? "",
    lines: q.lines.filter((l) => l.goodsItem.isActive).map((l) => ({ goodsItemId: l.goodsItemId, title: l.goodsItem.title, quantity: Number(l.quantity) })),
  };
}

async function receiptCustomerOf(m: any): Promise<EntityRef | null> {
  const id = receiptPresetOf(m)?.customerId;
  if (!id) return null;
  const c = await prisma.customer.findUnique({ where: { id }, select: { id: true, party: { select: { detailTitle: true } } } });
  return c ? { id: c.id, label: c.party.detailTitle } : null;
}

async function paymentPartyOf(m: any): Promise<EntityRef | null> {
  const id = paymentPresetOf(m)?.partyId;
  if (!id) return null;
  const p = await prisma.party.findUnique({ where: { id }, select: { id: true, detailTitle: true, isActive: true } });
  return p && p.isActive ? { id: p.id, label: p.detailTitle } : null;
}

/** پیش‌تعیین اعلامیه پرداخت یک ماکرو برای کاربر (همان کنترل نقش؛ ماکروی غیرفعال/غیرمجاز = null) */
export async function loadPaymentPreset(userId: number, macroId: number): Promise<PaymentPreset | null> {
  const m = await prisma.assistantMacro.findUnique({ where: { id: macroId }, include: { roles: { select: { roleId: true } } } });
  if (!m || !m.isActive || m.actionKey !== "payment") return null;
  const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true, role: { select: { code: true } } } });
  const ok = roles.some((r) => r.role.code === 1) || m.roles.length === 0 || m.roles.some((r) => roles.some((u) => u.roleId === r.roleId));
  return ok ? paymentPresetOf(m) : null;
}

/** پیش‌تعیین رسید یک ماکرو برای کاربر (همان کنترل نقش findMacroForUser؛ ماکروی غیرفعال/غیرمجاز = null) */
export async function loadReceiptPreset(userId: number, macroId: number): Promise<ReceiptPreset | null> {
  const m = await prisma.assistantMacro.findUnique({ where: { id: macroId }, include: { roles: { select: { roleId: true } } } });
  if (!m || !m.isActive || m.actionKey !== "receipt") return null;
  const roles = await prisma.userRole.findMany({ where: { userId }, select: { roleId: true, role: { select: { code: true } } } });
  const ok = roles.some((r) => r.role.code === 1) || m.roles.length === 0 || m.roles.some((r) => roles.some((u) => u.roleId === r.roleId));
  return ok ? receiptPresetOf(m) : null;
}
