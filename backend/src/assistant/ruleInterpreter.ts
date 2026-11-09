import { ActionDef, ChatState, Interpretation, Interpreter, LineValue, SlotValue } from "./types";
import { norm, toNumber } from "./text";
import { findMacroForUser, macroKey } from "../services/assistantMacroService";

// تفسیرگر قاعده‌محور: تشخیص کار با کلیدواژه/مترادف و استخراج اسلات‌ها با الگوهای ثابت. هر کار یک «extractor» دارد که از باقی‌مانده‌ی متن اسلات‌ها را برمی‌دارد.
// آنچه تشخیص‌داده‌نشود نادیده گرفته می‌شود و موتور درباره‌اش می‌پرسد؛ هرگز حدس خطرناک نمی‌زند.

const NUM = String.raw`\d+(?:\.\d+)?`;
const UNIT_WORDS = String.raw`(?:تا|عدد|واحد|دستگاه|متر|کیلو|کیلوگرم|بسته|رول|شاخه)`;

const RE_LINE_QTY_FIRST = new RegExp(String.raw`^(${NUM})\s*${UNIT_WORDS}?\s*(?:از\s+)?(?:کالای\s+|کالا\s+|خدمت\s+)?(.+)$`);
const RE_LINE_TIMES = new RegExp(String.raw`^(.+?)\s*(?:[×xX*]|ضربدر)\s*(${NUM})$`);
const RE_LINE_QTY_LAST = new RegExp(String.raw`^(.+?)\s+(${NUM})\s*${UNIT_WORDS}?$`);
const RE_DISCOUNT_A = new RegExp(String.raw`تخفیف\s*(${NUM})\s*(?:درصد|%|٪)?`);
const RE_DISCOUNT_B = new RegExp(String.raw`(${NUM})\s*(?:درصد|%|٪)\s*تخفیف`);
const RE_LOOKS_ITEM = new RegExp(String.raw`^(?:کالای|کالا|خدمت)\s|^${NUM}(?:\s|$)|[×xX*]\s*${NUM}$|\s${NUM}\s*${UNIT_WORDS}?$`);

const INTENTS: { key: string; re: RegExp }[] = [
  { key: "approve-quote", re: /(?:تایید|تأیید|تائید)\s*(?:کن\s*)?(?:پیش\s?فاکتور)|پیش\s?فاکتور[^،.]*?(?:تایید|تأیید|تائید)\s*(?:کن|شود)/ },
  { key: "sales-quote", re: /پیش\s?فاکتور|استعلام\s?قیمت|قیمت\s?بده/ },
  { key: "create-customer", re: /مشتری\s+(?:جدید|تازه)|تعریف\s+مشتری|ثبت\s+مشتری/ },
  // «اعلامیه پرداخت»، «پرداخت به/وجه/جدید»، «ثبت/صدور … پرداخت»؛ قبل از «حواله» می‌آید تا «پرداخت با حواله بانکی» حواله‌ی فروش نشود
  { key: "payment", re: /اعلامیه\s+پرداخت|پرداخت\s+(?:به|وجه|جدید|بزن|بساز)|(?:ثبت|صدور|صادر|ایجاد|بزن|بساز)\s*(?:یک\s+)?پرداخت/ },
  { key: "sales-delivery", re: /حواله/ },
  { key: "sales-invoice", re: /(?:ثبت|صدور|صادر|ایجاد|بزن|بساز)\s*(?:یک\s+)?(?:فاکتور|صورتحساب)|(?:فاکتور|صورتحساب)\s*(?:فروش\s*)?(?:جدید|بزن|بساز)/ },
  // «رسید انبار» دریافت نیست؛ فقط «رسید دریافت»، «دریافت از/وجه/جدید» و «ثبت/صدور … دریافت|رسید»
  { key: "receipt", re: /رسید\s+دریافت|دریافت\s+(?:از|وجه|جدید|بزن|بساز)|(?:ثبت|صدور|صادر|ایجاد|بزن|بساز)\s*(?:یک\s+)?(?:رسید(?!\s*انبار)|دریافت)/ },
  { key: "stock", re: /موجودی|مانده\s?کالا|چقدر.*(?:داریم|موجود)/ },
  { key: "customer-invoices", re: /فاکتور/ },
];

const CANCEL = /^(?:انصراف|لغو|کنسل|بیخیال|ولش کن)\s*[.!؟]*$/;

/** ZWNJ حذف می‌شود تا «پیش‌فاکتور» و «پیش فاکتور» و «پیشفاکتور» یکی شوند؛ باقی نرمال‌سازی همان norm است */
const forIntent = (s: string) => norm(s).replace(/‌/g, "");

