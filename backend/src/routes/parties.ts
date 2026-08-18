import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode, resolveDetailCode } from "../utils/coding";

const DETAIL_TYPE_PARTY = 1;

const router = Router();

router.get("/", async (req, res) => {
  const { category } = req.query as { category?: "INDIVIDUAL" | "LEGAL" };
  const parties = await prisma.party.findMany({
    where: category ? { category } : undefined,
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

router.post("/", async (req, res) => {
  const body = req.body as {
    category: "INDIVIDUAL" | "LEGAL";
    nationality?: "LOCAL" | "FOREIGN";
    nationalId?: string;
    foreignId?: string;
    economicCode?: string;
    firstName?: string;
    lastName?: string;
    legalType?: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK";
    name?: string;
    confirmDuplicate?: boolean;
    detailCode?: string;
    isActive?: boolean;
  };

  if (body.category === "INDIVIDUAL") {
    if (!body.firstName || !body.lastName) {
      return res.status(400).json({ error: "نام و نام خانوادگی الزامی است" });
    }
  } else if (body.category === "LEGAL") {
    if (!body.name) return res.status(400).json({ error: "نام شخص حقوقی الزامی است" });
  } else {
    return res.status(400).json({ error: "نوع طرف‌حساب نامعتبر است" });
  }

  // کنترل نام تکراری (هشدار غیر بازدارنده)
  if (!body.confirmDuplicate) {
    const dup =
      body.category === "INDIVIDUAL"
        ? await prisma.party.findFirst({ where: { firstName: body.firstName, lastName: body.lastName } })
        : await prisma.party.findFirst({ where: { name: body.name } });
    if (dup) {
      return res.status(409).json({
        warning: true,
        error: "قبلا طرف‌حساب دیگری با همین عنوان تعریف شده است. آیا ادامه می‌دهید؟",
      });
    }
  }

  // کنترل تکراری بودن کد ملی / شناسه ملی / کد اقتصادی / شناسه فراگیر (هشدار غیر بازدارنده)
  if (!body.confirmDuplicate) {
    const orConds: any[] = [];
    if (body.nationalId) orConds.push({ nationalId: body.nationalId });
    if (body.foreignId) orConds.push({ foreignId: body.foreignId });
    if (body.economicCode) orConds.push({ economicCode: body.economicCode });
    if (orConds.length) {
      const dup = await prisma.party.findFirst({ where: { OR: orConds } });
      if (dup) {
        return res.status(409).json({
          warning: true,
          error: "قبلا طرف‌حساب دیگری با همین کد ملی/شناسه ملی/کد اقتصادی تعریف شده است. آیا ادامه می‌دهید؟",
        });
      }
    }
  }

  let code: string, detailTypeId: number;
  try {
    ({ code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_PARTY, body.detailCode));

    const party = await prisma.party.create({
      data: {
        detailCode: code,
        category: body.category,
        nationality: body.nationality ?? "LOCAL",
        nationalId: body.nationality === "FOREIGN" ? null : body.nationalId,
        foreignId: body.nationality === "FOREIGN" ? body.foreignId : null,
        economicCode: body.economicCode || null,
        firstName: body.category === "INDIVIDUAL" ? body.firstName : null,
        lastName: body.category === "INDIVIDUAL" ? body.lastName : null,
        legalType: body.category === "LEGAL" ? body.legalType : null,
        name: body.category === "LEGAL" ? body.name : null,
        isActive: body.isActive ?? true,
      },
    });
    await registerDetailCode(code, detailTypeId, "Party", party.id);

    res.status(201).json(party);
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(400).json({ error: "یکی از فیلدهای یکتا (کد ملی/شناسه ملی/کد اقتصادی/کد تفصیل) تکراری است" });
    }
    res.status(400).json({ error: e.message || "خطا در ثبت طرف‌حساب" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
  if (party.hasTransactions) {
    return res.status(400).json({ error: "این طرف‌حساب گردش دارد و قابل حذف نیست" });
  }
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Party", entityId: id } }),
    prisma.party.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    nationality?: "LOCAL" | "FOREIGN";
    nationalId?: string;
    foreignId?: string;
    economicCode?: string;
    firstName?: string;
    lastName?: string;
    legalType?: "LEGAL" | "SPECIAL_PARTNERSHIP" | "BANK";
    name?: string;
    isActive?: boolean;
  };

  const party = await prisma.party.findUnique({ where: { id } });
  if (!party) return res.status(404).json({ error: "طرف‌حساب یافت نشد" });

  const updated = await prisma.party.update({
    where: { id },
    data: {
      nationality: body.nationality,
      nationalId: body.nationality === "FOREIGN" ? null : body.nationalId,
      foreignId: body.nationality === "FOREIGN" ? body.foreignId : null,
      economicCode: body.economicCode,
      firstName: party.category === "INDIVIDUAL" ? body.firstName : undefined,
      lastName: party.category === "INDIVIDUAL" ? body.lastName : undefined,
      legalType: party.category === "LEGAL" ? body.legalType : undefined,
      name: party.category === "LEGAL" ? body.name : undefined,
      isActive: body.isActive,
    },
  });
  res.json(updated);
});

// --- تب نشانی ---
router.post("/:id/addresses", async (req, res) => {
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

router.put("/:id/addresses/:addressId", async (req, res) => {
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

router.delete("/:id/addresses/:addressId", async (req, res) => {
  await prisma.partyAddress.delete({ where: { id: Number(req.params.addressId) } });
  res.status(204).send();
});

// --- تب تلفن ---
router.post("/:id/phones", async (req, res) => {
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

router.put("/:id/phones/:phoneId", async (req, res) => {
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

router.delete("/:id/phones/:phoneId", async (req, res) => {
  await prisma.partyPhone.delete({ where: { id: Number(req.params.phoneId) } });
  res.status(204).send();
});

// --- تب حساب بانکی (اطلاعات بانکی طرف‌حساب، نه حساب بانکی داخلی شرکت) ---
router.post("/:id/bank-accounts", async (req, res) => {
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

router.put("/:id/bank-accounts/:bankAccountId", async (req, res) => {
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

router.delete("/:id/bank-accounts/:bankAccountId", async (req, res) => {
  await prisma.partyBankAccount.delete({ where: { id: Number(req.params.bankAccountId) } });
  res.status(204).send();
});

export default router;
