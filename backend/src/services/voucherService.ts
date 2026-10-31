import { randomInt } from "crypto";
import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { nextSerialNumber } from "../utils/coding";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { displayDate } from "../utils/dateDisplay";
import { issueJournalEntry } from "./journalEntryService";
import { findIssuingDocType } from "./documentTypeService";
import { EffectiveTreasurySettings } from "./treasurySettingService";
import { resolveAccountDetailFieldsForCodes } from "../utils/detailValues";

// باشگاه مشتریان › «بن‌کارت» (بنِ صادرشده توسط خودمان) — تنها محل قواعد.
// • چرخه‌ی عمر هر بن: CREATED (ایجادشده؛ بدهی نیست) → SOLD (فروخته‌شده به سازمان؛ بدهی ما) → USED (مصرف‌شده در یک دریافت فروش فروشگاهی)؛ VOID = باطل.
// • سریال‌ها را خودمان قبل از فروش می‌سازیم: ۱۰ رقم تصادفیِ غیرقابل‌حدس + ۱ رقم کنترل (Luhn)، یکتا در کل سیستم.
// • مصرف بن یک‌بار است: تغییر وضعیت SOLD→USED با updateMany شرطی و قید یکتای StoreReceipt.voucherId؛ حذف دریافت، بن را به SOLD برمی‌گرداند.
// • حسابداری: «فروش بن به سازمان» = بدهکار «طلب از صادرکننده‌ی بن (سازمان)» / بستانکار «بدهی بن‌کارت» (تفصیل: سازمان)؛ مصرف در فروش فروشگاهی = بدهکار «بدهی بن‌کارت» در سند «تحویل فروش».
// • قفل‌ها: 7100040 (شماره‌ی دسته‌ی صدور)، 7100041 (شماره‌ی فروش بن هر دوره).

export class VoucherError extends Error {}

