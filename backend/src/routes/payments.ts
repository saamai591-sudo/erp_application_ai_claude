import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("payments");

// =========================================================================
// ماژول «خزانه‌داری» > پرداخت (Payment)
//
// مشابه routes/receipts.ts (نگاه کنید به یادداشت‌های آن فایل برای تصمیم‌های کلی ماژول)، با یک
// تفاوت اصلی در ردیف ابزار «چک»: در سند پرداخت، ردیف چک می‌تواند یکی از این دو حالت باشد:
//   ۱) صدور یک چک پرداختنی تازه (chequeItemId خالی؛ شماره/سررسید/شعبه/حساب صادرکننده از کاربر
//      گرفته می‌شود) — در لحظه‌ی تایید، یک ChequeItem جدید با direction=PAYABLE و status=ISSUED
//      ایجاد می‌شود.
//   ۲) «خرج‌کردن» یک چک دریافتنی موجود که قبلاً از طریق یک سند دریافت دیگر وارد سیستم شده
//      (chequeItemId به یک ChequeItem با direction=RECEIVABLE و status=IN_HAND اشاره می‌کند) —
//      در لحظه‌ی تایید، وضعیت آن چک به ENDORSED تغییر می‌کند (بدون ایجاد رکورد جدید).
// تشخیص این‌که یک چک متعلق به همین سند پرداخت است یا صرفاً «خرج» شده، از روی direction خود
// ChequeItem قابل استنتاج است: PAYABLE = توسط همین سند ایجاد شده، RECEIVABLE = چکی موجود که خرج
// شده (چون سند پرداخت هرگز چک دریافتنی تازه ایجاد نمی‌کند).
//
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز؛ نگاه کنید به توضیح مشابه در routes/receipts.ts):
// هر ChequeItem یک شمارنده‌ی نسخه (`step`) دارد؛ صدور چک تازه یا خرج/ظهرنویسی یک چک دریافتنی موجود
// هر دو یک «رویداد» هستند که step را بالا می‌برند و همان مقدار روی chequeStep همین ردیف ذخیره
// می‌شود. فقط وقتی chequeStep ردیف با step فعلی چک برابر باشد (یعنی بعد از این سند، اتفاق دیگری
// برای آن چک نیفتاده)، آن ردیف مستقیماً از PUT /payments/:id/edit-approved قابل ویرایش/حذف است.
// =========================================================================

const router = Router();

interface InstrumentLineInput {
  type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS";
  amount: number;
  cashBoxId?: number | null;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  chequeItemId?: number | null; // اگر مقداردهی شود: خرج‌کردن یک چک دریافتنی موجود
  chequeNumber?: string | null;
  chequeDueDate?: string | null;
  chequeBankBranchId?: number | null;
  posTerminal?: string | null;
  description?: string | null;
}

interface SettlementLineInput {
  paymentTypeId: number;
  purchaseInvoiceId?: number | null;
  amount: number;
  description?: string | null;
}

interface HeaderBody {
  date: string;
  partyId: number;
  currencyId: number;
  description?: string;
  instrumentLines: InstrumentLineInput[];
  settlementLines: SettlementLineInput[];
}

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function validateInstrumentLines(lines: InstrumentLineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");
  const cleaned = [];
  for (const [idx, l] of lines.entries()) {
    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);
    if (l.type === "CASH") {
      if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
    } else if (l.type === "BANK_TRANSFER") {
      if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
    } else if (l.type === "POS") {
      if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی مبدا الزامی است`);
    } else if (l.type === "CHEQUE") {
      if (l.chequeItemId) {
        const existing = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId } });
        if (!existing) throw new Error(`ردیف ${idx + 1}: چک انتخاب‌شده یافت نشد`);
        if (existing.direction !== "RECEIVABLE" || existing.status !== "IN_HAND") {
          throw new Error(`ردیف ${idx + 1}: این چک در وضعیت «در دست» نیست و قابل خرج‌کردن نیست`);
        }
        if (Math.abs(Number(existing.amount) - amount) > 0.001) {
          throw new Error(`ردیف ${idx + 1}: مبلغ ردیف باید برابر مبلغ چک (${Number(existing.amount)}) باشد`);
        }
      } else {
        if (!l.chequeNumber) throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
        if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
        if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: حساب بانکی صادرکننده‌ی چک الزامی است`);
      }
    } else {
      throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
    }
    cleaned.push({
      type: l.type,
      amount,
      cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
      bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" || (l.type === "CHEQUE" && !l.chequeItemId) ? l.bankAccountId || null : null,
      referenceNumber: l.referenceNumber || null,
      chequeItemId: l.type === "CHEQUE" ? l.chequeItemId || null : null,
      chequeNumber: l.type === "CHEQUE" && !l.chequeItemId ? l.chequeNumber! : null,
      chequeDueDate: l.type === "CHEQUE" && !l.chequeItemId ? new Date(l.chequeDueDate!) : null,
      chequeBankBranchId: l.type === "CHEQUE" && !l.chequeItemId ? l.chequeBankBranchId || null : null,
      posTerminal: l.type === "POS" ? l.posTerminal || null : null,
      description: l.description || null,
    });
  }
  return cleaned;
}

