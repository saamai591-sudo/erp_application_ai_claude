import { prisma } from "../lib/prisma";
import { getLineAmounts } from "./documentItemAmountService";

// =========================================================================
// گزارش «مرور خرید» (زنجیره تامین > گزارش) — هم‌الگوی «مرور فروش» (services/salesReviewService.ts) — منبع داده‌ی مشترک همه‌ی تب‌ها.
//
//   خرید:        PurchaseInvoiceLine فاکتورهای خرید «تاییدشده» (فقط تاییدشده اثر حسابداری/خرید واقعی دارد)؛ مبلغ/تخفیف از baseAmount/baseDiscount و
//                ارزش‌افزوده از vatAmount که از قبل همیشه به ارز پایه ذخیره شده‌اند (پس تبدیل ارز لازم نیست).
//   برگشت خرید: ردیف‌های سند «برگشت به تامین‌کننده» (SUPPLIER_RETURN). برخلاف فروش، برگشت از خرید فاکتور مالی جدا ندارد؛ پس مقدار از خود ردیف و مبلغ
//                از تاریخچه‌ی مبلغ ردیف انبار (getLineAmounts، ارز پایه، فقط بعد از محاسبه‌ی قیمت) خوانده می‌شود و تخفیف/ارزش‌افزوده ندارد. سند برگشت
//                «نوع خرید» ندارد؛ در تب «نوع خرید» زیر ردیف «نامشخص (برگشت از خرید)» می‌آید.
//   بُعد تامین‌کننده بر اساس طرف حساب (Party) است: فاکتور خرید partyId و سند انبار detailCode طرف حساب را دارد.
// خدمات: ردیف‌های «فاکتور خرید خدمات» تاییدشده (PurchaseCostLine) هم در همین جمع‌ها می‌آیند؛ «خدمت» یک GoodsItem است (گروه/گروه حسابداری دارد)، پس در همان
// ابعاد کالا قرار می‌گیرد؛ مقدار ندارد (۰) و مبلغ/تخفیف/ارزش‌افزوده از baseAmount/baseDiscount/vatAmount (ارز پایه).
// =========================================================================

export interface PurchaseLineFilters {
  fromDate: Date;
  toDate: Date;
  purchaseTypeIds?: number[];
  supplierPartyIds?: number[];
  goodsItemIds?: number[];
  /** شناسه‌ی فاکتور: مثبت = فاکتور خرید کالا، منفی = فاکتور خرید خدمات (قرارداد تب «اسناد»، چون دو جدول id جدا دارند) */
  invoiceIds?: number[];
}

export type PurchaseDocumentKind = "GOODS" | "SERVICE";

/** «نوع خرید» ناشناخته‌ی ردیف‌های برگشت از خرید */
export const UNKNOWN_PURCHASE_TYPE_ID = 0;

interface PurchaseDimensionFields {
  supplierPartyId: number;
  supplierCode: string;
  supplierTitle: string;
  purchaseTypeId: number;
  purchaseTypeCode: number;
  purchaseTypeTitle: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  goodsGroupId: number;
  accountingGroupId: number;
  accountingGroupCode: number;
  accountingGroupTitle: string;
  unitTitle: string;
  quantity: number;
  amount: number;
  discount: number;
  vatAmount: number;
}

export interface PurchaseLine extends PurchaseDimensionFields {
  lineId: number;
  purchaseInvoiceId: number;
  purchaseInvoiceNumber: number;
  documentKind: PurchaseDocumentKind;
  date: Date;
}

export interface PurchaseReturnLine extends PurchaseDimensionFields {
  lineId: number;
  supplierReturnId: number;
  supplierReturnNumber: number;
  date: Date;
}

