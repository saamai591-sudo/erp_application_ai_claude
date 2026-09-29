import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { getBankMovements, loadBankAccounts } from "./bankAccountReviewService";
import { getCashMovements } from "./cashReviewService";

// =========================================================================
// «بستن سال دریافت و پرداخت» — Documents/افتتاحیه دریافت و پرداخت و بستن سال.md
//
// اطلاعات پایان دوره‌ی مالیِ جاری را به «افتتاحیه دریافت و پرداخت» دوره‌ی بعد منتقل می‌کند؛ هر بخش مستقل قابل بستن است
// (و «بستن همه»). بستن‌ها با TreasuryYearClose ثبت می‌شوند و یک بخش را نمی‌شود دوباره بست (مگر افتتاحیه‌ی دوره‌ی بعد حذف
// شود که بستن‌های این دوره را باز می‌کند — نگاه کنید به DELETE /treasury-openings/:id).
// ردیف‌ها/چک‌هایی که بستن می‌سازد «ساخته‌شده توسط سیستم» هستند (TreasuryOpening{BankAccount,CashBox}.isSystemGenerated؛ برای چک:
// parentChequeId) و کاربر نمی‌تواند در فرم افتتاحیه ویرایش/حذفشان کند (routes/treasuryOpenings.ts).
//   - حساب‌های بانکی: مانده‌ی پایان سال هر حساب (افتتاحیه‌ی همین دوره + گردش‌های تاییدشده، همان تعریف «مرور حساب بانکی»)
//     به ارز حساب و ارز پایه. مانده‌ی ارز حساب برای گردش‌های مبتنی بر چک (ارز پایه) فقط برای حساب‌های ارز پایه حساب می‌شود.
//   - صندوق‌ها: مانده‌ی پایان سال هر صندوق به تفکیک ارز (به ارز ردیف و ارز پایه).
//   - چک‌های دریافتی فعال (در دست / واگذار به وصول / برگشتی) و پرداختی فعال (صادرشده): برای هر چک یک ChequeItem تازه در دوره‌ی بعد با
//     همان شماره‌ی چک و parentChequeId به چک سال قبل ساخته می‌شود (چک سال قبل دست‌نخورده می‌ماند).
// =========================================================================

export type CloseSection = "BANK_ACCOUNTS" | "CASH_BOXES" | "RECEIVABLE_CHEQUES" | "PAYABLE_CHEQUES";
export const CLOSE_SECTIONS: CloseSection[] = ["BANK_ACCOUNTS", "CASH_BOXES", "RECEIVABLE_CHEQUES", "PAYABLE_CHEQUES"];

const SECTION_TITLE: Record<CloseSection, string> = {
  BANK_ACCOUNTS: "حساب‌های بانکی",
  CASH_BOXES: "صندوق‌ها",
  RECEIVABLE_CHEQUES: "چک‌های دریافتی",
  PAYABLE_CHEQUES: "چک‌های پرداختی",
};
export const sectionTitle = (s: CloseSection) => SECTION_TITLE[s];

const ACTIVE_RECEIVABLE = ["IN_HAND", "IN_COLLECTION", "BOUNCED"] as const;
const ACTIVE_PAYABLE = ["ISSUED"] as const;

export async function getCloseContext() {
  const current = await getCurrentFiscalPeriod();
  if (!current) throw new Error("دوره مالی جاری مشخص نیست");
  const next = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { gt: current.toDate } }, orderBy: { fromDate: "asc" } });
  return { current, next };
}

async function requireNext() {
  const ctx = await getCloseContext();
  if (!ctx.next) throw new Error("دوره مالی بعد تعریف نشده است؛ ابتدا دوره مالی سال بعد را تعریف کنید");
  return { current: ctx.current, next: ctx.next };
}

async function ensureOpening(tx: any, nextPeriod: { id: number; fromDate: Date }) {
  const existing = await tx.treasuryOpening.findUnique({ where: { fiscalPeriodId: nextPeriod.id } });
  if (existing) return existing;
  return tx.treasuryOpening.create({ data: { fiscalPeriodId: nextPeriod.id, date: nextPeriod.fromDate } });
}

