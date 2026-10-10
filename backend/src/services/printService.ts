import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { prisma } from "../lib/prisma";
import { DEFAULT_PRINT_TEMPLATES } from "../data/printDefaultTemplates";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { amountInWords } from "../utils/numberToWords";

// چاپ اسناد با «قالب چاپ»: قالب = HTML/CSS با متغیرهای Handlebars؛ داده‌ی هر نوع سند را سرور می‌سازد (دیکشنری فیلد، PRINT_DOC_TYPES) و سرور
// آن را در قالب جاگذاری می‌کند. خروجی یک سند HTML کامل (فونت وزیرمتن داخل خودش، بدون هیچ منبع بیرونی) است که هم در پیش‌نمایش/چاپ مرورگر
// (iframe بدون اسکریپت) و هم بعداً برای PDF سمت سرور استفاده می‌شود. مقادیر داده با {{ }} escape می‌شوند؛ HTML خودِ قالب را فقط کاربری با
// مجوز «قالب‌های چاپ» می‌نویسد و چون خروجی در iframe با sandbox (بدون allow-scripts) و CSP بدون script نمایش داده می‌شود، اسکریپت اجرا نمی‌شود.

const hb = Handlebars.create();

export interface PrintFieldDoc {
  path: string;
  title: string;
  group: string;
  /** فهرست‌ها (مثل lines) داخل {{#each …}} استفاده می‌شوند */
  list?: boolean;
}

export type PrintData = Record<string, any>;

interface PrintDocTypeDef {
  title: string;
  fields: PrintFieldDoc[];
  /** متن‌های ثابتِ قالب (کلید → عنوان فارسی) که در {{t.کلید}} استفاده می‌شوند */
  textKeys: { key: string; title: string }[];
  /** نام پیش‌فرض فایل (Handlebars؛ وقتی متن ثابت fileName قالب خالی است) */
  defaultFileName: string;
  load(sourceId: number): Promise<PrintData>;
  latestSourceId(): Promise<number | null>;
  sample(): PrintData;
}

// ─── کمک‌ها ────────────────────────────────────────────────────────────────

/** عدد با جداکننده‌ی هزارگان (ارقام انگلیسی، مثل فرمت‌های چاپی رایج)؛ صفرهای اعشاریِ بی‌مصرف حذف می‌شود */
export function fmtNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.max(0, Math.min(decimals, 10)) }).format(n);
}