const EPS = 1e-6;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const userId = () => getRequestContext()?.userId ?? null;
const partyTitle = (p: any) => (p ? p.detailTitle || `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.name || "" : "");

function parseDate(raw: unknown, label: string): Date {
  const d = new Date(String(raw ?? ""));
  if (!raw || Number.isNaN(d.getTime())) throw new VoucherError(`${label} الزامی و باید معتبر باشد`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function fiscalPeriodOf(date: Date) {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new VoucherError("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fp.id);
  return fp;
}

async function baseDecimals() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  return c?.decimalPlaces ?? 0;
}

// ───────────────────────── سریال ─────────────────────────

/** رقم کنترل Luhn برای رشته‌ی ارقام */
function luhnDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    let d = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}
export const serialIsValid = (s: string) => /^\d{11}$/.test(s) && luhnDigit(s.slice(0, 10)) === Number(s[10]);
function newSerial(): string {
  const body = String(randomInt(0, 10_000_000_000)).padStart(10, "0");
  return body + luhnDigit(body);
}
/** ارقام فارسی/عربی و فاصله‌ها را به شکل استاندارد می‌برد (ورودی بارکدخوان یا تایپ دستی) */
export function normalizeSerial(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s-]/g, "");
}

// ───────────────────────── نوع بن ─────────────────────────

export interface VoucherTypeBody {
  title?: string;
  faceValue?: number | string;
  validityDays?: number | string | null;
  isActive?: boolean;
}

async function cleanType(b: VoucherTypeBody, existingId?: number) {
  const title = String(b.title ?? "").trim();
  if (!title) throw new VoucherError("عنوان نوع بن الزامی است");
  const faceValue = Number(String(b.faceValue ?? "").replace(/,/g, ""));
  if (!Number.isFinite(faceValue) || faceValue <= 0) throw new VoucherError("ارزش اسمی باید عددی بزرگ‌تر از صفر باشد");
  const dp = await baseDecimals();
  if (Math.abs(faceValue * 10 ** dp - Math.round(faceValue * 10 ** dp)) > 1e-6) throw new VoucherError(`ارزش اسمی حداکثر ${dp} رقم اعشار دارد`);
  let validityDays: number | null = null;
  if (b.validityDays !== undefined && b.validityDays !== null && String(b.validityDays).trim() !== "") {
    validityDays = Number(b.validityDays);
    if (!Number.isInteger(validityDays) || validityDays <= 0 || validityDays > 3650) throw new VoucherError("مدت اعتبار باید عدد صحیحِ روز (۱ تا ۳۶۵۰) باشد");
  }
  // ارزش اسمی بعد از صدور اولین بن عوض نمی‌شود (بن‌ها کپی ارزش را دارند، ولی تغییرِ نوع گمراه‌کننده است)
  if (existingId) {
    const ex = await prisma.voucherType.findUnique({ where: { id: existingId }, include: { _count: { select: { vouchers: true } } } });
    if (!ex) throw new VoucherError("نوع بن یافت نشد");
    if (ex._count.vouchers > 0 && Math.abs(Number(ex.faceValue) - faceValue) > EPS) throw new VoucherError("برای این نوع بن، بن صادر شده است؛ ارزش اسمی قابل تغییر نیست (نوع تازه تعریف کنید)");
  }
  return { title, faceValue, validityDays, isActive: b.isActive !== false };
}

export const typeShape = (t: any) => ({
  id: t.id,
  code: t.code,
  title: t.title,
  faceValue: Number(t.faceValue),
  validityDays: t.validityDays ?? null,
  isActive: t.isActive,
  voucherCount: t._count?.vouchers ?? 0,
  updatedAt: t.updatedAt,
});

export async function listVoucherTypes() {
  const rows = await prisma.voucherType.findMany({ include: { _count: { select: { vouchers: true } } }, orderBy: { code: "asc" } });
  return rows.map(typeShape);
}

export async function createVoucherType(b: VoucherTypeBody) {
  const d = await cleanType(b);
  for (let attempt = 0; ; attempt++) {
    try {
      const code = await nextSerialNumber(prisma.voucherType as any, "code");
      return await prisma.voucherType.create({ data: { code, ...d } });
    } catch (e: any) {
      if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateVoucherType(id: number, b: VoucherTypeBody) {
  const d = await cleanType(b, id);
  await prisma.voucherType.update({ where: { id }, data: d });
}

// ───────────────────────── صدور دسته‌ای ─────────────────────────

const MAX_BATCH = 20000;

export async function issueVoucherBatch(body: { typeId?: number; count?: number | string; date?: string; validUntil?: string | null; description?: string | null }) {
  const type = Number(body.typeId) ? await prisma.voucherType.findUnique({ where: { id: Number(body.typeId) } }) : null;
  if (!type) throw new VoucherError("نوع بن را انتخاب کنید");
  if (!type.isActive) throw new VoucherError(`نوع بن «${type.title}» غیرفعال است`);
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) throw new VoucherError(`تعداد باید عدد صحیح بین ۱ تا ${MAX_BATCH} باشد`);
  const date = parseDate(body.date, "تاریخ صدور");
  let validUntil: Date | null = null;
  if (body.validUntil) {
    validUntil = parseDate(body.validUntil, "تاریخ انقضا");
    if (validUntil.getTime() < date.getTime()) throw new VoucherError("تاریخ انقضا نمی‌تواند قبل از تاریخ صدور باشد");
  } else if (type.validityDays) {
    validUntil = new Date(date.getTime() + type.validityDays * 86400000);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100040, 1)`);
    const last = await tx.voucherBatch.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    const batch = await tx.voucherBatch.create({ data: { number: (last?.number ?? 0) + 1, typeId: type.id, date, count, validUntil, description: body.description ? String(body.description).trim() || null : null, createdById: userId() } });
    // سریال‌های تصادفی؛ برخوردِ احتمالی با skipDuplicates رد می‌شود و تا رسیدن به تعداد تکرار می‌شود
    let made = 0;
    for (let round = 0; made < count && round < 20; round++) {
      const need = count - made;
      const serials = new Set<string>();
      while (serials.size < need) serials.add(newSerial());
      // eslint-disable-next-line no-await-in-loop
      const r = await tx.voucher.createMany({ data: [...serials].map((serial) => ({ serial, typeId: type.id, batchId: batch.id, faceValue: type.faceValue, validUntil })), skipDuplicates: true });
      made += r.count;
    }
    if (made !== count) throw new VoucherError("ساخت سریال‌های یکتا کامل نشد؛ دوباره تلاش کنید");
    return batch;
  }, { timeout: 120000 });
}