/** تعداد ردیف‌هایی که بستن هر بخش ایجاد می‌کند (پیش‌نمایش صفحه‌ی بستن سال). */
export async function previewCounts(current: { id: number; fromDate: Date; toDate: Date }) {
  const [bank, cash, receivable, payable] = await Promise.all([
    computeBankClosing(current),
    computeCashClosing(current),
    prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "RECEIVABLE", status: { in: [...ACTIVE_RECEIVABLE] } } }),
    prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "PAYABLE", status: { in: [...ACTIVE_PAYABLE] } } }),
  ]);
  return { BANK_ACCOUNTS: bank.length, CASH_BOXES: cash.length, RECEIVABLE_CHEQUES: receivable, PAYABLE_CHEQUES: payable } as Record<CloseSection, number>;
}

export async function computeBankClosing(current: { fromDate: Date; toDate: Date }) {
  const [movements, accounts, base] = await Promise.all([
    getBankMovements(current.toDate, current.fromDate),
    loadBankAccounts(),
    prisma.currency.findFirst({ where: { isBase: true } }),
  ]);
  const totals = new Map<number, { base: number; cur: number }>();
  for (const m of movements) {
    if (!accounts.has(m.bankAccountId)) continue;
    const t = totals.get(m.bankAccountId) || { base: 0, cur: 0 };
    t.base += m.inflow - m.outflow;
    t.cur += m.currencyInflow - m.currencyOutflow;
    totals.set(m.bankAccountId, t);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return Array.from(totals.entries())
    .map(([bankAccountId, t]) => {
      const acc = accounts.get(bankAccountId)!;
      const currencyId = acc.currencyId ?? base!.id;
      return { bankAccountId, currencyId, balance: round(currencyId === base!.id ? t.base : t.cur), baseBalance: round(t.base) };
    })
    .filter((r) => r.balance !== 0 || r.baseBalance !== 0);
}

export async function computeCashClosing(current: { fromDate: Date; toDate: Date }) {
  const movements = await getCashMovements(current.toDate, current.fromDate);
  const totals = new Map<string, { cashBoxId: number; currencyId: number; base: number; cur: number }>();
  for (const m of movements) {
    const key = `${m.cashBoxId}:${m.currencyId}`;
    const t = totals.get(key) || { cashBoxId: m.cashBoxId, currencyId: m.currencyId, base: 0, cur: 0 };
    t.base += m.inflow - m.outflow;
    t.cur += m.currencyInflow - m.currencyOutflow;
    totals.set(key, t);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return Array.from(totals.values())
    .map((t) => ({ cashBoxId: t.cashBoxId, currencyId: t.currencyId, balance: round(t.cur), baseBalance: round(t.base) }))
    .filter((r) => r.balance !== 0 || r.baseBalance !== 0);
}

/** «نوع دریافت/پرداخت» چک منتقل‌شده: از افتتاحیه‌ی خودِ چک، یا از ردیف‌های موضوع سندی که چک را ایجاد کرده (فقط اگر یکتا باشد). */
async function deriveTypeIds(cheque: any): Promise<{ openingReceiptTypeId: number | null; openingPaymentTypeId: number | null }> {
  if (cheque.isOpening) return { openingReceiptTypeId: cheque.openingReceiptTypeId, openingPaymentTypeId: cheque.openingPaymentTypeId };
  if (cheque.direction === "RECEIVABLE") {
    const line = await prisma.receiptInstrumentLine.findFirst({ where: { chequeItemId: cheque.id }, include: { settlementLines: true } });
    const ids = Array.from(new Set((line?.settlementLines || []).map((s: any) => s.receiptTypeId)));
    return { openingReceiptTypeId: ids.length === 1 ? (ids[0] as number) : null, openingPaymentTypeId: null };
  }
  const line = await prisma.paymentInstrumentLine.findFirst({ where: { chequeItemId: cheque.id }, include: { settlementLines: true } });
  const ids = Array.from(new Set((line?.settlementLines || []).map((s: any) => s.paymentTypeId)));
  return { openingReceiptTypeId: null, openingPaymentTypeId: ids.length === 1 ? (ids[0] as number) : null };
}

export async function closeSection(section: CloseSection): Promise<{ section: CloseSection; title: string; count: number }> {
  const { current, next } = await requireNext();
  return withoutFiscalPeriodScope(async () => {
    const already = await prisma.treasuryYearClose.findUnique({ where: { fiscalPeriodId_section: { fiscalPeriodId: current.id, section } } });
    if (already) throw new Error(`بخش «${SECTION_TITLE[section]}» قبلاً بسته شده است`);

    let count = 0;
    if (section === "BANK_ACCOUNTS") {
      const rows = await computeBankClosing(current);
      await prisma.$transaction(async (tx: any) => {
        const opening = await ensureOpening(tx, next);
        const last = await tx.treasuryOpeningBankAccount.aggregate({ where: { openingId: opening.id }, _max: { rowOrder: true } });
        let order = (last._max.rowOrder ?? -1) + 1;
        for (const r of rows) {
          // اگر برای همین حساب قبلاً (دستی) مانده‌ای ثبت شده، مقدار محاسبه‌شده جایگزین می‌شود
          // eslint-disable-next-line no-await-in-loop
          await tx.treasuryOpeningBankAccount.upsert({
            where: { openingId_bankAccountId: { openingId: opening.id, bankAccountId: r.bankAccountId } },
            update: { currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, isSystemGenerated: true },
            create: { openingId: opening.id, bankAccountId: r.bankAccountId, currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, rowOrder: order++, isSystemGenerated: true },
          });
        }
        await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
      });
      count = rows.length;
    } else if (section === "CASH_BOXES") {
      const rows = await computeCashClosing(current);
      await prisma.$transaction(async (tx: any) => {
        const opening = await ensureOpening(tx, next);
        const last = await tx.treasuryOpeningCashBox.aggregate({ where: { openingId: opening.id }, _max: { rowOrder: true } });
        let order = (last._max.rowOrder ?? -1) + 1;
        for (const r of rows) {
          // eslint-disable-next-line no-await-in-loop
          await tx.treasuryOpeningCashBox.upsert({
            where: { openingId_cashBoxId_currencyId: { openingId: opening.id, cashBoxId: r.cashBoxId, currencyId: r.currencyId } },
            update: { balance: r.balance, baseBalance: r.baseBalance, isSystemGenerated: true },
            create: { openingId: opening.id, cashBoxId: r.cashBoxId, currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, rowOrder: order++, isSystemGenerated: true },
          });
        }
        await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
      });
      count = rows.length;
    } else {
      const direction = section === "RECEIVABLE_CHEQUES" ? "RECEIVABLE" : "PAYABLE";
      const statuses = direction === "RECEIVABLE" ? [...ACTIVE_RECEIVABLE] : [...ACTIVE_PAYABLE];
      const cheques = await prisma.chequeItem.findMany({ where: { fiscalPeriodId: current.id, direction, status: { in: statuses as any } }, orderBy: { id: "asc" } });
      await prisma.$transaction(async (tx: any) => {
        await ensureOpening(tx, next);
        for (const c of cheques as any[]) {
          // انتقال تکراری نشود (مثلاً بعد از بازگشایی)
          // eslint-disable-next-line no-await-in-loop
          const child = await tx.chequeItem.findFirst({ where: { parentChequeId: c.id, fiscalPeriodId: next.id } });
          if (child) continue;
          // eslint-disable-next-line no-await-in-loop
          const types = await deriveTypeIds(c);
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.create({
            data: {
              fiscalPeriodId: next.id,
              parentChequeId: c.id,
              isOpening: true,
              direction: c.direction,
              number: c.number,
              dueDate: c.dueDate,
              bankBranchId: c.bankBranchId,
              ownerBankAccountId: c.ownerBankAccountId,
              partyId: c.partyId,
              amount: c.amount,
              currencyId: c.currencyId,
              status: c.status,
              step: 1,
              receivableChequeTypeId: c.receivableChequeTypeId,
              payableChequeTypeId: c.payableChequeTypeId,
              description: c.description,
              ...types,
            },
          });
          count++;
        }
        await tx.treasuryYearClose.create({ data: { fiscalPeriodId: current.id, section } });
      });
    }
    return { section, title: SECTION_TITLE[section], count };
  });
}

/** بستن همه: بخش‌هایی که هنوز بسته نشده‌اند به‌ترتیب بسته می‌شوند؛ بخش‌های بسته‌شده رد می‌شوند. */
export async function closeAll() {
  const { current } = await requireNext();
  const done = await withoutFiscalPeriodScope(() => prisma.treasuryYearClose.findMany({ where: { fiscalPeriodId: current.id } }));
  const closed = new Set(done.map((d: any) => d.section));
  const results: { section: CloseSection; title: string; count: number }[] = [];
  const skipped: string[] = [];
  for (const s of CLOSE_SECTIONS) {
    if (closed.has(s)) {
      skipped.push(SECTION_TITLE[s]);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    results.push(await closeSection(s));
  }
  return { results, skipped };
}
