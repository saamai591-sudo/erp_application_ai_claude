import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش «مرور صندوق» (خزانه‌داری > گزارش). هر «گردش صندوق» یک ورودی (دریافت) یا خروجی (پرداخت) روی
// یک صندوق است، فقط از اسناد «تایید»شده، و به ارز پایه (baseAmount ردیف ابزار):
//   ورودی: ردیف ابزار «نقد» سند دریافت — به صندوق همان ردیف
//   خروجی: ردیف ابزار «نقد» سند پرداخت — از صندوق همان ردیف
// مانده‌ی ابتدای دوره = جمع گردش‌های قبل از «از تاریخ» (تجمعی از اولین سند؛ بدون محدودیت دوره‌ی مالی).
// =========================================================================

export interface CashMovement {
  key: string;
  cashBoxId: number;
  date: Date;
  docType: string;
  docTypeCode: "RECEIPT" | "PAYMENT";
  docId: number;
  docNumber: number;
  partyDisplay: string;
  description: string | null;
  inflow: number;
  outflow: number;
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
export async function getCashMovements(toDate: Date): Promise<CashMovement[]> {
  return withoutFiscalPeriodScope(async () => {
    const movements: CashMovement[] = [];

    const receiptLines = await prisma.receiptInstrumentLine.findMany({
      where: { type: "CASH", cashBoxId: { not: null }, receipt: { status: "APPROVED", date: { lte: toDate } } },
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
      });
    }

    const paymentLines = await prisma.paymentInstrumentLine.findMany({
      where: { type: "CASH", cashBoxId: { not: null }, payment: { status: "APPROVED", date: { lte: toDate } } },
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
      });
    }

    return movements;
  });
}
