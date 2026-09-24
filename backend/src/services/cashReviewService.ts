import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش «مرور صندوق» (خزانه‌داری > گزارش). هر «گردش صندوق» یک ورودی (دریافت) یا خروجی (پرداخت) روی
// یک صندوق است، فقط از اسناد «تایید»شده، و به ارز پایه (baseAmount ردیف ابزار):
//   ورودی: ردیف ابزار «نقد» سند دریافت — به صندوق همان ردیف
//   خروجی: ردیف ابزار «نقد» سند پرداخت — از صندوق همان ردیف
// گزارش به «دوره‌ی مالیِ» تاریخ «از» محدود است: گردش‌ها از ابتدای همان دوره شروع می‌شوند و مانده‌ی اول دوره از «افتتاحیه دریافت
// و پرداخت» همان دوره (TreasuryOpeningCashBox) به‌صورت یک گردش «افتتاحیه» به تاریخ روز قبل از شروع دوره می‌آید. مانده‌ی ابتدای بازه =
// جمع گردش‌های قبل از «از تاریخ» (شامل افتتاحیه).
// =========================================================================

export interface CashMovement {
  key: string;
  cashBoxId: number;
  date: Date;
  docType: string;
  docTypeCode: "RECEIPT" | "PAYMENT" | "OPENING";
  docId: number;
  docNumber: number;
  partyDisplay: string;
  description: string | null;
  inflow: number;
  outflow: number;
  // ارز و مبلغ به ارز خودِ ردیف (برای انتقال مانده‌ی پایان سال به تفکیک ارز)؛ inflow/outflow همیشه به ارز پایه است
  currencyId: number;
  currencyInflow: number;
  currencyOutflow: number;
}

export interface CashBoxMeta {
  id: number;
  code: string;
  title: string;
}

function partyDisplay(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

export async function loadCashBoxes(): Promise<Map<number, CashBoxMeta>> {
  const boxes = await prisma.cashBox.findMany();
  return new Map(boxes.map((b: any) => [b.id, { id: b.id, code: b.detailCode, title: b.title }]));
}

/** همه‌ی گردش‌های صندوقِ اسناد تاییدشده تا تاریخ toDate (شامل همان روز)، بدون محدودیت دوره‌ی مالی. */
export async function getCashMovements(toDate: Date, fromDate?: Date): Promise<CashMovement[]> {
  return withoutFiscalPeriodScope(async () => {
    const movements: CashMovement[] = [];
    const period = fromDate ? await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: fromDate }, toDate: { gte: fromDate } } }) : null;
    const dateRange: any = period ? { gte: period.fromDate, lte: toDate } : { lte: toDate };

    const receiptLines = await prisma.receiptInstrumentLine.findMany({
      where: { type: "CASH", cashBoxId: { not: null }, receipt: { status: "APPROVED", date: dateRange } },
      include: { receipt: { include: { party: true } } },
    });
    for (const l of receiptLines as any[]) {
      movements.push({
        key: `R${l.id}`,
        cashBoxId: l.cashBoxId,
        date: l.receipt.date,
        docType: "دریافت",
        docTypeCode: "RECEIPT",
        docId: l.receiptId,
        docNumber: l.receipt.number,
        partyDisplay: partyDisplay(l.receipt.party),
        description: l.description || l.receipt.description,
        inflow: Number(l.baseAmount),
        outflow: 0,
        currencyId: l.currencyId,
        currencyInflow: Number(l.amount),
        currencyOutflow: 0,
      });
    }

    const paymentLines = await prisma.paymentInstrumentLine.findMany({
      where: { type: "CASH", cashBoxId: { not: null }, payment: { status: "APPROVED", date: dateRange } },
      include: { payment: { include: { party: true } } },
    });
    for (const l of paymentLines as any[]) {
      movements.push({
        key: `P${l.id}`,
        cashBoxId: l.cashBoxId,
        date: l.payment.date,
        docType: "پرداخت",
        docTypeCode: "PAYMENT",
        docId: l.paymentId,
        docNumber: l.payment.number,
        partyDisplay: partyDisplay(l.payment.party),
        description: l.description || l.payment.description,
        inflow: 0,
        outflow: Number(l.baseAmount),
        currencyId: l.currencyId,
        currencyInflow: 0,
        currencyOutflow: Number(l.amount),
      });
    }

    if (period) {
      const openingLines = await prisma.treasuryOpeningCashBox.findMany({ where: { opening: { fiscalPeriodId: period.id } } });
      const before = new Date(period.fromDate.getTime() - 86400000);
      for (const l of openingLines as any[]) {
        const base = Number(l.baseBalance);
        const cur = Number(l.balance);
        movements.push({
          key: `O${l.id}`,
          cashBoxId: l.cashBoxId,
          date: before,
          docType: "افتتاحیه",
          docTypeCode: "OPENING",
          docId: l.openingId,
          docNumber: 0,
          partyDisplay: "",
          description: "مانده اول دوره",
          inflow: base > 0 ? base : 0,
          outflow: base < 0 ? -base : 0,
          currencyId: l.currencyId,
          currencyInflow: cur > 0 ? cur : 0,
          currencyOutflow: cur < 0 ? -cur : 0,
        });
      }
    }

    return movements;
  });
}
