import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { getBankMovements, loadBankAccounts } from "./bankAccountReviewService";
import { getCashMovements } from "./cashReviewService";
import { getPettyCashMovements } from "./pettyCashReviewService";
import { findChequeUses } from "../utils/chequeUsage";

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
//   - تنخواه‌ها: مانده‌ی پایان سال هر تنخواه (زنجیره‌ی پیوسته‌ی شارژ تاییدشده − پرداخت‌های تنخواه، همان تعریف «مرور تنخواه») به ارز خودِ تنخواه؛
//     مانده‌ی ارز پایه برای تنخواه ارزی با میانگین وزنیِ نرخ ارز شارژها تخمین زده می‌شود (نرخ مستقلی برای پرداخت تنخواه ثبت نمی‌شود).
//   - چک‌های دریافتی فعال (در دست / واگذار به وصول / برگشتی) و پرداختی فعال (صادرشده): برای هر چک یک ChequeItem تازه در دوره‌ی بعد با
//     همان شماره‌ی چک و parentChequeId به چک سال قبل ساخته می‌شود (چک سال قبل دست‌نخورده می‌ماند).
// «بازگشایی» (reopenSection) دقیقاً برعکس بستن است: رکوردهای ساخته‌شده‌ی همان بخش در افتتاحیه‌ی دوره‌ی بعد پاک و ثبتِ بستن برداشته
// می‌شود. این تنها راه حذف رکوردهای خودکار افتتاحیه است (DELETE افتتاحیه برای افتتاحیه‌ی ساخته‌شده توسط بستن سال رد می‌شود).
// =========================================================================

export type CloseSection = "BANK_ACCOUNTS" | "CASH_BOXES" | "PETTY_CASHES" | "RECEIVABLE_CHEQUES" | "PAYABLE_CHEQUES";
export const CLOSE_SECTIONS: CloseSection[] = ["BANK_ACCOUNTS", "CASH_BOXES", "PETTY_CASHES", "RECEIVABLE_CHEQUES", "PAYABLE_CHEQUES"];

const SECTION_TITLE: Record<CloseSection, string> = {
  BANK_ACCOUNTS: "حساب‌های بانکی",
  CASH_BOXES: "صندوق‌ها",
  PETTY_CASHES: "تنخواه‌ها",
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

async function ensureOpening(tx: any, nextPeriod: { id: number; title?: string; fromDate: Date }) {
  const existing = await tx.treasuryOpening.findUnique({ where: { fiscalPeriodId: nextPeriod.id } });
  if (existing) {
    // افتتاحیه‌ی سیستمی فقط با بستن ساخته/تکمیل می‌شود؛ افتتاحیه‌ی دستیِ همین دوره با آن قاطی نمی‌شود
    if (!existing.isSystemGenerated) {
      throw new Error(`برای دوره مالی سال بعد یک افتتاحیه‌ی دستی ثبت شده است؛ ابتدا آن را در «عملیات اول دوره» حذف کنید تا بستن بتواند افتتاحیه‌ی سیستمی بسازد`);
    }
    return existing;
  }
  return tx.treasuryOpening.create({ data: { fiscalPeriodId: nextPeriod.id, date: nextPeriod.fromDate, isSystemGenerated: true } });
}

/** تعداد ردیف‌هایی که بستن هر بخش ایجاد می‌کند (پیش‌نمایش صفحه‌ی بستن سال). */
export async function previewCounts(current: { id: number; fromDate: Date; toDate: Date }) {
  const [bank, cash, pettyCash, receivable, payable] = await Promise.all([
    computeBankClosing(current),
    computeCashClosing(current),
    computePettyCashClosing(current),
    prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "RECEIVABLE", status: { in: [...ACTIVE_RECEIVABLE] } } }),
    prisma.chequeItem.count({ where: { fiscalPeriodId: current.id, direction: "PAYABLE", status: { in: [...ACTIVE_PAYABLE] } } }),
  ]);
  return { BANK_ACCOUNTS: bank.length, CASH_BOXES: cash.length, PETTY_CASHES: pettyCash.length, RECEIVABLE_CHEQUES: receivable, PAYABLE_CHEQUES: payable } as Record<CloseSection, number>;
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

