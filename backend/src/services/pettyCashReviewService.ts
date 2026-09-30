import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش «مرور تنخواه» (خزانه‌داری > گزارش). هر «گردش تنخواه» یک ورودی (شارژ) یا خروجی (پرداخت) روی یک تنخواه‌دار
// (و تنخواهِ او) است، به ارز خودِ تنخواه (پرداخت تنخواه فیلد ارز جدا ندارد و ردیف «به تنخواه» سند پرداخت هم به ارز همان تنخواه ثبت می‌شود):
//   ورودی (شارژ): ردیف موضوع پرداختِ ماهیت «به تنخواه» در سند پرداختِ «تایید»شده — به تاریخ سند پرداخت
//   خروجی (پرداخت): «پرداخت تنخواه» (PettyCashPayment) — به تاریخ خودش (این سند تاییدی ندارد، پس همه‌ی رکوردها حساب می‌شوند)
// مانده از ابتدای تاریخ‌ها (نه فقط دوره‌ی مالیِ جاری) پیوسته است و مانده‌ی ابتدای بازه = جمع همه‌ی گردش‌های قبل از «از تاریخ»، بدون محدودیت
// دوره‌ی مالی. «افتتاحیه‌ی تنخواه» (TreasuryOpeningPettyCash — ساخته‌شده با «بستن تنخواه‌ها» در عملیات پایان دوره یا ثبت دستی) مانده‌ی
// تنخواه را در «یک روز قبل از شروع دوره‌ی مالی» برابر مقدار خودش قرار می‌دهد (openingAdjustments): اگر زنجیره‌ی گردش‌ها همان مقدار را بدهد
// (حالت عادی بعد از «بستن»)، چیزی اضافه نمی‌شود؛ وگرنه اختلاف به‌صورت یک گردش «افتتاحیه» (docTypeCode = OPENING) ثبت می‌شود.
// =========================================================================

export interface PettyCashMovement {
  key: string;
  pettyCashId: number;
  custodianId: number;
  date: Date;
  docType: string;
  docTypeCode: "FUNDING" | "SPENDING" | "OPENING";
  docId: number;
  docNumber: number;
  partyDisplay: string;
  description: string | null;
  inflow: number;
  outflow: number;
}

export interface PettyCashMeta {
  id: number;
  code: string;
  title: string;
  currencyTitle: string;
}

export interface CustodianMeta {
  id: number;
  code: string;
  title: string;
  pettyCashId: number;
}

