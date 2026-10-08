// ساخت و اعتبارسنجی محلیِ «صورتحساب الکترونیکی» سامانه مودیان از روی «فاکتور فروش» — سند RC_IITP.IS V7.9 (الگوی ۱ «فروش»، نوع ۱ و ۲، موضوع «اصلی»).
// فقط JSON می‌سازد و مشکلاتش را گزارش می‌کند؛ هیچ ارتباطی با شبکه ندارد و چیزی ذخیره نمی‌کند (ارسال: services/taxTransport.ts).
//
// تصمیم‌های ثبت‌شده با کاربر:
//  • شماره اقتصادی فروشنده = شناسه ملی حافظه مالیاتی؛ تسویه‌ی پیش‌فرض نقدی؛ ساعت صدور پیش‌فرض ۰۸:۰۰ تاریخ فاکتور (به وقت تهران)
//  • «فی» هنگام ساخت دوباره از روی مبلغ ردیف محاسبه می‌شود (مبلغ ملاک است): کوچک‌ترین فیِ ≤ ۸ رقم اعشار که trunc(تعداد × فی) دقیقاً برابر مبلغ ردیف شود
//  • مالیات همان مبلغ ذخیره‌شده‌ی فاکتور است؛ اگر با فرمول سامانه (قطع‌شده) نخواند فقط «هشدار» می‌دهد (قطع کردن مالیات فاز بعد است)
//  • نوع ۲ را کاربر آگاهانه انتخاب می‌کند (پیش‌فرض نوع ۱)؛ نوع ۲ همیشه نقدی و بدون اطلاعات خریدار است
//  • inno = سریال ۱۰ رقمی هگز (همان جزء شماره مالیاتی)؛ نمونه‌ی ارسالیِ سیستم سام تایید کرد
//  • «موضوع ماده ۹» پیش‌فرض «در موعد» است؛ خارج از موعد ⇒ insr = 1 و indati2m = لحظه‌ی ارسال

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { toEnglishDigits } from "../utils/digits";
import { getVatRatePercentForDate } from "./accountingSettingsService";
import { makeTaxId, peekNextTaxSerial, TAX_MEMORY_ID_RE } from "./taxId";

const Dec = Prisma.Decimal;
type Dec = Prisma.Decimal;

export interface TaxInvoiceOptions {
  /** inty: ۱ = نوع اول (با خریدار) | ۲ = نوع دوم */
  invoiceType: 1 | 2;
  /** true = «خارج از موعد» (موضوع ماده ۹): insr = 1 و indati2m = لحظه‌ی ارسال */
  isArticle9: boolean;
  /** setm: ۱ = نقدی | ۲ = نسیه (برای نوع ۲ همیشه نقدی) */
  settlementMethod: 1 | 2;
}
export const DEFAULT_TAX_OPTIONS: TaxInvoiceOptions = { invoiceType: 1, isArticle9: false, settlementMethod: 1 };

export interface TaxProblem {
  severity: "error" | "warning";
  scope: "header" | "seller" | "buyer" | "line";
  /** شماره‌ی ردیف (۱-مبنا) برای مشکلات ردیف */
  line?: number;
  /** کلید JSON فیلد مربوط، اگر مشخص باشد */
  field?: string;
  message: string;
}

export interface BuiltTaxInvoice {
  /** JSON صورتحساب (header/body/payments)؛ اگر خطای بنیادی باشد null */
  payload: any | null;
  problems: TaxProblem[];
  errorCount: number;
  warningCount: number;
  meta: {
    invoiceNumber: number;
    invoiceDate: string;
    customerTitle: string;
    taxMemoryId: number | null;
    taxId: string | null;
    issuedAt: number | null;
    totalAmount: number | null;
    lineCount: number;
  };
}

/** فاکتور فروش با هرچه برای ساخت صورتحساب لازم است (یک‌بار بارگذاری؛ فهرست کاندیدها از همین استفاده می‌کند) */
export const TAX_INVOICE_INCLUDE = {
  customer: { include: { party: { include: { addresses: true } } } },
  lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" as const } },
  numberingPattern: { include: { taxMemory: true } },
  taxInvoices: { select: { id: true, status: true } },
} satisfies Prisma.SalesInvoiceInclude;
export type LoadedSalesInvoice = Prisma.SalesInvoiceGetPayload<{ include: typeof TAX_INVOICE_INCLUDE }>;

