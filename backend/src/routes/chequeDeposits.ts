import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("cheque-deposits");

// =========================================================================
// ماژول «خزانه‌داری» > واگذاری چک به بانک (ChequeDeposit)
//
// طبق تصمیم صریح کاربر: واگذاری چند چک دریافتنی با هم به یک حساب بانکی مشخص، برای وصول. هدر سند
// حساب بانکی مقصد را مشخص می‌کند؛ آیتم‌ها چند چک دریافتنی «در دست» را انتخاب می‌کنند. در تایید،
// وضعیت همه‌ی چک‌های انتخاب‌شده از IN_HAND به IN_COLLECTION تغییر می‌کند. فعلاً بدون سند حسابداری
// خودکار (طبق تصمیم صریح کاربر؛ می‌تواند در فاز بعد اضافه شود).
//
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز؛ نگاه کنید به توضیح مشابه در
// routes/receipts.ts): چون این سند فیلد قابل‌ویرایشی به‌جز خودِ ارجاع به چک ندارد، «ویرایش درجا»
// یعنی برداشتن یک چک step-مطابق از فهرست (که وضعیتش را به IN_HAND برمی‌گرداند) یا افزودن چک تازه —
// بدون این‌که سند از حالت APPROVED خارج شود.
// =========================================================================

const router = Router();

interface HeaderBody {
  date: string;
  bankAccountId: number;
  description?: string;
  chequeItemIds: number[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function validateChequeIds(chequeItemIds: number[]) {
  if (!Array.isArray(chequeItemIds) || chequeItemIds.length === 0) {
    throw new Error("سند واگذاری به بانک باید حداقل یک چک داشته باشد");
  }
  const unique = Array.from(new Set(chequeItemIds));
  if (unique.length !== chequeItemIds.length) throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");

  for (const [idx, id] of unique.entries()) {
    const cheque = await prisma.chequeItem.findUnique({ where: { id } });
    if (!cheque) throw new Error(`چک ردیف ${idx + 1} یافت نشد`);
    if (cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_HAND") {
      throw new Error(`چک شماره ${cheque.number} در وضعیت «در دست» نیست و قابل واگذاری به بانک نیست`);
    }
  }
  return unique;
}

router.get("/cheque-deposits/pickable-cheques", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeItem.findMany({
    where: { direction: "RECEIVABLE", status: "IN_HAND" },
    include: { party: true, currency: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((c: any) => ({
      id: c.id,
      number: c.number,
      dueDate: c.dueDate,
      amount: Number(c.amount),
      currencyTitle: c.currency?.title,
      partyDisplay: c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim(),
    }))
  );
});

router.get("/cheque-deposits", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeDeposit.findMany({
    include: { bankAccount: { include: { bankBranch: true } }, fiscalPeriod: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      bankAccountId: d.bankAccountId,
      bankAccountDisplay: `${d.bankAccount.accountNumber} — ${d.bankAccount.bankBranch.title}`,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      lineCount: d.lines.length,
    }))
  );
});

router.get("/cheque-deposits/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDeposit.findUnique({
    where: { id },
    include: {
      bankAccount: { include: { bankBranch: true } },
      fiscalPeriod: true,
      lines: { include: { chequeItem: { include: { party: true, currency: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "سند واگذاری به بانک یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    bankAccountId: d.bankAccountId,
    bankAccountDisplay: `${d.bankAccount.accountNumber} — ${d.bankAccount.bankBranch.title}`,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      chequeItemId: l.chequeItemId,
      chequeNumber: l.chequeItem.number,
      chequeDueDate: l.chequeItem.dueDate,
      chequeAmount: Number(l.chequeItem.amount),
      chequeCurrencyTitle: l.chequeItem.currency?.title,
      chequePartyDisplay: l.chequeItem.party.category === "LEGAL" ? l.chequeItem.party.name || "" : `${l.chequeItem.party.firstName || ""} ${l.chequeItem.party.lastName || ""}`.trim(),
      chequeStatus: l.chequeItem.status,
      chequeStep: l.chequeStep,
      chequeItemStep: l.chequeItem.step,
    })),
  });
});

