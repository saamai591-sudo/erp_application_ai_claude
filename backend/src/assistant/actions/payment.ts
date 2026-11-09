import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { ActionDef, EntityRef } from "../types";
import { loadPaymentPreset } from "../../services/assistantMacroService";

// «ثبت اعلامیه پرداخت»: طرف حساب (و اگر کاربر گفت، مبلغ) ← فرم «اعلامیه پرداخت» با طرف حساب و مبلغ ردیف اول ابزار پیش‌پر باز می‌شود.
// چیزی ثبت نمی‌شود؛ نوع ابزار (نقد/حواله/چک/چک انتقالی)، موضوعات پرداخت (نوع پرداخت، مبنا و ...) و ذخیره با کاربر است، مگر آنچه دستور میانبر از پیش تعیین کرده باشد.

const PAYMENTS = findFormPrefix("payments");

export const paymentAction: ActionDef = {
  key: "payment",
  title: "ثبت اعلامیه پرداخت",
  description: "فرم اعلامیه پرداخت را برای یک طرف حساب (و در صورت گفتن، با مبلغ) باز می‌کند؛ نوع ابزار، موضوعات پرداخت و ذخیره با خود شماست.",
  examples: ["اعلامیه پرداخت به شرکت پارسیان", "ثبت پرداخت به تامین‌کننده 1023 مبلغ 50 میلیون ریال"],
  permissions: [`${PAYMENTS}.create`],
  slots: [
    { name: "party", title: "طرف حساب", type: "party", required: true, prompt: "پرداخت به کدام طرف حساب است؟ (نام یا کد تفصیل)" },
    { name: "amount", title: "مبلغ", type: "number", required: false, prompt: "مبلغ پرداخت را بگویید (ریال؛ مثلاً «۵۰ میلیون»):" },
    // فقط از دستور میانبر پر یا پرسیده می‌شود (شرح ثابت / «حتماً بپرس»)
    { name: "description", title: "شرح", type: "text", prompt: "شرح پرداخت را بگویید (یا «رد» بزنید):" },
    // شناسه‌ی دستور میانبر دارای ابزار/موضوعات پیش‌تعیین‌شده (فقط از ماکرو پر می‌شود؛ در run دوباره با نقش کاربر کنترل می‌شود)
    { name: "macroId", title: "دستور", type: "number", required: false },
  ],
  async run(ctx, s) {
    const party = s.party as EntityRef;
    const p = await prisma.party.findFirst({ where: { id: party.id, isActive: true }, select: { id: true, detailTitle: true } });
    if (!p) return [{ type: "text", text: "طرف حساب یافت نشد." }];
    const amount = typeof s.amount === "number" && s.amount > 0 ? Math.round(s.amount) : null;
    const base = await prisma.currency.findFirst({ where: { isBase: true }, select: { title: true } });
    const amountText = amount ? ` به مبلغ ${amount.toLocaleString("fa-IR")} ${base?.title ?? ""}`.trimEnd() : "";
    const preset = typeof s.macroId === "number" ? await loadPaymentPreset(ctx.userId, s.macroId) : null;
    return [
      { type: "text", text: `اعلامیه پرداخت به «${p.detailTitle}»${amountText} آماده شد. نوع ابزار (نقد، حواله، چک، …) و موضوعات پرداخت را در فرم مشخص کنید.` },
      {
        type: "prefill",
        label: "باز کردن اعلامیه پرداخت در فرم",
        path: "/payments/new",
        payload: { partyId: p.id, partyDisplay: p.detailTitle, description: typeof s.description === "string" ? s.description : "", amount, ...(preset ? { instruments: preset.instruments, subjects: preset.subjects } : {}) },
      },
    ];
  },
};