function partyName(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

function primary<T extends { isPrimary: boolean }>(list: T[] | undefined): T | undefined {
  return (list ?? []).find((x) => x.isPrimary) ?? (list ?? [])[0];
}

function dataUri(asset: { mimeType: string; data: Uint8Array | Buffer } | null | undefined): string {
  if (!asset) return "";
  return `data:${asset.mimeType};base64,${Buffer.from(asset.data).toString("base64")}`;
}

const DOC_STATUS_FA: Record<string, string> = { DRAFT: "ثبت", APPROVED: "تایید", VOIDED: "باطل" };

async function loadCompany(): Promise<PrintData> {
  const c = await prisma.companyProfile.findUnique({ where: { id: 1 }, include: { logoAsset: true, stampAsset: true } });
  const banks = Array.isArray(c?.bankAccounts) ? (c!.bankAccounts as any[]) : [];
  return {
    name: c?.name ?? "",
    economicCode: c?.economicCode ?? "",
    registrationNumber: c?.registrationNumber ?? "",
    nationalId: c?.nationalId ?? "",
    phone: c?.phone ?? "",
    address: c?.address ?? "",
    postalCode: c?.postalCode ?? "",
    website: c?.website ?? "",
    logo: dataUri(c?.logoAsset),
    stamp: dataUri(c?.stampAsset),
    bankAccounts: banks.map((b, i) => ({ no: i + 1, bankName: b.bankName ?? "", branch: b.branch ?? "", accountNumber: b.accountNumber ?? "", iban: b.iban ?? "" })),
  };
}

// ─── پیش‌فاکتور ─────────────────────────────────────────────────────────────

const COMPANY_FIELDS: PrintFieldDoc[] = [
  { path: "company.name", title: "نام شرکت (فروشنده)", group: "شرکت" },
  { path: "company.economicCode", title: "شماره اقتصادی شرکت", group: "شرکت" },
  { path: "company.registrationNumber", title: "شماره ثبت شرکت", group: "شرکت" },
  { path: "company.nationalId", title: "کد ملی/شناسه ملی شرکت", group: "شرکت" },
  { path: "company.phone", title: "تلفن شرکت", group: "شرکت" },
  { path: "company.address", title: "نشانی شرکت", group: "شرکت" },
  { path: "company.postalCode", title: "کد پستی شرکت", group: "شرکت" },
  { path: "company.website", title: "وب‌سایت شرکت", group: "شرکت" },
  { path: "company.logo", title: "لوگو (آدرس تصویر؛ در src)", group: "شرکت" },
  { path: "company.stamp", title: "مهر و امضا (آدرس تصویر؛ در src)", group: "شرکت" },
  { path: "company.bankAccounts", title: "حساب‌های بانکی شرکت (فهرست؛ no، bankName، branch، accountNumber، iban)", group: "شرکت", list: true },
];

const CUSTOMER_FIELDS: PrintFieldDoc[] = [
  { path: "customer.name", title: "نام مشتری", group: "مشتری" },
  { path: "customer.economicCode", title: "شماره اقتصادی مشتری", group: "مشتری" },
  { path: "customer.registrationNumber", title: "شماره ثبت مشتری", group: "مشتری" },
  { path: "customer.nationalId", title: "کد ملی/شناسه ملی مشتری", group: "مشتری" },
  { path: "customer.phone", title: "تلفن مشتری", group: "مشتری" },
  { path: "customer.address", title: "نشانی مشتری", group: "مشتری" },
  { path: "customer.postalCode", title: "کد پستی مشتری", group: "مشتری" },
];

const QUOTE_LINE_FIELDS: PrintFieldDoc[] = [
  { path: "lines", title: "ردیف‌های سند (داخل {{#each lines}} … {{/each}})", group: "ردیف‌ها", list: true },
  { path: "row", title: "ردیف: شماره ردیف", group: "ردیف‌ها" },
  { path: "code", title: "ردیف: کد کالا/خدمت", group: "ردیف‌ها" },
  { path: "title", title: "ردیف: عنوان کالا/خدمت (بدون عنوان گروه‌ها)", group: "ردیف‌ها" },
  { path: "fullTitle", title: "ردیف: عنوان کامل کالا/خدمت (با عنوان گروه‌ها)", group: "ردیف‌ها" },
  { path: "description", title: "ردیف: توضیحات ردیف", group: "ردیف‌ها" },
  { path: "quantity", title: "ردیف: تعداد", group: "ردیف‌ها" },
  { path: "unit", title: "ردیف: واحد", group: "ردیف‌ها" },
  { path: "unitPrice", title: "ردیف: مبلغ واحد", group: "ردیف‌ها" },
  { path: "amount", title: "ردیف: مبلغ کل", group: "ردیف‌ها" },
  { path: "discount", title: "ردیف: مبلغ تخفیف", group: "ردیف‌ها" },
  { path: "afterDiscount", title: "ردیف: مبلغ پس از تخفیف", group: "ردیف‌ها" },
  { path: "vat", title: "ردیف: ارزش افزوده", group: "ردیف‌ها" },
  { path: "net", title: "ردیف: خالص (پس از تخفیف + ارزش افزوده)", group: "ردیف‌ها" },
  { path: "totals.amount", title: "جمع مبلغ کل", group: "جمع‌ها" },
  { path: "totals.discount", title: "جمع تخفیف", group: "جمع‌ها" },
  { path: "totals.afterDiscount", title: "جمع مبلغ پس از تخفیف", group: "جمع‌ها" },
  { path: "totals.vat", title: "جمع ارزش افزوده", group: "جمع‌ها" },
  { path: "totals.net", title: "جمع خالص", group: "جمع‌ها" },
  { path: "totals.netInWords", title: "جمع خالص به حروف (با نام ارز)", group: "جمع‌ها" },
];

const DOC_FIELDS_QUOTE: PrintFieldDoc[] = [
  { path: "doc.number", title: "شماره پیش‌فاکتور", group: "سند" },
  { path: "doc.date", title: "تاریخ (شمسی)", group: "سند" },
  { path: "doc.validUntil", title: "تاریخ اعتبار (شمسی؛ اگر ثبت نشده خالی)", group: "سند" },
  { path: "doc.description", title: "توضیحات سند", group: "سند" },
  { path: "doc.currency", title: "ارز", group: "سند" },
  { path: "doc.status", title: "وضعیت", group: "سند" },
];

async function loadSalesInvoice(id: number): Promise<PrintData> {
  const d = await prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      currency: true,
      customer: { include: { party: { include: { addresses: { include: { city: true } }, phones: true } } } },
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
      taxInvoices: { where: { status: { in: ["IN_PROGRESS", "SUCCESS"] } }, orderBy: { id: "desc" }, take: 1, select: { taxId: true } },
    },
  });
  if (!d) throw new Error("فاکتور فروش یافت نشد");
  const dec = d.currency.decimalPlaces ?? 0;
  const fx = Number(d.fxRate) || 1;
  const party: any = d.customer.party;
  const addr = primary<any>(party.addresses);
  const phone = primary<any>(party.phones);
  const factor = 10 ** dec;
  const totals = { amount: 0, discount: 0, afterDiscount: 0, vat: 0, net: 0 };
  const lines = d.lines.map((l, i) => {
    const amount = Number(l.amount);
    const discount = Number(l.discount);
    // ارزش‌افزوده‌ی فاکتور فروش به ارز مبنا ذخیره می‌شود؛ برای چاپ به ارز فاکتور برمی‌گردد (÷ نرخ تبدیل)
    const vat = Math.round((Number(l.vatAmount) / fx) * factor) / factor;
    const afterDiscount = amount - discount;
    const net = afterDiscount + vat;
    totals.amount += amount;
    totals.discount += discount;
    totals.afterDiscount += afterDiscount;
    totals.vat += vat;
    totals.net += net;
    return {
      row: i + 1,
      code: l.goodsItem.fullCode,
      title: l.goodsItem.rawTitle,
      fullTitle: l.goodsItem.title,
      description: l.description ?? "",
      quantity: fmtNumber(Number(l.quantity), 6),
      unit: l.unit.title,
      unitPrice: fmtNumber(Number(l.unitPrice), dec),
      amount: fmtNumber(amount, dec),
      discount: fmtNumber(discount, dec),
      afterDiscount: fmtNumber(afterDiscount, dec),
      vat: fmtNumber(vat, dec),
      net: fmtNumber(net, dec),
    };
  });
  return {
    company: await loadCompany(),
    doc: { number: d.number, date: formatJalaliDateForMessage(d.date), description: d.description ?? "", currency: d.currency.title, status: DOC_STATUS_FA[d.status] ?? d.status, taxId: d.taxInvoices[0]?.taxId ?? "" },
    customer: {
      name: partyName(party),
      economicCode: party.economicCode ?? "",
      registrationNumber: party.registrationNumber ?? "",
      nationalId: party.nationalId ?? "",
      phone: phone?.number ?? "",
      address: addr ? [addr.city?.title, addr.address].filter(Boolean).join("، ") : "",
      postalCode: addr?.postalCode ?? "",
    },
    lines,
    totals: { ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, fmtNumber(v, dec)])), netInWords: amountInWords(totals.net, dec, d.currency.title) },
  };
}