function partyTitle(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

/** کد نمایشی تامین‌کننده: کد تامین‌کننده‌ی تعریف‌شده، وگرنه کد تفصیلی طرف حساب */
async function loadSupplierCodes(): Promise<Map<number, number>> {
  const suppliers = await prisma.supplier.findMany({ select: { partyId: true, code: true } });
  return new Map(suppliers.map((s) => [s.partyId, s.code]));
}

export async function getPurchaseLines(f: PurchaseLineFilters): Promise<PurchaseLine[]> {
  const goodsInvoiceIds = f.invoiceIds?.filter((n) => n > 0);
  const serviceInvoiceIds = f.invoiceIds?.filter((n) => n < 0).map((n) => -n);
  const onlyInvoices = !!f.invoiceIds?.length;
  const codes = await loadSupplierCodes();

  const goods = !onlyInvoices || goodsInvoiceIds!.length
    ? await prisma.purchaseInvoiceLine.findMany({
        where: {
          purchaseInvoice: {
            status: "APPROVED",
            date: { gte: f.fromDate, lte: f.toDate },
            ...(f.purchaseTypeIds?.length ? { purchaseTypeId: { in: f.purchaseTypeIds } } : {}),
            ...(f.supplierPartyIds?.length ? { partyId: { in: f.supplierPartyIds } } : {}),
            ...(goodsInvoiceIds?.length ? { id: { in: goodsInvoiceIds } } : {}),
          },
          ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
        },
        include: {
          purchaseInvoice: { include: { party: true, purchaseType: true } },
          goodsItem: { include: { accountingGroup: true } },
          unit: true,
        },
        orderBy: [{ purchaseInvoice: { date: "asc" } }, { purchaseInvoiceId: "asc" }, { rowOrder: "asc" }],
      })
    : [];

  const goodsLines: PurchaseLine[] = goods.map((l: any) => ({
    lineId: l.id,
    purchaseInvoiceId: l.purchaseInvoiceId,
    purchaseInvoiceNumber: l.purchaseInvoice.number,
    documentKind: "GOODS" as const,
    date: l.purchaseInvoice.date,
    supplierPartyId: l.purchaseInvoice.partyId,
    supplierCode: String(codes.get(l.purchaseInvoice.partyId) ?? l.purchaseInvoice.party.detailCode),
    supplierTitle: partyTitle(l.purchaseInvoice.party),
    purchaseTypeId: l.purchaseInvoice.purchaseTypeId,
    purchaseTypeCode: l.purchaseInvoice.purchaseType.code,
    purchaseTypeTitle: l.purchaseInvoice.purchaseType.title,
    goodsItemId: l.goodsItemId,
    goodsItemCode: l.goodsItem.fullCode,
    goodsItemTitle: l.goodsItem.title,
    goodsGroupId: l.goodsItem.goodsGroupId,
    accountingGroupId: l.goodsItem.accountingGroupId,
    accountingGroupCode: l.goodsItem.accountingGroup.code,
    accountingGroupTitle: l.goodsItem.accountingGroup.title,
    unitTitle: l.unit.title,
    quantity: Number(l.quantity),
    amount: Number(l.baseAmount),
    discount: Number(l.baseDiscount),
    vatAmount: Number(l.vatAmount),
  }));

  const services = !onlyInvoices || serviceInvoiceIds!.length
    ? await prisma.purchaseCostLine.findMany({
        where: {
          servicePurchaseInvoice: {
            status: "APPROVED",
            date: { gte: f.fromDate, lte: f.toDate },
            ...(f.purchaseTypeIds?.length ? { purchaseTypeId: { in: f.purchaseTypeIds } } : {}),
            ...(f.supplierPartyIds?.length ? { partyId: { in: f.supplierPartyIds } } : {}),
            ...(serviceInvoiceIds?.length ? { id: { in: serviceInvoiceIds } } : {}),
          },
          ...(f.goodsItemIds?.length ? { serviceId: { in: f.goodsItemIds } } : {}),
        },
        include: {
          servicePurchaseInvoice: { include: { party: true, purchaseType: true } },
          service: { include: { accountingGroup: true } },
        },
        orderBy: [{ servicePurchaseInvoice: { date: "asc" } }, { servicePurchaseInvoiceId: "asc" }, { rowOrder: "asc" }],
      })
    : [];

  const serviceLines: PurchaseLine[] = services.map((l: any) => ({
    lineId: l.id,
    purchaseInvoiceId: l.servicePurchaseInvoiceId,
    purchaseInvoiceNumber: l.servicePurchaseInvoice.number,
    documentKind: "SERVICE" as const,
    date: l.servicePurchaseInvoice.date,
    supplierPartyId: l.servicePurchaseInvoice.partyId,
    supplierCode: String(codes.get(l.servicePurchaseInvoice.partyId) ?? l.servicePurchaseInvoice.party.detailCode),
    supplierTitle: partyTitle(l.servicePurchaseInvoice.party),
    purchaseTypeId: l.servicePurchaseInvoice.purchaseTypeId,
    purchaseTypeCode: l.servicePurchaseInvoice.purchaseType.code,
    purchaseTypeTitle: l.servicePurchaseInvoice.purchaseType.title,
    goodsItemId: l.serviceId,
    goodsItemCode: l.service.fullCode,
    goodsItemTitle: l.service.title,
    goodsGroupId: l.service.goodsGroupId,
    accountingGroupId: l.service.accountingGroupId,
    accountingGroupCode: l.service.accountingGroup.code,
    accountingGroupTitle: l.service.accountingGroup.title,
    unitTitle: "",
    quantity: 0,
    amount: Number(l.baseAmount),
    discount: Number(l.baseDiscount),
    vatAmount: Number(l.vatAmount),
  }));

  return [...goodsLines, ...serviceLines].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.purchaseInvoiceNumber - b.purchaseInvoiceNumber || a.lineId - b.lineId
  );
}