async function purchaseInvoiceRemaining(purchaseInvoiceId: number, excludePaymentId?: number) {
  const invoice = await prisma.purchaseInvoice.findUnique({
    where: { id: purchaseInvoiceId },
    include: { lines: true, otherCostLines: true, paymentSettlementLines: { include: { payment: true } } },
  });
  if (!invoice) return null;
  const total =
    invoice.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
    invoice.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const applied = invoice.paymentSettlementLines
    .filter((s: any) => s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
    .reduce((s: number, l: any) => s + Number(l.amount), 0);
  return { invoice, total, applied, remaining: total - applied };
}

async function validateSettlementLines(lines: SettlementLineInput[], instrumentTotal: number, excludePaymentId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند پرداخت باید حداقل یک ردیف تسویه داشته باشد");
  const cleaned = [];
  let sum = 0;
  for (const [idx, l] of lines.entries()) {
    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`مبلغ ردیف تسویه ${idx + 1} باید عددی مثبت باشد`);
    sum += amount;

    if (!l.paymentTypeId) throw new Error(`ردیف تسویه ${idx + 1}: نوع پرداخت الزامی است`);
    const paymentType = await prisma.paymentType.findUnique({ where: { id: l.paymentTypeId } });
    if (!paymentType || !paymentType.isActive) throw new Error(`ردیف تسویه ${idx + 1}: نوع پرداخت یافت نشد یا غیرفعال است`);

    // مبنا کاملاً از روی نوع پرداخت تعیین می‌شود: «بدون مبنا» هرگز فاکتور ذخیره نمی‌کند (حتی اگر کلاینت بفرستد).
    if (paymentType.basisType === "NONE") {
      cleaned.push({ paymentTypeId: paymentType.id, purchaseInvoiceId: null, amount, description: l.description || null });
      continue;
    }
    if (!l.purchaseInvoiceId) throw new Error(`ردیف تسویه ${idx + 1}: انتخاب فاکتور خرید برای نوع پرداخت «${paymentType.title}» الزامی است`);
    {
      const info = await purchaseInvoiceRemaining(l.purchaseInvoiceId, excludePaymentId);
      if (!info) throw new Error(`فاکتور خرید ردیف تسویه ${idx + 1} یافت نشد`);
      if (info.invoice.status !== "APPROVED") throw new Error(`فاکتور خرید ردیف تسویه ${idx + 1} در وضعیت تایید نیست`);
      if (amount > info.remaining) throw new Error(`مبلغ ردیف تسویه ${idx + 1} از مانده‌ی قابل تسویه‌ی فاکتور (${info.remaining}) بیشتر است`);
      cleaned.push({ paymentTypeId: paymentType.id, purchaseInvoiceId: l.purchaseInvoiceId, amount, description: l.description || null });
    }
  }
  if (Math.abs(sum - instrumentTotal) > 0.001) {
    throw new Error("مجموع مبلغ ردیف‌های تسویه باید با مجموع مبلغ ردیف‌های ابزار پرداخت برابر باشد");
  }
  return cleaned;
}

async function markPaymentTypesUsed(lines: { paymentTypeId: number }[]) {
  const ids = [...new Set(lines.map((l) => l.paymentTypeId))];
  if (ids.length) await prisma.paymentType.updateMany({ where: { id: { in: ids } }, data: { hasTransactions: true } });
}

