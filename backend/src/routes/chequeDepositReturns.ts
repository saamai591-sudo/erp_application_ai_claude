import { Router } from "express";
import { prisma } from "../lib/prisma";
import { filterChequesByBaseDate, assertChequeBaseDatesNotAfter } from "../services/chequeBaseDates";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { registerChequeDocReEdit } from "../utils/chequeDocReEdit";
import { issueChequeDepositReturnJournalEntry, revertChequeDepositReturnJournalEntry } from "../services/chequeDepositReturnJournalEntryService";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("cheque-deposit-returns");

const JE_LOCK_MESSAGE = "برای این سند برگشت از واگذاری، سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";

// =========================================================================
// ماژول «خزانه‌داری» > برگشت از واگذاری (ChequeDepositReturn)
//
// طبق تصمیم صریح کاربر: ممکن است یک یا چند چک را — حتی زیرمجموعه‌ای از یک واگذاری قبلی — از بانک
// پس بگیریم (پیش از آن‌که وصول یا برگشت بخورند). این سند مستقل از سند «واگذاری به بانک» است (به یک
// واگذاری خاص ارجاع نمی‌دهد)؛ فقط چک‌های در وضعیت «واگذار به وصول» را انتخاب می‌کند و در تایید،
// آن‌ها را به «در دست» برمی‌گرداند.
//
// سند «تایید»شده از مسیر «ویرایش» عادی اصلاً قابل ویرایش نیست؛ برای هر تغییری یا باید از تایید برگردانده شود، یا از مسیر مستقل
// «ویرایش مجدد» (GET/PUT /cheque-deposit-returns/:id/re-edit، utils/chequeDocReEdit.ts) فقط ردیف‌های فاقد گردش اصلاح/حذف شوند.
// =========================================================================

const router = Router();

interface HeaderBody {
  date: string;
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

async function validateChequeIds(chequeItemIds: number[], formDate: Date, excludeDocId?: number) {
  if (!Array.isArray(chequeItemIds) || chequeItemIds.length === 0) {
    throw new Error("سند برگشت از واگذاری باید حداقل یک چک داشته باشد");
  }
  const unique = Array.from(new Set(chequeItemIds));
  if (unique.length !== chequeItemIds.length) throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");

  for (const [idx, id] of unique.entries()) {
    const cheque = await prisma.chequeItem.findUnique({ where: { id } });
    if (!cheque) throw new Error(`چک ردیف ${idx + 1} یافت نشد`);
    if (cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_COLLECTION") {
      throw new Error(`چک شماره ${cheque.number} در وضعیت «واگذار به وصول» نیست و قابل برگشت از واگذاری نیست`);
    }
  }
  // تاریخ سند مبنای هر چک (آخرین اتفاق تاییدشده‌ی آن) نباید بعد از تاریخ این سند باشد
  const labels = new Map<number, string>();
  for (const id of unique) labels.set(id, `چک شماره ${(await prisma.chequeItem.findUnique({ where: { id }, select: { number: true } }))?.number ?? id}`);
  await assertChequeBaseDatesNotAfter(unique, formDate, excludeDocId ? { kind: "depositReturn", id: excludeDocId } : undefined, labels);
  return unique;
}

router.get("/cheque-deposit-returns/pickable-cheques", can(`${FORM}.view`), async (req, res) => {
  // فقط چک‌هایی که تاریخ سند مبنایشان (آخرین اتفاق تاییدشده‌ی چک) ≤ تاریخ سند فرم است؛ excludeId = سند در حال ویرایش
  const formDate = req.query.date ? new Date(req.query.date as string) : null;
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;
  const allItems = await prisma.chequeItem.findMany({
    where: { direction: "RECEIVABLE", status: "IN_COLLECTION" },
    include: { party: true, currency: true },
    orderBy: { id: "desc" },
  });
  const items = await filterChequesByBaseDate(allItems, formDate, excludeId ? { kind: "depositReturn", id: excludeId } : undefined);
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

router.get("/cheque-deposit-returns", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeDepositReturn.findMany({
    include: { fiscalPeriod: true, lines: true, journalEntry: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      fiscalPeriodTitle: d.fiscalPeriod.title,
      description: d.description,
      status: d.status,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      lineCount: d.lines.length,
    }))
  );
});

const CHEQUE_DEPOSIT_RETURNS_DETAIL_INCLUDE = {
  fiscalPeriod: true,
  journalEntry: true,
  lines: { include: { chequeItem: { include: { party: true, currency: true } } }, orderBy: { rowOrder: "asc" } },
} as const;

function serializeChequeDepositReturns(d: any) {
  return {
    id: d.id,
    number: d.number,
    date: d.date,
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    description: d.description,
    status: d.status,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
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
    })),
  };
}

