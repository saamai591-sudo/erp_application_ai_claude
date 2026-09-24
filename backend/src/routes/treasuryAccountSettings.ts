import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// =========================================================================
// ماژول «خزانه‌داری» > تنظیمات > تعیین حسابهای معین — طبق Documents/تعیین حسابهای معین.md.
//
// هر رکورد یک «مورد خزانه‌داری» را به یک «حساب معین» نگاشت می‌کند. نوع حساب (accountType) تعیین می‌کند
// کدام فیلد هدف نمایش داده و انتخاب شود (TARGET_FIELD — تنها منبع این قاعده؛ فرانت‌اند نسخه‌ی هم‌راستای
// آن را دارد). دقیقاً همان یک فیلد هدف ذخیره می‌شود و بقیه همیشه null‌اند (حتی اگر کلاینت بفرستد).
// «حساب بانکی» و «کارمزد بانکی» هر دو از فیلد bankAccountId استفاده می‌کنند و با accountType از هم جدا
// می‌شوند. برای هر (نوع حساب، مورد) فقط یک معین مجاز است.
// FX_GAIN_LOSS («سود و زیان تسعیر ارز») هیچ مورد هدفی ندارد (مقدار TARGET_FIELD آن null است) و کلاً فقط
// یک رکورد از آن مجاز است؛ در صدور سند رسید دریافت، سود روی آن بستانکار و زیان روی آن بدهکار می‌شود.
// =========================================================================

const FORM = findFormPrefix("treasury-account-settings");

const TARGET_FIELD: Record<string, string | null> = {
  BANK_ACCOUNT: "bankAccountId",
  BANK_FEE: "bankAccountId",
  CASH_BOX: "cashBoxId",
  RECEIVABLE_CHEQUE: "receivableChequeTypeId",
  PAYABLE_CHEQUE: "payableChequeTypeId",
  RECEIPT_SUBJECT: "receiptTypeId",
  PAYMENT_SUBJECT: "paymentTypeId",
  CHEQUE_IN_COLLECTION: "bankAccountId",
  FX_GAIN_LOSS: null,
  BOUNCED_PAYABLE_CHEQUE: null,
};

const TARGET_LABEL: Record<string, string> = {
  bankAccountId: "حساب بانکی",
  cashBoxId: "صندوق",
  receivableChequeTypeId: "نوع چک دریافتی",
  payableChequeTypeId: "نوع چک پرداختی",
  receiptTypeId: "موضوع دریافت",
  paymentTypeId: "موضوع پرداخت",
};

// موضوع دریافت/پرداختی که مبنایش فاکتور است، معین را از خودِ سند مبنا می‌گیرد (دریافتنی فروش/پرداختنی خرید
// در حسابداری کالا و خدمت)، پس نباید اینجا معین جدا داشته باشد — هم در UI نمایش داده نمی‌شود و هم سرور رد می‌کند.
const BASIS_FROM_DOCUMENT = new Set(["SALES_INVOICE", "PURCHASE_INVOICE"]);

const TARGET_EXISTS: Record<string, (id: number) => Promise<any>> = {
  bankAccountId: (id) => prisma.bankAccount.findUnique({ where: { id } }),
  cashBoxId: (id) => prisma.cashBox.findUnique({ where: { id } }),
  receivableChequeTypeId: (id) => prisma.receivableChequeType.findUnique({ where: { id } }),
  payableChequeTypeId: (id) => prisma.payableChequeType.findUnique({ where: { id } }),
  receiptTypeId: (id) => prisma.receiptType.findUnique({ where: { id } }),
  paymentTypeId: (id) => prisma.paymentType.findUnique({ where: { id } }),
};

const INCLUDE = {
  account: { include: { level: true } },
  bankAccount: { include: { bankBranch: true } },
  cashBox: true,
  receivableChequeType: true,
  payableChequeType: true,
  receiptType: true,
  paymentType: true,
};

interface Body {
  accountType?: string;
  accountId?: number;
  bankAccountId?: number | null;
  cashBoxId?: number | null;
  receivableChequeTypeId?: number | null;
  payableChequeTypeId?: number | null;
  receiptTypeId?: number | null;
  paymentTypeId?: number | null;
}

