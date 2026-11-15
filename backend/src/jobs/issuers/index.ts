import { prisma } from "../../lib/prisma";
import { formatJalaliDateForMessage } from "../../utils/jalaliDate";
import { ISSUE_DRY_RUN_MESSAGE, IssueDryRunSignal } from "../../services/journalEntryService";
import { accountingApprovePayment, issuePaymentJournalEntry, previewPaymentIssuance } from "../../services/paymentJournalEntryService";
import { accountingApproveReceipt, issueReceiptJournalEntry, previewReceiptIssuance } from "../../services/receiptJournalEntryService";
import {
  accountingApprovePartySettlement,
  setPartySettlementUnapproved,
  issuePartySettlementJournal,
  previewPartySettlementIssuance,
} from "../../services/partySettlementService";
import { issueChequeDepositJournalEntry } from "../../services/chequeDepositJournalEntryService";
import { issueChequeDepositReturnJournalEntry } from "../../services/chequeDepositReturnJournalEntryService";
import { issueChequeClearingReceivableJournalEntry } from "../../services/chequeClearingReceivableJournalEntryService";
import { issueChequeClearingPayableJournalEntry } from "../../services/chequeClearingPayableJournalEntryService";
import { issuePettyCashSummaryJournalEntry } from "../../services/pettyCashSummaryJournalEntryService";
import { issueStoreDeliveryJournal } from "../../services/storeSaleDeliveryJournalService";
import { issueVoucherSaleJournal } from "../../services/voucherService";
import { issueDepreciationEntry } from "../../services/assetDepreciationService";
import { issueInsuranceEntry } from "../../services/assetInsuranceService";
import { issueChangeEntry } from "../../services/assetGroupChangeService";
import { issueExitEntry } from "../../services/assetExitService";
import { issueSalesInvoiceJournalHandler } from "../../routes/salesInvoices";
import { issueSalesReturnInvoiceJournalHandler } from "../../routes/salesReturnInvoices";
import { issuePurchaseInvoiceJournalHandler } from "../../routes/purchaseInvoices";
import { issueServicePurchaseInvoiceJournalHandler } from "../../routes/servicePurchaseInvoices";
import { issuePurchaseReturnJournalHandler } from "../../routes/purchaseReturns";
import type { IssueOutcome, IssuerCandidate, IssuerRange, JournalIssuer } from "./types";
import { partyTitle } from "../../utils/partyTitle";
import { invokeRouteHandler } from "../../utils/internalHandler";

// فهرست فرم‌هایی که کار «صدور سند حسابداری» می‌تواند برایشان سند بزند. ترتیب این آرایه ترتیب نمایش گروه‌ها در فرم تنظیمات و ترتیب تساوی هنگام
// ادغام بر اساس تاریخ است. نیاورده‌شده‌ها (و دلیلشان): صدور سند تحصیل دارایی (تاریخ سند را کاربر هنگام صدور تعیین می‌کند)، حقوق (ماه‌محور و دسته‌ای)،
// سند انبار (دسته‌ای)، بستن حساب‌ها و افتتاحیه/اختتامیه (عملیات یک‌باره‌ی پایان دوره، نه رکوردهای در انتظار).

const fa = (d: Date) => formatJalaliDateForMessage(d);
const num = (x: unknown) => (x == null ? null : Number(x));

const dateFilter = (r: IssuerRange) => (r.from || r.to ? { date: { ...(r.from ? { gte: r.from } : {}), ...(r.to ? { lte: r.to } : {}) } } : {});
const outcomeOf = (r: any): IssueOutcome => ({ number: num(r?.number), referenceNumber: num(r?.referenceNumber) });

