import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { registerChequeDocReEdit } from "../utils/chequeDocReEdit";
import { findDepositBankByCheque, bankAccountDisplayText } from "../services/chequeDepositBankLookup";
import { issueChequeClearingReceivableJournalEntry, revertChequeClearingReceivableJournalEntry } from "../services/chequeClearingReceivableJournalEntryService";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("cheque-clearings-receivable");

const JE_LOCK_MESSAGE = "برای این سند، سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";

// =========================================================================
// ماژول «خزانه‌داری» > نتیجه وصول/برگشت چک دریافتنی (ChequeClearingReceivable)
//
// طبق تصمیم صریح کاربر: پس از واگذاری یک دسته چک به بانک، نتیجه (وصول یا برگشت) ممکن است برای
// چک‌های مختلفِ همان دسته متفاوت باشد؛ بنابراین هر ردیف نتیجه‌ی خودش را جداگانه مشخص می‌کند. فقط
// چک‌های دریافتنیِ در وضعیت «واگذار به وصول» قابل انتخاب هستند. فرم مستقل از چک پرداختنی است (طبق
// تصمیم کاربر: دو فرم جداگانه) — نگاه کنید به routes/chequeClearingPayable.ts.
//
// سند «تایید»شده از مسیر «ویرایش» عادی اصلاً قابل ویرایش نیست؛ برای هر تغییری یا باید از تایید برگردانده شود، یا از مسیر مستقل
// «ویرایش مجدد» (GET/PUT /cheque-clearings-receivable/:id/re-edit، utils/chequeDocReEdit.ts) فقط ردیف‌های فاقد گردش اصلاح/حذف شوند.
// =========================================================================

const router = Router();

type Outcome = "CLEARED" | "BOUNCED";

interface LineInput {
  chequeItemId: number;
  outcome: Outcome;
}
interface HeaderBody {
  date: string;
  description?: string;
  lines: LineInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function validateLines(lines: LineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("سند نتیجه وصول/برگشت باید حداقل یک چک داشته باشد");
  }
  const ids = lines.map((l) => l.chequeItemId);
  if (new Set(ids).size !== ids.length) throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");

  const cleaned = [];
  for (const [idx, l] of lines.entries()) {
    if (l.outcome !== "CLEARED" && l.outcome !== "BOUNCED") throw new Error(`ردیف ${idx + 1}: نتیجه نامعتبر است`);
    const cheque = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId } });
    if (!cheque) throw new Error(`چک ردیف ${idx + 1} یافت نشد`);
    if (cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_COLLECTION") {
      throw new Error(`چک شماره ${cheque.number} در وضعیت «واگذار به وصول» نیست`);
    }
    cleaned.push({ chequeItemId: l.chequeItemId, outcome: l.outcome });
  }
  return cleaned;
}

router.get("/cheque-clearings-receivable/pickable-cheques", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeItem.findMany({
    where: { direction: "RECEIVABLE", status: "IN_COLLECTION" },
    include: { party: true, currency: true },
    orderBy: { id: "desc" },
  });
  // حساب بانکیِ اختصاص‌یافته = حساب واگذاریِ تاییدشده‌ای که چک در آن بوده
  const bankByCheque = await findDepositBankByCheque(items.map((c: any) => ({ chequeItemId: c.id, chequeStep: null })));
  res.json(
    items.map((c: any) => ({
      id: c.id,
      number: c.number,
      dueDate: c.dueDate,
      bankAccountDisplay: bankAccountDisplayText(bankByCheque.get(c.id)?.bankAccount),
      amount: Number(c.amount),
      currencyTitle: c.currency?.title,
      partyDisplay: c.party.category === "LEGAL" ? c.party.name || "" : `${c.party.firstName || ""} ${c.party.lastName || ""}`.trim(),
    }))
  );
});

