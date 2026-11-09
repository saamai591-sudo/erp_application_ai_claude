import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { ActionDef, EntityRef } from "../types";
import { loadReceiptPreset } from "../../services/assistantMacroService";

// «ثبت رسید دریافت»: مشتری (و اگر کاربر گفت، مبلغ) ← فرم «رسید دریافت» با طرف حساب و مبلغ ردیف اول ابزار پیش‌پر باز می‌شود.
// چیزی ثبت نمی‌شود؛ نوع ابزار (نقد/حواله/چک/پوز)، صندوق یا حساب بانکی، موضوعات دریافت (فاکتور و ...) و ذخیره با کاربر است.
// قالب payload همان ReceiptFromTaskPrefill (کارتابل) است + مبلغ اختیاری.

const RECEIPTS = findFormPrefix("receipts");

export const receiptAction: ActionDef = {
  key: "receipt",
  title: "ثبت رسید دریافت",
  description: "فرم رسید دریافت را برای یک مشتری (و در صورت گفتن، با مبلغ) باز می‌کند؛ نوع ابزار، موضوعات دریافت و ذخیره با خود شماست.",
  examples: ["رسید دریافت از شرکت پارسیان", "ثبت دریافت از مشتری 1023 مبلغ 50 میلیون ریال"],
  permissions: [`${RECEIPTS}.create`],
  slots: [
    { name: "customer", title: "مشتری", type: "customer", required: true, prompt: "رسید دریافت از کدام مشتری است؟ (نام یا کد)" },
    { name: "amount", title: "مبلغ", type: "number", required: false, prompt: "مبلغ رسید را بگویید (ریال؛ مثلاً «۵۰ میلیون»):" },
    // فقط از دستور میانبر پر یا پرسیده می‌شود (شرح ثابت / «حتماً بپرس»)
    { name: "description", title: "شرح", type: "text", prompt: "شرح رسید را بگویید (یا «رد» بزنید):" },
    // شناسه‌ی دستور میانبر دارای ابزار/موضوعات پیش‌تعیین‌شده (فقط از ماکرو پر می‌شود؛ در run دوباره با نقش کاربر کنترل می‌شود)
    { name: "macroId", title: "دستور", type: "number", required: false },
  ],
  async run(ctx, s) {
    const customer = s.customer as EntityRef;
    const cust = await prisma.customer.findUnique({ where: { id: customer.id }, select: { partyId: true, party: { select: { detailTitle: true } } } });
    if (!cust) return [{ type: "text", text: "مشتری یافت نشد." }];
    const amount = typeof s.amount === "number" && s.amount > 0 ? Math.round(s.amount) : null;
    const base = await prisma.currency.findFirst({ where: { isBase: true }, select: { title: true } });
    const amountText = amount ? ` به مبلغ ${amount.toLocaleString("fa-IR")} ${base?.title ?? ""}`.trimEnd() : "";
    const preset = typeof s.macroId === "number" ? await loadReceiptPreset(ctx.userId, s.macroId) : null;
    return [
      { type: "text", text: `رسید دریافت از «${customer.label}»${amountText} آماده شد. نوع ابزار (نقد، حواله، چک، …) و موضوعات دریافت را در فرم مشخص کنید.` },
      {
        type: "prefill",
        label: "باز کردن رسید دریافت در فرم",
        path: "/receipts/new",
        payload: { partyId: cust.partyId, partyDisplay: cust.party.detailTitle, description: typeof s.description === "string" ? s.description : "", amount, ...(preset ? { instruments: preset.instruments, subjects: preset.subjects } : {}) },
      },
    ];
  },
};
