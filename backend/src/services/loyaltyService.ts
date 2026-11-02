import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { nextSerialNumber } from "../utils/coding";
import { displayDate } from "../utils/dateDisplay";
import { normalizeSerial } from "./voucherService";
import { saleTotals } from "./storeSaleService";

// باشگاه مشتریان › «کارت وفاداری» — تنها محل قواعد.
// • نوع شارژ: کد (خودکار) + عنوان + نوع (مبلغی/درصدی) + مقدار + «تنها یک‌بار قابل استفاده باشد». شارژ، نوع/مقدار/یک‌بارمصرف را کپی می‌کند (تغییر نوع بعداً شارژهای صادرشده را عوض نمی‌کند).
// • کارت: طرف‌حساب + شماره‌ی یکتا + کلمه‌ی عبور (bcrypt؛ هنگام مصرف در فروش باید دوباره وارد شود) + تاریخ صدور/انقضا.
// • شارژ: یک کارت × یک نوع × تاریخ شارژ × تاریخ انقضا. مانده و وضعیت **ذخیره نمی‌شود**؛ از دریافت‌های فروش فروشگاهی (StoreReceipt.loyaltyChargeId) مشتق می‌شود.
// • مصرف در فروش فروشگاهی (دریافت با روش «کارت وفاداری»):
//     مبلغی ⇒ min(مانده‌ی شارژ، باقی‌مانده‌ی فاکتور) و از مانده‌ی شارژ کم می‌شود؛
//     درصدی ⇒ تخفیف = درصد × مبلغ قابل پرداخت فاکتور (حداکثر باقی‌مانده‌ی فاکتور)، تا انقضا چندبار قابل مصرف است ولی در «یک فاکتور» فقط یک‌بار؛
//     «تنها یک‌بار» ⇒ اولین مصرف کل شارژ را می‌بندد (مانده‌ی مصرف‌نشده‌ی شارژ مبلغی می‌سوزد).
// • قفل: 7100050 (شماره‌ی شارژ). مصرف زیر قفل «فروش» (7100022) و قفل ردیف شارژها انجام می‌شود تا دو فروش هم‌زمان یک شارژ را دوبار خرج نکنند.

export class LoyaltyError extends Error {}

