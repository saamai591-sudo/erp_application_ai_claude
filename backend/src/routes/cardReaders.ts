import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { BANK_ACCOUNT_TITLE_INCLUDE, bankAccountDetailTitle } from "../utils/detailValues";
import { toEnglishDigits } from "../utils/digits";

// «کارتخوان» (مدیریت خزانه › تنظیمات): کد خودکار (آخرین کد + ۱)، شماره پایانه و شماره پذیرنده (رشته‌ی اجباری)، حساب بانکی و عنوان.
// فعلاً فقط تعریف پایه است؛ هنوز در دریافت/پرداخت استفاده نمی‌شود. حذف فقط وقتی ممکن است که جایی استفاده نشده باشد (FK از «موارد استفاده» گزارش می‌شود).

const FORM = findFormPrefix("card-readers");
const router = Router();

const INCLUDE = { bankAccount: { select: { id: true, detailCode: true, accountNumber: true, isActive: true, ...BANK_ACCOUNT_TITLE_INCLUDE } } };

function shape(r: any) {
  return {
    id: r.id,
    code: r.code,
    terminalNumber: r.terminalNumber,
    merchantNumber: r.merchantNumber,
    bankAccountId: r.bankAccountId,
    bankAccountCode: r.bankAccount?.detailCode ?? "",
    bankAccountTitle: r.bankAccount ? bankAccountDetailTitle(r.bankAccount) : "",
    title: r.title,
    updatedAt: r.updatedAt,
  };
}

/** رشته‌ی اجباری: فاصله‌ی ابتدا/انتها حذف و ارقام فارسی/عربی به انگلیسی تبدیل می‌شود (تا «۱۲۳» و «123» دو مقدار جدا نشوند)؛ صفرِ اول حفظ می‌شود */
function requiredText(raw: unknown, label: string, digits = false): string {
  let v = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (digits) v = toEnglishDigits(v);
  if (!v) throw new Error(`${label} الزامی است`);
  return v;
}

async function clean(body: any, existing?: { bankAccountId: number }) {
  const title = requiredText(body?.title, "عنوان");
  const terminalNumber = requiredText(body?.terminalNumber, "شماره پایانه", true);
  const merchantNumber = requiredText(body?.merchantNumber, "شماره پذیرنده", true);
  const bankAccountId = Number(body?.bankAccountId);
  if (!bankAccountId) throw new Error("حساب بانکی الزامی است");
  const acc = await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true, isActive: true } });
  if (!acc) throw new Error("حساب بانکی نامعتبر است");
  // حساب غیرفعال برای انتخاب تازه پذیرفته نمی‌شود؛ حسابِ قبلیِ همین کارتخوان (که بعداً غیرفعال شده) می‌ماند
  if (!acc.isActive && existing?.bankAccountId !== bankAccountId) throw new Error("حساب بانکی انتخاب‌شده غیرفعال است");
  return { title, terminalNumber, merchantNumber, bankAccountId };
}

async function assertNoDuplicate(d: { title: string; terminalNumber: string; merchantNumber: string }, excludeId?: number) {
  const notSelf = excludeId ? { NOT: { id: excludeId } } : {};
  if (await prisma.cardReader.findFirst({ where: { title: d.title, ...notSelf }, select: { id: true } })) throw new Error("عنوان تکراری است");
  if (await prisma.cardReader.findFirst({ where: { terminalNumber: d.terminalNumber, merchantNumber: d.merchantNumber, ...notSelf }, select: { id: true } })) {
    throw new Error("کارتخوانی با همین شماره پایانه و شماره پذیرنده قبلاً تعریف شده است");
  }
}

router.get("/", async (_req, res) => {
  const rows = await prisma.cardReader.findMany({ include: INCLUDE, orderBy: { code: "asc" } });
  res.json(rows.map(shape));
});

router.get("/:id", async (req, res) => {
  const r = await prisma.cardReader.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!r) return res.status(404).json({ error: "کارتخوان یافت نشد" });
  res.json(shape(r));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = await clean(req.body);
    await assertNoDuplicate(d);
    // کد = آخرین کد + ۱؛ هم‌زمانیِ دو ثبت با یکتایی کد و چند تلاش مجدد ایمن می‌شود
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const last = await tx.cardReader.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
          return tx.cardReader.create({ data: { code: (last?.code ?? 0) + 1, ...d }, include: INCLUDE });
        });
        return res.status(201).json(shape(created));
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3 && String(e?.meta?.target ?? "").includes("code")) continue;
        throw e;
      }
    }
  } catch (e: any) {
    res.status(400).json({ error: e?.code === "P2002" ? "عنوان یا شماره‌ی پایانه/پذیرنده تکراری است" : e?.message || "خطا در ثبت کارتخوان" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.cardReader.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "کارتخوان یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "کارتخوان");
    const d = await clean(req.body, ex);
    await assertNoDuplicate(d, id);
    // کد هرگز تغییر نمی‌کند
    const updated = await prisma.cardReader.update({ where: { id }, data: d, include: INCLUDE });
    res.json(shape(updated));
  } catch (e: any) {
    res.status(400).json({ error: e?.code === "P2002" ? "عنوان یا شماره‌ی پایانه/پذیرنده تکراری است" : e?.message || "خطا در ویرایش کارتخوان" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.cardReader.findUnique({ where: { id }, select: { id: true } });
    if (!ex) return res.status(404).json({ error: "کارتخوان یافت نشد" });
    await prisma.cardReader.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "خطا در حذف کارتخوان" });
  }
});

export default router;