export async function computePettyCashClosing(current: { fromDate: Date; toDate: Date }) {
  // افتتاحیه‌ی دوره‌ی بعد (تاریخش = آخرین روز همین دوره) در مانده‌ی بستن اثر نمی‌گذارد
  const [movements, pettyCashes, base] = await Promise.all([
    getPettyCashMovements(current.toDate, { openingsBeforeDate: current.toDate }),
    prisma.pettyCash.findMany({ select: { id: true, currencyId: true } }),
    prisma.currency.findFirst({ where: { isBase: true } }),
  ]);
  const currencyOf = new Map<number, number>(pettyCashes.map((p: any) => [p.id, p.currencyId]));
  const totals = new Map<number, number>();
  for (const m of movements) {
    if (!currencyOf.has(m.pettyCashId)) continue;
    totals.set(m.pettyCashId, (totals.get(m.pettyCashId) || 0) + m.inflow - m.outflow);
  }
  const round = (n: number) => Math.round(n * 100) / 100;

  // نرخ تبدیل تنخواه ارزی: میانگین وزنیِ نرخ ارز ردیف‌های شارژِ تاییدشده؛ در نبودِ شارژ، نسبت مانده‌ی ارز پایه به مانده در آخرین افتتاحیه‌ی همان تنخواه
  const foreign = Array.from(totals.keys()).filter((id) => currencyOf.get(id) !== base!.id);
  const rates = new Map<number, number>();
  if (foreign.length) {
    const lines: any[] = await withoutFiscalPeriodScope(() =>
      prisma.paymentSettlementLine.findMany({
        where: { paymentType: { nature: "TO_PETTY_CASH" }, payment: { status: "APPROVED", date: { lte: current.toDate } }, custodian: { pettyCashId: { in: foreign } } },
        select: { amount: true, fxRate: true, custodian: { select: { pettyCashId: true } } },
      })
    );
    const acc = new Map<number, { amount: number; base: number }>();
    for (const l of lines) {
      const a = acc.get(l.custodian.pettyCashId) || { amount: 0, base: 0 };
      a.amount += Number(l.amount);
      a.base += Number(l.amount) * Number(l.fxRate);
      acc.set(l.custodian.pettyCashId, a);
    }
    for (const [id, a] of acc) if (a.amount > 0) rates.set(id, a.base / a.amount);
    const missing = foreign.filter((id) => !rates.has(id));
    if (missing.length) {
      const rows: any[] = await withoutFiscalPeriodScope(() =>
        prisma.treasuryOpeningPettyCash.findMany({ where: { pettyCashId: { in: missing } }, include: { opening: { include: { fiscalPeriod: true } } } })
      );
      rows.sort((a, b) => a.opening.fiscalPeriod.fromDate.getTime() - b.opening.fiscalPeriod.fromDate.getTime());
      for (const r of rows) if (Number(r.balance) !== 0 && r.opening.fiscalPeriod.fromDate <= current.fromDate) rates.set(r.pettyCashId, Number(r.baseBalance) / Number(r.balance));
    }
  }
  return Array.from(totals.entries())
    .map(([pettyCashId, total]) => {
      const currencyId = currencyOf.get(pettyCashId)!;
      const balance = round(total);
      return { pettyCashId, currencyId, balance, baseBalance: currencyId === base!.id ? balance : round(balance * (rates.get(pettyCashId) ?? 1)) };
    })
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
    } else if (section === "PETTY_CASHES") {
      const rows = await computePettyCashClosing(current);
      await prisma.$transaction(async (tx: any) => {
        const opening = await ensureOpening(tx, next);
        const last = await tx.treasuryOpeningPettyCash.aggregate({ where: { openingId: opening.id }, _max: { rowOrder: true } });
        let order = (last._max.rowOrder ?? -1) + 1;
        for (const r of rows) {
          // eslint-disable-next-line no-await-in-loop
          await tx.treasuryOpeningPettyCash.upsert({
            where: { openingId_pettyCashId: { openingId: opening.id, pettyCashId: r.pettyCashId } },
            update: { currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, isSystemGenerated: true },
            create: { openingId: opening.id, pettyCashId: r.pettyCashId, currencyId: r.currencyId, balance: r.balance, baseBalance: r.baseBalance, rowOrder: order++, isSystemGenerated: true },
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

/**
 * بازگشایی یک بخش بسته‌شده: رکوردهایی که بستنِ همان بخش در افتتاحیه‌ی دوره‌ی بعد ساخته حذف می‌شوند و بخش دوباره «باز» می‌شود. چک‌های
 * منتقل‌شده‌ای که در دوره‌ی بعد سندی به آن‌ها ارجاع می‌دهد یا گردش داشته‌اند بازگشایی را متوقف می‌کنند (هیچ‌چیز حذف نمی‌شود). اگر بعد از
 * بازگشایی افتتاحیه‌ی دوره‌ی بعد کاملاً خالی بماند (بستن ساخته بودش)، خودِ افتتاحیه هم حذف می‌شود.
 */
export async function reopenSection(section: CloseSection): Promise<{ section: CloseSection; title: string; count: number }> {
  const { current, next } = await requireNext();
  return withoutFiscalPeriodScope(async () => {
    const closed = await prisma.treasuryYearClose.findUnique({ where: { fiscalPeriodId_section: { fiscalPeriodId: current.id, section } } });
    if (!closed) throw new Error(`بخش «${SECTION_TITLE[section]}» بسته نشده است و قابل بازگشایی نیست`);
    // اگر سال بعد خودش بسته شده، مانده‌های افتتاحیه‌اش مبنای آن بستن بوده‌اند
    const nextCloses = await prisma.treasuryYearClose.count({ where: { fiscalPeriodId: next.id } });
    if (nextCloses > 0) throw new Error("عملیات پایان دوره‌ی سال بعد انجام شده است؛ ابتدا آن را بازگشایی کنید");

    let count = 0;
    await prisma.$transaction(async (tx: any) => {
      const opening = await tx.treasuryOpening.findUnique({ where: { fiscalPeriodId: next.id } });
      if (opening) {
        if (section === "BANK_ACCOUNTS") {
          count = (await tx.treasuryOpeningBankAccount.deleteMany({ where: { openingId: opening.id, isSystemGenerated: true } })).count;
        } else if (section === "PETTY_CASHES") {
          count = (await tx.treasuryOpeningPettyCash.deleteMany({ where: { openingId: opening.id, isSystemGenerated: true } })).count;
        } else if (section === "CASH_BOXES") {
          count = (await tx.treasuryOpeningCashBox.deleteMany({ where: { openingId: opening.id, isSystemGenerated: true } })).count;
        } else {
          const direction = section === "RECEIVABLE_CHEQUES" ? "RECEIVABLE" : "PAYABLE";
          const children = await tx.chequeItem.findMany({ where: { fiscalPeriodId: next.id, isOpening: true, direction, parentChequeId: { not: null } } });
          for (const c of children as any[]) {
            // eslint-disable-next-line no-await-in-loop
            const used = c.step !== 1 || (await findChequeUses(tx, c.id, {})).length > 0;
            if (used) throw new Error(`چک شماره ${c.number} در سال بعد سندی دارد یا گردش داشته است؛ ابتدا آن را از سند/گردش جدا کنید تا بازگشایی ممکن شود`);
          }
          for (const c of children as any[]) {
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.delete({ where: { id: c.id } });
            count++;
          }
        }
      }
      await tx.treasuryYearClose.delete({ where: { fiscalPeriodId_section: { fiscalPeriodId: current.id, section } } });
      if (opening) {
        const [bank, cash, pettyCash, cheques] = await Promise.all([
          tx.treasuryOpeningBankAccount.count({ where: { openingId: opening.id } }),
          tx.treasuryOpeningCashBox.count({ where: { openingId: opening.id } }),
          tx.treasuryOpeningPettyCash.count({ where: { openingId: opening.id } }),
          tx.chequeItem.count({ where: { fiscalPeriodId: next.id, isOpening: true } }),
        ]);
        if (bank + cash + pettyCash + cheques === 0) await tx.treasuryOpening.delete({ where: { id: opening.id } });
      }
    });
    return { section, title: SECTION_TITLE[section], count };
  });
}