const EPS = 1e-6;
const MAX_BULK = 5000;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const userId = () => getRequestContext()?.userId ?? null;
const partyTitle = (p: any) => (p ? p.detailTitle || `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.name || "" : "");
const todayUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

function parseDate(raw: unknown, label: string): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new LoyaltyError(`${label} الزامی و باید معتبر باشد`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function baseDecimals() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  return c?.decimalPlaces ?? 0;
}
const roundTo = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

const KIND_FA = { AMOUNT: "مبلغی", PERCENT: "درصدی" } as const;

// ───────────────────────── نوع شارژ ─────────────────────────

export interface ChargeTypeBody {
  title?: string;
  kind?: string;
  value?: number | string;
  singleUse?: boolean;
  isActive?: boolean;
}

async function cleanType(b: ChargeTypeBody, existingId?: number) {
  const title = String(b.title ?? "").trim();
  if (!title) throw new LoyaltyError("عنوان نوع شارژ الزامی است");
  if (b.kind !== "AMOUNT" && b.kind !== "PERCENT") throw new LoyaltyError("نوع شارژ را (مبلغی یا درصدی) انتخاب کنید");
  const kind: "AMOUNT" | "PERCENT" = b.kind;
  const value = Number(String(b.value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) throw new LoyaltyError(kind === "AMOUNT" ? "مبلغ باید عددی بزرگ‌تر از صفر باشد" : "درصد باید عددی بزرگ‌تر از صفر باشد");
  if (kind === "PERCENT") {
    if (value > 100) throw new LoyaltyError("درصد نمی‌تواند بیشتر از ۱۰۰ باشد");
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) throw new LoyaltyError("درصد حداکثر ۲ رقم اعشار دارد");
  } else {
    const dp = await baseDecimals();
    if (Math.abs(value * 10 ** dp - Math.round(value * 10 ** dp)) > 1e-6) throw new LoyaltyError(`مبلغ حداکثر ${dp} رقم اعشار دارد`);
  }
  if (existingId) {
    const ex = await prisma.loyaltyChargeType.findUnique({ where: { id: existingId }, include: { _count: { select: { charges: true } } } });
    if (!ex) throw new LoyaltyError("نوع شارژ یافت نشد");
    if (ex._count.charges > 0 && (ex.kind !== kind || Math.abs(Number(ex.value) - value) > EPS)) throw new LoyaltyError("با این نوع شارژ، کارتی شارژ شده است؛ نوع/مقدار قابل تغییر نیست (نوع تازه تعریف کنید)");
  }
  return { title, kind, value, singleUse: !!b.singleUse, isActive: b.isActive !== false };
}

export const chargeTypeShape = (t: any) => ({
  id: t.id,
  code: t.code,
  title: t.title,
  kind: t.kind as "AMOUNT" | "PERCENT",
  kindTitle: KIND_FA[t.kind as "AMOUNT" | "PERCENT"],
  value: Number(t.value),
  singleUse: t.singleUse,
  isActive: t.isActive,
  chargeCount: t._count?.charges ?? 0,
  updatedAt: t.updatedAt,
});

export async function listChargeTypes() {
  const rows = await prisma.loyaltyChargeType.findMany({ include: { _count: { select: { charges: true } } }, orderBy: { code: "asc" } });
  return rows.map(chargeTypeShape);
}

export async function createChargeType(b: ChargeTypeBody) {
  const d = await cleanType(b);
  for (let attempt = 0; ; attempt++) {
    try {
      const code = await nextSerialNumber(prisma.loyaltyChargeType as any, "code");
      return await prisma.loyaltyChargeType.create({ data: { code, ...d } });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateChargeType(id: number, b: ChargeTypeBody) {
  const d = await cleanType(b, id);
  await prisma.loyaltyChargeType.update({ where: { id }, data: d });
}

// ───────────────────────── کارت ─────────────────────────

export interface CardBody {
  partyId?: number | string;
  cardNumber?: string;
  password?: string;
  issueDate?: string;
  expiryDate?: string | null;
  isActive?: boolean;
}

async function cleanCard(b: CardBody, existingId?: number) {
  const partyId = Number(b.partyId);
  if (!partyId) throw new LoyaltyError("طرف‌حساب را انتخاب کنید");
  if (!(await prisma.party.findUnique({ where: { id: partyId }, select: { id: true } }))) throw new LoyaltyError("طرف‌حساب یافت نشد");
  const cardNumber = normalizeSerial(b.cardNumber);
  if (!cardNumber) throw new LoyaltyError("شماره‌ی کارت وفاداری الزامی است");
  if (cardNumber.length > 50) throw new LoyaltyError("شماره‌ی کارت نباید بیش از ۵۰ نویسه باشد");
  const password = String(b.password ?? "");
  if (!existingId && !password) throw new LoyaltyError("کلمه‌ی عبور الزامی است");
  if (password && password.length < 4) throw new LoyaltyError("کلمه‌ی عبور حداقل ۴ نویسه باشد");
  const issueDate = parseDate(b.issueDate, "تاریخ صدور");
  let expiryDate: Date | null = null;
  if (b.expiryDate) {
    expiryDate = parseDate(b.expiryDate, "تاریخ انقضا");
    if (expiryDate.getTime() < issueDate.getTime()) throw new LoyaltyError("تاریخ انقضا نمی‌تواند قبل از تاریخ صدور باشد");
  }
  return { partyId, cardNumber, password, issueDate, expiryDate, isActive: b.isActive !== false };
}

export const cardShape = (c: any, today = todayUtc()) => ({
  id: c.id,
  partyId: c.partyId,
  partyTitle: partyTitle(c.party),
  cardNumber: c.cardNumber,
  issueDate: dayStr(c.issueDate),
  expiryDate: c.expiryDate ? dayStr(c.expiryDate) : null,
  expired: !!c.expiryDate && c.expiryDate.getTime() < today.getTime(),
  isActive: c.isActive,
  chargeCount: c._count?.charges ?? 0,
  updatedAt: c.updatedAt,
});

const CARD_INCLUDE = { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } }, _count: { select: { charges: true } } } as const;

export async function listCards() {
  const rows = await prisma.loyaltyCard.findMany({ include: CARD_INCLUDE, orderBy: { id: "desc" }, take: 20000 });
  return rows.map((c) => cardShape(c));
}

export async function loadCard(id: number) {
  const c = await prisma.loyaltyCard.findUnique({ where: { id }, include: CARD_INCLUDE });
  return c ? cardShape(c) : null;
}

export async function createCard(b: CardBody) {
  const d = await cleanCard(b);
  try {
    return await prisma.loyaltyCard.create({ data: { partyId: d.partyId, cardNumber: d.cardNumber, passwordHash: await bcrypt.hash(d.password, 10), issueDate: d.issueDate, expiryDate: d.expiryDate, isActive: d.isActive, createdById: userId() } });
  } catch (e: any) {
    if (e?.code === "P2002") throw new LoyaltyError(`شماره‌ی کارت ${d.cardNumber} قبلاً ثبت شده است`);
    throw e;
  }
}

export async function updateCard(id: number, b: CardBody) {
  const d = await cleanCard(b, id);
  try {
    await prisma.loyaltyCard.update({
      where: { id },
      data: { partyId: d.partyId, cardNumber: d.cardNumber, issueDate: d.issueDate, expiryDate: d.expiryDate, isActive: d.isActive, ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}) },
    });
  } catch (e: any) {
    if (e?.code === "P2002") throw new LoyaltyError(`شماره‌ی کارت ${d.cardNumber} قبلاً ثبت شده است`);
    throw e;
  }
}

// ───────────────────────── مانده و وضعیت شارژ (مشتق) ─────────────────────────

export interface ChargeUsage {
  used: number;
  count: number;
}

export async function chargeUsage(ids: number[]): Promise<Map<number, ChargeUsage>> {
  if (!ids.length) return new Map();
  const rows = await prisma.storeReceipt.groupBy({ by: ["loyaltyChargeId"], where: { loyaltyChargeId: { in: ids } }, _sum: { amount: true }, _count: true });
  return new Map(rows.map((r) => [r.loyaltyChargeId as number, { used: Number(r._sum.amount ?? 0), count: r._count }]));
}

export type ChargeStatus = "ACTIVE" | "USED" | "EXPIRED";
const STATUS_FA: Record<ChargeStatus, string> = { ACTIVE: "قابل استفاده", USED: "مصرف‌شده", EXPIRED: "منقضی" };

/** مانده (فقط مبلغی)، بسته‌شدن و وضعیت یک شارژ؛ «مصرف‌شده» بر «منقضی» مقدم است */
export function chargeState(c: { kind: string; value: any; singleUse: boolean; expiryDate: Date | null }, u: ChargeUsage | undefined, today = todayUtc()) {
  const used = u?.used ?? 0;
  const count = u?.count ?? 0;
  const remaining = c.kind === "AMOUNT" ? Math.max(0, Number(c.value) - used) : null;
  const closed = (c.singleUse && count > 0) || (c.kind === "AMOUNT" && (remaining as number) <= EPS);
  const expired = !!c.expiryDate && c.expiryDate.getTime() < today.getTime();
  const status: ChargeStatus = closed ? "USED" : expired ? "EXPIRED" : "ACTIVE";
  return { used, count, remaining, closed, expired, status, statusTitle: STATUS_FA[status] };
}

const CHARGE_INCLUDE = { card: { select: { cardNumber: true, party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, type: { select: { title: true } } } as const;

export function chargeShape(c: any, u: ChargeUsage | undefined) {
  const st = chargeState(c, u);
  return {
    id: c.id,
    number: c.number,
    cardId: c.cardId,
    cardNumber: c.card?.cardNumber ?? "",
    partyTitle: partyTitle(c.card?.party),
    typeId: c.typeId,
    typeTitle: c.type?.title ?? "",
    kind: c.kind as "AMOUNT" | "PERCENT",
    kindTitle: KIND_FA[c.kind as "AMOUNT" | "PERCENT"],
    value: Number(c.value),
    singleUse: c.singleUse,
    date: dayStr(c.date),
    expiryDate: c.expiryDate ? dayStr(c.expiryDate) : null,
    description: c.description ?? "",
    usedAmount: st.used,
    useCount: st.count,
    remaining: st.remaining,
    status: st.status,
    statusTitle: st.statusTitle,
    updatedAt: c.updatedAt,
  };
}

export async function listCharges(q: { cardId?: number; typeId?: number; status?: string }) {
  const where: any = {};
  if (q.cardId) where.cardId = q.cardId;
  if (q.typeId) where.typeId = q.typeId;
  const rows = await prisma.loyaltyCharge.findMany({ where, include: CHARGE_INCLUDE, orderBy: { id: "desc" }, take: 20000 });
  const usage = await chargeUsage(rows.map((r) => r.id));
  const shaped = rows.map((r) => chargeShape(r, usage.get(r.id)));
  return q.status ? shaped.filter((r) => r.status === q.status) : shaped;
}

export async function loadCharge(id: number) {
  const r = await prisma.loyaltyCharge.findUnique({ where: { id }, include: CHARGE_INCLUDE });
  if (!r) return null;
  return chargeShape(r, (await chargeUsage([id])).get(id));
}

// ───────────────────────── شارژ کارت‌ها ─────────────────────────

export interface ChargeBody {
  cardIds?: (number | string)[];
  /** شارژ گروهی: همه‌ی کارت‌های فعالِ منقضی‌نشده */
  allActive?: boolean;
  typeId?: number | string;
  date?: string;
  expiryDate?: string | null;
  description?: string | null;
}

/** شارژ یک یا چند کارت با یک نوع در یک تراکنش (همه‌یا‌هیچ) */
export async function createCharges(body: ChargeBody) {
  const type = Number(body.typeId) ? await prisma.loyaltyChargeType.findUnique({ where: { id: Number(body.typeId) } }) : null;
  if (!type) throw new LoyaltyError("نوع شارژ را انتخاب کنید");
  if (!type.isActive) throw new LoyaltyError(`نوع شارژ «${type.title}» غیرفعال است`);
  const date = parseDate(body.date, "تاریخ شارژ");
  let expiryDate: Date | null = null;
  if (body.expiryDate) {
    expiryDate = parseDate(body.expiryDate, "تاریخ انقضا");
    if (expiryDate.getTime() < date.getTime()) throw new LoyaltyError("تاریخ انقضا نمی‌تواند قبل از تاریخ شارژ باشد");
  }
  let cards: { id: number; cardNumber: string; isActive: boolean; expiryDate: Date | null }[];
  if (body.allActive) {
    cards = await prisma.loyaltyCard.findMany({ where: { isActive: true, OR: [{ expiryDate: null }, { expiryDate: { gte: date } }] }, select: { id: true, cardNumber: true, isActive: true, expiryDate: true }, orderBy: { id: "asc" } });
    if (!cards.length) throw new LoyaltyError("کارت فعالِ منقضی‌نشده‌ای برای شارژ وجود ندارد");
  } else {
    const ids = [...new Set((Array.isArray(body.cardIds) ? body.cardIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
    if (!ids.length) throw new LoyaltyError("کارت را انتخاب کنید");
    cards = await prisma.loyaltyCard.findMany({ where: { id: { in: ids } }, select: { id: true, cardNumber: true, isActive: true, expiryDate: true }, orderBy: { id: "asc" } });
    if (cards.length !== ids.length) throw new LoyaltyError("برخی از کارت‌های انتخابی یافت نشدند");
    const bad = cards.filter((c) => !c.isActive || (c.expiryDate && c.expiryDate.getTime() < date.getTime()));
    if (bad.length) throw new LoyaltyError(`کارت‌های غیرفعال یا منقضی‌شده قابل شارژ نیستند: ${bad.slice(0, 5).map((c) => c.cardNumber).join("، ")}${bad.length > 5 ? " …" : ""}`);
  }
  if (cards.length > MAX_BULK) throw new LoyaltyError(`در هر بار حداکثر ${MAX_BULK} کارت قابل شارژ است`);
  const description = body.description ? String(body.description).trim() || null : null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100050, 1)`);
    const last = await tx.loyaltyCharge.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    let n = last?.number ?? 0;
    const data = cards.map((c) => ({ number: ++n, cardId: c.id, typeId: type.id, kind: type.kind, value: type.value, singleUse: type.singleUse, date, expiryDate, description, createdById: userId() }));
    await tx.loyaltyCharge.createMany({ data });
    return { count: data.length, firstNumber: data[0].number, lastNumber: data[data.length - 1].number };
  }, { timeout: 120000 });
}

