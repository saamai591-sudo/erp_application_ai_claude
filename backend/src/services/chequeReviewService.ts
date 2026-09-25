import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// =========================================================================
// منبع داده‌ی گزارش‌های «مرور اسناد دریافتنی» و «مرور اسناد پرداختنی» (مدیریت نقدینگی و چک > گزارش) —
// Documents/تغییرات نقدینگی و چک راه اندازی مرور اسناد دریافتی و پرداختی.md.
//
// «سند دریافتنی/پرداختنی» = چک دریافتنی/پرداختنی (ChequeItem). هیچ داده‌ی موازی ساخته نمی‌شود: هر «رویداد» مستقیم از ردیف اسناد تاییدشده‌ی
// چرخه‌ی عمر همان چک خوانده می‌شود:
//   دریافتنی: رسید دریافت (ردیف ابزار چک) · خرج چک (ردیف «چک انتقالی» سند پرداخت) · واگذاری به بانک · برگشت از واگذاری · وصول/برگشت
//   پرداختنی: صدور چک (ردیف ابزار چک سند پرداخت) · وصول/برگشت
//   و برای چک‌های افتتاحیه/انتقالی از سال قبل: رویداد «افتتاحیه» به تاریخ افتتاحیه‌ی دوره.
// بازه‌ی تاریخ = تاریخ همین اسناد؛ چکی در گزارش می‌آید که حداقل یک رویدادش (دریافت/صدور، واگذاری، وصول، ...) در بازه باشد.
// چون خزانه‌داری در پایان هر دوره بسته می‌شود، بازه نباید بیش از یک دوره‌ی مالی را شامل شود (assertSingleFiscalPeriod).
// =========================================================================

export type ChequeKind = "receivable" | "payable";

export const CHEQUE_STATUS_TITLES: Record<string, string> = {
  IN_HAND: "در دست",
  IN_COLLECTION: "در جریان وصول",
  ISSUED: "صادرشده",
  CLEARED: "وصول‌شده",
  BOUNCED: "برگشتی",
  ENDORSED: "خرج‌شده",
  CANCELLED: "باطل",
};

export interface ChequeEvent {
  key: string;
  chequeId: number;
  chequeNumber: string;
  partyDisplay: string;
  amount: number;
  date: Date;
  typeCode: string;
  typeTitle: string;
  docRoute: string | null;
  docId: number | null;
  docNumber: number | null;
  description: string | null;
}

export interface ChequeRow {
  id: number;
  number: string;
  partyDisplay: string;
  bankBranchTitle: string;
  dueDate: Date;
  amount: number;
  status: string;
  statusTitle: string;
  firstDate: Date | null;
  lastDate: Date | null;
  eventCount: number;
  events: ChequeEvent[];
}

function partyDisplay(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

/** از/تا باید در یک دوره‌ی مالی باشند؛ همان دوره را برمی‌گرداند */
export async function assertSingleFiscalPeriod(fromDate: Date, toDate: Date) {
  if (toDate < fromDate) throw new Error("«تا تاریخ» نباید قبل از «از تاریخ» باشد");
  const [a, b] = await Promise.all([
    prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: fromDate }, toDate: { gte: fromDate } } }),
    prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: toDate }, toDate: { gte: toDate } } }),
  ]);
  if (!a || !b) throw new Error("بازه‌ی تاریخ باید در یک دوره‌ی مالی تعریف‌شده باشد");
  if (a.id !== b.id) throw new Error("بازه‌ی گزارش نمی‌تواند بیش از یک دوره‌ی مالی را شامل شود (خزانه‌داری در پایان هر دوره بسته می‌شود)");
  return a;
}