/**
 * برگشت به تامین‌کننده. مثل فروش، وقتی فیلتر invoiceIds (انتخاب یک فاکتور در تب «اسناد») فعال است برگشت‌ها کنار گذاشته می‌شوند چون به فاکتور
 * خرید ارجاع ندارند؛ و اگر فیلتر «نوع خرید» فعال باشد فقط وقتی «نامشخص» هم انتخاب شده باشد می‌آیند.
 */
export async function getPurchaseReturnLines(f: PurchaseLineFilters): Promise<PurchaseReturnLine[]> {
  if (f.invoiceIds?.length) return [];
  if (f.purchaseTypeIds?.length && !f.purchaseTypeIds.includes(UNKNOWN_PURCHASE_TYPE_ID)) return [];

  let detailCodes: string[] | undefined;
  if (f.supplierPartyIds?.length) {
    const parties = await prisma.party.findMany({ where: { id: { in: f.supplierPartyIds } }, select: { detailCode: true } });
    detailCodes = parties.map((p) => p.detailCode);
  }

  const lines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: {
        documentType: "SUPPLIER_RETURN",
        date: { gte: f.fromDate, lte: f.toDate },
        ...(detailCodes ? { detailCode: { in: detailCodes } } : {}),
      },
      ...(f.goodsItemIds?.length ? { goodsItemId: { in: f.goodsItemIds } } : {}),
    },
    include: { document: true, goodsItem: { include: { accountingGroup: true } }, unit: true },
    orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }],
  });
  if (lines.length === 0) return [];

  const amounts = await getLineAmounts(lines.map((l) => l.id));
  const partyCodes = Array.from(new Set(lines.map((l: any) => l.document.detailCode).filter(Boolean))) as string[];
  const parties = await prisma.party.findMany({ where: { detailCode: { in: partyCodes } } });
  const partyByCode = new Map(parties.map((p) => [p.detailCode, p]));
  const codes = await loadSupplierCodes();

  return lines.map((l: any) => {
    const party = partyByCode.get(l.document.detailCode);
    return {
      lineId: l.id,
      supplierReturnId: l.documentId,
      supplierReturnNumber: l.document.number,
      date: l.document.date,
      supplierPartyId: party?.id ?? 0,
      supplierCode: String(party ? codes.get(party.id) ?? party.detailCode : l.document.detailCode ?? ""),
      supplierTitle: party ? partyTitle(party) : l.document.detailCode ?? "",
      purchaseTypeId: UNKNOWN_PURCHASE_TYPE_ID,
      purchaseTypeCode: 0,
      purchaseTypeTitle: "نامشخص (برگشت از خرید)",
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      goodsGroupId: l.goodsItem.goodsGroupId,
      accountingGroupId: l.goodsItem.accountingGroupId,
      accountingGroupCode: l.goodsItem.accountingGroup.code,
      accountingGroupTitle: l.goodsItem.accountingGroup.title,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      amount: Number(amounts.get(l.id) ?? 0),
      discount: 0,
      vatAmount: 0,
    };
  });
}