// اعتبارسنجی مشترک POST/PUT روی مقدار «نهایی» (بدنه‌ی ادغام‌شده با رکورد موجود) و ساخت داده‌ی قابل ذخیره
async function buildData(b: Body, excludeId?: number) {
  const accountType = b.accountType;
  if (!accountType || !(accountType in TARGET_FIELD)) throw new Error("نوع حساب الزامی/نامعتبر است");
  const field = TARGET_FIELD[accountType];
  let targetId: number | null | undefined = null;
  if (field) {
    const label = TARGET_LABEL[field];
    targetId = (b as any)[field] as number | null | undefined;
    if (!targetId) throw new Error(`برای این نوع حساب، انتخاب ${label} الزامی است`);
  }
  if (!b.accountId) throw new Error("انتخاب حساب معین الزامی است");

  if (field) {
    const target = await TARGET_EXISTS[field](targetId!);
    if (!target) throw new Error(`${TARGET_LABEL[field]} یافت نشد`);
    if ((field === "receiptTypeId" || field === "paymentTypeId") && BASIS_FROM_DOCUMENT.has(target.basisType)) {
      throw new Error(`معین این ${TARGET_LABEL[field]} از سند مبنا تعیین می‌شود و نیازی به تعیین در اینجا نیست`);
    }
  }
  // همان قاعده‌ی «حساب قابل ثبت در سند حسابداری» (routes/journalEntries.ts#validateAccountForLine): آخرین سطح
  // درخت حساب‌ها — سطح ۳ به بعد و بدون زیرحساب — نه لزوماً سطح «معین».
  const account = await prisma.account.findUnique({ where: { id: b.accountId }, include: { level: true } });
  if (!account) throw new Error("حساب انتخاب‌شده یافت نشد");
  if (account.level.order < 3) throw new Error(`حساب «${account.title}» در سطح گروه/کل است و قابل انتخاب نیست`);
  if (await prisma.account.findFirst({ where: { parentId: account.id } })) {
    throw new Error(`حساب «${account.title}» دارای زیرحساب است؛ باید حسابی از آخرین سطح انتخاب شود`);
  }

  const dup = await prisma.treasuryAccountSetting.findFirst({
    where: { accountType: accountType as any, ...(field ? { [field]: targetId } : {}), ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (dup) throw new Error(field ? "برای این نوع حساب و این مورد، قبلاً معین تعیین شده است" : "برای این نوع حساب قبلاً معین تعیین شده است");

  const data: Record<string, unknown> = { accountType, accountId: b.accountId };
  for (const f of Object.keys(TARGET_LABEL)) data[f] = f === field ? targetId : null;
  return data;
}

const router = Router();

router.get("/treasury-account-settings", async (_req, res) => {
  res.json(await prisma.treasuryAccountSetting.findMany({ include: INCLUDE, orderBy: { id: "asc" } }));
});

router.post("/treasury-account-settings", can(`${FORM}.create`), async (req, res) => {
  try {
    const data = await buildData(req.body as Body);
    res.status(201).json(await prisma.treasuryAccountSetting.create({ data: data as any, include: INCLUDE }));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این نوع حساب و این مورد، قبلاً معین تعیین شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت" });
  }
});

router.put("/treasury-account-settings/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.treasuryAccountSetting.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "رکورد یافت نشد" });
  try {
    // اگر نوع حساب عوض شود، هدف قبلی (مربوط به نوع قبلی) نباید به نوع جدید نشت کند؛ فقط بدنه ملاک است
    const b = req.body as Body;
    const merged: Body = b.accountType && b.accountType !== existing.accountType ? b : { ...existing, ...b };
    const data = await buildData(merged, id);
    res.json(await prisma.treasuryAccountSetting.update({ where: { id }, data: data as any, include: INCLUDE }));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "برای این نوع حساب و این مورد، قبلاً معین تعیین شده است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش" });
  }
});

router.delete("/treasury-account-settings/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.treasuryAccountSetting.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "رکورد یافت نشد" });
  await prisma.treasuryAccountSetting.delete({ where: { id } });
  res.status(204).send();
});

export default router;