/** فراخواننده‌ی handlerهای مسیر (فاکتورها/برگشت‌ها) با req/res ساختگی: همان منطق صدورِ دکمه‌ی دستی، بدون نسخه‌ی دوم */
async function callIssueHandler(handler: (req: any, res: any) => Promise<unknown>, id: number): Promise<IssueOutcome> {
  const { status, body } = await invokeRouteHandler(handler, id);
  if (status >= 400) {
    // handler خطاها را به پاسخ ۴۰۰ تبدیل می‌کند؛ سیگنال «صدور آزمایشی» هم باید سیگنال بماند
    if (body?.error === ISSUE_DRY_RUN_MESSAGE) throw new IssueDryRunSignal();
    throw new Error(body?.error || "خطا در صدور سند حسابداری");
  }
  return outcomeOf(body);
}

interface SimpleDocOptions {
  key: string;
  title: string;
  group: string;
  form: string;
  /** نام مدل Prisma (camelCase) */
  model: string;
  /** شرط اضافه روی رکورد (مثلاً status = APPROVED)؛ journalEntryId = null و بازه‌ی تاریخ همیشه اعمال می‌شود */
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  /** شرح خوانا؛ پیش‌فرض «عنوان شماره — تاریخ» */
  labelOf?: (row: any) => string;
  issue(id: number): Promise<unknown>;
  accounting?: {
    approve(id: number, userId: number | null): Promise<void>;
    unapprove(id: number): Promise<void>;
    preview(id: number): Promise<string[]>;
  };
}

/** سندهای یک‌خطی با ستون‌های استاندارد number/date/fiscalPeriodId/journalEntryId که صدورشان با شناسه‌ی سند انجام می‌شود */
function simpleDoc(o: SimpleDocOptions): JournalIssuer {
  const delegate = () => (prisma as any)[o.model];
  const acc = o.accounting;
  return {
    key: o.key,
    title: o.title,
    group: o.group,
    form: o.form,
    accountingApprove: !!acc,
    async find(range, take) {
      const rows = await delegate().findMany({
        where: { journalEntryId: null, ...(o.where ?? {}), ...dateFilter(range) },
        ...(o.include ? { include: o.include } : {}),
        orderBy: [{ date: "asc" }, { number: "asc" }],
        take,
      });
      return rows.map(
        (r: any): IssuerCandidate => ({
          id: r.id,
          number: r.number,
          date: r.date,
          fiscalPeriodId: r.fiscalPeriodId,
          label: o.labelOf ? o.labelOf(r) : `${o.title} ${r.number} — ${fa(r.date)}`,
          needsApprove: !!acc && r.accountingStatus !== "APPROVED",
        })
      );
    },
    ...(acc
      ? {
          preview: (c: IssuerCandidate) => acc.preview(c.id),
          approve: (c: IssuerCandidate, userId: number | null) => acc.approve(c.id, userId),
          unapprove: (c: IssuerCandidate) => acc.unapprove(c.id),
        }
      : {}),
    async issue(c) {
      return outcomeOf(await o.issue(c.id));
    },
  };
}

const treasuryLabel = (title: string) => (r: any) => {
  const total = (r.instrumentLines ?? []).reduce((s: number, l: any) => s + Number(l.baseAmount), 0);
  return `${title} ${r.number} — ${partyTitle(r.party)} — ${fa(r.date)} — ${total.toLocaleString("fa-IR")}`;
};
const resetAccounting = { accountingStatus: "NONE" as const, accountingApprovedAt: null, accountingApprovedById: null };

