import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createParty, updateParty, findPartyByNationalId, PartyError, PartyWarning } from "../services/partyService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("parties");

const router = Router();

router.get("/", async (req, res) => {
  const { category, customersOnly, suppliersOnly } = req.query as {
    category?: "INDIVIDUAL" | "LEGAL";
    customersOnly?: string;
    suppliersOnly?: string;
  };
  const parties = await prisma.party.findMany({
    where: {
      ...(category ? { category } : {}),
      // برای پیکرهایی مثل «طرف مقابل» حواله فروش که فقط طرف‌حساب‌های ثبت‌شده به‌عنوان «مشتری» باید
      // قابل انتخاب باشند — دقیقاً هم‌الگوی رابطه‌ی یک‌به‌یک Party↔Customer
      ...(customersOnly === "true" ? { customer: { isNot: null } } : {}),
      // همان الگو برای «طرف مقابل» فاکتور خرید — فقط طرف‌حساب‌های ثبت‌شده به‌عنوان «تامین‌کننده»
      ...(suppliersOnly === "true" ? { supplier: { isNot: null } } : {}),
    },
    include: { addresses: true, phones: true, bankAccounts: true },
    orderBy: { detailCode: "asc" },
  });
  res.json(parties);
});

router.get("/:id", async (req, res) => {
  const party = await prisma.party.findUnique({
    where: { id: Number(req.params.id) },
    include: { addresses: { include: { city: true } }, phones: true, contacts: { orderBy: { id: "asc" } }, bankAccounts: true },
  });
  if (!party) return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
  res.json(party);
});

// جستجوی شخص با کد ملی/شناسه ملی (فرم‌های تعریف سریع: «این شخص قبلاً ثبت شده؟»)؛ نقش‌های فعلی شخص هم برمی‌گردد
router.get("/lookup/by-national-id", async (req, res) => {
  const found = await findPartyByNationalId(String(req.query.nationalId ?? ""));
  res.json(found);
});

function partyFail(res: any, e: any, fallback: string) {
  if (e instanceof PartyWarning) return res.status(409).json({ warning: true, error: e.message });
  if (e instanceof PartyError) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
}

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const party = await createParty(req.body, { confirmDuplicate: !!req.body.confirmDuplicate });
    res.status(201).json(party);
  } catch (e: any) {
    partyFail(res, e, "خطا در ثبت طرف‌حساب");
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
  if (party.hasTransactions) {
    return res.status(400).json({ error: "این طرف‌حساب گردش دارد و قابل حذف نیست" });
  }
  if (await prisma.employee.findUnique({ where: { partyId: id }, select: { id: true } })) {
    return res.status(400).json({ error: "این شخص به‌عنوان کارمند ثبت شده است؛ ابتدا کارمند را حذف کنید" });
  }
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Party", entityId: id } }),
    prisma.party.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const updated = await updateParty(Number(req.params.id), req.body, { confirmDuplicate: !!req.body.confirmDuplicate });
    res.json(updated);
  } catch (e: any) {
    if (e instanceof PartyError && e.message === "طرف‌حساب یافت نشد") return res.status(404).json({ error: e.message });
    partyFail(res, e, "خطا در ویرایش طرف‌حساب");
  }
});

export default router;