const DOC_FIELDS_INVOICE: PrintFieldDoc[] = [
  { path: "doc.number", title: "شماره فاکتور", group: "سند" },
  { path: "doc.date", title: "تاریخ (شمسی)", group: "سند" },
  { path: "doc.description", title: "توضیحات سند", group: "سند" },
  { path: "doc.currency", title: "ارز", group: "سند" },
  { path: "doc.status", title: "وضعیت", group: "سند" },
  { path: "doc.taxId", title: "شناسه یکتای مالیاتی (فقط اگر به سامانه مودیان ارسال شده؛ وگرنه خالی)", group: "سند" },
];

async function loadSalesQuote(id: number): Promise<PrintData> {
  const d = await prisma.salesQuote.findUnique({
    where: { id },
    include: {
      currency: true,
      customer: { include: { party: { include: { addresses: { include: { city: true } }, phones: true } } } },
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) throw new Error("پیش‌فاکتور یافت نشد");
  const dec = d.currency.decimalPlaces ?? 0;
  const party: any = d.customer.party;
  const addr = primary<any>(party.addresses);
  const phone = primary<any>(party.phones);
  const totals = { amount: 0, discount: 0, afterDiscount: 0, vat: 0, net: 0 };
  const lines = d.lines.map((l, i) => {
    const amount = Number(l.amount);
    const discount = Number(l.discount);
    const vat = Number(l.vatAmount);
    const afterDiscount = amount - discount;
    const net = afterDiscount + vat;
    totals.amount += amount;
    totals.discount += discount;
    totals.afterDiscount += afterDiscount;
    totals.vat += vat;
    totals.net += net;
    return {
      row: i + 1,
      code: l.goodsItem.fullCode,
      title: l.goodsItem.rawTitle,
      fullTitle: l.goodsItem.title,
      description: l.description ?? "",
      quantity: fmtNumber(Number(l.quantity), 6),
      unit: l.unit.title,
      unitPrice: fmtNumber(Number(l.unitPrice), dec),
      amount: fmtNumber(amount, dec),
      discount: fmtNumber(discount, dec),
      afterDiscount: fmtNumber(afterDiscount, dec),
      vat: fmtNumber(vat, dec),
      net: fmtNumber(net, dec),
    };
  });
  return {
    company: await loadCompany(),
    doc: { number: d.number, date: formatJalaliDateForMessage(d.date), validUntil: d.validUntil ? formatJalaliDateForMessage(d.validUntil) : "", description: d.description ?? "", currency: d.currency.title, status: DOC_STATUS_FA[d.status] ?? d.status },
    customer: {
      name: partyName(party),
      economicCode: party.economicCode ?? "",
      registrationNumber: party.registrationNumber ?? "",
      nationalId: party.nationalId ?? "",
      phone: phone?.number ?? "",
      address: addr ? [addr.city?.title, addr.address].filter(Boolean).join("، ") : "",
      postalCode: addr?.postalCode ?? "",
    },
    lines,
    totals: { ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, fmtNumber(v, dec)])), netInWords: amountInWords(totals.net, dec, d.currency.title) },
  };
}