/** سند دوره‌ای (استهلاک/بیمه): کاندیدا = دوره‌ی گزارشگری که محاسبه‌ی آن مبلغ دارد و سند ندارد؛ صدور با شناسه‌ی دوره */
function periodRun(o: { key: string; title: string; group: string; form: string; model: "assetDepreciationRun" | "assetInsuranceRun"; label: string; issue(reportingPeriodId: number): Promise<unknown> }): JournalIssuer {
  return {
    key: o.key,
    title: o.title,
    group: o.group,
    form: o.form,
    accountingApprove: false,
    async find(range, take) {
      const rows = await (prisma as any)[o.model].findMany({
        where: {
          journalEntryId: null,
          totalAmount: { gt: 0 },
          ...(range.from || range.to ? { reportingPeriod: { toDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } } : {}),
        },
        include: { reportingPeriod: true },
        orderBy: { reportingPeriod: { toDate: "asc" } },
        take,
      });
      return rows.map(
        (r: any): IssuerCandidate => ({
          id: r.reportingPeriodId,
          number: Number.parseInt(r.reportingPeriod.code, 10) || 0,
          date: r.reportingPeriod.toDate,
          fiscalPeriodId: r.reportingPeriod.fiscalPeriodId,
          label: `${o.label} دوره ${r.reportingPeriod.code} — ${fa(r.reportingPeriod.toDate)}`,
          needsApprove: false,
        })
      );
    },
    async issue(c) {
      return outcomeOf(await o.issue(c.id));
    },
  };
}

const TREASURY = "مدیریت خزانه";
const SALES = "فروش";
const SUPPLY = "زنجیره تامین";
const STORE = "فروش فروشگاهی";
const CLUB = "باشگاه مشتریان";
const ASSETS = "دارایی ثابت";

