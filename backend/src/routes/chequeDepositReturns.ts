import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("cheque-deposit-returns");

// =========================================================================
// ماژول «خزانه‌داری» > برگشت از واگذاری (ChequeDepositReturn)
//
// طبق تصمیم صریح کاربر: ممکن است یک یا چند چک را — حتی زیرمجموعه‌ای از یک واگذاری قبلی — از بانک
// پس بگیریم (پیش از آن‌که وصول یا برگشت بخورند). این سند مستقل از سند «واگذاری به بانک» است (به یک
// واگذاری خاص ارجاع نمی‌دهد)؛ فقط چک‌های در وضعیت «واگذار به وصول» را انتخاب می‌کند و در تایید،
// آن‌ها را به «در دست» برمی‌گرداند.
//
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز؛ نگاه کنید به توضیح مشابه در
// routes/receipts.ts): برداشتن یک چک step-مطابق از فهرست (برمی‌گردد به IN_COLLECTION) یا افزودن چک
// تازه (می‌رود به IN_HAND) — بدون این‌که سند از حالت APPROVED خارج شود.
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

async function validateChequeIds(chequeItemIds: number[]) {
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
  return unique;
}

router.get("/cheque-deposit-returns/pickable-cheques", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeItem.findMany({
    where: { direction: "RECEIVABLE", status: "IN_COLLECTION" },
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

router.get("/cheque-deposit-returns", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.chequeDepositReturn.findMany({
    include: { fiscalPeriod: true, lines: true },
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
      lineCount: d.lines.length,
    }))
  );
});

router.get("/cheque-deposit-returns/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.chequeDepositReturn.findUnique({
    where: { id },
    include: {
      fiscalPeriod: true,
      lines: { include: { chequeItem: { include: { party: true, currency: true } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "سند برگشت از واگذاری یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
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

router.post("/cheque-deposit-returns", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const chequeItemIds = await validateChequeIds(body.chequeItemIds);

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
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const chequeItemIds = await validateChequeIds(body.chequeItemIds);

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
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  const touched = d.lines.find((l: any) => l.chequeItem.step !== l.chequeStep);
  if (touched) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touched.chequeItem.number} از وضعیت «در دست» خارج شده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان چک را از «ویرایش سند تایید‌شده» حذف کنید` });
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

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل).
router.put("/cheque-deposit-returns/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { chequeItemIds: number[] };

  const existing = await prisma.chequeDepositReturn.findUnique({
    where: { id },
    include: { lines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند برگشت از واگذاری یافت نشد" });
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
      throw new Error("سند برگشت از واگذاری باید حداقل یک چک داشته باشد");
    }

    for (const cid of toAdd) {
      const cheque = await prisma.chequeItem.findUnique({ where: { id: cid } });
      if (!cheque) throw new Error(`چک انتخاب‌شده یافت نشد`);
      if (cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_COLLECTION") {
        throw new Error(`چک شماره ${cheque.number} در وضعیت «واگذار به وصول» نیست و قابل برگشت از واگذاری نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of toRemove) {
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_COLLECTION", step: { decrement: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositReturnLine.delete({ where: { id: l.id } });
      }
      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;
      for (const cid of toAdd) {
        // eslint-disable-next-line no-await-in-loop
        const updated = await tx.chequeItem.update({ where: { id: cid }, data: { status: "IN_HAND", step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.chequeDepositReturnLine.create({ data: { chequeDepositReturnId: id, chequeItemId: cid, chequeStep: updated.step, rowOrder: nextOrder++ } });
      }
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

export default router;