function sampleSalesQuote(): PrintData {
  return {
    company: {
      name: "شرکت نمونه",
      economicCode: "10000000000",
      registrationNumber: "12345",
      nationalId: "10000000000",
      phone: "02100000000",
      address: "تهران، خیابان نمونه، پلاک ۱",
      postalCode: "1234567890",
      website: "https://www.example.ir",
      logo: "",
      stamp: "",
      bankAccounts: [{ no: 1, bankName: "بانک نمونه", branch: "مرکزی", accountNumber: "1234567890", iban: "IR000000000000000000000000" }],
    },
    doc: { number: 101, date: "1405/01/01", validUntil: "", description: "", currency: "ریال", status: "ثبت" },
    customer: { name: "مشتری نمونه", economicCode: "", registrationNumber: "", nationalId: "10000000001", phone: "02100000001", address: "تهران، خیابان مشتری", postalCode: "1234567891" },
    lines: [
      { row: 1, code: "1001", title: "کالای نمونه", description: "", quantity: "100", unit: "عدد", unitPrice: "1,000,000", amount: "100,000,000", discount: "0", afterDiscount: "100,000,000", vat: "10,000,000", net: "110,000,000" },
    ],
    totals: { amount: "100,000,000", discount: "0", afterDiscount: "100,000,000", vat: "10,000,000", net: "110,000,000", netInWords: "یکصد و ده میلیون ریال" },
  };
}

