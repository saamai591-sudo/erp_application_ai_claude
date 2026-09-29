"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALES_INVOICE_ADVANCE_LOCKS = exports.ADVANCE_NATURES = void 0;
exports.getAdvanceLockReasons = getAdvanceLockReasons;
exports.assertAdvanceEditable = assertAdvanceEditable;
exports.salesInvoiceNetTotal = salesInvoiceNetTotal;
exports.salesInvoiceVatTotal = salesInvoiceVatTotal;
exports.getSalesInvoiceAdvanceState = getSalesInvoiceAdvanceState;
exports.saveSalesInvoiceAdvanceAllocations = saveSalesInvoiceAdvanceAllocations;
exports.assertReceiptAdvanceNotAllocated = assertReceiptAdvanceNotAllocated;
exports.assertAdvanceAllocationsStillValid = assertAdvanceAllocationsStillValid;
const prisma_1 = require("../lib/prisma");
// =========================================================================
// تخصیص پیش‌دریافت به فاکتور فروش — طبق Documents/تخصیص پیش دریافت.md و Documents/تغییرات تخصیص پیش‌دریافت.md.
// دو ماهیت قابل تخصیص است: «پیش‌دریافت» (ADVANCE_RECEIPT، سقف = مبلغ فاکتور) و «پیش‌دریافت ارزش افزوده» (ADVANCE_VAT_RECEIPT، سقف = ارزش افزوده‌ی فاکتور)؛
// مبلغ هر ماهیت جدا نگهداری، کنترل و در سند حسابداری جدا (روی دریافتنی/ارزش‌افزوده‌ی همان بخش) لحاظ می‌شود و هرگز با هم جمع نمی‌شوند.
// یک عملیات مستقل از ثبت/ویرایش اطلاعات اصلی فاکتور: هر تخصیص یک ردیف موضوع دریافتِ «پیش‌دریافت» (ReceiptSettlementLine با ماهیت ADVANCE_RECEIPT
// روی رسید تاییدشده) را با یک مبلغ (به ارز فاکتور) به فاکتور وصل می‌کند. یک پیش‌دریافت می‌تواند به چند فاکتور و یک فاکتور از چند پیش‌دریافت استفاده کند.
// تفاوت نرخ ارز هرگز روی مبلغ ارزی تخصیص/مانده قابل پرداخت اثر نمی‌گذارد؛ فقط هنگام صدور سند حسابداری فاکتور (routes/salesInvoices.ts) بر اساس
// «رویه‌ها و تنظیمات حسابداری» (روش شناسایی پیش‌دریافت ارزی معتبر در تاریخ فاکتور) لحاظ می‌شود.
// =========================================================================
const TOLERANCE = 0.005;
exports.ADVANCE_NATURES = ["ADVANCE_RECEIPT", "ADVANCE_VAT_RECEIPT"];
const NATURE_FA = { ADVANCE_RECEIPT: "پیش‌دریافت", ADVANCE_VAT_RECEIPT: "پیش‌دریافت ارزش افزوده" };
exports.SALES_INVOICE_ADVANCE_LOCKS = [
    {
        // گردش پرداخت: هر ردیف موضوع دریافت/پرداختی که به این فاکتور ارجاع داده باشد
        key: "PAYMENT_FLOW",
        check: async (invoiceId) => {
            const receipts = await prisma_1.prisma.receiptSettlementLine.count({ where: { salesInvoiceId: invoiceId } });
            const payments = await prisma_1.prisma.paymentSettlementLine.count({ where: { salesInvoiceId: invoiceId } });
            return receipts + payments > 0
                ? "برای این فاکتور گردش پرداخت (دریافت/پرداخت) ثبت شده است؛ امکان ایجاد، ویرایش یا حذف تخصیص پیش‌دریافت وجود ندارد"
                : null;
        },
    },
    {
        // سند حسابداری صادرشده: سند فاکتور از روی تخصیص‌ها ساخته می‌شود، پس بعد از صدور نباید تخصیص تغییر کند
        key: "JOURNAL_ENTRY",
        check: async (invoiceId) => {
            const inv = await prisma_1.prisma.salesInvoice.findUnique({ where: { id: invoiceId }, select: { journalEntryId: true } });
            return inv?.journalEntryId ? "برای این فاکتور سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید" : null;
        },
    },
];
async function getAdvanceLockReasons(invoiceId) {
    const reasons = [];
    for (const lock of exports.SALES_INVOICE_ADVANCE_LOCKS) {
        // eslint-disable-next-line no-await-in-loop
        const r = await lock.check(invoiceId);
        if (r)
            reasons.push(r);
    }
    return reasons;
}
async function assertAdvanceEditable(invoiceId) {
    const reasons = await getAdvanceLockReasons(invoiceId);
    if (reasons.length > 0)
        throw new Error(reasons.join("\n"));
}
/** مبلغ فاکتور به ارز فاکتور: جمع (مبلغ − تخفیف) ردیف‌ها (ارزش‌افزوده همیشه به ارز مبنا است و در این مبلغ نمی‌آید) */
function salesInvoiceNetTotal(lines) {
    return lines.reduce((s, l) => s + Number(l.amount) - Number(l.discount), 0);
}
/** ارزش‌افزوده‌ی فاکتور به «ارز فاکتور»: vatAmount ردیف‌ها همیشه به ارز مبنا ذخیره می‌شود، پس برای فاکتور ارزی بر نرخ فاکتور تقسیم می‌شود */
function salesInvoiceVatTotal(lines, fxRate) {
    const base = lines.reduce((s, l) => s + Number(l.vatAmount || 0), 0);
    const rate = Number(fxRate) > 0 ? Number(fxRate) : 1;
    return Math.round((base / rate) * 100) / 100;
}
async function loadInvoice(invoiceId) {
    const invoice = await prisma_1.prisma.salesInvoice.findUnique({
        where: { id: invoiceId },
        include: { customer: { include: { party: true } }, currency: true, lines: true },
    });
    if (!invoice)
        throw new Error("فاکتور فروش یافت نشد");
    return invoice;
}
function partyName(p) {
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
// پیش‌دریافت‌های قابل نمایش برای یک فاکتور (شرایط بند ۳ مستند): طرف حساب یکسان، نوع دریافت «پیش‌دریافت»، رسید تاییدشده، تاریخ دریافت ≤ تاریخ فاکتور،
// ارز یکسان و مبلغ قابل تخصیص > صفر (ردیف‌هایی که همین فاکتور از آن‌ها تخصیص گرفته هم برای ویرایش نمایش داده می‌شوند).
async function getSalesInvoiceAdvanceState(invoiceId) {
    const invoice = await loadInvoice(invoiceId);
    const total = salesInvoiceNetTotal(invoice.lines);
    const vatTotal = salesInvoiceVatTotal(invoice.lines, Number(invoice.fxRate));
    const lines = await prisma_1.prisma.receiptSettlementLine.findMany({
        where: {
            partyId: invoice.customer.partyId,
            currencyId: invoice.currencyId,
            receiptType: { nature: { in: exports.ADVANCE_NATURES } },
            receipt: { status: "APPROVED", date: { lte: invoice.date } },
        },
        include: { receipt: true, receiptType: true, currency: true, advanceAllocations: true },
        orderBy: { id: "asc" },
    });
    const candidates = lines
        .map((l) => {
        const original = Number(l.amount);
        const allocatedToThis = l.advanceAllocations.filter((a) => a.salesInvoiceId === invoiceId).reduce((s, a) => s + Number(a.amount), 0);
        const allocatedToOthers = l.advanceAllocations.filter((a) => a.salesInvoiceId !== invoiceId).reduce((s, a) => s + Number(a.amount), 0);
        return {
            receiptSettlementLineId: l.id,
            nature: l.receiptType.nature,
            natureTitle: NATURE_FA[l.receiptType.nature],
            receiptId: l.receiptId,
            receiptNumber: l.receipt.number,
            receiptDate: l.receipt.date,
            currencyTitle: l.currency.title,
            fxRate: Number(l.fxRate),
            originalAmount: original,
            allocatedAmount: allocatedToThis + allocatedToOthers,
            // مبلغ قابل تخصیص به این فاکتور (بدون احتساب تخصیص فعلیِ خودِ این فاکتور)
            allocatableAmount: original - allocatedToOthers,
            allocatedToThis,
        };
    })
        .filter((c) => c.allocatableAmount > TOLERANCE);
    const allocations = await prisma_1.prisma.salesInvoiceAdvanceAllocation.findMany({ where: { salesInvoiceId: invoiceId }, orderBy: { id: "asc" } });
    const allocatedTotal = allocations.filter((a) => a.nature === "ADVANCE_RECEIPT").reduce((s, a) => s + Number(a.amount), 0);
    const allocatedVatTotal = allocations.filter((a) => a.nature === "ADVANCE_VAT_RECEIPT").reduce((s, a) => s + Number(a.amount), 0);
    return {
        invoice: {
            id: invoice.id,
            number: invoice.number,
            date: invoice.date,
            customerTitle: partyName(invoice.customer.party),
            currencyTitle: invoice.currency.title,
            total,
            vatTotal,
        },
        allocatedTotal,
        allocatedVatTotal,
        payable: total - allocatedTotal,
        vatPayable: vatTotal - allocatedVatTotal,
        lockReasons: await getAdvanceLockReasons(invoiceId),
        candidates,
    };
}
/**
 * ثبت مجموعه‌ی تخصیص‌های یک فاکتور (ایجاد/ویرایش/حذف با هم): ردیف‌هایی که در items نیامده‌اند یا مبلغشان صفر است حذف می‌شوند.
 * همه‌ی محدودیت‌های مستند (بند ۳، ۵ و ۱۰) اینجا در بک‌اند کنترل می‌شود.
 */
async function saveSalesInvoiceAdvanceAllocations(invoiceId, items) {
    await assertAdvanceEditable(invoiceId);
    const invoice = await loadInvoice(invoiceId);
    const total = salesInvoiceNetTotal(invoice.lines);
    const vatTotal = salesInvoiceVatTotal(invoice.lines, Number(invoice.fxRate));
    if (!Array.isArray(items))
        throw new Error("فهرست تخصیص‌ها نامعتبر است");
    const wanted = items.filter((i) => Number(i.amount) > 0);
    const ids = wanted.map((i) => i.receiptSettlementLineId);
    if (new Set(ids).size !== ids.length)
        throw new Error("یک پیش‌دریافت نمی‌تواند دو بار در تخصیص یک فاکتور تکرار شود");
    const sums = { ADVANCE_RECEIPT: 0, ADVANCE_VAT_RECEIPT: 0 };
    const natureById = new Map();
    for (const item of wanted) {
        const amount = Number(item.amount);
        if (!(amount > 0))
            throw new Error("مبلغ تخصیص باید عددی مثبت باشد");
        // eslint-disable-next-line no-await-in-loop
        const line = await prisma_1.prisma.receiptSettlementLine.findUnique({
            where: { id: item.receiptSettlementLineId },
            include: { receipt: true, receiptType: true, advanceAllocations: true },
        });
        if (!line)
            throw new Error("پیش‌دریافت انتخاب‌شده یافت نشد");
        const label = `پیش‌دریافت رسید شماره ${line.receipt.number}`;
        if (line.partyId !== invoice.customer.partyId)
            throw new Error(`${label}: طرف حساب با طرف حساب فاکتور یکسان نیست`);
        const nature = line.receiptType.nature;
        if (!exports.ADVANCE_NATURES.includes(nature))
            throw new Error(`${label}: نوع دریافت، «پیش‌دریافت» یا «پیش‌دریافت ارزش افزوده» نیست`);
        if (line.receipt.status !== "APPROVED")
            throw new Error(`${label}: رسید دریافت تایید نشده است`);
        if (line.receipt.date.getTime() > invoice.date.getTime())
            throw new Error(`${label}: تاریخ دریافت بعد از تاریخ فاکتور است`);
        if (line.currencyId !== invoice.currencyId)
            throw new Error(`${label}: ارز پیش‌دریافت با ارز فاکتور یکسان نیست`);
        const allocatedToOthers = line.advanceAllocations.filter((a) => a.salesInvoiceId !== invoiceId).reduce((s, a) => s + Number(a.amount), 0);
        const allocatable = Number(line.amount) - allocatedToOthers;
        if (!(allocatable > TOLERANCE))
            throw new Error(`${label}: مبلغ قابل تخصیصی باقی نمانده است`);
        if (amount > allocatable + TOLERANCE)
            throw new Error(`${label}: مبلغ تخصیص از مبلغ قابل تخصیص پیش‌دریافت (${allocatable}) بیشتر است`);
        sums[nature] += amount;
        natureById.set(item.receiptSettlementLineId, nature);
    }
    if (sums.ADVANCE_RECEIPT > total + TOLERANCE)
        throw new Error(`مجموع پیش‌دریافت‌های تخصیص‌یافته (${sums.ADVANCE_RECEIPT}) از مبلغ فاکتور (${total}) بیشتر است`);
    if (sums.ADVANCE_VAT_RECEIPT > vatTotal + TOLERANCE)
        throw new Error(`مجموع پیش‌دریافت‌های ارزش افزوده‌ی تخصیص‌یافته (${sums.ADVANCE_VAT_RECEIPT}) از ارزش افزوده‌ی فاکتور (${vatTotal}) بیشتر است`);
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.salesInvoiceAdvanceAllocation.deleteMany({ where: { salesInvoiceId: invoiceId, receiptSettlementLineId: { notIn: ids } } });
        for (const item of wanted) {
            // eslint-disable-next-line no-await-in-loop
            await tx.salesInvoiceAdvanceAllocation.upsert({
                where: { salesInvoiceId_receiptSettlementLineId: { salesInvoiceId: invoiceId, receiptSettlementLineId: item.receiptSettlementLineId } },
                create: { salesInvoiceId: invoiceId, receiptSettlementLineId: item.receiptSettlementLineId, amount: Number(item.amount), nature: natureById.get(item.receiptSettlementLineId) },
                update: { amount: Number(item.amount), nature: natureById.get(item.receiptSettlementLineId) },
            });
        }
    });
}
/** رسیدی که پیش‌دریافتش به فاکتور تخصیص داده شده، قابل برگشت از تایید/ویرایش مجدد (حذف ردیف) نیست تا تخصیص‌ها حذف شوند */
async function assertReceiptAdvanceNotAllocated(receiptId, instrumentLineIds) {
    const count = await prisma_1.prisma.salesInvoiceAdvanceAllocation.count({
        where: { receiptSettlementLine: { receiptId, ...(instrumentLineIds ? { instrumentLineId: { in: instrumentLineIds } } : {}) } },
    });
    if (count > 0)
        throw new Error("این رسید دریافت (پیش‌دریافت) به فاکتور فروش تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید");
}
/** پیش از ذخیره‌ی ویرایش فاکتور: تخصیص‌های موجود با مشتری/ارز/تاریخ/مبلغِ جدید فاکتور ناسازگار نشوند */
async function assertAdvanceAllocationsStillValid(invoiceId, next) {
    const allocations = await prisma_1.prisma.salesInvoiceAdvanceAllocation.findMany({
        where: { salesInvoiceId: invoiceId },
        include: { receiptSettlementLine: { include: { receipt: true } }, salesInvoice: { include: { customer: true } } },
    });
    if (allocations.length === 0)
        return;
    const inv = allocations[0].salesInvoice;
    if (inv.customerId !== next.customerId)
        throw new Error("برای این فاکتور پیش‌دریافت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا مشتری قابل تغییر باشد");
    if (inv.currencyId !== next.currencyId)
        throw new Error("برای این فاکتور پیش‌دریافت تخصیص داده شده است؛ ابتدا تخصیص‌ها را حذف کنید تا ارز قابل تغییر باشد");
    if (allocations.some((a) => a.receiptSettlementLine.receipt.date.getTime() > next.date.getTime())) {
        throw new Error("تاریخ فاکتور نمی‌تواند قبل از تاریخ دریافتِ پیش‌دریافت‌های تخصیص‌یافته باشد؛ ابتدا تخصیص‌ها را حذف کنید");
    }
    const allocated = allocations.filter((a) => a.nature === "ADVANCE_RECEIPT").reduce((s, a) => s + Number(a.amount), 0);
    if (allocated > next.netTotal + TOLERANCE)
        throw new Error("مبلغ جدید فاکتور از مجموع پیش‌دریافت تخصیص‌یافته کمتر می‌شود؛ ابتدا تخصیص‌ها را کاهش دهید");
    const allocatedVat = allocations.filter((a) => a.nature === "ADVANCE_VAT_RECEIPT").reduce((s, a) => s + Number(a.amount), 0);
    if (allocatedVat > next.vatTotal + TOLERANCE)
        throw new Error("ارزش افزوده‌ی جدید فاکتور از مجموع پیش‌دریافت ارزش افزوده‌ی تخصیص‌یافته کمتر می‌شود؛ ابتدا تخصیص‌ها را کاهش دهید");
}
