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
    include: { addresses: { include: { city: true } }, phones: true, bankAccounts: true },
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

// --- تب نشانی ---
router.post("/:id/addresses", can(`${FORM}.edit`), async (req, res) => {
  const partyId = Number(req.params.id);
  const { type, cityId, address, postalCode, isPrimary } = req.body as {
    type: string;
    cityId: number;
    address?: string;
    postalCode?: string;
    isPrimary?: boolean;
  };

  if (isPrimary) {
    await prisma.partyAddress.updateMany({ where: { partyId }, data: { isPrimary: false } });
  }
  const created = await prisma.partyAddress.create({
    data: { partyId, type: type as any, cityId, address, postalCode, isPrimary: !!isPrimary },
  });
  res.status(201).json(created);
});

router.put("/:id/addresses/:addressId", can(`${FORM}.edit`), async (req, res) => {
  const partyId = Number(req.params.id);
  const addressId = Number(req.params.addressId);
  const { type, cityId, address, postalCode, isPrimary } = req.body as {
    type?: string;
    cityId?: number;
    address?: string;
    postalCode?: string;
    isPrimary?: boolean;
  };

  if (isPrimary) {
    await prisma.partyAddress.updateMany({ where: { partyId, NOT: { id: addressId } }, data: { isPrimary: false } });
  }
  const updated = await prisma.partyAddress.update({
    where: { id: addressId },
    data: { type: type as any, cityId, address, postalCode, isPrimary },
  });
  res.json(updated);
});

router.delete("/:id/addresses/:addressId", can(`${FORM}.edit`), async (req, res) => {
  await prisma.partyAddress.delete({ where: { id: Number(req.params.addressId) } });
  res.status(204).send();
});

// --- تب تلفن ---
router.post("/:id/phones", can(`${FORM}.edit`), async (req, res) => {
  const partyId = Number(req.params.id);
  const { type, number, isPrimary } = req.body as { type: string; number: string; isPrimary?: boolean };

  if (isPrimary) {
    await prisma.partyPhone.updateMany({ where: { partyId }, data: { isPrimary: false } });
  }
  const created = await prisma.partyPhone.create({
    data: { partyId, type: type as any, number, isPrimary: !!isPrimary },
  });
  res.status(201).json(created);
});

router.put("/:id/phones/:phoneId", can(`${FORM}.edit`), async (req, res) => {
  const partyId = Number(req.params.id);
  const phoneId = Number(req.params.phoneId);
  const { type, number, isPrimary } = req.body as { type?: string; number?: string; isPrimary?: boolean };

  if (isPrimary) {
    await prisma.partyPhone.updateMany({ where: { partyId, NOT: { id: phoneId } }, data: { isPrimary: false } });
  }
  const updated = await prisma.partyPhone.update({
    where: { id: phoneId },
    data: { type: type as any, number, isPrimary },
  });
  res.json(updated);
});

router.delete("/:id/phones/:phoneId", can(`${FORM}.edit`), async (req, res) => {
  await prisma.partyPhone.delete({ where: { id: Number(req.params.phoneId) } });
  res.status(204).send();
});

// --- تب حساب بانکی (اطلاعات بانکی طرف‌حساب، نه حساب بانکی داخلی شرکت) ---
router.post("/:id/bank-accounts", can(`${FORM}.edit`), async (req, res) => {
  const partyId = Number(req.params.id);
  const { bankPartyId, accountNumber, iban, cardNumber } = req.body as {
    bankPartyId?: number;
    accountNumber?: string;
    iban?: string;
    cardNumber?: string;
  };
  const created = await prisma.partyBankAccount.create({
    data: { partyId, bankPartyId, accountNumber, iban, cardNumber },
  });
  res.status(201).json(created);
});

router.put("/:id/bank-accounts/:bankAccountId", can(`${FORM}.edit`), async (req, res) => {
  const bankAccountId = Number(req.params.bankAccountId);
  const { bankPartyId, accountNumber, iban, cardNumber } = req.body as {
    bankPartyId?: number;
    accountNumber?: string;
    iban?: string;
    cardNumber?: string;
  };
  const updated = await prisma.partyBankAccount.update({
    where: { id: bankAccountId },
    data: { bankPartyId, accountNumber, iban, cardNumber },
  });
  res.json(updated);
});

router.delete("/:id/bank-accounts/:bankAccountId", can(`${FORM}.edit`), async (req, res) => {
  await prisma.partyBankAccount.delete({ where: { id: Number(req.params.bankAccountId) } });
  res.status(204).send();
});

export default router;