export const PRINT_DOC_TYPES: Record<string, PrintDocTypeDef> = {
  SALES_QUOTE: {
    title: "پیش‌فاکتور",
    fields: [...DOC_FIELDS_QUOTE, ...COMPANY_FIELDS, ...CUSTOMER_FIELDS, ...QUOTE_LINE_FIELDS],
    textKeys: [
      { key: "title", title: "عنوان سند" },
      { key: "topNote", title: "یادداشت بالای صفحه" },
      { key: "salesTerms", title: "شرایط و نحوه فروش" },
      { key: "deliveryPlace", title: "محل تحویل" },
      { key: "watermark", title: "متن watermark (خالی = بدون watermark)" },
      { key: "fileName", title: "نام فایل هنگام ذخیره به‌صورت PDF (می‌تواند متغیر داشته باشد، مثلاً {{customer.name}})" },
    ],
    defaultFileName: "پیش فاکتور {{customer.name}} - {{company.name}}",
    load: loadSalesQuote,
    latestSourceId: async () => (await prisma.salesQuote.findFirst({ orderBy: { id: "desc" }, select: { id: true } }))?.id ?? null,
    sample: sampleSalesQuote,
  },
};

PRINT_DOC_TYPES.SALES_INVOICE = {
  title: "فاکتور فروش",
  fields: [...DOC_FIELDS_INVOICE, ...COMPANY_FIELDS, ...CUSTOMER_FIELDS, ...QUOTE_LINE_FIELDS],
  textKeys: PRINT_DOC_TYPES.SALES_QUOTE.textKeys,
  defaultFileName: "صورتحساب فروش {{customer.name}} - {{company.name}}",
  load: loadSalesInvoice,
  latestSourceId: async () => (await prisma.salesInvoice.findFirst({ orderBy: { id: "desc" }, select: { id: true } }))?.id ?? null,
  sample: () => {
    const d = sampleSalesQuote();
    return { ...d, doc: { number: 101, date: "1405/01/01", description: "", currency: "ریال", status: "ثبت", taxId: "" } };
  },
};

export function getPrintDocType(type: string): PrintDocTypeDef {
  const def = PRINT_DOC_TYPES[type];
  if (!def) throw new Error("نوع سند چاپ نامعتبر است");
  return def;
}

// ─── قالب‌های پیش‌فرض ─────────────────────────────────────────────────────────

/** برای هر نوع سندی که هیچ قالبی ندارد، قالب پیش‌فرض نصب را می‌سازد (idempotent) */
export async function ensureDefaultPrintTemplates(): Promise<void> {
  for (const t of DEFAULT_PRINT_TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    const count = await prisma.printTemplate.count({ where: { documentType: t.documentType } });
    if (count > 0) continue;
    // eslint-disable-next-line no-await-in-loop
    await prisma.printTemplate.create({
      data: { documentType: t.documentType, title: t.title, paper: t.paper, orientation: t.orientation, marginMm: t.marginMm, digits: t.digits, html: t.html, texts: t.texts, isDefault: true, isActive: true },
    });
  }
}

// ─── رندر ──────────────────────────────────────────────────────────────────

export type PrintDigitsMode = "LATIN" | "PERSIAN";

export interface RenderInput {
  html: string;
  texts: Record<string, string>;
  paper: "A4" | "A5";
  orientation: "PORTRAIT" | "LANDSCAPE";
  marginMm: number;
  digits?: PrintDigitsMode;
  /** عنوان سند HTML؛ مرورگر آن را پیشنهادِ نام فایل «ذخیره به‌صورت PDF» می‌گیرد */
  title?: string;
}

