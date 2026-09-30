import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش «مرور تنخواه» (خزانه‌داری > گزارش). هر «گردش تنخواه» یک ورودی (شارژ) یا خروجی (پرداخت) روی یک تنخواه‌دار
// (و تنخواهِ او) است، به ارز خودِ تنخواه (پرداخت تنخواه فیلد ارز جدا ندارد و ردیف «به تنخواه» سند پرداخت هم به ارز همان تنخواه ثبت می‌شود):
//   ورودی (شارژ): ردیف موضوع پرداختِ ماهیت «به تنخواه» در سند پرداختِ «تایید»شده — به تاریخ سند پرداخت
//   خروجی (پرداخت): «پرداخت تنخواه» (PettyCashPayment) — به تاریخ خودش (این سند تاییدی ندارد، پس همه‌ی رکوردها حساب می‌شوند)
// برخلاف صندوق/بانک، برای تنخواه «افتتاحیه» و انتقال مانده‌ی پایان سال وجود ندارد؛ پس مانده از ابتدای تاریخ‌ها (نه فقط دوره‌ی مالیِ
// جاری) پیوسته است و مانده‌ی ابتدای بازه = جمع همه‌ی گردش‌های قبل از «از تاریخ»، بدون محدودیت دوره‌ی مالی.
// =========================================================================

export interface PettyCashMovement {
  key: string;
  pettyCashId: number;
  custodianId: number;
  date: Date;
  docType: string;
  docTypeCode: "FUNDING" | "SPENDING";
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

/** همه‌ی گردش‌های تنخواه (شارژِ اسناد پرداخت تاییدشده + پرداخت‌های تنخواه) تا تاریخ toDate (شامل همان روز). */
export async function getPettyCashMovements(toDate: Date): Promise<PettyCashMovement[]> {
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

    return movements;
  });
}