/** حذف شارژهای استفاده‌نشده (همه‌یا‌هیچ): شارژی که حتی یک دریافت دارد حذف نمی‌شود */
export async function deleteCharges(idsRaw: unknown) {
  const ids = [...new Set((Array.isArray(idsRaw) ? idsRaw : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) throw new LoyaltyError("شارژی انتخاب نشده است");
  if (ids.length > 50000) throw new LoyaltyError("تعداد شارژهای انتخابی بیش از حد مجاز است");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100050, 1)`);
    const rows = await tx.loyaltyCharge.findMany({ where: { id: { in: ids } }, select: { id: true, number: true, _count: { select: { receipts: true } } } });
    if (rows.length !== ids.length) throw new LoyaltyError("برخی از شارژهای انتخابی یافت نشدند؛ فهرست را تازه کنید");
    const bad = rows.filter((r) => r._count.receipts > 0);
    if (bad.length) throw new LoyaltyError(`شارژی که در فروش مصرف شده حذف نمی‌شود. ${bad.length} شارژ غیرقابل حذف است: ${bad.slice(0, 5).map((r) => r.number).join("، ")}${bad.length > 5 ? " …" : ""}`);
    const r = await tx.loyaltyCharge.deleteMany({ where: { id: { in: ids }, receipts: { none: {} } } });
    if (r.count !== ids.length) throw new LoyaltyError("وضعیت برخی شارژها هم‌زمان تغییر کرد؛ دوباره تلاش کنید");
    return { deleted: r.count };
  }, { timeout: 120000 });
}

// ───────────────────────── احراز کارت (فروش فروشگاهی) ─────────────────────────

const failures = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

function assertNotLocked(key: string) {
  const f = failures.get(key);
  if (f && Date.now() - f.first < WINDOW_MS && f.n >= MAX_FAILS) throw new LoyaltyError("تلاش‌های ناموفق برای این کارت زیاد بوده است؛ ۱۵ دقیقه بعد دوباره تلاش کنید");
}
function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first >= WINDOW_MS) failures.set(key, { n: 1, first: Date.now() });
  else f.n += 1;
}

/** شماره‌ی کارت + کلمه‌ی عبور را کنترل می‌کند؛ هر دو اشتباه یک پیام یکسان می‌دهند. کارت باید فعال و در تاریخ مصرف منقضی‌نشده باشد. */
export async function authenticateCard(cardNumberRaw: unknown, password: unknown, date: Date) {
  const cardNumber = normalizeSerial(cardNumberRaw);
  if (!cardNumber) throw new LoyaltyError("شماره‌ی کارت وفاداری را وارد کنید");
  assertNotLocked(cardNumber);
  const card = await prisma.loyaltyCard.findUnique({ where: { cardNumber }, include: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } });
  const ok = card ? await bcrypt.compare(String(password ?? ""), card.passwordHash) : false;
  if (!card || !ok) {
    recordFailure(cardNumber);
    throw new LoyaltyError("شماره‌ی کارت یا کلمه‌ی عبور نادرست است");
  }
  failures.delete(cardNumber);
  if (!card.isActive) throw new LoyaltyError("این کارت وفاداری غیرفعال است");
  if (card.expiryDate && card.expiryDate.getTime() < date.getTime()) throw new LoyaltyError(`این کارت در تاریخ ${displayDate(card.expiryDate)} منقضی شده است`);
  return card;
}

/** یافتن کارت فعال و منقضی‌نشده با شماره‌ی کارت (بدون کلمه‌ی عبور)؛ برای نمایش شارژها پیش از تایید. کلمه‌ی عبور هنگام ثبت کنترل می‌شود. */
export async function findUsableCard(cardNumberRaw: unknown, date: Date) {
  const cardNumber = normalizeSerial(cardNumberRaw);
  if (!cardNumber) throw new LoyaltyError("شماره‌ی کارت وفاداری را وارد کنید");
  const card = await prisma.loyaltyCard.findUnique({ where: { cardNumber }, include: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } });
  if (!card) throw new LoyaltyError("کارتی با این شماره یافت نشد");
  if (!card.isActive) throw new LoyaltyError("این کارت وفاداری غیرفعال است");
  if (card.expiryDate && card.expiryDate.getTime() < date.getTime()) throw new LoyaltyError(`این کارت در تاریخ ${displayDate(card.expiryDate)} منقضی شده است`);
  return card;
}

/** مبلغ کسر یک شارژ از یک فاکتور: مبلغی = min(مانده، باقی‌مانده‌ی فاکتور)؛ درصدی = درصد × قابل پرداخت (حداکثر باقی‌مانده) */
export function chargeDeduction(c: { kind: string; value: any }, remaining: number | null, payable: number, due: number, dp: number) {
  const raw = c.kind === "AMOUNT" ? Math.min(remaining ?? 0, due) : Math.min(roundTo((payable * Number(c.value)) / 100, dp), due);
  return Math.max(0, roundTo(raw, dp));
}

async function saleContext(tx: any, saleId: number) {
  const sale = await tx.storeSale.findUnique({ where: { id: saleId }, include: { lines: { select: { amount: true, vatAmount: true } } } });
  if (!sale) throw new LoyaltyError("فروش یافت نشد");
  const payable = saleTotals(sale.lines).payable;
  const agg = await tx.storeReceipt.aggregate({ where: { saleId }, _sum: { amount: true } });
  const paid = Number(agg._sum.amount ?? 0);
  return { sale, payable, paid, due: Math.max(0, payable - paid) };
}

/** استعلام کارت برای تسویه‌ی یک فاکتور: شارژهای قابل مصرف (مانده‌دار، منقضی‌نشده) + مبلغ تخمینیِ هر کدام */
export async function lookupCard(body: { cardNumber?: unknown; cardId?: unknown; password?: unknown; date?: unknown; saleId?: unknown }) {
  const date = parseDate(body.date, "تاریخ");
  // پیش‌فرض: کارت‌های وفاداری مشتریِ همین فروش؛ شماره‌ی کارت دیگر لازم نیست
  let card: Awaited<ReturnType<typeof findUsableCard>>;
  let cards: { id: number; cardNumber: string }[] = [];
  if (normalizeSerial(body.cardNumber)) {
    card = await findUsableCard(body.cardNumber, date);
    cards = [{ id: card.id, cardNumber: card.cardNumber }];
  } else {
    const sid = Number(body.saleId) || 0;
    const sale = sid ? await prisma.storeSale.findUnique({ where: { id: sid }, select: { customer: { select: { partyId: true } } } }) : null;
    if (!sale) throw new LoyaltyError("فروش یافت نشد");
    const list = await prisma.loyaltyCard.findMany({
      where: { partyId: sale.customer.partyId, isActive: true, OR: [{ expiryDate: null }, { expiryDate: { gte: date } }] },
      include: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } },
      orderBy: { id: "asc" },
    });
    if (!list.length) throw new LoyaltyError("برای مشتری این فروش، کارت وفاداری فعالی تعریف نشده است");
    cards = list.map((c) => ({ id: c.id, cardNumber: c.cardNumber }));
    card = list.find((c) => c.id === Number(body.cardId)) ?? list[0];
  }
  const dp = await baseDecimals();
  const saleId = Number(body.saleId) || 0;
  const ctx = saleId ? await saleContext(prisma, saleId) : null;
  const rows = await prisma.loyaltyCharge.findMany({ where: { cardId: card.id, date: { lte: date }, OR: [{ expiryDate: null }, { expiryDate: { gte: date } }] }, include: { type: { select: { title: true } } }, orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }] });
  const usage = await chargeUsage(rows.map((r) => r.id));
  const usedOnSale = new Set<number>();
  if (saleId && rows.length) {
    const here = await prisma.storeReceipt.findMany({ where: { saleId, loyaltyChargeId: { in: rows.map((r) => r.id) } }, select: { loyaltyChargeId: true } });
    for (const h of here) usedOnSale.add(h.loyaltyChargeId as number);
  }
  const charges = rows
    .map((r) => {
      const st = chargeState(r, usage.get(r.id));
      const blockedHere = r.kind === "PERCENT" && usedOnSale.has(r.id);
      return { r, st, blockedHere };
    })
    .filter((x) => !x.st.closed && !x.blockedHere)
    .map(({ r, st }) => ({
      id: r.id,
      number: r.number,
      typeTitle: r.type.title,
      kind: r.kind as "AMOUNT" | "PERCENT",
      kindTitle: KIND_FA[r.kind as "AMOUNT" | "PERCENT"],
      value: Number(r.value),
      singleUse: r.singleUse,
      date: dayStr(r.date),
      expiryDate: r.expiryDate ? dayStr(r.expiryDate) : null,
      remaining: st.remaining,
      /** مبلغ بدون در نظر گرفتن باقی‌مانده‌ی فاکتور (مبلغی: مانده‌ی شارژ؛ درصدی: درصد × قابل پرداخت) — فرانت برای جمع چند شارژ به‌ترتیب با باقی‌مانده سقف می‌زند */
      full: ctx ? chargeDeduction(r, st.remaining, ctx.payable, Number.MAX_SAFE_INTEGER, dp) : null,
      estimate: ctx ? chargeDeduction(r, st.remaining, ctx.payable, ctx.due, dp) : null,
    }));
  return { cards, card: { id: card.id, cardNumber: card.cardNumber, partyTitle: partyTitle(card.party), expiryDate: card.expiryDate ? dayStr(card.expiryDate) : null }, charges, payable: ctx?.payable ?? null, due: ctx?.due ?? null };
}

export interface LoyaltyRedemption {
  chargeId: number;
  amount: number;
  cardNumber: string;
  typeTitle: string;
}

/**
 * مصرف شارژها در تراکنشِ ثبت دریافت (زیر قفل فروش). به ترتیب ارسال‌شده: هر شارژ مبلغِ خودش را از باقی‌مانده‌ی فاکتور کم می‌کند.
 * قفل ردیف شارژها (FOR UPDATE) از دوبار خرج‌شدنِ هم‌زمانِ یک شارژ در دو فروش جلوگیری می‌کند.
 */
export async function redeemChargesInTx(tx: any, saleId: number, cardId: number, items: { id: number; amount?: number }[], date: Date): Promise<LoyaltyRedemption[]> {
  const chargeIds = items.map((i) => i.id);
  if (new Set(chargeIds).size !== chargeIds.length) throw new LoyaltyError("یک شارژ بیش از یک بار انتخاب شده است");
  const dp = await baseDecimals();
  await tx.$queryRawUnsafe(`SELECT "id" FROM "LoyaltyCharge" WHERE "id" IN (${chargeIds.map((n) => Number(n)).join(",")}) ORDER BY "id" FOR UPDATE`);
  const charges = await tx.loyaltyCharge.findMany({ where: { id: { in: chargeIds } }, include: { type: { select: { title: true } }, card: { select: { cardNumber: true } } } });
  if (charges.length !== chargeIds.length) throw new LoyaltyError("شارژ انتخابی یافت نشد");
  const byId = new Map<number, any>(charges.map((c: any) => [c.id, c]));
  const usageRows = await tx.storeReceipt.groupBy({ by: ["loyaltyChargeId"], where: { loyaltyChargeId: { in: chargeIds } }, _sum: { amount: true }, _count: true });
  const usage = new Map<number, ChargeUsage>(usageRows.map((r: any) => [r.loyaltyChargeId, { used: Number(r._sum.amount ?? 0), count: r._count }]));
  const here = await tx.storeReceipt.findMany({ where: { saleId, loyaltyChargeId: { in: chargeIds } }, select: { loyaltyChargeId: true } });
  const usedOnSale = new Set<number>(here.map((h: any) => h.loyaltyChargeId));
  const ctx = await saleContext(tx, saleId);
  let due = ctx.due;
  const out: LoyaltyRedemption[] = [];
  for (const item of items) {
    const id = item.id;
    const c = byId.get(id);
    const label = `شارژ شماره ${c.number}`;
    if (c.cardId !== cardId) throw new LoyaltyError(`${label} متعلق به این کارت نیست`);
    if (c.date.getTime() > date.getTime()) throw new LoyaltyError(`${label} از تاریخ ${displayDate(c.date)} قابل استفاده است`);
    if (c.expiryDate && c.expiryDate.getTime() < date.getTime()) throw new LoyaltyError(`${label} در تاریخ ${displayDate(c.expiryDate)} منقضی شده است`);
    const st = chargeState(c, usage.get(id));
    if (st.closed) throw new LoyaltyError(`${label} قبلاً مصرف شده است`);
    if (c.kind === "PERCENT" && usedOnSale.has(id)) throw new LoyaltyError(`${label} (درصدی) قبلاً در همین فاکتور استفاده شده است`);
    let amount = chargeDeduction(c, st.remaining, ctx.payable, due, dp);
    // شارژ مبلغی: کاربر می‌تواند کمتر از سقف مصرف کند (بیشتر از سقف = مانده‌ی شارژ/باقی‌مانده‌ی فاکتور مجاز نیست)
    if (c.kind === "AMOUNT" && item.amount !== undefined && item.amount !== null) {
      const want = roundTo(Number(item.amount), dp);
      if (!(want > EPS)) throw new LoyaltyError(`مبلغ مصرف ${label} باید بزرگ‌تر از صفر باشد`);
      if (want - amount > EPS) throw new LoyaltyError(`مبلغ مصرف ${label} بیشتر از حداکثر مجاز (${amount}) است`);
      amount = want;
    }
    if (amount <= EPS) throw new LoyaltyError(`برای ${label} مبلغی قابل کسر نیست (باقی‌مانده‌ی فاکتور صفر است)`);
    due = roundTo(due - amount, dp);
    out.push({ chargeId: id, amount, cardNumber: c.card.cardNumber, typeTitle: c.type.title });
  }
  return out;
}