let fontCss: string | null = null;
function embeddedFontCss(): string {
  if (fontCss !== null) return fontCss;
  const dir = path.join(__dirname, "..", "assets", "fonts");
  const face = (file: string, weight: number) => {
    const b64 = fs.readFileSync(path.join(dir, file)).toString("base64");
    return `@font-face{font-family:"Vazirmatn";font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
  };
  fontCss = face("Vazirmatn-Regular.woff2", 400) + face("Vazirmatn-Bold.woff2", 700);
  return fontCss;
}

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * ارقام «متنِ» سند HTML را فارسی می‌کند (تگ‌ها/صفت‌ها، <style>، <script> و موجودیت‌هایی مثل &#39; و داده‌ی base64 تصویر دست‌نخورده می‌مانند):
 * 0-9 → ۰-۹، «,» بین ارقام → «٬» (جداکننده‌ی هزارگان) و «.» بین ارقام → «٫» (ممیز).
 */
export function toPersianDigitsInHtml(html: string): string {
  return html.replace(/(<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]*>)|([^<]+)/gi, (_m, markup: string | undefined, text: string | undefined) => {
    if (markup !== undefined) return markup;
    return (text ?? "")
      // موجودیت‌های HTML و توکن‌های حرفی‑عددی لاتین (شناسه‌ی مالیاتی، شبا، کد انگلیسی) دست‌نخورده می‌مانند؛ فقط ارقام جدا/عدد خالص فارسی می‌شوند
      .replace(/&#?[A-Za-z0-9]+;|[A-Za-z0-9]*[A-Za-z][A-Za-z0-9]*|[0-9]/g, (t) => (/^[0-9]$/.test(t) ? PERSIAN_DIGITS[Number(t)] : t))
      .replace(/([۰-۹]),(?=[۰-۹])/g, "$1٬")
      .replace(/([۰-۹])\.(?=[۰-۹])/g, "$1٫");
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** نام فایل امن از الگوی Handlebars: نویسه‌های ممنوع نام فایل و کنترلی حذف، فاصله‌ها فشرده، حداکثر ۱۲۰ نویسه */
export function buildPrintFileName(pattern: string, data: PrintData, fallback: string): string {
  let name = "";
  try {
    name = hb.compile(pattern || fallback, { noEscape: true })(data);
  } catch {
    name = "";
  }
  name = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120).trim();
  return name || "سند";
}

const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:";

/** سند HTML کامل برای چاپ؛ خطای نحوی قالب با پیام فارسی پرتاب می‌شود */
export function renderPrintDocument(input: RenderInput, data: PrintData): string {
  let body: string;
  try {
    body = hb.compile(input.html, { strict: false })({ ...data, t: input.texts ?? {} });
  } catch (e: any) {
    throw new Error(`خطا در قالب چاپ: ${String(e?.message ?? e).split("\n")[0]}`);
  }
  const size = `${input.paper} ${input.orientation === "LANDSCAPE" ? "landscape" : "portrait"}`;
  const margin = Math.max(0, Math.min(40, Number(input.marginMm) || 0));
  const digits: PrintDigitsMode = input.digits === "PERSIAN" ? "PERSIAN" : "LATIN";
  if (digits === "PERSIAN") body = toPersianDigitsInHtml(body);
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(input.title ?? "")}</title><style>${embeddedFontCss()}
@page { size: ${size}; margin: ${margin}mm; }
html, body { margin: 0; padding: 0; }
/* پیش‌نمایش روی صفحه هم حاشیه‌ی چاپی را نشان بدهد (در چاپ، @page حاشیه را اعمال می‌کند) */
@media screen { body { padding: ${margin}mm; box-sizing: border-box; } }
body { font-family: "Vazirmatn", Tahoma, sans-serif; font-size: 9pt; color: #111; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${body}</body></html>`;
}

export async function renderSavedTemplate(templateId: number, sourceId: number, digits?: PrintDigitsMode): Promise<{ html: string; title: string; fileName: string }> {
  const tpl = await prisma.printTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error("قالب چاپ یافت نشد");
  const def = getPrintDocType(tpl.documentType);
  const data = await def.load(sourceId);
  const texts: Record<string, string> = (tpl.texts as any) ?? {};
  const fileName = buildPrintFileName(texts.fileName ?? "", data, def.defaultFileName);
  const html = renderPrintDocument({ title: fileName, html: tpl.html, texts, paper: tpl.paper, orientation: tpl.orientation, marginMm: tpl.marginMm, digits: digits ?? tpl.digits }, data);
  return { html, title: `${def.title} ${data.doc?.number ?? ""}`.trim(), fileName };
}
