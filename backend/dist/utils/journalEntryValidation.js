"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLineHasAmount = assertLineHasAmount;
exports.assertDateNotConfirmed = assertDateNotConfirmed;
const jalaliDate_1 = require("./jalaliDate");
/**
 * هر ردیف سند حسابداری باید دقیقاً یکی از مبلغ بدهکار یا بستانکار را داشته باشد (بزرگتر از صفر)،
 * نه هر دو صفر و نه هر دو همزمان مقدار داشته باشند. این تابع باید پیش از هرگونه ایجاد سند
 * حسابداری (چه از فرم سند دستی، چه از عملیات‌های خودکار مثل بستن حسابها) فراخوانی شود.
 */
function assertLineHasAmount(debit, credit, context) {
    const d = Number(debit) || 0;
    const c = Number(credit) || 0;
    const suffix = context ? ` (${context})` : "";
    if (d <= 0 && c <= 0) {
        throw new Error(`ردیف سند باید مبلغ بدهکار یا بستانکار داشته باشد${suffix}`);
    }
    if (d > 0 && c > 0) {
        throw new Error(`ردیف سند نمی‌تواند همزمان بدهکار و بستانکار داشته باشد${suffix}`);
    }
}
/**
 * پس از «تایید اسناد» تا یک تاریخ مشخص، دیگر هیچ سندی با تاریخ کوچکتر یا مساوی آن قابل ثبت نیست.
 * این تابع باید پیش از ایجاد هر سند حسابداری (از هر ماژولی) فراخوانی شود — در سرویس مرکزی
 * issueJournalEntry برای همه‌ی فراخوانی‌کننده‌ها به‌صورت خودکار اعمال می‌شود.
 */
async function assertDateNotConfirmed(prismaClient, date, fiscalPeriodId) {
    const lastApproved = await prismaClient.journalEntry.findFirst({
        where: { fiscalPeriodId, status: "APPROVED" },
        orderBy: { date: "desc" },
    });
    if (lastApproved && date < lastApproved.date) {
        const jalali = (0, jalaliDate_1.formatJalaliDateForMessage)(new Date(lastApproved.date));
        throw new Error(`اسناد تا تاریخ ${jalali} تایید شده‌اند؛ ثبت سند با تاریخ قبل از آن امکان‌پذیر نیست`);
    }
}
