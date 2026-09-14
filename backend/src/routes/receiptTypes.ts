import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("receipt-types");

// =========================================================================
// ماژول «خزانه‌داری» > تنظیمات > نوع دریافت — طبق Documents/ReceiptType.md.
//
// دو فیلد کلیدی: nature («این دریافت اساساً چه ماهیتی دارد» — از مشتری/پیش‌دریافت/از تامین‌کننده/از
// سایر/ارزش‌افزوده فروش/ارزش‌افزوده خرید) و basisType («این دریافت بر چه سندی مبتنی است»). طبق بند ۵
// مستند، مقادیر basisType مجاز به nature بستگی دارد — ALLOWED_BASIS_TYPES زیر تنها محل این قاعده است
// (هم برای اعتبارسنجی سرورساید، هم — از طریق همین فایل بودن تنها منبع حقیقت — برای فرانت‌اند که با
// دریافت کامل enum از بک‌اند گزینه‌ها را فیلتر می‌کند؛ نگاه کنید به ReceiptTypes.tsx).
//
// accountId (معین حسابداری) طبق بند ۶ مستند فقط برای basisType=NONE معنا دارد: در آن حالت الزامی است؛
// برای بقیه‌ی basisType ها نه‌فقط در UI مخفی می‌شود، بلکه سرور هم هرگز آن را ذخیره نمی‌کند (حتی اگر
// کلاینت مقداری بفرستد) — دقیقاً هم‌الگوی GROUPLESS_TYPES در routes/goodsAccounting.ts.
// =========================================================================

const ALLOWED_BASIS_TYPES: Record<string, string[]> = {
  CUSTOMER_RECEIPT: ["NONE", "SALES_INVOICE"],
  ADVANCE_RECEIPT: ["NONE", "SALES_ORDER", "PROFORMA_INVOICE"],
  SUPPLIER_RECEIPT: ["NONE", "PURCHASE_INVOICE"],
  SALES_VAT: ["NONE", "SALES_INVOICE"],
  PURCHASE_VAT: ["NONE", "PURCHASE_INVOICE"],
  OTHER_RECEIPT: ["NONE"],
};

const router = Router();

router.get("/receipt-types", async (_req, res) => {
  res.json(
    await prisma.receiptType.findMany({
      include: { account: { include: { level: true } } },
      orderBy: { code: "asc" },
    })
  );
});

router.post("/receipt-types", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title: string; nature: string; basisType: string; accountId?: number | null };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.nature) return res.status(400).json({ error: "نوع دریافت الزامی است" });
  if (!body.basisType) return res.status(400).json({ error: "نوع مبنا الزامی است" });

  const allowed = ALLOWED_BASIS_TYPES[body.nature];
  if (!allowed) return res.status(400).json({ error: "نوع دریافت نامعتبر است" });
  if (!allowed.includes(body.basisType)) {
    return res.status(400).json({ error: "نوع مبنای انتخاب‌شده با نوع دریافت سازگار نیست" });
  }

  const isNoBasis = body.basisType === "NONE";
  if (isNoBasis && !body.accountId) {
    return res.status(400).json({ error: "برای «بدون مبنا»، انتخاب معین حسابداری الزامی است" });
  }

  try {
    const dup = await prisma.receiptType.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    if (isNoBasis) {
      const account = await prisma.account.findUnique({ where: { id: body.accountId! }, include: { level: true } });
      if (!account || account.level.title !== "معین") {
        return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
      }
    }

    const finalCode = body.code ?? (await nextSerialNumber(prisma.receiptType, "code"));
    const created = await prisma.receiptType.create({
      data: {
        code: finalCode,
        title: body.title,
        nature: body.nature as any,
        basisType: body.basisType as any,
        accountId: isNoBasis ? body.accountId! : null,
      },
      include: { account: { include: { level: true } } },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت نوع دریافت" });
  }
});

router.put("/receipt-types/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; nature?: string; basisType?: string; accountId?: number | null; isActive?: boolean };

  const existing = await prisma.receiptType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع دریافت یافت نشد" });
  if (existing.hasTransactions && (body.nature !== undefined || body.basisType !== undefined || body.accountId !== undefined)) {
    return res.status(400).json({ error: "این نوع دریافت گردش دارد و نوع/مبنا/معین آن قابل ویرایش نیست" });
  }

  const nature = body.nature ?? existing.nature;
  const basisType = body.basisType ?? existing.basisType;

  if (body.title) {
    const dup = await prisma.receiptType.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  const allowed = ALLOWED_BASIS_TYPES[nature];
  if (!allowed) return res.status(400).json({ error: "نوع دریافت نامعتبر است" });
  if (!allowed.includes(basisType)) {
    return res.status(400).json({ error: "نوع مبنای انتخاب‌شده با نوع دریافت سازگار نیست" });
  }

  const isNoBasis = basisType === "NONE";
  const accountId = body.accountId !== undefined ? body.accountId : existing.accountId;
  if (isNoBasis && !accountId) {
    return res.status(400).json({ error: "برای «بدون مبنا»، انتخاب معین حسابداری الزامی است" });
  }

  try {
    if (isNoBasis && accountId) {
      const account = await prisma.account.findUnique({ where: { id: accountId }, include: { level: true } });
      if (!account || account.level.title !== "معین") {
        return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
      }
    }

    const updated = await prisma.receiptType.update({
      where: { id },
      data: {
        title: body.title,
        nature: body.nature as any,
        basisType: body.basisType as any,
        accountId: isNoBasis ? accountId : null,
        isActive: body.isActive,
      },
      include: { account: { include: { level: true } } },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش نوع دریافت" });
  }
});

router.delete("/receipt-types/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.receiptType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع دریافت یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این نوع دریافت گردش دارد و قابل حذف نیست" });
  try {
    await prisma.receiptType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این نوع دریافت در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف نوع دریافت" });
  }
});

export default router;
