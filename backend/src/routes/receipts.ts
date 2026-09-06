import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { recomputeCashBoxHasTransactions, recomputeBankAccountHasTransactions } from "../utils/treasuryTracking";
import { assertRecordNotStale } from "../utils/concurrency";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("receipts");

// =========================================================================
// ماژول «خزانه‌داری» > دریافت (Receipt)
//
// طبق تصمیم‌های صریح کاربر:
// - ابزارهای پشتیبانی‌شده: نقد (صندوق)، حواله/انتقال بانکی، چک دریافتی، پوز/درگاه پرداخت آنلاین.
// - تسویه می‌تواند «عمومی» (بابت حساب طرف حساب، بدون ارجاع به فاکتور) یا «عطف به فاکتور فروش»
//   باشد؛ حتی می‌تواند ترکیبی از هر دو در یک سند باشد. مجموع مبلغ ردیف‌های تسویه باید همیشه با
//   مجموع مبلغ ردیف‌های ابزار برابر باشد.
// - فعلاً بدون سند حسابداری خودکار (طبق تصمیم صریح کاربر؛ می‌تواند در فاز بعد اضافه شود).
// - گردش وضعیت ساده: ثبت (DRAFT) / تایید (APPROVED) — مشابه SalesDocStatus.
// - چک: طبق تصمیم کاربر، چک به‌عنوان موجودیت مستقل «ChequeItem» با چرخه‌ی عمر خودش مدل شده
//   (routes/cheques.ts و routes/chequeDeposits.ts و ...). ردیف ابزار «چک» در سند دریافت، همیشه
//   یک چک دریافتنی تازه ایجاد می‌کند — خرج‌کردن یک چک موجود فقط در سند «پرداخت» معنا دارد
//   (routes/payments.ts).
// - اثرِ واقعی روی ChequeItem (ایجاد رکورد) فقط در لحظه‌ی «تایید» سند اعمال می‌شود، نه در «ثبت» —
//   مطابق قاعده‌ی عمومی این پروژه (مشابه قطعی‌شدن رسید انبار) که اثرات جانبی به لحظه‌ی تایید/قطعی
//   موکول می‌شود، نه ثبت اولیه.
//
// اصلاح جزئی سند «تایید»شده (فاز ۲.۲ — سند نیمه‌باز، طبق تصمیم صریح کاربر): هر ChequeItem یک
// شمارنده‌ی نسخه (`step`) دارد که با هر رویداد چرخه‌ی عمر (ایجاد، واگذاری، برگشت از واگذاری، نتیجه‌ی
// وصول/برگشت، خرج/ظهرنویسی) یک واحد بالا می‌رود؛ همان مقدار روی ردیف ابزار همین سند هم
// (`chequeStep`) ذخیره می‌شود. اگر `chequeStep` یک ردیف چک با `step` فعلی همان چک برابر باشد، یعنی
// این ردیف «آخرین اتفاق» برای آن چک بوده و هیچ سند دیگری بعد از آن به آن چک دست نزده — پس بدون
// برگشت از تایید کل سند (که هنوز هم به همان شکل قبل، فقط با همین معیار step پیاده شده)، مستقیماً از
// طریق PUT /receipts/:id/edit-approved قابل ویرایش/حذف است، و ردیف تازه هم قابل افزودن است. ردیف‌های
// «قفل» (chequeStep متفاوت از step فعلی) دست‌نخورده باقی می‌مانند.
// =========================================================================

const router = Router();

interface InstrumentLineInput {
  type: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "POS";
  amount: number;
  cashBoxId?: number | null;
  bankAccountId?: number | null;
  referenceNumber?: string | null;
  chequeNumber?: string | null;
  chequeDueDate?: string | null;
  chequeBankBranchId?: number | null;
  posTerminal?: string | null;
  description?: string | null;
}