router.post("/cheque-deposits", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.bankAccountId) return res.status(400).json({ error: "حساب بانکی مقصد الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: body.bankAccountId } });
    if (!bankAccount) throw new Error("حساب بانکی یافت نشد");

    const chequeItemIds = await validateChequeIds(body.chequeItemIds);

    const lastNumber = await prisma.chequeDeposit.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.chequeDeposit.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        bankAccountId: bankAccount.id,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: chequeItemIds.map((chequeItemId, idx) => ({ chequeItemId, rowOrder: idx })) },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/cheque-deposits/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.chequeDeposit.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند واگذاری به بانک یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.bankAccountId) return res.status(400).json({ error: "حساب بانکی مقصد الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: body.bankAccountId } });
    if (!bankAccount) throw new Error("حساب بانکی یافت نشد");

    const chequeItemIds = await validateChequeIds(body.chequeItemIds);

    await prisma.$transaction([
      prisma.chequeDepositLine.deleteMany({ where: { chequeDepositId: id } }),
      prisma.chequeDeposit.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          bankAccountId: bankAccount.id,
          description: body.description || null,
          lines: { create: chequeItemIds.map((chequeItemId, idx) => ({ chequeItemId, rowOrder: idx })) },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/cheque-deposits/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDeposit.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.chequeDeposit.delete({ where: { id } });
  res.status(204).send();
});

router.post("/cheque-deposits/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDeposit.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک چک داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);

    for (const l of d.lines) {
      if (l.chequeItem.direction !== "RECEIVABLE" || l.chequeItem.status !== "IN_HAND") {
        throw new Error(`چک شماره ${l.chequeItem.number} دیگر در وضعیت «در دست» نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        const updated = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_COLLECTION", step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositLine.update({ where: { id: l.id }, data: { chequeStep: updated.step } });
      }
      await tx.bankAccount.update({ where: { id: d.bankAccountId }, data: { hasTransactions: true } });
      await tx.chequeDeposit.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

// برگشت از تایید فقط در صورتی مجاز است که هیچ‌کدام از چک‌های این واگذاری از وضعیت «واگذار به وصول»
// خارج نشده باشند (نه با سند «برگشت از واگذاری»، نه با سند «نتیجه وصول/برگشت»).
router.post("/cheque-deposits/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDeposit.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  const touched = d.lines.find((l: any) => l.chequeItem.step !== l.chequeStep);
  if (touched) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touched.chequeItem.number} از وضعیت «واگذار به وصول» خارج شده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان چک را از «ویرایش سند تایید‌شده» حذف کنید` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
      }
      await tx.chequeDeposit.update({ where: { id }, data: { status: "DRAFT" } });
    });
    await recomputeBankAccountHasTransactions([d.bankAccountId]);
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل). سند در وضعیت APPROVED
// باقی می‌ماند؛ چک‌های step-مطابق قابل حذف‌اند (برمی‌گردند به IN_HAND) و چک‌های جدید IN_HAND هم قابل
// افزودن‌اند (می‌روند به IN_COLLECTION). چک‌های «قفل» (step دیگر مطابق نیست) دست‌نخورده می‌مانند.
router.put("/cheque-deposits/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { chequeItemIds: number[] };

  const existing = await prisma.chequeDeposit.findUnique({
    where: { id },
    include: { lines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند واگذاری به بانک یافت نشد" });
  if (existing.status !== "APPROVED") return res.status(400).json({ error: "این مسیر فقط برای اصلاح جزئی اسناد «تایید»شده است" });

  try {
    await resolveFiscalPeriod(existing.date);

    const incomingIds = Array.isArray(body.chequeItemIds) ? Array.from(new Set(body.chequeItemIds)) : [];
    const existingLines = existing.lines as any[];
    const lockedLines = existingLines.filter((l: any) => l.chequeItem.step !== l.chequeStep);
    const lockedIds = new Set(lockedLines.map((l: any) => l.chequeItemId));
    const editableLines = existingLines.filter((l: any) => !lockedIds.has(l.chequeItemId));
    const editableIds = new Set(editableLines.map((l: any) => l.chequeItemId));

    for (const cid of incomingIds) {
      if (lockedIds.has(cid)) throw new Error("یکی از چک‌های قفل‌شده (که دیگر آخرین اتفاق برایش این سند نیست) در درخواست ارسال شده است");
    }

    const toKeep = incomingIds.filter((cid) => editableIds.has(cid));
    const toAdd = incomingIds.filter((cid) => !editableIds.has(cid) && !lockedIds.has(cid));
    const toRemove = editableLines.filter((l: any) => !incomingIds.includes(l.chequeItemId));

    if (lockedIds.size + toKeep.length + toAdd.length === 0) {
      throw new Error("سند واگذاری به بانک باید حداقل یک چک داشته باشد");
    }

    for (const cid of toAdd) {
      const cheque = await prisma.chequeItem.findUnique({ where: { id: cid } });
      if (!cheque) throw new Error(`چک انتخاب‌شده یافت نشد`);
      if (cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_HAND") {
        throw new Error(`چک شماره ${cheque.number} در وضعیت «در دست» نیست و قابل واگذاری به بانک نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of toRemove) {
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositLine.delete({ where: { id: l.id } });
      }
      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;
      for (const cid of toAdd) {
        // eslint-disable-next-line no-await-in-loop
        const updated = await tx.chequeItem.update({ where: { id: cid }, data: { status: "IN_COLLECTION", step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositLine.create({ data: { chequeDepositId: id, chequeItemId: cid, chequeStep: updated.step, rowOrder: nextOrder++ } });
      }
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

export default router;