export async function listVoucherBatches() {
  const rows = await prisma.voucherBatch.findMany({ include: { type: { select: { title: true, faceValue: true } } }, orderBy: { number: "desc" }, take: 2000 });
  const sold = await prisma.voucher.groupBy({ by: ["batchId"], where: { status: { in: ["SOLD", "USED"] } }, _count: true });
  const used = await prisma.voucher.groupBy({ by: ["batchId"], where: { status: "USED" }, _count: true });
  const soldMap = new Map(sold.map((x) => [x.batchId, x._count]));
  const usedMap = new Map(used.map((x) => [x.batchId, x._count]));
  return rows.map((b) => ({
    id: b.id,
    number: b.number,
    date: dayStr(b.date),
    typeId: b.typeId,
    typeTitle: b.type.title,
    faceValue: Number(b.type.faceValue),
    count: b.count,
    soldCount: soldMap.get(b.id) ?? 0,
    usedCount: usedMap.get(b.id) ?? 0,
    validUntil: b.validUntil ? dayStr(b.validUntil) : null,
    description: b.description ?? "",
  }));
}

// ───────────────────────── فهرست بن‌ها ─────────────────────────

const STATUS_FA = { CREATED: "ایجادشده", SOLD: "فروخته‌شده", USED: "مصرف‌شده", VOID: "باطل" } as const;

export function voucherShape(v: any, today = new Date()) {
  const expired = !!v.validUntil && v.validUntil.getTime() < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) && (v.status === "CREATED" || v.status === "SOLD");
  return {
    id: v.id,
    serial: v.serial,
    typeId: v.typeId,
    typeTitle: v.type?.title ?? "",
    batchNumber: v.batch?.number ?? null,
    faceValue: Number(v.faceValue),
    validUntil: v.validUntil ? dayStr(v.validUntil) : null,
    status: v.status as keyof typeof STATUS_FA,
    statusTitle: expired ? "منقضی" : STATUS_FA[v.status as keyof typeof STATUS_FA],
    expired,
    saleId: v.saleId ?? null,
    saleNumber: v.sale?.number ?? null,
    customerId: v.sale?.customerId ?? null,
    customerTitle: partyTitle(v.sale?.customer?.party),
    voidReason: v.voidReason ?? "",
    usedReceiptNumber: v.receipt?.number ?? null,
  };
}

export async function listVouchers(q: { typeId?: number; status?: string; batchId?: number; customerId?: number; saleId?: number; search?: string; limit?: number }) {
  const where: any = {};
  if (q.typeId) where.typeId = q.typeId;
  if (q.batchId) where.batchId = q.batchId;
  if (q.saleId) where.saleId = q.saleId;
  if (q.customerId) where.sale = { customerId: q.customerId };
  if (q.status && ["CREATED", "SOLD", "USED", "VOID"].includes(q.status)) where.status = q.status;
  if (q.search) where.serial = { contains: normalizeSerial(q.search) };
  const rows = await prisma.voucher.findMany({
    where,
    include: { type: { select: { title: true } }, batch: { select: { number: true } }, sale: { select: { number: true, customerId: true, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } }, receipt: { select: { number: true } } },
    orderBy: { id: "asc" },
    take: Math.min(q.limit ?? 3000, 20000),
  });
  return rows.map((v) => voucherShape(v));
}

// ───────────────────────── فروش بن به سازمان ─────────────────────────