export const ISSUERS: JournalIssuer[] = [
  simpleDoc({
    key: "payments",
    title: "اعلامیه پرداخت",
    group: TREASURY,
    form: "payments",
    model: "payment",
    where: { status: "APPROVED" },
    include: { party: true, instrumentLines: { select: { baseAmount: true } } },
    labelOf: treasuryLabel("اعلامیه پرداخت"),
    issue: (id) => issuePaymentJournalEntry(id),
    accounting: {
      approve: (id, userId) => accountingApprovePayment(id, userId),
      unapprove: async (id) => {
        await prisma.payment.update({ where: { id }, data: resetAccounting });
      },
      preview: (id) => previewPaymentIssuance(id),
    },
  }),
  simpleDoc({
    key: "receipts",
    title: "رسید دریافت",
    group: TREASURY,
    form: "receipts",
    model: "receipt",
    where: { status: "APPROVED" },
    include: { party: true, instrumentLines: { select: { baseAmount: true } } },
    labelOf: treasuryLabel("رسید دریافت"),
    issue: (id) => issueReceiptJournalEntry(id),
    accounting: {
      approve: (id, userId) => accountingApproveReceipt(id, userId),
      unapprove: async (id) => {
        await prisma.receipt.update({ where: { id }, data: resetAccounting });
      },
      preview: (id) => previewReceiptIssuance(id),
    },
  }),
  simpleDoc({
    key: "party-settlements",
    title: "اعلامیه بدهکار بستانکار",
    group: TREASURY,
    form: "party-settlements",
    model: "partySettlement",
    issue: (id) => issuePartySettlementJournal(id),
    accounting: {
      approve: (id, userId) => accountingApprovePartySettlement(id, userId),
      unapprove: (id) => setPartySettlementUnapproved(id),
      preview: (id) => previewPartySettlementIssuance(id),
    },
  }),
  simpleDoc({ key: "cheque-deposits", title: "واگذاری چک به بانک", group: TREASURY, form: "cheque-deposits", model: "chequeDeposit", where: { status: "APPROVED" }, issue: (id) => issueChequeDepositJournalEntry(id) }),
  simpleDoc({ key: "cheque-deposit-returns", title: "برگشت از واگذاری چک", group: TREASURY, form: "cheque-deposit-returns", model: "chequeDepositReturn", where: { status: "APPROVED" }, issue: (id) => issueChequeDepositReturnJournalEntry(id) }),
  simpleDoc({ key: "cheque-clearings-receivable", title: "وصول و برگشت چک دریافتنی", group: TREASURY, form: "cheque-clearings-receivable", model: "chequeClearingReceivable", where: { status: "APPROVED" }, issue: (id) => issueChequeClearingReceivableJournalEntry(id) }),
  simpleDoc({ key: "cheque-clearings-payable", title: "وصول و برگشت چک پرداختنی", group: TREASURY, form: "cheque-clearings-payable", model: "chequeClearingPayable", where: { status: "APPROVED" }, issue: (id) => issueChequeClearingPayableJournalEntry(id) }),
  simpleDoc({ key: "petty-cash-summaries", title: "خلاصه تنخواه", group: TREASURY, form: "petty-cash-summaries", model: "pettyCashSummary", where: { status: "APPROVED" }, issue: (id) => issuePettyCashSummaryJournalEntry(id) }),

  simpleDoc({ key: "sales-invoices", title: "فاکتور فروش", group: SALES, form: "sales-invoices", model: "salesInvoice", where: { status: { not: "VOIDED" } }, issue: (id) => callIssueHandler(issueSalesInvoiceJournalHandler, id) }),
  simpleDoc({ key: "sales-return-invoices", title: "فاکتور برگشت از فروش", group: SALES, form: "sales-return-invoices", model: "salesReturnInvoice", issue: (id) => callIssueHandler(issueSalesReturnInvoiceJournalHandler, id) }),

  simpleDoc({ key: "purchase-invoices", title: "فاکتور خرید", group: SUPPLY, form: "purchase-invoices", model: "purchaseInvoice", where: { status: "APPROVED" }, issue: (id) => callIssueHandler(issuePurchaseInvoiceJournalHandler, id) }),
  simpleDoc({ key: "service-purchase-invoices", title: "فاکتور خرید خدمات", group: SUPPLY, form: "service-purchase-invoices", model: "servicePurchaseInvoice", where: { status: "APPROVED" }, issue: (id) => callIssueHandler(issueServicePurchaseInvoiceJournalHandler, id) }),
  simpleDoc({ key: "purchase-returns", title: "برگشت خرید", group: SUPPLY, form: "purchase-returns", model: "purchaseReturn", issue: (id) => callIssueHandler(issuePurchaseReturnJournalHandler, id) }),

  simpleDoc({ key: "store-deliveries", title: "تحویل فروش فروشگاهی", group: STORE, form: "store-deliveries", model: "storeSaleDelivery", where: { status: "CONFIRMED" }, issue: (id) => issueStoreDeliveryJournal(id) }),
  simpleDoc({ key: "voucher-sales", title: "فروش بن‌کارت", group: CLUB, form: "voucher-sales", model: "voucherSale", issue: (id) => issueVoucherSaleJournal(id) }),

  periodRun({ key: "asset-depreciation", title: "استهلاک دارایی ثابت", group: ASSETS, form: "asset-depreciation", model: "assetDepreciationRun", label: "استهلاک", issue: (id) => issueDepreciationEntry(id) }),
  periodRun({ key: "asset-insurance-calculation", title: "هزینه‌ی بیمه‌ی دارایی ثابت", group: ASSETS, form: "asset-insurance-calculation", model: "assetInsuranceRun", label: "هزینه‌ی بیمه", issue: (id) => issueInsuranceEntry(id) }),
  simpleDoc({ key: "asset-group-changes", title: "تغییر گروه دارایی", group: ASSETS, form: "asset-group-changes", model: "assetGroupChange", where: { status: "CONFIRMED" }, issue: (id) => issueChangeEntry(id) }),
  simpleDoc({ key: "asset-exits", title: "خروج دارایی", group: ASSETS, form: "asset-exits", model: "assetExit", where: { status: "CONFIRMED" }, issue: (id) => issueExitEntry(id) }),
];

const byKey = new Map(ISSUERS.map((i) => [i.key, i]));
if (byKey.size !== ISSUERS.length) throw new Error("کلید صادرکننده‌های سند تکراری است");

export function getIssuer(key: string): JournalIssuer | undefined {
  return byKey.get(key);
}