export async function getChequeReviewRows(kind: ChequeKind, fromDate: Date, toDate: Date): Promise<ChequeRow[]> {
  const period = await assertSingleFiscalPeriod(fromDate, toDate);
  return withoutFiscalPeriodScope(async () => {
    const cheques: any[] = await prisma.chequeItem.findMany({
      where: { direction: kind === "receivable" ? "RECEIVABLE" : "PAYABLE", fiscalPeriodId: period.id },
      include: {
        party: true,
        bankBranch: true,
        receiptInstrumentLines: { include: { receipt: { include: { party: true } } } },
        paymentInstrumentLines: { include: { payment: { include: { party: true } } } },
        depositLines: { include: { chequeDeposit: true } },
        depositReturnLines: { include: { chequeDepositReturn: true } },
        clearingReceivableLines: { include: { chequeClearingReceivable: true } },
        clearingPayableLines: { include: { chequeClearingPayable: true } },
      },
      orderBy: { id: "asc" },
    });
    const opening = await prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: period.id } });

    const rows: ChequeRow[] = [];
    for (const c of cheques) {
      const events: ChequeEvent[] = [];
      const base = { chequeId: c.id, chequeNumber: c.number, partyDisplay: partyDisplay(c.party), amount: Number(c.amount) };
      const push = (key: string, date: Date, typeCode: string, typeTitle: string, docRoute: string | null, docId: number | null, docNumber: number | null, description: string | null) =>
        events.push({ ...base, key: `${c.id}:${key}`, date, typeCode, typeTitle, docRoute, docId, docNumber, description });

      if (c.isOpening && opening) push("open", opening.date, "OPENING", "افتتاحیه", "/treasury-openings", opening.id, null, c.description);
      for (const l of c.receiptInstrumentLines) {
        if (l.receipt.status !== "APPROVED") continue;
        push(`R${l.id}`, l.receipt.date, "RECEIPT", "رسید دریافت", "/receipts", l.receiptId, l.receipt.number, l.description || l.receipt.description);
      }
      for (const l of c.paymentInstrumentLines) {
        if (l.payment.status !== "APPROVED") continue;
        const title = l.type === "CHEQUE_TRANSFER" ? "خرج چک (سند پرداخت)" : "صدور چک (سند پرداخت)";
        push(`P${l.id}`, l.payment.date, l.type === "CHEQUE_TRANSFER" ? "ENDORSE" : "ISSUE", title, "/payments", l.paymentId, l.payment.number, l.description || l.payment.description);
      }
      for (const l of c.depositLines) {
        if (l.chequeDeposit.status !== "APPROVED") continue;
        push(`D${l.id}`, l.chequeDeposit.date, "DEPOSIT", "واگذاری به بانک", "/cheque-deposits", l.chequeDepositId, l.chequeDeposit.number, l.chequeDeposit.description);
      }
      for (const l of c.depositReturnLines) {
        if (l.chequeDepositReturn.status !== "APPROVED") continue;
        push(`DR${l.id}`, l.chequeDepositReturn.date, "DEPOSIT_RETURN", "برگشت از واگذاری", "/cheque-deposit-returns", l.chequeDepositReturnId, l.chequeDepositReturn.number, l.chequeDepositReturn.description);
      }
      for (const l of c.clearingReceivableLines) {
        if (l.chequeClearingReceivable.status !== "APPROVED") continue;
        push(`CR${l.id}`, l.chequeClearingReceivable.date, "CLEARING", l.outcome === "CLEARED" ? "وصول چک" : "برگشت چک", "/cheque-clearings-receivable", l.chequeClearingReceivableId, l.chequeClearingReceivable.number, l.chequeClearingReceivable.description);
      }
      for (const l of c.clearingPayableLines) {
        if (l.chequeClearingPayable.status !== "APPROVED") continue;
        push(`CP${l.id}`, l.chequeClearingPayable.date, "CLEARING", l.outcome === "CLEARED" ? "وصول چک" : "برگشت چک", "/cheque-clearings-payable", l.chequeClearingPayableId, l.chequeClearingPayable.number, l.chequeClearingPayable.description);
      }

      // چک فقط اگر حداقل یک رویدادش (تاریخ دریافت/صدور/واگذاری/وصول ...) در بازه باشد می‌آید
      const inRange = events.filter((e) => e.date >= fromDate && e.date <= toDate);
      if (inRange.length === 0) continue;
      events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
      rows.push({
        id: c.id,
        number: c.number,
        partyDisplay: base.partyDisplay,
        bankBranchTitle: c.bankBranch?.title || "",
        dueDate: c.dueDate,
        amount: base.amount,
        status: c.status,
        statusTitle: CHEQUE_STATUS_TITLES[c.status] || c.status,
        firstDate: inRange[0].date,
        lastDate: inRange[inRange.length - 1].date,
        eventCount: inRange.length,
        events: inRange,
      });
    }
    return rows;
  });
}