router.get("/cheque-clearings-receivable", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeClearingReceivable.findMany({
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

const CHEQUE_CLEARING_RECEIVABLE_DETAIL_INCLUDE = {
  fiscalPeriod: true,
  journalEntry: true,
  lines: { include: { chequeItem: { include: { party: true, currency: true } } }, orderBy: { rowOrder: "asc" } },
} as const;

async function serializeChequeClearingReceivable(d: any) {
  const bankByCheque = await findDepositBankByCheque(d.lines.map((l: any) => ({ chequeItemId: l.chequeItemId, chequeStep: l.chequeStep })));
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
      outcome: l.outcome,
      chequeNumber: l.chequeItem.number,
      chequeDueDate: l.chequeItem.dueDate,
      chequeAmount: Number(l.chequeItem.amount),
      chequeCurrencyTitle: l.chequeItem.currency?.title,
      chequeBankAccountDisplay: bankAccountDisplayText(bankByCheque.get(l.chequeItemId)?.bankAccount),
      chequePartyDisplay: l.chequeItem.party.category === "LEGAL" ? l.chequeItem.party.name || "" : `${l.chequeItem.party.firstName || ""} ${l.chequeItem.party.lastName || ""}`.trim(),
      chequeStatus: l.chequeItem.status,
    })),
  };
}

router.get("/cheque-clearings-receivable/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeClearingReceivable.findUnique({ where: { id }, include: CHEQUE_CLEARING_RECEIVABLE_DETAIL_INCLUDE });
  if (!d) return res.status(404).json({ error: "سند نتیجه وصول/برگشت یافت نشد" });
  res.json(await serializeChequeClearingReceivable(d));
});

router.post("/cheque-clearings-receivable", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const lines = await validateLines(body.lines);

    const lastNumber = await prisma.chequeClearingReceivable.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.chequeClearingReceivable.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/cheque-clearings-receivable/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.chequeClearingReceivable.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند نتیجه وصول/برگشت یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const lines = await validateLines(body.lines);

    await prisma.$transaction([
      prisma.chequeClearingReceivableLine.deleteMany({ where: { chequeClearingReceivableId: id } }),
      prisma.chequeClearingReceivable.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          description: body.description || null,
          lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/cheque-clearings-receivable/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeClearingReceivable.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.chequeClearingReceivable.delete({ where: { id } });
  res.status(204).send();
});

router.post("/cheque-clearings-receivable/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeClearingReceivable.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
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
        const updated = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: l.outcome, step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeClearingReceivableLine.update({ where: { id: l.id }, data: { chequeStep: updated.step } });
      }
      await tx.chequeClearingReceivable.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

router.post("/cheque-clearings-receivable/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeClearingReceivable.findUnique({ where: { id }, include: { lines: { include: { chequeItem: true } } } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: JE_LOCK_MESSAGE });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  const touched = d.lines.find((l: any) => l.chequeItem.step !== l.chequeStep);
  if (touched) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touched.chequeItem.number} از وضعیت ثبت‌شده در این سند تغییر کرده و این سند قابل برگشت از تایید نیست؛ ابتدا آن گردش را برگردانید (یا از «ویرایش مجدد» فقط ردیف‌های فاقد گردش را اصلاح کنید)` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.lines) {
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_COLLECTION", step: { decrement: 1 } } });
      }
      await tx.chequeClearingReceivable.update({ where: { id }, data: { status: "DRAFT" } });
    });
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

router.post("/cheque-clearings-receivable/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issueChequeClearingReceivableJournalEntry(Number(req.params.id));
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/cheque-clearings-receivable/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertChequeClearingReceivableJournalEntry(Number(req.params.id));
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

registerChequeDocReEdit(router, {
  path: "cheque-clearings-receivable",
  form: FORM,
  docModel: "chequeClearingReceivable",
  lineModel: "chequeClearingReceivableLine",
  detailInclude: CHEQUE_CLEARING_RECEIVABLE_DETAIL_INCLUDE,
  serialize: serializeChequeClearingReceivable,
  notFoundMessage: "سند نتیجه وصول/برگشت یافت نشد",
  minOneMessage: "سند نتیجه وصول/برگشت باید حداقل یک چک داشته باشد",
  hasOutcome: true,
  revertStatus: "IN_COLLECTION",
  resolveFiscalPeriod,
});

export default router;