function partyDisplay(p: any) {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// =========================================================================
// پیکرهای مانده برای انتخاب فاکتور خرید قابل تسویه
// =========================================================================

router.get("/payments/pickable-purchase-invoices", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludePaymentId = req.query.excludePaymentId ? Number(req.query.excludePaymentId) : undefined;
  if (!partyId) return res.json([]);

  // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری
  // محدود نمی‌شود، برخلاف لیست عادی فاکتورهای خرید.
  const invoices = await withoutFiscalPeriodScope(() =>
    prisma.purchaseInvoice.findMany({
      where: { partyId, status: "APPROVED" },
      include: { lines: true, otherCostLines: true, paymentSettlementLines: { include: { payment: true } }, currency: true },
      orderBy: { id: "desc" },
    })
  );

  const result = invoices
    .map((inv: any) => {
      const total =
        inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
        inv.otherCostLines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = inv.paymentSettlementLines
        .filter((s: any) => s.payment.status === "APPROVED" && (!excludePaymentId || s.payment.id !== excludePaymentId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      const remaining = total - applied;
      return {
        id: inv.id,
        purchaseInvoiceId: inv.id,
        number: inv.number,
        date: inv.date,
        currencyId: inv.currencyId,
        currencyTitle: inv.currency?.title,
        total,
        applied,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0.001);
  res.json(result);
});

// =========================================================================
// CRUD + تایید/برگشت از تایید
// =========================================================================

router.get("/payments", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.payment.findMany({
    include: { party: true, fiscalPeriod: true, currency: true, instrumentLines: true, settlementLines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      partyId: d.partyId,
      partyDisplay: partyDisplay(d.party),
      fiscalPeriodTitle: d.fiscalPeriod.title,
      currencyId: d.currencyId,
      currencyTitle: d.currency.title,
      description: d.description,
      status: d.status,
      totalAmount: d.instrumentLines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/payments/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({
    where: { id },
    include: {
      party: true,
      fiscalPeriod: true,
      currency: true,
      instrumentLines: { include: { cashBox: true, bankAccount: true, chequeBankBranch: true, chequeItem: true }, orderBy: { rowOrder: "asc" } },
      settlementLines: { include: { purchaseInvoice: true, paymentType: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    partyId: d.partyId,
    partyDisplay: partyDisplay(d.party),
    fiscalPeriodId: d.fiscalPeriodId,
    fiscalPeriodTitle: d.fiscalPeriod.title,
    currencyId: d.currencyId,
    currencyTitle: d.currency.title,
    description: d.description,
    status: d.status,
    updatedAt: d.updatedAt,
    instrumentLines: d.instrumentLines.map((l: any) => ({
      id: l.id,
      type: l.type,
      amount: Number(l.amount),
      cashBoxId: l.cashBoxId,
      cashBoxTitle: l.cashBox?.title,
      bankAccountId: l.bankAccountId,
      bankAccountNumber: l.bankAccount?.accountNumber,
      referenceNumber: l.referenceNumber,
      chequeItemId: l.chequeItemId,
      chequeItemNumber: l.chequeItem?.number,
      chequeItemDirection: l.chequeItem?.direction,
      chequeStep: l.chequeStep,
      chequeItemStep: l.chequeItem?.step ?? null,
      chequeNumber: l.chequeNumber,
      chequeDueDate: l.chequeDueDate,
      chequeBankBranchId: l.chequeBankBranchId,
      chequeBankBranchTitle: l.chequeBankBranch?.title,
      posTerminal: l.posTerminal,
      description: l.description,
    })),
    settlementLines: d.settlementLines.map((l: any) => ({
      id: l.id,
      paymentTypeId: l.paymentTypeId,
      paymentTypeTitle: l.paymentType?.title,
      purchaseInvoiceId: l.purchaseInvoiceId,
      purchaseInvoiceNumber: l.purchaseInvoice?.number,
      amount: Number(l.amount),
      description: l.description,
    })),
  });
});

router.post("/payments", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const instrumentLines = await validateInstrumentLines(body.instrumentLines);
    const instrumentTotal = instrumentLines.reduce((s, l) => s + l.amount, 0);
    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal);

    const lastNumber = await prisma.payment.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.payment.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        date,
        partyId: party.id,
        currencyId: body.currencyId,
        description: body.description || null,
        status: "DRAFT",
        instrumentLines: { create: instrumentLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        settlementLines: { create: settlementLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
    });

    await markPaymentTypesUsed(settlementLines);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/payments/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.payment.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  if (existing.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل ویرایش هستند؛ ابتدا از «تایید» برگردانید" });

  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این سند");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const instrumentLines = await validateInstrumentLines(body.instrumentLines);
    const instrumentTotal = instrumentLines.reduce((s, l) => s + l.amount, 0);
    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal, id);

    await prisma.$transaction([
      prisma.paymentInstrumentLine.deleteMany({ where: { paymentId: id } }),
      prisma.paymentSettlementLine.deleteMany({ where: { paymentId: id } }),
      prisma.payment.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          partyId: party.id,
          currencyId: body.currencyId,
          description: body.description || null,
          instrumentLines: { create: instrumentLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
          settlementLines: { create: settlementLines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      }),
    ]);

    await markPaymentTypesUsed(settlementLines);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/payments/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.payment.delete({ where: { id } });
  res.status(204).send();
});

router.post("/payments/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({ where: { id }, include: { instrumentLines: true, settlementLines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.instrumentLines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف ابزار پرداخت داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);

    for (const s of d.settlementLines) {
      if (s.purchaseInvoiceId) {
        // eslint-disable-next-line no-await-in-loop
        const info = await purchaseInvoiceRemaining(s.purchaseInvoiceId, id);
        if (!info) throw new Error("فاکتور خرید تسویه‌شده یافت نشد");
        if (Number(s.amount) > info.remaining) throw new Error(`مانده‌ی فاکتور خرید شماره ${info.invoice.number} از زمان ثبت این سند کاهش یافته و کافی نیست`);
      }
    }

    // بازبینی مجدد چک‌های خرج‌شده در لحظه‌ی تایید (ممکن است از زمان ثبت، جای دیگری خرج شده باشند)
    for (const l of d.instrumentLines) {
      if (l.type === "CHEQUE" && l.chequeItemId) {
        // eslint-disable-next-line no-await-in-loop
        const cheque = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId } });
        if (!cheque || cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_HAND") {
          throw new Error(`چک انتخاب‌شده در ردیف مربوطه دیگر در وضعیت «در دست» نیست`);
        }
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.type === "CHEQUE" && !l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "PAYABLE",
              number: l.chequeNumber!,
              dueDate: l.chequeDueDate!,
              bankBranchId: l.chequeBankBranchId,
              ownerBankAccountId: l.bankAccountId,
              partyId: d.partyId,
              amount: l.amount,
              currencyId: d.currencyId,
              status: "ISSUED",
              step: 1,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: cheque.id, chequeStep: 1 } });
        } else if (l.type === "CHEQUE" && l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          const endorsed = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "ENDORSED", step: { increment: 1 } } });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeStep: endorsed.step } });
        } else if (l.type === "CASH" && l.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
        } else if ((l.type === "BANK_TRANSFER" || l.type === "POS") && l.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      await tx.party.update({ where: { id: d.partyId }, data: { hasTransactions: true } });
      await tx.payment.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

router.post("/payments/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.payment.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  for (const l of d.instrumentLines) {
    if (!l.chequeItem) continue;
    if (l.chequeItem.step !== l.chequeStep) {
      return res
        .status(400)
        .json({ error: `چک شماره ${l.chequeItem.number} از وضعیت اولیه تغییر کرده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان ردیف را از «ویرایش سند تایید‌شده» اصلاح یا حذف کنید` });
    }
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (!l.chequeItemId || !l.chequeItem) continue;
        if (l.chequeItem.direction === "PAYABLE") {
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
        }
      }
      await tx.payment.update({ where: { id }, data: { status: "DRAFT" } });
    });
    await recomputeCashBoxHasTransactions(d.instrumentLines.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(d.instrumentLines.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل و توضیح مشابه در
// routes/receipts.ts). دو نوع ردیف چک رفتار متفاوتی دارند:
//   - چک پرداختنی که خودِ همین سند صادر کرده (direction=PAYABLE): مثل سند دریافت، کاملاً قابل
//     ویرایش درجا (شماره/سررسید/شعبه/حساب صادرکننده/مبلغ) است.
//   - چک دریافتنیِ خرج‌شده (direction=RECEIVABLE، متعلق به سند دیگری): چون اطلاعات اصلی چک به آن
//     سند دیگر تعلق دارد، فقط قابل «حذف» (برگشت به در دست) است، نه ویرایش شماره/سررسید/شعبه/مبلغ آن.
router.put("/payments/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };

  const existing = await prisma.payment.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند پرداخت یافت نشد" });
  if (existing.status !== "APPROVED") {
    return res.status(400).json({ error: "این مسیر فقط برای اصلاح جزئی اسناد «تایید»شده است" });
  }

  try {
    await resolveFiscalPeriod(existing.date);

    const incoming = Array.isArray(body.instrumentLines) ? body.instrumentLines : [];
    const existingLines = existing.instrumentLines as any[];
    const lockedLines = existingLines.filter((l: any) => l.chequeItemId && l.chequeItem && l.chequeItem.step !== l.chequeStep);
    const lockedIds = new Set(lockedLines.map((l: any) => l.id));
    const editableExistingById = new Map(existingLines.filter((l: any) => !lockedIds.has(l.id)).map((l: any) => [l.id, l]));

    for (const l of incoming) {
      if (l.id && lockedIds.has(l.id)) {
        throw new Error("یکی از ردیف‌های قفل‌شده (چکی که دیگر آخرین اتفاق برایش این سند نیست) در درخواست ارسال شده و قابل ویرایش نیست");
      }
    }

    const seenIds = new Set<number>();
    const toCreateFresh: any[] = []; // صدور چک تازه یا نقد/بانک/پوز
    const toCreateEndorse: { amount: number; chequeItemId: number; description: string | null }[] = [];
    const toUpdate: { id: number; existing: any; data: any }[] = [];

    for (const [idx, l] of incoming.entries()) {
      const amount = Number(l.amount);
      if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);

      if (l.type === "CASH") {
        if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
      } else if (l.type === "BANK_TRANSFER" || l.type === "POS") {
        if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
      } else if (l.type === "CHEQUE") {
        if (!l.id && !l.chequeItemId) {
          if (!l.chequeNumber) throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
          if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
          if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: حساب بانکی صادرکننده‌ی چک الزامی است`);
        }
      } else {
        throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
      }

      if (l.id) {
        const ex = editableExistingById.get(l.id);
        if (!ex) throw new Error(`ردیف ${idx + 1} در این سند یافت نشد یا قابل ویرایش نیست`);
        seenIds.add(l.id);

        if (ex.chequeItemId && ex.chequeItem.direction === "RECEIVABLE") {
          // چک خرج‌شده‌ی متعلق به سند دیگر: فقط شرح قابل تغییر است، بقیه باید دست‌نخورده بمانند
          const sameNumber = l.chequeNumber == null || l.chequeNumber === ex.chequeItem.number;
          const sameDue = !l.chequeDueDate || new Date(l.chequeDueDate).getTime() === new Date(ex.chequeItem.dueDate).getTime();
          const sameAmount = Math.abs(amount - Number(ex.chequeItem.amount)) < 0.001;
          if (!sameNumber || !sameDue || !sameAmount) {
            throw new Error(`ردیف ${idx + 1}: این چک متعلق به سند دیگری است؛ شماره/سررسید/مبلغ آن از این سند قابل ویرایش نیست (فقط قابل حذف است)`);
          }
          toUpdate.push({
            id: l.id,
            existing: ex,
            data: { type: "CHEQUE", amount: Number(ex.chequeItem.amount), description: l.description || null },
          });
          continue;
        }

        if (ex.type !== l.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف و ردیف جدید اضافه کنید`);

        const data = {
          type: l.type,
          amount,
          cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
          bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" || l.type === "CHEQUE" ? l.bankAccountId || null : null,
          referenceNumber: l.referenceNumber || null,
          chequeNumber: l.type === "CHEQUE" ? l.chequeNumber! : null,
          chequeDueDate: l.type === "CHEQUE" ? new Date(l.chequeDueDate!) : null,
          chequeBankBranchId: l.type === "CHEQUE" ? l.chequeBankBranchId || null : null,
          posTerminal: l.type === "POS" ? l.posTerminal || null : null,
          description: l.description || null,
        };
        toUpdate.push({ id: l.id, existing: ex, data });
      } else if (l.type === "CHEQUE" && l.chequeItemId) {
        const cheque = await prisma.chequeItem.findUnique({ where: { id: l.chequeItemId } });
        if (!cheque || cheque.direction !== "RECEIVABLE" || cheque.status !== "IN_HAND") {
          throw new Error(`ردیف ${idx + 1}: این چک در وضعیت «در دست» نیست و قابل خرج‌کردن نیست`);
        }
        if (Math.abs(Number(cheque.amount) - amount) > 0.001) {
          throw new Error(`ردیف ${idx + 1}: مبلغ ردیف باید برابر مبلغ چک (${Number(cheque.amount)}) باشد`);
        }
        toCreateEndorse.push({ amount, chequeItemId: l.chequeItemId, description: l.description || null });
      } else {
        toCreateFresh.push({
          type: l.type,
          amount,
          cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
          bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" || l.type === "CHEQUE" ? l.bankAccountId || null : null,
          referenceNumber: l.referenceNumber || null,
          chequeNumber: l.type === "CHEQUE" ? l.chequeNumber! : null,
          chequeDueDate: l.type === "CHEQUE" ? new Date(l.chequeDueDate!) : null,
          chequeBankBranchId: l.type === "CHEQUE" ? l.chequeBankBranchId || null : null,
          posTerminal: l.type === "POS" ? l.posTerminal || null : null,
          description: l.description || null,
        });
      }
    }

    const toDelete = [...editableExistingById.values()].filter((l: any) => !seenIds.has(l.id));

    const finalLineCount = lockedIds.size + toUpdate.length + toCreateFresh.length + toCreateEndorse.length;
    if (finalLineCount === 0) throw new Error("سند پرداخت باید حداقل یک ردیف ابزار پرداخت داشته باشد");

    const instrumentTotal =
      lockedLines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
      toUpdate.reduce((s, u) => s + u.data.amount, 0) +
      toCreateFresh.reduce((s, l) => s + l.amount, 0) +
      toCreateEndorse.reduce((s, l) => s + l.amount, 0);

    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal, id);

    await prisma.$transaction(async (tx: any) => {
      for (const l of toDelete) {
        if (l.chequeItemId && l.chequeItem) {
          if (l.chequeItem.direction === "PAYABLE") {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
          } else {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "IN_HAND", step: { decrement: 1 } } });
          }
        }
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.delete({ where: { id: l.id } });
      }

      for (const u of toUpdate) {
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.update({ where: { id: u.id }, data: u.data });
        if (u.existing.chequeItemId && u.existing.chequeItem.direction === "PAYABLE") {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: u.existing.chequeItemId },
            data: {
              number: u.data.chequeNumber,
              dueDate: u.data.chequeDueDate,
              bankBranchId: u.data.chequeBankBranchId,
              ownerBankAccountId: u.data.bankAccountId,
              amount: u.data.amount,
              description: u.data.description,
            },
          });
        } else if (!u.existing.chequeItemId) {
          if (u.data.type === "CASH" && u.data.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: u.data.cashBoxId }, data: { hasTransactions: true } });
          } else if ((u.data.type === "BANK_TRANSFER" || u.data.type === "POS") && u.data.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: u.data.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;

      for (const l of toCreateFresh) {
        if (l.type === "CHEQUE") {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "PAYABLE",
              number: l.chequeNumber,
              dueDate: l.chequeDueDate,
              bankBranchId: l.chequeBankBranchId,
              ownerBankAccountId: l.bankAccountId,
              partyId: existing.partyId,
              amount: l.amount,
              currencyId: existing.currencyId,
              status: "ISSUED",
              step: 1,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.create({
            data: { ...l, paymentId: id, rowOrder: nextOrder++, chequeItemId: cheque.id, chequeStep: 1 },
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await tx.paymentInstrumentLine.create({ data: { ...l, paymentId: id, rowOrder: nextOrder++ } });
          if (l.type === "CASH" && l.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
          } else if ((l.type === "BANK_TRANSFER" || l.type === "POS") && l.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      for (const l of toCreateEndorse) {
        // eslint-disable-next-line no-await-in-loop
        const endorsed = await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: "ENDORSED", step: { increment: 1 } } });
        // eslint-disable-next-line no-await-in-loop
        await tx.paymentInstrumentLine.create({
          data: {
            type: "CHEQUE",
            amount: l.amount,
            chequeItemId: l.chequeItemId,
            chequeStep: endorsed.step,
            description: l.description,
            paymentId: id,
            rowOrder: nextOrder++,
          },
        });
      }

      await tx.paymentSettlementLine.deleteMany({ where: { paymentId: id } });
      await tx.paymentSettlementLine.createMany({
        data: settlementLines.map((l: any, idx: number) => ({ ...l, paymentId: id, rowOrder: idx })),
      });
      if (body.description !== undefined) {
        await tx.payment.update({ where: { id }, data: { description: body.description || null } });
      }
    });

    await markPaymentTypesUsed(settlementLines);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

export default router;
