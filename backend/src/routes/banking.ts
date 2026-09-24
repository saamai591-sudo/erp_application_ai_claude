import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode, nextSerialNumber } from "../utils/coding";
import { bankAccountDetailTitle } from "../utils/detailValues";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const DETAIL_TYPE_BANK_ACCOUNT = 4;
const BANK_ACCOUNT_TYPES = findFormPrefix("bank-account-types");
const BANK_BRANCHES = findFormPrefix("bank-branches");
const BANK_ACCOUNTS = findFormPrefix("bank-accounts");
const router = Router();

// ---------- نوع حساب بانکی ----------
router.get("/account-types", async (_req, res) => {
  res.json(await prisma.bankAccountType.findMany({ orderBy: { code: "asc" } }));
});

router.post("/account-types", can(`${BANK_ACCOUNT_TYPES}.create`), async (req, res) => {
  const { code, title, hasChequeBook } = req.body as { code?: number; title: string; hasChequeBook?: boolean };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  const dupTitle = await prisma.bankAccountType.findUnique({ where: { title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

  const finalCode = code ?? (await nextSerialNumber(prisma.bankAccountType, "code"));
  const created = await prisma.bankAccountType.create({
    data: { code: finalCode, title, hasChequeBook: !!hasChequeBook },
  });
  res.status(201).json(created);
});

router.put("/account-types/:id", can(`${BANK_ACCOUNT_TYPES}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title, hasChequeBook } = req.body as { title?: string; hasChequeBook?: boolean };
  if (title) {
    const dup = await prisma.bankAccountType.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }
  const updated = await prisma.bankAccountType.update({ where: { id }, data: { title, hasChequeBook } });
  res.json(updated);
});

router.delete("/account-types/:id", can(`${BANK_ACCOUNT_TYPES}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const inUse = await prisma.bankAccount.findFirst({ where: { accountTypeId: id } });
  if (inUse) return res.status(400).json({ error: "این نوع حساب بانکی استفاده شده و قابل حذف نیست" });
  try {
    await prisma.bankAccountType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این نوع حساب بانکی استفاده شده و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف نوع حساب بانکی" });
  }
});

// ---------- شعبه بانک ----------
router.get("/branches", async (_req, res) => {
  res.json(await prisma.bankBranch.findMany({ include: { bankParty: true }, orderBy: { code: "asc" } }));
});

router.post("/branches", can(`${BANK_BRANCHES}.create`), async (req, res) => {
  const { code, title, bankPartyId } = req.body as { code?: number; title: string; bankPartyId: number };
  if (!title || !bankPartyId) return res.status(400).json({ error: "عنوان و بانک الزامی است" });

  const bankParty = await prisma.party.findUnique({ where: { id: bankPartyId } });
  if (!bankParty || bankParty.legalType !== "BANK") {
    return res.status(400).json({ error: "طرف‌حساب انتخاب شده از نوع بانک/موسسه مالی نیست" });
  }

  const dupTitle = await prisma.bankBranch.findUnique({ where: { title } });
  if (dupTitle) return res.status(400).json({ error: "عنوان تکراری است" });

  let finalCode = code;
  if (!finalCode) {
    const last = await prisma.bankBranch.findFirst({ where: { bankPartyId }, orderBy: { code: "desc" } });
    finalCode = last ? last.code + 1 : 1;
  }
  const dupCode = await prisma.bankBranch.findFirst({ where: { bankPartyId, code: finalCode } });
  if (dupCode) return res.status(400).json({ error: "کد در سطح این بانک تکراری است" });

  const created = await prisma.bankBranch.create({ data: { code: finalCode, title, bankPartyId } });
  res.status(201).json(created);
});

router.put("/branches/:id", can(`${BANK_BRANCHES}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { title } = req.body as { title?: string };
  if (title) {
    const dup = await prisma.bankBranch.findFirst({ where: { title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }
  const updated = await prisma.bankBranch.update({ where: { id }, data: { title } });
  res.json(updated);
});

router.delete("/branches/:id", can(`${BANK_BRANCHES}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.bankBranch.findUnique({ where: { id } });
  if (!branch) return res.status(404).json({ error: "شعبه بانک یافت نشد" });
  if (branch.hasTransactions) return res.status(400).json({ error: "این شعبه گردش دارد و قابل حذف نیست" });
  const inUse = await prisma.bankAccount.findFirst({ where: { bankBranchId: id } });
  if (inUse) return res.status(400).json({ error: "این شعبه دارای حساب بانکی ثبت‌شده است و قابل حذف نیست" });
  try {
    await prisma.bankBranch.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این شعبه در جایی استفاده شده و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف شعبه بانک" });
  }
});

// ---------- حساب بانکی ----------
router.get("/accounts", async (_req, res) => {
  const accounts = await prisma.bankAccount.findMany({
    include: { accountType: true, bankBranch: { include: { bankParty: true } }, currency: true },
    orderBy: { detailCode: "asc" },
  });
  // detailTitle: عنوان تفصیلی حساب بانکی (برای انتخابگر مشترک BankAccountPicker)
  res.json(accounts.map((a) => ({ ...a, detailTitle: bankAccountDetailTitle(a.accountNumber) })));
});

router.post("/accounts", can(`${BANK_ACCOUNTS}.create`), async (req, res) => {
  const { accountTypeId, bankBranchId, accountNumber, currencyId } = req.body as {
    accountTypeId: number;
    bankBranchId: number;
    accountNumber: string;
    currencyId?: number;
  };
  if (!accountTypeId || !bankBranchId || !accountNumber) {
    return res.status(400).json({ error: "نوع حساب، شعبه بانک و شماره حساب الزامی است" });
  }

  const branch = await prisma.bankBranch.findUnique({ where: { id: bankBranchId } });
  if (!branch) return res.status(404).json({ error: "شعبه بانک یافت نشد" });

  const dup = await prisma.bankAccount.findFirst({
    where: { bankPartyId: branch.bankPartyId, accountNumber },
  });
  if (dup) return res.status(400).json({ error: "شماره حساب در سطح این بانک تکراری است" });

  let finalCurrencyId = currencyId;
  if (!finalCurrencyId) {
    const base = await prisma.currency.findFirst({ where: { isBase: true } });
    finalCurrencyId = base?.id;
  }

  const { code, detailTypeId } = await generateDetailCode(DETAIL_TYPE_BANK_ACCOUNT);
  const created = await prisma.bankAccount.create({
    data: {
      detailCode: code,
      accountTypeId,
      bankBranchId,
      accountNumber,
      currencyId: finalCurrencyId,
      bankPartyId: branch.bankPartyId,
    },
  });
  await registerDetailCode(code, detailTypeId, "BankAccount", created.id);
  res.status(201).json(created);
});

router.put("/accounts/:id", can(`${BANK_ACCOUNTS}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const { accountTypeId, accountNumber, currencyId } = req.body as {
    accountTypeId?: number;
    accountNumber?: string;
    currencyId?: number;
  };

  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: "حساب بانکی یافت نشد" });

  if (accountNumber && accountNumber !== account.accountNumber) {
    const dup = await prisma.bankAccount.findFirst({
      where: { bankPartyId: account.bankPartyId, accountNumber, NOT: { id } },
    });
    if (dup) return res.status(400).json({ error: "شماره حساب در سطح این بانک تکراری است" });
  }

  const updated = await prisma.bankAccount.update({
    where: { id },
    data: { accountTypeId, accountNumber, currencyId },
  });
  res.json(updated);
});

router.delete("/accounts/:id", can(`${BANK_ACCOUNTS}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const account = await prisma.bankAccount.findUnique({ where: { id } });
  if (!account) return res.status(404).json({ error: "حساب بانکی یافت نشد" });
  if (account.hasTransactions) return res.status(400).json({ error: "این حساب بانکی گردش دارد و قابل حذف نیست" });
  try {
    await prisma.$transaction([
      prisma.detailCodeUsage.deleteMany({ where: { entityTable: "BankAccount", entityId: id } }),
      prisma.bankAccount.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    if (e?.code === "P2003") {
      return res.status(400).json({ error: "این حساب بانکی گردش دارد و قابل حذف نیست" });
    }
    res.status(400).json({ error: e?.message || "خطا در حذف حساب بانکی" });
  }
});

export default router;
