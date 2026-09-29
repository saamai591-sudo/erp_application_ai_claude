"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDetailSelectorOptions = getDetailSelectorOptions;
exports.assertDetailSelectorValid = assertDetailSelectorValid;
const prisma_1 = require("../lib/prisma");
async function resolveAllowedPartyIds(condition) {
    switch (condition.kind) {
        case "SUPPLIER_PARTY": {
            // هم‌الگوی دقیق WarehouseReceipts.tsx فعلی: بر اساس Supplier.isActive (نه Party.isActive) فیلتر
            // می‌شود — طرف مقابل باید یک رکورد «تامین‌کننده»ی فعال مرتبط داشته باشد.
            const suppliers = await prisma_1.prisma.supplier.findMany({ where: { isActive: true }, select: { partyId: true } });
            return new Set(suppliers.map((s) => s.partyId));
        }
    }
}
function partyTitle(p) {
    return p.category === "INDIVIDUAL" ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : p.name || "—";
}
/** فهرست گزینه‌های مجاز برای پیکر فرانت‌اند — فقط کد تفصیل و عنوان (طبق تصمیم صریح کاربر) */
async function getDetailSelectorOptions(condition) {
    const allowedIds = await resolveAllowedPartyIds(condition);
    if (allowedIds.size === 0)
        return [];
    const parties = await prisma_1.prisma.party.findMany({ where: { id: { in: Array.from(allowedIds) } }, orderBy: { id: "asc" } });
    return parties.map((p) => ({ code: p.detailCode, title: partyTitle(p) }));
}
/** اعتبارسنجی سمت بک‌اند در لحظه‌ی ذخیره — دقیقاً همان شرطی که فهرست فرانت‌اند از آن پر شده دوباره چک
 * می‌شود؛ خروجی id عددی طرف مقابل برای استفاده‌ی داخلی مسیر (مثلاً یافتن Supplier.id مرتبط) است. */
async function assertDetailSelectorValid(code, condition) {
    const party = await prisma_1.prisma.party.findUnique({ where: { detailCode: code } });
    if (!party)
        throw new Error("کد تفصیل انتخاب‌شده یافت نشد");
    const allowedIds = await resolveAllowedPartyIds(condition);
    if (!allowedIds.has(party.id)) {
        throw new Error("طرف مقابل انتخاب‌شده با شرایط مجاز این فیلد مطابقت ندارد (باید تامین‌کننده‌ی فعال باشد)");
    }
    return { id: party.id };
}
