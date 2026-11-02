// درایورهای دستگاه. کلید = مقدار فیلد «درایور» کارتخوان در ERP (CardReaderDriver).
// هر درایور: async send({ requestUid, amount, reader, config }) ⇒ { status, referenceNumber?, maskedCard?, errorCode?, errorMessage? }
//   • تا رسیدن نتیجه‌ی نهایی منتظر می‌ماند (SUCCESS | FAILED | UNKNOWN)؛ PENDING برنگردانید.
//   • ارتباط با دستگاه از اول برقرار نشد و مطمئنید چیزی ارسال نشده ⇒ FAILED؛ بعد از ارسال و بدون پاسخ ⇒ UNKNOWN.
//   • config = بخش readers[<شناسه‌ی کارتخوان>] در config.json (مثلاً آدرس IP و پورت دستگاه).
// برای افزودن دستگاه جدید یک فایل بنویسید و اینجا ثبت کنید؛ همین نام را در ERP (enum CardReaderDriver و فرم کارتخوان) هم اضافه کنید.
import { simulator } from "./simulator.mjs";

export const DRIVERS = { SIMULATOR: simulator };