function parseLine(seg: string): LineValue | null {
  let t = seg.trim().replace(/^(?:کالای|کالا|خدمت|آیتم)\s+/, "");
  let m = RE_LINE_QTY_FIRST.exec(t);
  if (m && !/^\d+$/.test(m[2].trim())) return { text: m[2].trim(), quantity: Number(m[1]) };
  m = RE_LINE_TIMES.exec(t);
  if (m) return { text: m[1].trim(), quantity: Number(m[2]) };
  m = RE_LINE_QTY_LAST.exec(t);
  if (m) return { text: m[1].trim(), quantity: Number(m[2]) };
  t = t.trim();
  return t ? { text: t, quantity: 1 } : null;
}

function splitSegments(text: string): string[] {
  return text
    .split(/[،,؛;\n]+|\s+و\s+(?=\d)/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const SKIP_WORDS = /^(?:رد|ندارم|ندارد|بعدا|بعداً|نمی\s?دانم|-|—)$/;

function extractQuote(text: string, state: ChatState): Record<string, SlotValue> {
  const out: Record<string, SlotValue> = {};
  const lines: LineValue[] = [];
  const pendingLines = state.pending?.slot === "lines";
  const pendingCustomer = state.pending?.slot === "customer";
  // پاسخ به سؤال «تخفیف/شرح» (دستور میانبر با «حتماً بپرس»): کل متن همان مقدار است، نه قلم کالا
  if (state.pending?.slot === "discountPercent") {
    const n = toNumber(text.replace(/[٪%]|درصد/g, " ").trim());
    return Number.isNaN(n) ? (SKIP_WORDS.test(text.trim()) ? { discountPercent: 0 } : {}) : { discountPercent: n };
  }
  if (state.pending?.slot === "description") return { description: SKIP_WORDS.test(text.trim()) ? "" : text.trim() };
  for (let seg of splitSegments(text)) {
    let m: RegExpExecArray | null;
    if ((m = RE_DISCOUNT_A.exec(seg)) || (m = RE_DISCOUNT_B.exec(seg))) {
      out.discountPercent = Number(m[1]);
      seg = seg.replace(m[0], "").trim();
      if (!seg) continue;
    }
    if ((m = /^(?:شرح|توضیح|توضیحات)\s+(.+)$/.exec(seg))) {
      out.description = m[1].trim();
      continue;
    }
    if ((m = /^مرکز(?:\s*فروش)?\s+(.+)$/.exec(seg))) {
      out.salesCenter = { text: m[1].trim() };
      continue;
    }
    if ((m = /^نوع(?:\s*فروش)?\s+(.+)$/.exec(seg))) {
      out.salesType = { text: m[1].trim() };
      continue;
    }
    if ((m = /^(?:برای|مشتری)\s+(.+)$/.exec(seg))) {
      // نام مشتری تا اولین عدد (غیر از کلمه‌ی اول)؛ باقی‌مانده‌ی بعد از آن اقلام است
      const toks = m[1].trim().split(/\s+/);
      let cut = toks.length;
      for (let i = 1; i < toks.length; i++) {
        if (!Number.isNaN(toNumber(toks[i]))) {
          cut = i;
          break;
        }
      }
      let custText = toks.slice(0, cut).join(" ");
      // «برای مشتری جدید شرکت X» / «مشتری جدید X»: مشتری جدید است (بدون جستجو؛ تعریف می‌شود)
      const nm = /^(?:مشتری\s+)?(?:جدید|تازه)\s*(.*)$/.exec(custText);
      out.customer = nm ? { text: nm[1].trim(), isNew: true } : { text: custText };
      const rest = toks.slice(cut).join(" ");
      if (rest) {
        const l = parseLine(rest);
        if (l) lines.push(l);
      }
      continue;
    }
    if (pendingCustomer && !out.customer && !RE_LOOKS_ITEM.test(seg)) {
      out.customer = { text: seg };
      continue;
    }
    if (RE_LOOKS_ITEM.test(seg) || pendingLines) {
      const l = parseLine(seg);
      if (l) lines.push(l);
    }
  }
  if (lines.length) out.lines = lines;
  return out;
}

const SKIP = /^(?:رد|ندارم|ندارد|بعدا|بعداً|نمی\s?دانم|-|—)$/;
const KIND_WORDS: [RegExp, number][] = [[/حقوقی|شرکت/, 2], [/حقیقی|شخص|فرد/, 1]];

/** «مشتری جدید»: در حالت پرسش (pending) فقط همان اسلات از کل متن خوانده می‌شود؛ در فرمان اولیه همه‌ی اسلات‌ها از متن استخراج می‌شود */
function extractCustomer(text: string, state: ChatState): Record<string, SlotValue> {
  const out: Record<string, SlotValue> = {};
  const p = state.pending?.slot;
  const t = text.trim();
  if (p === "kind") {
    const hit = KIND_WORDS.find(([re]) => re.test(t));
    return hit ? { kind: { id: hit[1], label: hit[1] === 2 ? "حقوقی" : "حقیقی" } } : {};
  }
  if (p === "name") return t ? { name: t } : {};
  if (p === "nationalId") return SKIP.test(t) ? { nationalId: "" } : /^\d[\d\s]*$/.test(t) ? { nationalId: t.replace(/\D/g, "") } : {};
  if (p === "mobile") return /^\d[\d\s]*$/.test(t) ? { mobile: t.replace(/\D/g, "") } : {};
  let rest = t.replace(/(?:تعریف|ثبت)\s+مشتری(?:\s+(?:جدید|تازه))?|مشتری\s+(?:جدید|تازه)/, " ");
  const kindHit = /حقوقی/.test(rest) ? 2 : /حقیقی/.test(rest) ? 1 : null;
  if (kindHit) {
    out.kind = { id: kindHit, label: kindHit === 2 ? "حقوقی" : "حقیقی" };
    rest = rest.replace(/حقوقی|حقیقی/g, " ");
  }
  const mob = /(?:موبایل|همراه|تلفن)\s*:?\s*(09\d{9})/.exec(rest) ?? /\b(09\d{9})\b/.exec(rest);
  if (mob) {
    out.mobile = mob[1];
    rest = rest.replace(mob[0], " ");
  }
  const nid = /(?:کد\s*ملی|شناسه\s*ملی|ملی)\s*:?\s*(\d{10,11})/.exec(rest) ?? /\b(\d{10,11})\b/.exec(rest);
  if (nid) {
    out.nationalId = nid[1];
    if (!out.kind) out.kind = { id: nid[1].length === 11 ? 2 : 1, label: nid[1].length === 11 ? "حقوقی" : "حقیقی" };
    rest = rest.replace(nid[0], " ");
  }
  const name = rest.replace(/[،,؛;]+/g, " ").replace(/\s+/g, " ").trim();
  if (name) out.name = name;
  return out;
}

/** «حواله / فاکتور»: فقط مشتری از متن خوانده می‌شود (مبنا را موتور با دکمه می‌پرسد) */
function extractCustomerOnly(text: string, state: ChatState): Record<string, SlotValue> {
  if (state.pending && state.pending.slot !== "customer") return {};
  const t = text
    .replace(/صدور|صادر|ثبت|ایجاد|بزن|بساز|کن|یک|جدید|حواله|فاکتور|صورتحساب|فروش|مشتری|برای|\?|؟/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? { customer: { text: t } } : {};
}

const AMOUNT_MULT: Record<string, number> = { هزار: 1e3, میلیون: 1e6, میلیارد: 1e9 };
// مبلغ فقط با کلمه‌ی «مبلغ» یا با واحد (هزار/میلیون/میلیارد/تومان/ریال) شناخته می‌شود؛ عدد بی‌واحد ممکن است کد مشتری باشد
const RE_AMOUNT_A = /مبلغ\s*(\d[\d,]*(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)?\s*(تومان|ریال)?/;
const RE_AMOUNT_B = /(\d[\d,]*(?:\.\d+)?)\s*(میلیارد|میلیون|هزار)\s*(تومان|ریال)?|(\d[\d,]*(?:\.\d+)?)\s*(تومان|ریال)/;

/** مبلغ بر حسب ارز پایه (ریال): «تومان» ×۱۰ می‌شود (ارز پایه‌ی این سامانه ریال است) */
function parseAmount(text: string): { value: number; match: string } | null {
  const a = RE_AMOUNT_A.exec(text);
  const b = a ? null : RE_AMOUNT_B.exec(text);
  const m = a ?? b;
  if (!m) return null;
  const numText = a ? m[1] : m[1] ?? m[4];
  const mult = m[2];
  const unit = a ? m[3] : m[3] ?? m[5];
  const n = Number(String(numText).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return { value: n * (mult ? AMOUNT_MULT[mult] : 1) * (unit === "تومان" ? 10 : 1), match: m[0] };
}

/** «رسید دریافت از شرکت X مبلغ ۵۰ میلیون»: مشتری + مبلغ اختیاری */
function extractReceipt(text: string, state: ChatState): Record<string, SlotValue> {
  // پاسخ به سؤال «شرح» (دستور میانبر با «حتماً بپرس»): کل متن همان شرح است
  if (state.pending?.slot === "description") return { description: SKIP_WORDS.test(text.trim()) ? "" : text.trim() };
  // پاسخ به سؤال «مبلغ» (دستور میانبر): کل متن مبلغ است («۵ میلیون» یا عدد ساده)
  if (state.pending?.slot === "amount") {
    const a = parseAmount(text);
    if (a) return { amount: a.value };
    const n = Number(text.replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    return Number.isFinite(n) && n > 0 ? { amount: n } : {};
  }
  if (state.pending && state.pending.slot !== "customer") return {};
  const out: Record<string, SlotValue> = {};
  let rest = text;
  const amt = parseAmount(rest);
  if (amt) {
    out.amount = amt.value;
    rest = rest.replace(amt.match, " ");
  }
  // کلمه‌های دستور فقط به‌صورت واژه‌ی کامل حذف می‌شوند (وگرنه «از» از وسط «بازرگانی» هم برداشته می‌شد)
  const t = rest
    .replace(/(?:^|\s)(?:ثبت|صدور|صادر|ایجاد|بزن|بساز|کن|یک|جدید|رسید|دریافت|وجه|از|مشتری|برای|مبلغ)(?=\s|$)/g, " ")
    .replace(/[?؟]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t) out.customer = { text: t };
  return out;
}

/** «اعلامیه پرداخت به شرکت X مبلغ ۵۰ میلیون»: طرف حساب + مبلغ اختیاری */
function extractPayment(text: string, state: ChatState): Record<string, SlotValue> {
  if (state.pending?.slot === "description") return { description: SKIP_WORDS.test(text.trim()) ? "" : text.trim() };
  if (state.pending?.slot === "amount") {
    const a = parseAmount(text);
    if (a) return { amount: a.value };
    const n = Number(text.replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    return Number.isFinite(n) && n > 0 ? { amount: n } : {};
  }
  if (state.pending && state.pending.slot !== "party") return {};
  const out: Record<string, SlotValue> = {};
  let rest = text;
  const amt = parseAmount(rest);
  if (amt) {
    out.amount = amt.value;
    rest = rest.replace(amt.match, " ");
  }
  const t = rest
    .replace(/(?:^|\s)(?:ثبت|صدور|صادر|ایجاد|بزن|بساز|کن|یک|جدید|اعلامیه|پرداخت|وجه|به|طرف|حساب|مبلغ)(?=\s|$)/g, " ")
    .replace(/[?؟]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t) out.party = { text: t };
  return out;
}

/** «تایید پیش‌فاکتور 131» / «… برای شرکت X»: شماره یا مشتری؛ خودِ پیش‌فاکتور را موتور با دکمه می‌پرسد */
function extractApproveQuote(text: string, state: ChatState): Record<string, SlotValue> {
  if (state.pending && state.pending.slot !== "customer" && state.pending.slot !== "quoteNumber") return {};
  const t = text
    .replace(/تایید|تأیید|تائید|پیش[\s‌]?فاکتور|شماره|\?|؟/g, " ")
    .replace(/(?:^|\s)(?:کن|را|رو|شود)(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out: Record<string, SlotValue> = {};
  const c = /(?:برای|مشتری)\s+(.+)$/.exec(t);
  if (c) out.customer = { text: c[1].trim() };
  else {
    const n = /(?:^|\s)(\d+)(?=\s|$)/.exec(t);
    if (n) out.quoteNumber = n[1];
  }
  return out;
}

function extractStock(text: string): Record<string, SlotValue> {
  const t = text
    .replace(/موجودی|مانده\s?کالا|چقدر|داریم|موجود|است|کالای|کالا|\?|؟/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? { item: { text: t } } : {};
}

function extractCustomerInvoices(text: string): Record<string, SlotValue> {
  const t = text
    .replace(/آخرین|اخیر|فاکتورهای|فاکتور‌های|فاکتورها|فاکتور|مشتری|برای|\?|؟/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? { customer: { text: t } } : {};
}

export const ruleInterpreter: Interpreter = {
  async interpret(rawText: string, _ctx, actions: ActionDef[], state: ChatState): Promise<Interpretation> {
    const text = norm(rawText);
    if (CANCEL.test(text)) return { actionKey: null, slots: {}, cancel: true };
    const probe = forIntent(rawText);
    const allowed = new Set(actions.map((a) => a.key));
    // دستور میانبر شرکت (فقط در شروع گفتگو، نه وسط پرسش): همان کار با مقدارهای از پیش‌تعیین‌شده؛ مقدارِ صریحِ خود کاربر مقدم است
    if (!state.pending) {
      const macro = await findMacroForUser(_ctx.userId, macroKey(rawText));
      if (macro && allowed.has(macro.actionKey)) {
        let cut = text.length;
        for (let i = 1; i <= text.length; i++) {
          if (macroKey(text.slice(0, i)) === macro.key) {
            cut = i;
            break;
          }
        }
        const rest = text.slice(cut).trim();
        const slots: Record<string, SlotValue> =
          macro.actionKey === "sales-quote" ? extractQuote(rest, { ...state, pending: null }) : macro.actionKey === "receipt" ? extractReceipt(rest, { ...state, pending: null }) : macro.actionKey === "payment" ? extractPayment(rest, { ...state, pending: null }) : {};
        if (macro.salesType && !slots.salesType) slots.salesType = macro.salesType;
        if (macro.salesCenter && !slots.salesCenter) slots.salesCenter = macro.salesCenter;
        if (macro.description && slots.description === undefined) slots.description = macro.description;
        if (macro.discountPercent && slots.discountPercent === undefined) slots.discountPercent = macro.discountPercent;
        if (macro.actionKey === "receipt" && macro.hasReceiptPreset) slots.macroId = macro.id;
        // مشتریِ ثابتِ ماکروی رسید از متن کاربر مقدم است (ثابت = تغییر نمی‌کند)
        if (macro.actionKey === "receipt" && macro.receiptCustomer) slots.customer = macro.receiptCustomer;
        if (macro.actionKey === "payment" && macro.hasPaymentPreset) slots.macroId = macro.id;
        // طرف حسابِ ثابتِ ماکروی پرداخت هم از متن کاربر مقدم است
        if (macro.actionKey === "payment" && macro.paymentParty) slots.party = macro.paymentParty;
        // ابزار و موضوع که انتخاب شده باشد، مبلغ بعداً در فرم قابل ویرایش نیست؛ پس مبلغ همین‌جا پرسیده می‌شود
        const ask = [...macro.askFields, ...((macro.actionKey === "receipt" && macro.hasReceiptPreset) || (macro.actionKey === "payment" && macro.hasPaymentPreset) ? ["amount"] : [])];
        // اقلام ثابتِ دستور؛ اگر کاربر هم اقلامی گفته، به آن‌ها اضافه می‌شود
        if (macro.lines.length) slots.lines = [...macro.lines.map((l): LineValue => (l.quantity === null ? { ref: l.ref, quantity: 1, askQty: true } : { ref: l.ref, quantity: l.quantity })), ...((slots.lines as LineValue[] | undefined) ?? [])];
        return { actionKey: macro.actionKey, slots, ask: ask.length ? ask : undefined };
      }
    }
    const hit = INTENTS.find((i) => allowed.has(i.key) && i.re.test(probe));
    const key = hit?.key ?? state.actionKey;
    if (!key) return { actionKey: null, slots: {} };
    // «پیش‌فاکتور» از ابتدای متن برداشته می‌شود تا قطعه‌ی اول درست خوانده شود
    const body = hit ? text.replace(/^(?:یک\s+)?(?:پیش[\s‌]?فاکتور(?:\s+جدید)?|استعلام\s?قیمت|قیمت\s?بده)\s*/, "") : text;
    let slots: Record<string, SlotValue> = {};
    if (key === "sales-quote") slots = extractQuote(body, hit ? { ...state, pending: null } : state);
    else if (key === "create-customer") slots = extractCustomer(body, hit ? { ...state, pending: null } : state);
    else if (key === "approve-quote") slots = extractApproveQuote(body, hit ? { ...state, pending: null } : state);
    else if (key === "sales-delivery" || key === "sales-invoice") slots = extractCustomerOnly(body, hit ? { ...state, pending: null } : state);
    else if (key === "receipt") slots = extractReceipt(body, hit ? { ...state, pending: null } : state);
    else if (key === "payment") slots = extractPayment(body, hit ? { ...state, pending: null } : state);
    else if (key === "stock") slots = hit || state.pending ? extractStock(body) : {};
    else if (key === "customer-invoices") slots = hit || state.pending ? extractCustomerInvoices(body) : {};
    return { actionKey: key, slots };
  },
};