function partyDisplay(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function loadPettyCashes(): Promise<Map<number, PettyCashMeta>> {
  const items = await prisma.pettyCash.findMany({ include: { currency: true } });
  return new Map(items.map((p: any) => [p.id, { id: p.id, code: p.detailCode, title: p.title, currencyTitle: p.currency?.title || "" }]));
}

export async function loadCustodians(): Promise<Map<number, CustodianMeta>> {
  const items = await prisma.pettyCashCustodian.findMany({ include: { party: true } });
  return new Map(items.map((c: any) => [c.id, { id: c.id, code: c.detailCode, title: partyDisplay(c.party), pettyCashId: c.pettyCashId }]));
}

export interface PettyCashOpeningRef {
  pettyCashId: number;
  /** یک روز قبل از شروع دوره‌ی مالیِ افتتاحیه */
  date: Date;
  balance: number;
}

/** افتتاحیه‌های تنخواه (همه‌ی دوره‌های مالی)؛ beforeDate: فقط افتتاحیه‌هایی که تاریخشان از آن کوچک‌تر است (مثلاً برای محاسبه‌ی مانده‌ی بستنِ دوره‌ای که افتتاحیه‌ی بعدی‌اش نباید در آن اثر کند). */
export async function loadPettyCashOpenings(opts: { pettyCashId?: number; beforeDate?: Date } = {}): Promise<PettyCashOpeningRef[]> {
  return withoutFiscalPeriodScope(async () => {
    const rows = await prisma.treasuryOpeningPettyCash.findMany({
      where: opts.pettyCashId ? { pettyCashId: opts.pettyCashId } : {},
      include: { opening: { include: { fiscalPeriod: true } } },
    });
    return (rows as any[])
      .map((r) => ({ pettyCashId: r.pettyCashId, date: new Date(r.opening.fiscalPeriod.fromDate.getTime() - 86400000), balance: Number(r.balance) }))
      .filter((r) => !opts.beforeDate || r.date < opts.beforeDate)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });
}

/**
 * اختلاف «مانده‌ی افتتاحیه» با مانده‌ی زنجیره‌ی گردش‌های یک تنخواه در تاریخ افتتاحیه (گردش‌های همان روز و قبل از آن + اختلاف‌های قبلی).
 * events: گردش‌های همان تنخواه (amount مثبت = شارژ). خروجی: گردش‌های تعدیلی با تاریخ افتتاحیه (فقط اختلاف غیرصفر).
 */
export function openingAdjustments(events: { date: Date; amount: number }[], openings: PettyCashOpeningRef[]): { date: Date; amount: number }[] {
  const out: { date: Date; amount: number }[] = [];
  let carried = 0;
  for (const o of openings) {
    const chain = events.filter((e) => e.date.getTime() <= o.date.getTime()).reduce((s, e) => s + e.amount, 0) + carried;
    const delta = Math.round((o.balance - chain) * 100) / 100;
    if (Math.abs(delta) > 0.001) {
      out.push({ date: o.date, amount: delta });
      carried += delta;
    }
  }
  return out;
}

/** همه‌ی گردش‌های تنخواه (شارژِ اسناد پرداخت تاییدشده + پرداخت‌های تنخواه + تعدیل افتتاحیه) تا تاریخ toDate (شامل همان روز). */
export async function getPettyCashMovements(toDate: Date, opts: { openingsBeforeDate?: Date } = {}): Promise<PettyCashMovement[]> {
  return withoutFiscalPeriodScope(async () => {
    const custodians = await prisma.pettyCashCustodian.findMany({ select: { id: true, pettyCashId: true } });
    const pettyCashByCustodian = new Map<number, number>(custodians.map((c: any) => [c.id, c.pettyCashId]));
    const movements: PettyCashMovement[] = [];

    const fundingLines = await prisma.paymentSettlementLine.findMany({
      where: { custodianId: { not: null }, paymentType: { nature: "TO_PETTY_CASH" }, payment: { status: "APPROVED", date: { lte: toDate } } },
      include: { payment: { include: { party: true } } },
    });
    for (const l of fundingLines as any[]) {
      const pettyCashId = pettyCashByCustodian.get(l.custodianId);
      if (!pettyCashId) continue;
      movements.push({
        key: `F${l.id}`,
        pettyCashId,
        custodianId: l.custodianId,
        date: l.payment.date,
        docType: "شارژ",
        docTypeCode: "FUNDING",
        docId: l.paymentId,
        docNumber: l.payment.number,
        partyDisplay: partyDisplay(l.payment.party),
        description: l.description || l.payment.description,
        inflow: Number(l.amount),
        outflow: 0,
      });
    }

    const spendings = await prisma.pettyCashPayment.findMany({ where: { date: { lte: toDate } }, include: { party: true } });
    for (const p of spendings as any[]) {
      const pettyCashId = pettyCashByCustodian.get(p.custodianId);
      if (!pettyCashId) continue;
      movements.push({
        key: `S${p.id}`,
        pettyCashId,
        custodianId: p.custodianId,
        date: p.date,
        docType: "پرداخت",
        docTypeCode: "SPENDING",
        docId: p.id,
        docNumber: p.id,
        partyDisplay: partyDisplay(p.party),
        description: p.description,
        inflow: 0,
        outflow: Number(p.amount),
      });
    }

    // تعدیل افتتاحیه‌ی هر تنخواه (تا toDate). گردشِ تعدیلی به تنخواه‌دار خاصی تعلق ندارد (custodianId = 0)
    const openings = (await loadPettyCashOpenings({ beforeDate: opts.openingsBeforeDate })).filter((o) => o.date <= toDate);
    const byPettyCash = new Map<number, PettyCashOpeningRef[]>();
    for (const o of openings) byPettyCash.set(o.pettyCashId, [...(byPettyCash.get(o.pettyCashId) || []), o]);
    for (const [pettyCashId, refs] of byPettyCash) {
      const events = movements.filter((m) => m.pettyCashId === pettyCashId).map((m) => ({ date: m.date, amount: m.inflow - m.outflow }));
      for (const [i, a] of openingAdjustments(events, refs).entries()) {
        movements.push({
          key: `O${pettyCashId}-${i}`,
          pettyCashId,
          custodianId: 0,
          date: a.date,
          docType: "افتتاحیه",
          docTypeCode: "OPENING",
          docId: 0,
          docNumber: 0,
          partyDisplay: "",
          description: "افتتاحیه‌ی تنخواه",
          inflow: a.amount > 0 ? a.amount : 0,
          outflow: a.amount < 0 ? -a.amount : 0,
        });
      }
    }
    return movements;
  });
}
