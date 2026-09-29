"use strict";
// «ردیف ابزار پرداخت/دریافتی که در موضوعات استفاده شده، قابل ویرایش نیست»: کاربر باید اول ردیف‌های موضوعات مرتبط را حذف کند.
// در ذخیره‌ی ویرایش، ردیف ابزارِ موجود (کلید = شناسه‌ی همان ردیف که فرانت‌اند به‌عنوان clientKey می‌فرستد) که هنوز یکی از ردیف‌های موضوعاتِ
// ورودی به آن ارجاع می‌دهد باید عیناً مثل مقدار ذخیره‌شده باشد؛ ابزار تازه‌ای که هنوز ذخیره نشده یا ابزاری که موضوعاتش حذف شده آزاد است.
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertUsedInstrumentsUnchanged = assertUsedInstrumentsUnchanged;
const COMPARED_FIELDS = [
    "type", "amount", "currencyId", "fxRate", "cashBoxId", "bankAccountId", "referenceNumber", "feeAmount", "chequeItemId", "chequeNumber",
    "chequeDueDate", "chequeBankBranchId", "payableChequeTypeId", "chequeTypeId", "chequeBookLeafId", "chequeStep", "posTerminal", "description",
];
function normalize(v) {
    if (v === undefined || v === null || v === "")
        return null;
    if (v instanceof Date)
        return v.toISOString().slice(0, 10);
    if (typeof v === "object" && typeof v.toNumber === "function")
        return Math.round(v.toNumber() * 1e6) / 1e6;
    if (typeof v === "number")
        return Math.round(v * 1e6) / 1e6;
    return String(v);
}
function assertUsedInstrumentsUnchanged(existingLines, incomingLines, incomingSettlementLines) {
    const usedKeys = new Set(incomingSettlementLines.map((s) => s.instrumentClientKey));
    const existingByKey = new Map(existingLines.map((l) => [String(l.id), l]));
    incomingLines.forEach((inc, idx) => {
        if (!usedKeys.has(inc.clientKey))
            return;
        const old = existingByKey.get(inc.clientKey);
        if (!old)
            return;
        for (const f of COMPARED_FIELDS) {
            if (!(f in inc))
                continue;
            if (normalize(inc[f]) !== normalize(old[f])) {
                throw new Error(`ردیف ${idx + 1} ابزار: این ابزار در موضوعات استفاده شده است و قابل ویرایش نیست؛ ابتدا ردیف‌های موضوعات مرتبط را حذف کنید`);
            }
        }
    });
}
