"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertRecordNotStale = assertRecordNotStale;
/**
 * حفاظت از «ویرایش گم‌شده» (lost update) در کل برنامه — طبق تصمیم صریح کاربر: اگر دو کاربر همزمان یک
 * رکورد را باز کنند، اولی ذخیره کند، سپس دومی (روی داده‌ی کهنه) ذخیره کند، دومی باید خطای روشن بگیرد،
 * نه اینکه بی‌سروصدا تغییرات نفر اول را پاک کند.
 *
 * قرارداد یکسان برای هر PUT/:id در کل بک‌اند (دقیقاً هم‌جایگاه assertWarehouseOpenForDate/
 * assertDateNotConfirmed که همین الگو را برای کنترل‌های دیگر استفاده می‌کنند):
 *   1) در پاسخ GET/:id همان مدل، فیلد updatedAt را برگردانید (frontend/lib/api.ts خودش آن را به‌خاطر
 *      می‌سپارد و در PUT بعدی روی همان مسیر خودکار پیوست می‌کند — نیازی به کار اضافه در فرانت‌اند نیست).
 *   2) در PUT/:id، بلافاصله بعد از واکشی existing (و بعد از کنترل «یافت نشد»)، پیش از هر اعتبارسنجی
 *      دیگری: assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "<برچسب فارسی این رکورد>")
 *
 * عمداً «مجوزدهنده» است اگر کلاینت اصلاً updatedAt نفرستد (typeof !== "string") — تا فرم‌هایی که هنوز
 * به این قرارداد مجهز نشده‌اند نشکنند؛ فرانت‌اند این پروژه امروز همیشه آن را می‌فرستد (وقتی مدل مربوطه
 * updatedAt داشته باشد)، پس این حالت فقط یک شبکه‌ی ایمنیِ سازگاری رو به عقب است.
 */
function assertRecordNotStale(existingUpdatedAt, clientUpdatedAt, label) {
    if (typeof clientUpdatedAt !== "string")
        return;
    const clientTime = new Date(clientUpdatedAt).getTime();
    if (Number.isNaN(clientTime))
        return;
    if (clientTime !== existingUpdatedAt.getTime()) {
        throw new Error(`${label} توسط کاربر دیگری تغییر کرده است؛ لطفاً صفحه را دوباره بارگذاری کنید`);
    }
}
