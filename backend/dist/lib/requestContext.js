"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithRequestContext = runWithRequestContext;
exports.getRequestContext = getRequestContext;
exports.withoutFiscalPeriodScope = withoutFiscalPeriodScope;
const async_hooks_1 = require("async_hooks");
const als = new async_hooks_1.AsyncLocalStorage();
function runWithRequestContext(ctx, fn) {
    return als.run(ctx, fn);
}
function getRequestContext() {
    return als.getStore();
}
/**
 * برای Queryهایی که عمداً باید سرتاسر همه‌ی دوره‌های مالی را ببینند (مثل قیمت‌گذاری کالا، یا انتخاب
 * فاکتور باز برای تسویه که ممکن است متعلق به دوره‌ی مالی قبلی باشد) — نگاه کنید به lib/prisma.ts برای
 * این‌که این پرچم چطور اعمال می‌شود.
 *
 * نکته‌ی مهم: Query خودِ prisma تنبل (lazy) است — prisma.model.findMany(...) تا وقتی await/.then()
 * نشود واقعاً اجرا نمی‌شود. اگر اینجا فقط همان Promise ساخته‌نشده را برمی‌گرداندیم (بدون await در همین
 * تابع)، زمینه‌ی bypassFiscalScope که als.run فعال کرده بود تا قبل از اجرای واقعیِ Query از بین می‌رفت
 * (چون als.run به‌محض return شدنِ callback همگام، زمینه را پاپ می‌کند). به همین دلیل fn حتماً همین‌جا
 * await می‌شود تا اجرای واقعی Query هنوز داخل بازه‌ی فعال als.run بیفتد.
 */
async function withoutFiscalPeriodScope(fn) {
    const current = als.getStore() || {};
    // «return await» اینجا ظاهربینانه زائد به‌نظر می‌رسد ولی حیاتی است: بدون await صریح، این تابع async
    // فقط Promise ساخته‌نشده‌ی fn() را برمی‌گرداند و بلافاصله (هم‌گام) تمام می‌شود — یعنی als.run زمینه را
    // همان لحظه پاپ می‌کند، قبل از این‌که Query تنبلِ prisma واقعاً اجرا شود. با await صریح، این تابع تا
    // تمام‌شدن واقعیِ fn() معلق می‌ماند، پس زمینه تا همان لحظه فعال می‌ماند.
    return als.run({ ...current, bypassFiscalScope: true }, async () => await fn());
}