export interface VoucherSaleBody {
  date?: string;
  customerId?: number;
  description?: string | null;
  /** انتخاب با فهرست سریال‌ها؛ یا typeId + count (کمترین سریال‌های ایجادشده‌ی بدون انقضا) */
  serials?: string[];
  typeId?: number;
  count?: number | string;
}

export async function createVoucherSale(body: VoucherSaleBody) {
  const date = parseDate(body.date, "تاریخ فروش");
  const fp = await fiscalPeriodOf(date);
  const customer = Number(body.customerId) ? await prisma.customer.findUnique({ where: { id: Number(body.customerId) } }) : null;
  if (!customer) throw new VoucherError("سازمان (مشتری) را انتخاب کنید");
  if (!customer.isActive) throw new VoucherError("مشتری غیرفعال است");
  const today = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return prisma.$transaction(async (tx) => {
    let ids: number[];
    if (Array.isArray(body.serials) && body.serials.length) {
      const serials = [...new Set(body.serials.map(normalizeSerial))];
      const found = await tx.voucher.findMany({ where: { serial: { in: serials } } });
      const byS = new Map(found.map((v) => [v.serial, v]));
      for (const s of serials) {
        const v = byS.get(s);
        if (!v) throw new VoucherError(`سریال ${s} یافت نشد`);
        if (v.status !== "CREATED") throw new VoucherError(`بن ${s} قابل فروش نیست (وضعیت: ${STATUS_FA[v.status]})`);
        if (v.validUntil && v.validUntil.getTime() < today.getTime()) throw new VoucherError(`بن ${s} منقضی شده است`);
      }
      ids = found.map((v) => v.id);
    } else {
      const count = Number(body.count);
      if (!Number(body.typeId)) throw new VoucherError("نوع بن را انتخاب کنید");
      if (!Number.isInteger(count) || count < 1) throw new VoucherError("تعداد باید عدد صحیحِ مثبت باشد");
      const pick = await tx.voucher.findMany({ where: { typeId: Number(body.typeId), status: "CREATED", OR: [{ validUntil: null }, { validUntil: { gte: today } }] }, orderBy: { id: "asc" }, take: count, select: { id: true } });
      if (pick.length < count) throw new VoucherError(`فقط ${pick.length} بنِ ایجادشده‌ی قابل فروش از این نوع موجود است (درخواست: ${count})`);
      ids = pick.map((x) => x.id);
    }
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100041, ${fp.id})`);
    const last = await tx.voucherSale.findFirst({ where: { fiscalPeriodId: fp.id }, orderBy: { number: "desc" }, select: { number: true } });
    const sale = await tx.voucherSale.create({ data: { fiscalPeriodId: fp.id, number: (last?.number ?? 0) + 1, date, customerId: customer.id, description: body.description ? String(body.description).trim() || null : null, createdById: userId() } });
    // مصرف همزمان/فروش دوباره‌ی یک بن: به‌روزرسانی شرطی؛ تعدادِ بروزشده باید برابر باشد
    const upd = await tx.voucher.updateMany({ where: { id: { in: ids }, status: "CREATED" }, data: { status: "SOLD", saleId: sale.id } });
    if (upd.count !== ids.length) throw new VoucherError("برخی بن‌ها هم‌زمان توسط کاربر دیگری فروخته شدند؛ دوباره تلاش کنید");
    return sale;
  }, { timeout: 120000 });
}

export async function deleteVoucherSale(id: number) {
  const s = await prisma.voucherSale.findUnique({ where: { id }, include: { _count: { select: { vouchers: { where: { status: "USED" } } } } } });
  if (!s) throw new VoucherError("فروش بن یافت نشد");
  if (s.journalEntryId) throw new VoucherError("برای این فروش سند حسابداری صادر شده است؛ ابتدا سند را حذف کنید");
  if (s._count.vouchers > 0) throw new VoucherError("برخی بن‌های این فروش مصرف شده‌اند و فروش قابل حذف نیست");
  await prisma.$transaction(async (tx) => {
    await tx.voucher.updateMany({ where: { saleId: id, status: "SOLD" }, data: { status: "CREATED", saleId: null } });
    await tx.voucherSale.delete({ where: { id } });
  });
}

export function voucherSaleShape(s: any) {
  const vs: any[] = s.vouchers ?? [];
  return {
    id: s.id,
    number: s.number,
    date: dayStr(s.date),
    customerId: s.customerId,
    customerTitle: partyTitle(s.customer?.party),
    description: s.description ?? "",
    count: vs.length,
    amount: vs.reduce((n, v) => n + Number(v.faceValue), 0),
    usedCount: vs.filter((v) => v.status === "USED").length,
    journalEntryId: s.journalEntryId ?? null,
    journalEntryReferenceNumber: s.journalEntry?.referenceNumber ?? null,
    updatedAt: s.updatedAt,
  };
}

const SALE_INCLUDE = { customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, vouchers: { select: { faceValue: true, status: true, serial: true, typeId: true } }, journalEntry: { select: { referenceNumber: true } } } as const;

export async function listVoucherSales() {
  const rows = await prisma.voucherSale.findMany({ include: SALE_INCLUDE as any, orderBy: { id: "desc" }, take: 5000 });
  return rows.map(voucherSaleShape);
}

export async function loadVoucherSale(id: number) {
  const s = await prisma.voucherSale.findUnique({ where: { id }, include: SALE_INCLUDE as any });
  if (!s) return null;
  const types = await prisma.voucherType.findMany({ select: { id: true, title: true } });
  const tm = new Map(types.map((t) => [t.id, t.title]));
  return { ...voucherSaleShape(s), vouchers: (s as any).vouchers.map((v: any) => ({ serial: v.serial, typeTitle: tm.get(v.typeId) ?? "", faceValue: Number(v.faceValue), status: v.status })) };
}

// ───────────────────────── سند حسابداری فروش بن ─────────────────────────

export async function issueVoucherSaleJournal(id: number) {
  const s = await prisma.voucherSale.findUnique({ where: { id }, include: { customer: { select: { party: { select: { detailCode: true } } } }, vouchers: { select: { faceValue: true } } } });
  if (!s) throw new VoucherError("فروش بن یافت نشد");
  if (s.journalEntryId) throw new VoucherError("برای این فروش قبلاً سند حسابداری صادر شده است");
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!base) throw new VoucherError("ارز پایه تعریف نشده است");
  const treasury = new EffectiveTreasurySettings((await prisma.treasuryAccountSetting.findMany({ where: { accountType: { in: ["VOUCHER_LIABILITY", "VOUCHER_RECEIVABLE"] } }, include: { account: true } })) as any[]);
  const receivable = treasury.find(s.date, (x: any) => x.accountType === "VOUCHER_RECEIVABLE");
  const liability = treasury.find(s.date, (x: any) => x.accountType === "VOUCHER_LIABILITY");
  const errors: string[] = [];
  if (!receivable) errors.push("حساب «طلب از سازمان بابت بن‌کارت» در «تعیین حسابهای معین» (مدیریت خزانه) تعریف نشده است");
  if (!liability) errors.push("حساب «بدهی بن‌کارت» در «تعیین حسابهای معین» (مدیریت خزانه) تعریف نشده است");
  if (errors.length) throw new VoucherError(errors.join("\n"));
  const total = s.vouchers.reduce((n, v) => n + Number(v.faceValue), 0);
  if (!(total > 0)) throw new VoucherError("این فروش بنی ندارد");
  const code = s.customer.party.detailCode;
  const desc = `بابت فروش بن‌کارت شماره ${s.number} — ${displayDate(s.date)}`;
  const dr = await resolveAccountDetailFieldsForCodes(receivable!.account, [code]);
  const cr = await resolveAccountDetailFieldsForCodes(liability!.account, [code]);
  const docType = await findIssuingDocType("VOUCHER_SALE");
  if (!docType) throw new VoucherError("نوع سند حسابداری یافت نشد");
  const entry = await issueJournalEntry({
    date: s.date,
    documentTypeId: docType.id,
    description: desc,
    issuingSystem: "SALES",
    isManual: false,
    lines: [
      { accountId: receivable!.account.id, ...dr, currencyId: base.id, debit: total, credit: 0, fxRate: 1, description: desc },
      { accountId: liability!.account.id, ...cr, currencyId: base.id, debit: 0, credit: total, fxRate: 1, description: desc },
    ],
    sources: [{ label: `فروش بن‌کارت شماره ${s.number}`, path: `/voucher-sales/${s.id}/edit` }],
  });
  await treasury.markUsed(entry.id);
  await prisma.voucherSale.update({ where: { id }, data: { journalEntryId: entry.id } });
  return entry;
}

export async function revertVoucherSaleJournal(id: number) {
  const s = await prisma.voucherSale.findUnique({ where: { id } });
  if (!s) throw new VoucherError("فروش بن یافت نشد");
  if (!s.journalEntryId) throw new VoucherError("برای این فروش سندی صادر نشده است");
  await prisma.$transaction([prisma.voucherSale.update({ where: { id }, data: { journalEntryId: null } }), prisma.journalEntry.delete({ where: { id: s.journalEntryId } })]);
}

// ───────────────────────── ابطال ─────────────────────────

export async function voidVoucher(id: number, reason: unknown) {
  const why = String(reason ?? "").trim();
  if (!why) throw new VoucherError("علت ابطال الزامی است");
  const v = await prisma.voucher.findUnique({ where: { id }, include: { sale: { select: { journalEntryId: true } } } });
  if (!v) throw new VoucherError("بن یافت نشد");
  if (v.status === "USED") throw new VoucherError("بنِ مصرف‌شده باطل نمی‌شود");
  if (v.status === "VOID") throw new VoucherError("این بن قبلاً باطل شده است");
  if (v.sale?.journalEntryId) throw new VoucherError("فروشِ این بن سند حسابداری دارد؛ ابتدا سند را حذف کنید (بدهی بن باید اصلاح شود)");
  const r = await prisma.voucher.updateMany({ where: { id, status: { in: ["CREATED", "SOLD"] } }, data: { status: "VOID", voidReason: why, voidedAt: new Date() } });
  if (r.count !== 1) throw new VoucherError("وضعیت بن هم‌زمان تغییر کرد؛ دوباره تلاش کنید");
}

// ───────────────────────── مصرف در فروش فروشگاهی ─────────────────────────

/** استعلام یک بن برای دریافت (بدون تغییر): مشکل = پیام فارسی یا null */
export async function lookupVoucher(serialRaw: unknown, date: Date) {
  const serial = normalizeSerial(serialRaw);
  if (!serial) throw new VoucherError("سریال بن را وارد کنید");
  if (!serialIsValid(serial)) return { serial, problem: "سریال نامعتبر است (رقم کنترل درست نیست)", voucher: null as any };
  const v = await prisma.voucher.findUnique({ where: { serial }, include: { type: { select: { title: true } }, sale: { select: { number: true, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } } } });
  if (!v) return { serial, problem: "این سریال در سیستم وجود ندارد", voucher: null as any };
  let problem: string | null = null;
  if (v.status === "USED") problem = "این بن قبلاً مصرف شده است";
  else if (v.status === "VOID") problem = "این بن باطل شده است";
  else if (v.status === "CREATED") problem = "این بن هنوز به سازمانی فروخته نشده است";
  else if (v.validUntil && v.validUntil.getTime() < date.getTime()) problem = `این بن در تاریخ ${displayDate(v.validUntil)} منقضی شده است`;
  return {
    serial,
    problem,
    voucher: { id: v.id, serial: v.serial, typeTitle: v.type.title, faceValue: Number(v.faceValue), customerTitle: partyTitle(v.sale?.customer?.party), validUntil: v.validUntil ? dayStr(v.validUntil) : null },
  };
}

/** مصرف اتمیک یک بن داخل تراکنشِ ثبت دریافت؛ ارزش اسمی را برمی‌گرداند */
export async function redeemVoucherInTx(tx: any, serialRaw: unknown, date: Date): Promise<{ id: number; faceValue: number; serial: string }> {
  const serial = normalizeSerial(serialRaw);
  const v = await tx.voucher.findUnique({ where: { serial } });
  if (!v || !serialIsValid(serial)) throw new VoucherError(`سریال بن «${serial}» نامعتبر یا ناموجود است`);
  if (v.status !== "SOLD") throw new VoucherError(`بن ${serial} قابل مصرف نیست (${v.status === "USED" ? "قبلاً مصرف شده" : v.status === "VOID" ? "باطل شده" : "هنوز فروخته نشده"})`);
  if (v.validUntil && v.validUntil.getTime() < date.getTime()) throw new VoucherError(`بن ${serial} در تاریخ ${displayDate(v.validUntil)} منقضی شده است`);
  const r = await tx.voucher.updateMany({ where: { id: v.id, status: "SOLD" }, data: { status: "USED" } });
  if (r.count !== 1) throw new VoucherError(`بن ${serial} هم‌زمان در جای دیگری مصرف شد`);
  return { id: v.id, faceValue: Number(v.faceValue), serial };
}

/** حذف دریافتِ بن: بن دوباره قابل مصرف می‌شود */
export async function releaseVoucherInTx(tx: any, voucherId: number) {
  await tx.voucher.updateMany({ where: { id: voucherId, status: "USED" }, data: { status: "SOLD" } });
}

// ───────────────────────── گزارش تعهد ─────────────────────────

/** تعهد بن‌های فروخته‌شده به تفکیک سازمان: فروخته‌شده / مصرف‌شده / مانده (قابل‌مصرف) / منقضی‌نشده‌ی مانده‌ی منقضی */
export async function liabilityReport() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT s."customerId" AS "customerId",
      COUNT(*) FILTER (WHERE v."status" IN ('SOLD','USED')) AS "soldCount",
      COALESCE(SUM(v."faceValue") FILTER (WHERE v."status" IN ('SOLD','USED')), 0) AS "soldAmount",
      COUNT(*) FILTER (WHERE v."status" = 'USED') AS "usedCount",
      COALESCE(SUM(v."faceValue") FILTER (WHERE v."status" = 'USED'), 0) AS "usedAmount",
      COUNT(*) FILTER (WHERE v."status" = 'SOLD' AND (v."validUntil" IS NULL OR v."validUntil" >= CURRENT_DATE)) AS "openCount",
      COALESCE(SUM(v."faceValue") FILTER (WHERE v."status" = 'SOLD' AND (v."validUntil" IS NULL OR v."validUntil" >= CURRENT_DATE)), 0) AS "openAmount",
      COUNT(*) FILTER (WHERE v."status" = 'SOLD' AND v."validUntil" < CURRENT_DATE) AS "expiredCount",
      COALESCE(SUM(v."faceValue") FILTER (WHERE v."status" = 'SOLD' AND v."validUntil" < CURRENT_DATE), 0) AS "expiredAmount"
    FROM "Voucher" v JOIN "VoucherSale" s ON s."id" = v."saleId"
    GROUP BY s."customerId" ORDER BY s."customerId"`);
  const customers = await prisma.customer.findMany({ where: { id: { in: rows.map((r) => Number(r.customerId)) } }, select: { id: true, code: true, party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } });
  const cm = new Map(customers.map((c) => [c.id, c]));
  return rows.map((r) => ({
    customerId: Number(r.customerId),
    customerCode: cm.get(Number(r.customerId))?.code ?? null,
    customerTitle: partyTitle(cm.get(Number(r.customerId))?.party),
    soldCount: Number(r.soldCount),
    soldAmount: Number(r.soldAmount),
    usedCount: Number(r.usedCount),
    usedAmount: Number(r.usedAmount),
    openCount: Number(r.openCount),
    openAmount: Number(r.openAmount),
    expiredCount: Number(r.expiredCount),
    expiredAmount: Number(r.expiredAmount),
  }));
}