export async function loadSalesInvoiceForTax(id: number): Promise<LoadedSalesInvoice | null> {
  return prisma.salesInvoice.findUnique({ where: { id }, include: TAX_INVOICE_INCLUDE });
}

const TEHRAN_OFFSET_MIN = 210; // +03:30 (بدون ساعت تابستانی)
const ISSUE_HOUR_TEHRAN = 8;

/** تاریخ فاکتور (Date در UTC نیمه‌شب) ← لحظه‌ی ۰۸:۰۰ تهران همان روز به میلی‌ثانیه‌ی یونیکس */
export function issueTimeMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), ISSUE_HOUR_TEHRAN, 0) - TEHRAN_OFFSET_MIN * 60_000;
}

const digits = (v: string | null | undefined) => (v ? toEnglishDigits(String(v)).replace(/\s+/g, "") : "");
const isEconomicCode = (v: string) => /^\d{11}$|^\d{14}$/.test(v);

const trunc0 = (d: Dec) => d.toDecimalPlaces(0, Dec.ROUND_DOWN);
const MAX_SAFE = new Dec(Number.MAX_SAFE_INTEGER);

function partyTitle(p: { detailCode: string; name: string | null; firstName: string | null; lastName: string | null }): string {
  const n = p.name?.trim() || [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  if (!n) return `بدون نام (${p.detailCode})`;
  return n.includes(p.detailCode) ? n : `${n} (${p.detailCode})`;
}

type Buyer = LoadedSalesInvoice["customer"]["party"];

/** نوع شخص خریدار مطابق سامانه: ۱ حقیقی | ۲ حقوقی (حقوقی/موسسه مالی و اعتباری) | ۳ مشارکت مدنی (مشارکت خاص) | ۴ اتباع غیرایرانی */
export function buyerPersonType(p: Pick<Buyer, "category" | "nationality" | "legalType">): 1 | 2 | 3 | 4 {
  if (p.category === "INDIVIDUAL") return p.nationality === "FOREIGN" ? 4 : 1;
  return p.legalType === "SPECIAL_PARTNERSHIP" ? 3 : 2;
}
const TOB_FA: Record<number, string> = { 1: "حقیقی", 2: "حقوقی", 3: "مشارکت مدنی", 4: "اتباع غیرایرانی" };

function buyerPostalCode(p: Buyer): string {
  const addrs = [...p.addresses].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  for (const a of addrs) {
    const pc = digits(a.postalCode);
    if (/^\d{10}$/.test(pc)) return pc;
  }
  return "";
}

export async function buildTaxInvoice(
  inv: LoadedSalesInvoice,
  optionsIn: Partial<TaxInvoiceOptions> = {},
  ctx: {
    nowMs?: number;
    /** فهرست: شماره مالیاتیِ پیش‌نمایش ساخته نشود (یک پرس‌وجو کمتر به‌ازای هر فاکتور) */
    skipTaxId?: boolean;
    /** ارسال واقعی: سریالِ رزروشده (به‌جای «سریال بعدیِ بدون رزرو» پیش‌نمایش) */
    serial?: bigint;
  } = {}
): Promise<BuiltTaxInvoice> {
  const nowMs = ctx.nowMs ?? Date.now();
  // مقدارهای undefined پیش‌فرض را بازنویسی نکنند
  const options = { ...DEFAULT_TAX_OPTIONS, ...Object.fromEntries(Object.entries(optionsIn).filter(([, v]) => v !== undefined)) } as TaxInvoiceOptions;
  const problems: TaxProblem[] = [];
  const err = (scope: TaxProblem["scope"], message: string, extra: Partial<TaxProblem> = {}) => problems.push({ severity: "error", scope, message, ...extra });
  const warn = (scope: TaxProblem["scope"], message: string, extra: Partial<TaxProblem> = {}) => problems.push({ severity: "warning", scope, message, ...extra });

  const customerTitle = partyTitle(inv.customer.party);
  const meta: BuiltTaxInvoice["meta"] = {
    invoiceNumber: inv.number,
    invoiceDate: inv.date.toISOString().slice(0, 10),
    customerTitle,
    taxMemoryId: null,
    taxId: null,
    issuedAt: null,
    totalAmount: null,
    lineCount: inv.lines.length,
  };
  const finish = (payload: any | null): BuiltTaxInvoice => ({
    payload,
    problems,
    errorCount: problems.filter((p) => p.severity === "error").length,
    warningCount: problems.filter((p) => p.severity === "warning").length,
    meta,
  });

  if (options.invoiceType !== 1 && options.invoiceType !== 2) err("header", "نوع صورتحساب باید ۱ یا ۲ باشد", { field: "inty" });
  if (options.settlementMethod !== 1 && options.settlementMethod !== 2) err("header", "روش تسویه باید نقدی یا نسیه باشد", { field: "setm" });
  let settlement: 1 | 2 = options.settlementMethod === 2 ? 2 : 1;
  if (options.invoiceType === 2 && settlement === 2) {
    warn("header", "در صورتحساب نوع دوم روش تسویه همیشه نقدی است", { field: "setm" });
    settlement = 1;
  }

  // ── فاکتور
  if (inv.status === "VOIDED") err("header", "فاکتور ابطال شده است");
  if (inv.taxInvoices.some((t) => t.status !== "FAILED" && t.status !== "TIMEOUT")) err("header", "برای این فاکتور قبلاً صورتحساب مالیاتی ارسال شده است");
  if (inv.lines.length === 0) err("header", "فاکتور هیچ ردیفی ندارد", { field: "body" });

  // ── فروشنده (حافظه مالیاتی از الگوی شماره‌گذاری فاکتور)
  const memory = inv.numberingPattern?.taxMemory ?? null;
  if (!memory) {
    err("seller", "الگوی شماره‌گذاری این فاکتور حافظه مالیاتی ندارد");
    return finish(null);
  }
  meta.taxMemoryId = memory.id;
  const memoryId = (memory.taxMemoryUniqueId ?? "").trim().toUpperCase();
  if (!memoryId) err("seller", "شناسه یکتای حافظه مالیاتی هنوز در فرم «حافظه مالیاتی» وارد نشده است (پس از ثبت کلید عمومی در کارپوشه دریافت می‌شود)");
  else if (!TAX_MEMORY_ID_RE.test(memoryId)) err("seller", `شناسه یکتای حافظه مالیاتی «${memoryId}» نامعتبر است (۶ کاراکتر؛ ارقام ۱ تا ۹ و حروف بزرگ، بدون I J L Q V)`);
  const tins = digits(memory.nationalId);
  if (!isEconomicCode(tins)) {
    err("seller", `شناسه ملی حافظه مالیاتی (${tins || "خالی"}) به‌عنوان شماره اقتصادی فروشنده باید ۱۱ یا ۱۴ رقم باشد`, { field: "tins" });
  }

  // ── تاریخ و زمان صدور
  const indatim = issueTimeMs(inv.date);
  meta.issuedAt = indatim;
  if (indatim > nowMs) err("header", "تاریخ و زمان صدور (۰۸:۰۰ تاریخ فاکتور) از زمان حال جلوتر است", { field: "indatim" });

  // ── خریدار
  const party = inv.customer.party;
  const tob = buyerPersonType(party);
  const header: Record<string, any> = {};
  const buyerFields: Record<string, any> = {};
  if (options.invoiceType === 1) {
    const eco = digits(party.economicCode);
    const nid = digits(tob === 4 ? party.foreignId : party.nationalId);
    const postal = buyerPostalCode(party);
    const ecoOk = isEconomicCode(eco);
    if (eco && !ecoOk) err("buyer", `شماره اقتصادی خریدار «${eco}» باید ۱۱ یا ۱۴ رقم باشد (${customerTitle})`, { field: "tinb" });
    if (tob === 2 || tob === 3) {
      if (!ecoOk) err("buyer", `برای خریدار ${TOB_FA[tob]} در صورتحساب نوع اول، شماره اقتصادی (۱۱ یا ۱۴ رقم) الزامی است (${customerTitle})`, { field: "tinb" });
    } else {
      const idLen = tob === 1 ? 10 : 12;
      const idOk = nid.length === idLen;
      if (!ecoOk && !(idOk && postal)) {
        const missing: string[] = [];
        if (!idOk) missing.push(tob === 1 ? "شماره ملی ۱۰ رقمی" : "کد فراگیر اتباع غیرایرانی ۱۲ رقمی");
        if (!postal) missing.push("کد پستی ۱۰ رقمی (آدرس طرف حساب)");
        err("buyer", `برای خریدار ${TOB_FA[tob]} باید «شماره اقتصادی» یا «${missing.join(" و ")}» ثبت شود (${customerTitle})`, { field: "tinb" });
      }
      if (nid && !idOk) warn("buyer", `${tob === 1 ? "شماره ملی" : "کد فراگیر"} خریدار «${nid}» ${idLen} رقمی نیست و ارسال نمی‌شود`, { field: "bid" });
      if (idOk) buyerFields.bid = nid;
      if (postal && (idOk || ecoOk)) buyerFields.bpc = postal;
    }
    if (ecoOk) buyerFields.tinb = eco;
    if (party.category === "LEGAL" && party.nationality === "FOREIGN") {
      warn("buyer", "خریدار حقوقیِ خارجی به‌عنوان «حقوقی» ارسال می‌شود؛ شماره اقتصادی لازم است", { field: "tob" });
    }
  }

  // ── ردیف‌ها
  const defaultVat = await getVatRatePercentForDate(inv.date);
  const body: any[] = [];
  let sumPrdis = new Dec(0);
  let sumDis = new Dec(0);
  let sumAdis = new Dec(0);
  let sumVam = new Dec(0);
  let sumTsstam = new Dec(0);

  inv.lines.forEach((l, i) => {
    const n = i + 1;
    const lerr = (message: string, field?: string) => err("line", `ردیف ${n}: ${message}`, { line: n, field });
    const lwarn = (message: string, field?: string) => warn("line", `ردیف ${n}: ${message}`, { line: n, field });
    const item = l.goodsItem;

    const sstid = digits(item.taxItemId);
    if (!/^\d{13}$/.test(sstid)) lerr(`شناسه مالیاتی ${item.kind === "SERVICE" ? "خدمت" : "کالا"} «${item.title}» تعریف نشده است (۱۳ رقم، تب حسابداری تعریف ${item.kind === "SERVICE" ? "خدمت" : "کالا"})`, "sstid");
    const mu = digits(l.unit.taxCode);
    if (!mu) lerr(`شناسه مالیاتی واحد سنجش «${l.unit.title}» تعریف نشده است`, "mu");

    const A = trunc0(l.baseAmount);
    if (!A.eq(l.baseAmount)) lwarn("مبلغ اعشار دارد و به ریال صحیح قطع شد", "prdis");
    const dis = trunc0(l.baseDiscount);
    const adis = A.sub(dis);
    const vam = trunc0(l.vatAmount);
    if (A.lte(0)) lerr("مبلغ ردیف باید بزرگ‌تر از صفر باشد", "prdis");
    if (dis.lt(0) || dis.gt(A)) lerr("مبلغ تخفیف باید بین صفر و مبلغ ردیف باشد", "dis");
    if (vam.lt(0)) lerr("مبلغ مالیات منفی است", "vam");

    const qty = l.quantity.toDecimalPlaces(8, Dec.ROUND_DOWN);
    if (!qty.eq(l.quantity)) lwarn("تعداد/مقدار بیش از ۸ رقم اعشار دارد و قطع شد", "am");
    if (qty.lte(0)) lerr("تعداد/مقدار باید بزرگ‌تر از صفر باشد", "am");

    // فی: کوچک‌ترین مقدار با ≤ ۸ رقم اعشار که قطعِ (تعداد × فی) دقیقاً مبلغ ردیف شود
    let fee = new Dec(0);
    if (qty.gt(0) && A.gt(0)) {
      fee = A.div(qty).toDecimalPlaces(8, Dec.ROUND_UP);
      if (!qty.mul(fee).toDecimalPlaces(0, Dec.ROUND_DOWN).eq(A)) lerr("نمی‌توان مبلغ واحدی با حداکثر ۸ رقم اعشار یافت که با مبلغ ردیف بخواند", "fee");
    }

    // نرخ مالیات: کالا/خدمت خاص نرخ خودش، وگرنه نرخ پیش‌فرض تنظیمات در تاریخ فاکتور
    const vra = item.isSpecial && item.taxRate != null ? item.taxRate.toNumber() : defaultVat;
    if (vra < 0 || vra >= 1000) lerr("نرخ مالیات خارج از محدوده است", "vra");
    const expectedVam = trunc0(adis.mul(vra).div(100));
    if (vra === 0 && !vam.isZero()) lerr("نرخ مالیات صفر است ولی مبلغ مالیات صفر نیست", "vam");
    else if (!vam.eq(expectedVam)) lwarn(`مبلغ مالیات فاکتور (${vam.toString()}) با فرمول سامانه — مبلغ بعد از تخفیف × نرخ ÷ ۱۰۰ با قطع (${expectedVam.toString()}) برابر نیست؛ ممکن است رد شود`, "vam");

    // شرح کالا/خدمت (sstt): «عنوان خام» (بدون پیشوند گروه/ویژگی)، مثل سیستم سام
    const title = (item.rawTitle ?? item.title ?? "").trim();
    if (title.length > 400) lwarn("شرح کالا/خدمت بیش از ۴۰۰ کاراکتر است و کوتاه شد", "sstt");

    const tsstam = adis.add(vam);
    if ([A, adis, vam, tsstam].some((d) => d.abs().gt(MAX_SAFE))) lerr("مبلغ از حد مجاز بزرگ‌تر است");

    sumPrdis = sumPrdis.add(A);
    sumDis = sumDis.add(dis);
    sumAdis = sumAdis.add(adis);
    sumVam = sumVam.add(vam);
    sumTsstam = sumTsstam.add(tsstam);

    body.push({
      sstid,
      sstt: title.slice(0, 400),
      mu,
      am: qty.toNumber(),
      fee: fee.toNumber(),
      prdis: A.toNumber(),
      dis: dis.toNumber(),
      adis: adis.toNumber(),
      vra,
      vam: vam.toNumber(),
      tsstam: tsstam.toNumber(),
    });
  });
  meta.totalAmount = sumTsstam.toNumber();

  // ── شماره مالیاتی (پیش‌نمایش با سریال بعدیِ بدون رزرو؛ هنگام ارسال سریال واقعی اتمی گرفته می‌شود)
  let innoHex: string | null = null; // سریال داخلی (inno) = همان جزء ۱۰ رقمی هگز شماره مالیاتی (مطابق نمونه‌ی سیستم سام)
  if (!ctx.skipTaxId && memoryId && TAX_MEMORY_ID_RE.test(memoryId) && indatim > 0) {
    try {
      const serial = ctx.serial ?? (await peekNextTaxSerial(memory.id));
      meta.taxId = makeTaxId(memoryId, indatim, serial);
      innoHex = serial.toString(16).toUpperCase().padStart(10, "0");
    } catch (e: any) {
      err("header", e.message, { field: "taxid" });
    }
  }

  // ── سرآمد
  header.taxid = meta.taxId;
  header.indatim = indatim;
  if (options.isArticle9) {
    header.indati2m = nowMs;
    warn("header", "صورتحساب «موضوع ماده ۹» ارسال می‌شود: تاریخ و زمان ثبت = لحظه‌ی ارسال؛ فقط اگر واقعاً از مهلت مجاز ارسال گذشته باشد انتخاب شود", { field: "insr" });
  }
  header.inty = options.invoiceType;
  if (innoHex) header.inno = innoHex;
  header.inp = 1;
  header.ins = 1;
  header.tins = tins;
  if (options.invoiceType === 1) {
    header.tob = tob;
    Object.assign(header, buyerFields);
  }
  header.tprdis = sumPrdis.toNumber();
  header.tdis = sumDis.toNumber();
  header.tadis = sumAdis.toNumber();
  header.tvam = sumVam.toNumber();
  header.todam = 0;
  header.tbill = sumTsstam.toNumber();
  header.setm = settlement;
  if (options.isArticle9) header.insr = 1;

  return finish({ header, body, payments: [] });
}

/** مقدار خلاصه‌ی فاکتور برای فهرست (بدون ساختن کل JSON) */
export function invoiceTotalForList(inv: LoadedSalesInvoice): number {
  return inv.lines.reduce((s, l) => s.add(l.baseAmount).sub(l.baseDiscount).add(l.vatAmount), new Dec(0)).toNumber();
}
