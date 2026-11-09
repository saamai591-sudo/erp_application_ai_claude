import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { createCustomer, CustomerError } from "../../services/customerService";
import { findPartyByNationalId, PartyError, PartyInput } from "../../services/partyService";
import { norm } from "../text";
import { ActionDef, AssistantContext, Block, EntityRef } from "../types";

// «مشتری جدید»: تعریف طرف‌حساب (Party) + نقش مشتری از وسط یک گفتگو (مثلاً پیش‌فاکتور) یا مستقل. این اولین کار «ثبتی» دستیار است:
// run استفاده نمی‌شود؛ preview خلاصه را می‌سازد و فقط با کلیک کاربر روی «ثبت مشتری» execute اجرا می‌شود. ساخت از همان createCustomer/createParty فرم‌هاست
// (یکتایی کد/شناسه ملی و عنوان تفصیل، کد تفصیل خودکار). شخصی که از قبل با همان شناسه ملی هست دوباره ساخته نمی‌شود: اگر مشتری است همان انتخاب می‌شود،
// اگر نقش دیگری دارد (تأمین‌کننده/کارمند) فقط نقش مشتری به او اضافه می‌شود.

const CUSTOMERS = findFormPrefix("customers");

const KIND = { INDIVIDUAL: 1, LEGAL: 2 };
const kindOf = (s: Record<string, any>) => ((s.kind as EntityRef | undefined)?.id === KIND.LEGAL ? "LEGAL" : "INDIVIDUAL") as "INDIVIDUAL" | "LEGAL";
const digitsOnly = (v: string) => norm(v).replace(/\D/g, "");

function personInput(s: Record<string, any>): PartyInput {
  const category = kindOf(s);
  const name = norm(String(s.name ?? ""));
  const nid = digitsOnly(String(s.nationalId ?? ""));
  const mobile = digitsOnly(String(s.mobile ?? ""));
  const base: PartyInput = { category, nationalId: nid || null, phones: mobile ? [{ type: "MOBILE", number: mobile, isPrimary: true }] : undefined };
  if (category === "LEGAL") return { ...base, name };
  const parts = name.split(" ").filter(Boolean);
  return { ...base, lastName: parts[parts.length - 1], firstName: parts.slice(0, -1).join(" ") };
}

async function existingOf(nid: string) {
  if (!nid) return null;
  const p = await findPartyByNationalId(nid);
  if (!p) return null;
  const customer = await prisma.customer.findUnique({ where: { partyId: p.id }, select: { id: true, code: true } });
  return { party: p, customer };
}

export const createCustomerAction: ActionDef = {
  key: "create-customer",
  title: "مشتری جدید",
  description: "طرف‌حساب و مشتری جدید تعریف می‌کند (نوع، نام، کد ملی/شناسه ملی)؛ ثبت فقط با دکمه‌ی تایید شما انجام می‌شود.",
  examples: ["مشتری جدید شرکت آسمان، حقوقی، شناسه ملی 14001234567", "ثبت مشتری علی رضایی حقیقی کد ملی 0012345678"],
  permissions: [`${CUSTOMERS}.create`],
  slots: [
    { name: "kind", title: "نوع مشتری", type: "choice", required: true, prompt: "مشتری حقیقی است یا حقوقی؟", options: [{ id: KIND.INDIVIDUAL, label: "حقیقی" }, { id: KIND.LEGAL, label: "حقوقی" }] },
    {
      name: "name",
      title: "نام",
      type: "text",
      required: true,
      prompt: "نام مشتری را بنویسید (حقیقی: نام و نام‌خانوادگی؛ حقوقی: نام شرکت)",
      validate: (v, s) => (kindOf(s) === "INDIVIDUAL" && String(v).trim().split(/\s+/).length < 2 ? "برای مشتری حقیقی، نام و نام‌خانوادگی را با هم بنویسید." : String(v).trim().length < 2 ? "نام بسیار کوتاه است." : null),
    },
    {
      name: "nationalId",
      title: "کد ملی / شناسه ملی",
      type: "text",
      required: true,
      prompt: "کد ملی (حقیقی، ۱۰ رقم) یا شناسه ملی (حقوقی، ۱۱ رقم) را بنویسید. اگر ندارید بنویسید «رد».",
      validate: (v, s) => {
        const d = digitsOnly(String(v));
        if (!d) return null; // رد شده
        const len = kindOf(s) === "LEGAL" ? 11 : 10;
        return d.length === len ? null : `${kindOf(s) === "LEGAL" ? "شناسه ملی" : "کد ملی"} باید ${len} رقم باشد.`;
      },
    },
    { name: "mobile", title: "موبایل", type: "text", validate: (v) => (!digitsOnly(String(v)) || /^09\d{9}$/.test(digitsOnly(String(v))) ? null : "موبایل باید به شکل 09123456789 باشد.") },
  ],
  async run() {
    return [];
  },
  async preview(_ctx, s) {
    const nid = digitsOnly(String(s.nationalId ?? ""));
    const ex = await existingOf(nid);
    if (ex?.customer) {
      return { blocks: [{ type: "text", text: `این ${kindOf(s) === "LEGAL" ? "شناسه ملی" : "کد ملی"} از قبل برای «${ex.party.detailTitle}» ثبت شده و مشتری است؛ همان استفاده می‌شود.` }], existing: { id: ex.customer.id, label: `${ex.customer.code} — ${ex.party.detailTitle}` } };
    }
    const summary: { label: string; value: string }[] = [
      { label: "نوع", value: kindOf(s) === "LEGAL" ? "حقوقی" : "حقیقی" },
      { label: "نام", value: String(s.name) },
      { label: kindOf(s) === "LEGAL" ? "شناسه ملی" : "کد ملی", value: nid || "— (رد شد)" },
    ];
    if (s.mobile) summary.push({ label: "موبایل", value: digitsOnly(String(s.mobile)) });
    const blocks: Block[] = [];
    if (ex) blocks.push({ type: "text", text: `شخصی با این کد از قبل «${ex.party.detailTitle}» هست (نقش مشتری ندارد)؛ فقط نقش مشتری به او اضافه می‌شود و شخص جدیدی ساخته نمی‌شود.` });
    blocks.push({ type: "confirm", label: ex ? "افزودن نقش مشتری" : "ثبت مشتری", summary });
    return { blocks };
  },
  async execute(ctx: AssistantContext, s) {
    if (!(await ctx.can(`${CUSTOMERS}.create`))) return { blocks: [{ type: "text", text: "دسترسی ثبت مشتری را ندارید." }] };
    try {
      const nid = digitsOnly(String(s.nationalId ?? ""));
      const ex = await existingOf(nid);
      if (ex?.customer) return { blocks: [{ type: "text", text: `«${ex.party.detailTitle}» از قبل مشتری است.` }], result: { id: ex.customer.id, label: `${ex.customer.code} — ${ex.party.detailTitle}` } };
      const created = ex ? await createCustomer({ partyId: ex.party.id }) : await createCustomer({ party: personInput(s), autoDisambiguate: true });
      const party = await prisma.party.findUnique({ where: { id: created.partyId }, select: { detailTitle: true } });
      const label = `${created.code} — ${party?.detailTitle ?? ""}`;
      return { blocks: [{ type: "text", text: `مشتری «${label}» ثبت شد.` }], result: { id: created.id, label } };
    } catch (e: any) {
      if (e instanceof PartyError || e instanceof CustomerError) return { blocks: [{ type: "text", text: `ثبت نشد: ${e.message}` }] };
      throw e;
    }
  },
};