router.get("/cheque-deposit-returns/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDepositReturn.findUnique({ where: { id }, include: CHEQUE_DEPOSIT_RETURNS_DETAIL_INCLUDE });
  if (!d) return res.status(404).json({ error: "سند برگشت از واگذاری یافت نشد" });
  res.json(serializeChequeDepositReturns(d));
});

router.post("/cheque-deposit-returns", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const chequeItemIds = await validateChequeIds(body.chequeItemIds, date);

    const lastNumber = await prisma.chequeDepositReturn.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.chequeDepositReturn.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
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

router.put("/cheque-deposit-returns/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.chequeDepositReturn.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند برگشت از واگذاری یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const chequeItemIds = await validateChequeIds(body.chequeItemIds, date, id);

    await prisma.$transaction([
      prisma.chequeDepositReturnLine.deleteMany({ where: { chequeDepositReturnId: id } }),
      prisma.chequeDepositReturn.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
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

router.delete("/cheque-deposit-returns/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDepositReturn.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.chequeDepositReturn.delete({ where: { id } });
  res.status(204).send();
});

router.post("/cheque-deposit-returns/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDepositReturn.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.lines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک چک داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);

    for (const l of d.lines) {
      if (l.chequeItem.direction !== "RECEIVABLE" || l.chequeItem.status !== "IN_COLLECTION") {
        throw new Error(`چک شماره ${l.chequeItem.number} دیگر در وضعیت «واگذار به وصول» نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        const updated = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositReturnLine.update({ where: { id: l.id }, data: { chequeStep: updated.step } });
      }
      await tx.chequeDepositReturn.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

router.post("/cheque-deposit-returns/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDepositReturn.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  const touched = d.lines.find((l: any) => l.chequeItem.step !== l.chequeStep);
  if (touched) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touched.chequeItem.number} از وضعیت «در دست» خارج شده و این سند قابل برگشت از تایید نیست؛ ابتدا آن گردش را برگردانید (یا از «ویرایش مجدد» فقط ردیف‌های فاقد گردش را اصلاح کنید)` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_COLLECTION", step: { decrement: 1 } } });
      }
      await tx.chequeDepositReturn.update({ where: { id }, data: { status: "DRAFT" } });
    });
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

router.post("/cheque-deposit-returns/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issueChequeDepositReturnJournalEntry(Number(req.params.id));
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/cheque-deposit-returns/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertChequeDepositReturnJournalEntry(Number(req.params.id));
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

registerChequeDocReEdit(router, {
  path: "cheque-deposit-returns",
  form: FORM,
  docModel: "chequeDepositReturn",
  lineModel: "chequeDepositReturnLine",
  detailInclude: CHEQUE_DEPOSIT_RETURNS_DETAIL_INCLUDE,
  serialize: serializeChequeDepositReturns,
  notFoundMessage: "سند برگشت از واگذاری یافت نشد",
  minOneMessage: "سند برگشت از واگذاری باید حداقل یک چک داشته باشد",
  hasOutcome: false,
  revertStatus: "IN_COLLECTION",
  resolveFiscalPeriod,
});

export default router;