interface SettlementLineInput {
  salesInvoiceId?: number | null;
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

function validateInstrumentLines(lines: InstrumentLineInput[]) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف ابزار پرداخت داشته باشد");
  const cleaned = [];
  for (const [idx, l] of lines.entries()) {
    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);
    if (l.type === "CASH") {
      if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
    } else if (l.type === "BANK_TRANSFER") {
      if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
    } else if (l.type === "POS") {
      if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی مقصد الزامی است`);
    } else if (l.type === "CHEQUE") {
      if (!l.chequeNumber) throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
      if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
    } else {
      throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
    }
    cleaned.push({
      type: l.type,
      amount,
      cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
      bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" ? l.bankAccountId! : null,
      referenceNumber: l.referenceNumber || null,
      chequeNumber: l.type === "CHEQUE" ? l.chequeNumber! : null,
      chequeDueDate: l.type === "CHEQUE" ? new Date(l.chequeDueDate!) : null,
      chequeBankBranchId: l.type === "CHEQUE" ? l.chequeBankBranchId || null : null,
      posTerminal: l.type === "POS" ? l.posTerminal || null : null,
      description: l.description || null,
    });
  }
  return cleaned;
}

async function salesInvoiceRemaining(salesInvoiceId: number, excludeReceiptId?: number) {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: salesInvoiceId },
    include: { lines: true, receiptSettlementLines: { include: { receipt: true } } },
  });
  if (!invoice) return null;
  const total = invoice.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
  const applied = invoice.receiptSettlementLines
    .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
    .reduce((s: number, l: any) => s + Number(l.amount), 0);
  return { invoice, total, applied, remaining: total - applied };
}

async function validateSettlementLines(lines: SettlementLineInput[], instrumentTotal: number, excludeReceiptId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("سند دریافت باید حداقل یک ردیف تسویه داشته باشد");
  const cleaned = [];
  let sum = 0;
  for (const [idx, l] of lines.entries()) {
    const amount = Number(l.amount);
    if (!(amount > 0)) throw new Error(`مبلغ ردیف تسویه ${idx + 1} باید عددی مثبت باشد`);
    sum += amount;
    if (l.salesInvoiceId) {
      const info = await salesInvoiceRemaining(l.salesInvoiceId, excludeReceiptId);
      if (!info) throw new Error(`فاکتور فروش ردیف تسویه ${idx + 1} یافت نشد`);
      if (info.invoice.status !== "APPROVED") throw new Error(`فاکتور فروش ردیف تسویه ${idx + 1} در وضعیت تایید نیست`);
      if (amount > info.remaining) throw new Error(`مبلغ ردیف تسویه ${idx + 1} از مانده‌ی قابل تسویه‌ی فاکتور (${info.remaining}) بیشتر است`);
      cleaned.push({ salesInvoiceId: l.salesInvoiceId, amount, description: l.description || null });
    } else {
      cleaned.push({ salesInvoiceId: null, amount, description: l.description || null });
    }
  }
  if (Math.abs(sum - instrumentTotal) > 0.001) {
    throw new Error("مجموع مبلغ ردیف‌های تسویه باید با مجموع مبلغ ردیف‌های ابزار پرداخت برابر باشد");
  }
  return cleaned;
}

function partyDisplay(p: any) {
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

// =========================================================================
// پیکرهای مانده برای انتخاب فاکتور فروش قابل تسویه
// =========================================================================

router.get("/receipts/pickable-sales-invoices", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeReceiptId = req.query.excludeReceiptId ? Number(req.query.excludeReceiptId) : undefined;
  if (!partyId) return res.json([]);

  const customer = await prisma.customer.findUnique({ where: { partyId } });
  if (!customer) return res.json([]);

  // فاکتور باز ممکن است متعلق به دوره مالی قبلی باشد (هنوز تسویه نشده) — پس عمداً به دوره مالی جاری
  // محدود نمی‌شود، برخلاف لیست عادی فاکتورهای فروش.
  const invoices = await withoutFiscalPeriodScope(() =>
    prisma.salesInvoice.findMany({
      where: { customerId: customer.id, status: "APPROVED" },
      include: { lines: true, receiptSettlementLines: { include: { receipt: true } }, currency: true },
      orderBy: { id: "desc" },
    })
  );

  const result = invoices
    .map((inv: any) => {
      const total = inv.lines.reduce((s: number, l: any) => s + Number(l.amount), 0);
      const applied = inv.receiptSettlementLines
        .filter((s: any) => s.receipt.status === "APPROVED" && (!excludeReceiptId || s.receipt.id !== excludeReceiptId))
        .reduce((s: number, l: any) => s + Number(l.amount), 0);
      const remaining = total - applied;
      return {
        id: inv.id,
        salesInvoiceId: inv.id,
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

router.get("/receipts", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.receipt.findMany({
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

router.get("/receipts/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({
    where: { id },
    include: {
      party: true,
      fiscalPeriod: true,
      currency: true,
      instrumentLines: { include: { cashBox: true, bankAccount: true, chequeBankBranch: true, chequeItem: true }, orderBy: { rowOrder: "asc" } },
      settlementLines: { include: { salesInvoice: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "سند دریافت یافت نشد" });
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
      chequeNumber: l.chequeNumber,
      chequeDueDate: l.chequeDueDate,
      chequeBankBranchId: l.chequeBankBranchId,
      chequeBankBranchTitle: l.chequeBankBranch?.title,
      chequeItemId: l.chequeItemId,
      // برای این‌که فرانت‌اند بتواند تشخیص دهد این ردیف «قفل» است یا قابل ویرایش/حذف در سند
      // تایید‌شده (نگاه کنید به توضیح بالای فایل).
      chequeStep: l.chequeStep,
      chequeItemStep: l.chequeItem?.step ?? null,
      posTerminal: l.posTerminal,
      description: l.description,
    })),
    settlementLines: d.settlementLines.map((l: any) => ({
      id: l.id,
      salesInvoiceId: l.salesInvoiceId,
      salesInvoiceNumber: l.salesInvoice?.number,
      amount: Number(l.amount),
      description: l.description,
    })),
  });
});

router.post("/receipts", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date) return res.status(400).json({ error: "تاریخ سند الزامی است" });
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });
  if (!body.currencyId) return res.status(400).json({ error: "ارز الزامی است" });

  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) throw new Error("طرف حساب یافت نشد");

    const instrumentLines = validateInstrumentLines(body.instrumentLines);
    const instrumentTotal = instrumentLines.reduce((s, l) => s + l.amount, 0);
    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal);

    const lastNumber = await prisma.receipt.findFirst({ where: { fiscalPeriodId: fiscalPeriod.id }, orderBy: { number: "desc" } });
    const number = lastNumber ? lastNumber.number + 1 : 1;

    const created = await prisma.receipt.create({
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

    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/receipts/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;

  const existing = await prisma.receipt.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "سند دریافت یافت نشد" });
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

    const instrumentLines = validateInstrumentLines(body.instrumentLines);
    const instrumentTotal = instrumentLines.reduce((s, l) => s + l.amount, 0);
    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal, id);

    await prisma.$transaction([
      prisma.receiptInstrumentLine.deleteMany({ where: { receiptId: id } }),
      prisma.receiptSettlementLine.deleteMany({ where: { receiptId: id } }),
      prisma.receipt.update({
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

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/receipts/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل حذف هستند؛ ابتدا از «تایید» برگردانید" });
  await prisma.receipt.delete({ where: { id } });
  res.status(204).send();
});

// تایید: از این لحظه چک‌های دریافتی این سند به‌عنوان رکورد مستقل ChequeItem ایجاد می‌شوند و در فهرست
// مانده‌ی فاکتورهای فروش نیز اثر می‌گذارد (رفتار مشابه «قطعی‌کردن» در اسناد انبار، اما با نام «تایید»
// طبق تصمیم کاربر برای این ماژول).
router.post("/receipts/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({ where: { id }, include: { instrumentLines: true, settlementLines: true } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "فقط اسناد در وضعیت «ثبت» قابل تایید هستند" });
  if (d.instrumentLines.length === 0) return res.status(400).json({ error: "سند باید حداقل یک ردیف ابزار پرداخت داشته باشد" });

  try {
    await resolveFiscalPeriod(d.date);

    // بازبینی مانده‌ی فاکتورهای فروش تسویه‌شده در لحظه‌ی تایید (ممکن است از زمان ثبت تغییر کرده باشد)
    for (const s of d.settlementLines) {
      if (s.salesInvoiceId) {
        // eslint-disable-next-line no-await-in-loop
        const info = await salesInvoiceRemaining(s.salesInvoiceId, id);
        if (!info) throw new Error("فاکتور فروش تسویه‌شده یافت نشد");
        if (Number(s.amount) > info.remaining) throw new Error(`مانده‌ی فاکتور فروش شماره ${info.invoice.number} از زمان ثبت این سند کاهش یافته و کافی نیست`);
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.type === "CHEQUE" && !l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "RECEIVABLE",
              number: l.chequeNumber!,
              dueDate: l.chequeDueDate!,
              bankBranchId: l.chequeBankBranchId,
              partyId: d.partyId,
              amount: l.amount,
              currencyId: d.currencyId,
              status: "IN_HAND",
              step: 1,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: cheque.id, chequeStep: 1 } });
        } else if (l.type === "CASH" && l.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
        } else if ((l.type === "BANK_TRANSFER" || l.type === "POS") && l.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      await tx.party.update({ where: { id: d.partyId }, data: { hasTransactions: true } });
      await tx.receipt.update({ where: { id }, data: { status: "APPROVED" } });
    });

    res.json({ id, status: "APPROVED" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید سند" });
  }
});

// برگشت از تایید: فقط در صورتی مجاز است که هیچ‌کدام از چک‌های دریافتی این سند از حالت اولیه («در دست»)
// تغییر نکرده باشند (نه واگذار به وصول، نه وصول‌شده، نه برگشتی، نه خرج‌شده در یک سند پرداخت دیگر).
router.post("/receipts/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.receipt.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.status !== "APPROVED") return res.status(400).json({ error: "فقط اسناد «تایید»شده قابل برگشت هستند" });

  const touchedCheque = d.instrumentLines.find((l: any) => l.chequeItem && l.chequeItem.step !== l.chequeStep);
  if (touchedCheque) {
    return res
      .status(400)
      .json({ error: `چک شماره ${touchedCheque.chequeItem!.number} از وضعیت اولیه تغییر کرده و این سند قابل برگشت از تایید نیست؛ می‌توانید فقط همان ردیف را از «ویرایش سند تایید‌شده» اصلاح یا حذف کنید` });
  }

  try {
    await prisma.$transaction(async (tx: any) => {
      for (const l of d.instrumentLines) {
        if (l.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.update({ where: { id: l.id }, data: { chequeItemId: null } });
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        }
      }
      await tx.receipt.update({ where: { id }, data: { status: "DRAFT" } });
    });
    await recomputeCashBoxHasTransactions(d.instrumentLines.filter((l: any) => l.cashBoxId).map((l: any) => l.cashBoxId));
    await recomputeBankAccountHasTransactions(d.instrumentLines.filter((l: any) => l.bankAccountId).map((l: any) => l.bankAccountId));
    res.json({ id, status: "DRAFT" });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید" });
  }
});

// اصلاح جزئی سند «تایید»شده («سند نیمه‌باز» — نگاه کنید به توضیح بالای فایل). سند در وضعیت APPROVED
// باقی می‌ماند؛ فقط ردیف‌های ابزار «قفل‌نشده» (چک‌هایی که step آن‌ها هنوز با chequeStep این سند
// برابر است، یا هر ردیف غیرچک) قابل ویرایش/حذف‌اند، و ردیف تازه هم قابل افزودن است. ردیف‌های تسویه
// هم‌زمان به‌طور کامل جایگزین می‌شوند تا جمعشان با جمع جدید ردیف‌های ابزار برابر بماند.
router.put("/receipts/:id/edit-approved", can(`${FORM}.editApproved`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { description?: string; instrumentLines: (InstrumentLineInput & { id?: number })[]; settlementLines: SettlementLineInput[] };

  const existing = await prisma.receipt.findUnique({
    where: { id },
    include: { instrumentLines: { include: { chequeItem: true } } },
  });
  if (!existing) return res.status(404).json({ error: "سند دریافت یافت نشد" });
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
    const toCreate: any[] = [];
    const toUpdate: { id: number; existing: any; data: any }[] = [];

    for (const [idx, l] of incoming.entries()) {
      const amount = Number(l.amount);
      if (!(amount > 0)) throw new Error(`مبلغ ردیف ابزار ${idx + 1} باید عددی مثبت باشد`);
      if (l.type === "CASH") {
        if (!l.cashBoxId) throw new Error(`ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
      } else if (l.type === "BANK_TRANSFER" || l.type === "POS") {
        if (!l.bankAccountId) throw new Error(`ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
      } else if (l.type === "CHEQUE") {
        if (!l.chequeNumber) throw new Error(`ردیف ${idx + 1}: شماره چک الزامی است`);
        if (!l.chequeDueDate) throw new Error(`ردیف ${idx + 1}: تاریخ سررسید چک الزامی است`);
      } else {
        throw new Error(`ردیف ${idx + 1}: نوع ابزار نامعتبر است`);
      }

      const data = {
        type: l.type,
        amount,
        cashBoxId: l.type === "CASH" ? l.cashBoxId! : null,
        bankAccountId: l.type === "BANK_TRANSFER" || l.type === "POS" ? l.bankAccountId! : null,
        referenceNumber: l.referenceNumber || null,
        chequeNumber: l.type === "CHEQUE" ? l.chequeNumber! : null,
        chequeDueDate: l.type === "CHEQUE" ? new Date(l.chequeDueDate!) : null,
        chequeBankBranchId: l.type === "CHEQUE" ? l.chequeBankBranchId || null : null,
        posTerminal: l.type === "POS" ? l.posTerminal || null : null,
        description: l.description || null,
      };

      if (l.id) {
        const ex = editableExistingById.get(l.id);
        if (!ex) throw new Error(`ردیف ${idx + 1} در این سند یافت نشد یا قابل ویرایش نیست`);
        if (ex.type !== data.type) throw new Error(`ردیف ${idx + 1}: نوع ابزار قابل تغییر نیست؛ به‌جای آن ردیف قبلی را حذف و ردیف جدید اضافه کنید`);
        seenIds.add(l.id);
        toUpdate.push({ id: l.id, existing: ex, data });
      } else {
        toCreate.push(data);
      }
    }

    const toDelete = [...editableExistingById.values()].filter((l: any) => !seenIds.has(l.id));

    const finalLineCount = lockedIds.size + toUpdate.length + toCreate.length;
    if (finalLineCount === 0) throw new Error("سند دریافت باید حداقل یک ردیف ابزار پرداخت داشته باشد");

    const instrumentTotal =
      lockedLines.reduce((s: number, l: any) => s + Number(l.amount), 0) +
      toUpdate.reduce((s, u) => s + u.data.amount, 0) +
      toCreate.reduce((s, l) => s + l.amount, 0);

    const settlementLines = await validateSettlementLines(body.settlementLines, instrumentTotal, id);

    await prisma.$transaction(async (tx: any) => {
      for (const l of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        if (l.chequeItemId) await tx.chequeItem.delete({ where: { id: l.chequeItemId } });
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.delete({ where: { id: l.id } });
      }
      for (const u of toUpdate) {
        // eslint-disable-next-line no-await-in-loop
        await tx.receiptInstrumentLine.update({ where: { id: u.id }, data: u.data });
        if (u.existing.chequeItemId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({
            where: { id: u.existing.chequeItemId },
            data: {
              number: u.data.chequeNumber,
              dueDate: u.data.chequeDueDate,
              bankBranchId: u.data.chequeBankBranchId,
              amount: u.data.amount,
              description: u.data.description,
            },
          });
        } else if (u.data.type === "CASH" && u.data.cashBoxId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.cashBox.update({ where: { id: u.data.cashBoxId }, data: { hasTransactions: true } });
        } else if ((u.data.type === "BANK_TRANSFER" || u.data.type === "POS") && u.data.bankAccountId) {
          // eslint-disable-next-line no-await-in-loop
          await tx.bankAccount.update({ where: { id: u.data.bankAccountId }, data: { hasTransactions: true } });
        }
      }
      const maxOrder = existingLines.reduce((m: number, l: any) => Math.max(m, l.rowOrder), -1);
      let nextOrder = maxOrder + 1;
      for (const l of toCreate) {
        if (l.type === "CHEQUE") {
          // eslint-disable-next-line no-await-in-loop
          const cheque = await tx.chequeItem.create({
            data: {
              direction: "RECEIVABLE",
              number: l.chequeNumber,
              dueDate: l.chequeDueDate,
              bankBranchId: l.chequeBankBranchId,
              partyId: existing.partyId,
              amount: l.amount,
              currencyId: existing.currencyId,
              status: "IN_HAND",
              step: 1,
              description: l.description,
            },
          });
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.create({
            data: { ...l, receiptId: id, rowOrder: nextOrder++, chequeItemId: cheque.id, chequeStep: 1 },
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          await tx.receiptInstrumentLine.create({ data: { ...l, receiptId: id, rowOrder: nextOrder++ } });
          if (l.type === "CASH" && l.cashBoxId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.cashBox.update({ where: { id: l.cashBoxId }, data: { hasTransactions: true } });
          } else if ((l.type === "BANK_TRANSFER" || l.type === "POS") && l.bankAccountId) {
            // eslint-disable-next-line no-await-in-loop
            await tx.bankAccount.update({ where: { id: l.bankAccountId }, data: { hasTransactions: true } });
          }
        }
      }

      await tx.receiptSettlementLine.deleteMany({ where: { receiptId: id } });
      await tx.receiptSettlementLine.createMany({
        data: settlementLines.map((l: any, idx: number) => ({ ...l, receiptId: id, rowOrder: idx })),
      });
      if (body.description !== undefined) {
        await tx.receipt.update({ where: { id }, data: { description: body.description || null } });
      }
    });

    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

export default router;
