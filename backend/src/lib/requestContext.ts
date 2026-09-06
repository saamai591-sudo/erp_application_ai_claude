import { AsyncLocalStorage } from "async_hooks";

// زمینه‌ی درخواست جاری — فعلاً فقط برای «دوره مالی جاری» (نگاه کنید به fiscalScope در lib/prisma.ts و
// middleware/fiscalScope.ts) استفاده می‌شود؛ اگر بعداً زمینه‌ی سراسری دیگری لازم شد (مثلاً کاربر جاری
// برای audit) همین‌جا اضافه می‌شود، نه یک AsyncLocalStorage جدا.
interface RequestContext {
  fiscalPeriodId?: number;
  bypassFiscalScope?: boolean;
}

const als = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
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
export async function withoutFiscalPeriodScope<T>(fn: () => T | Promise<T>): Promise<T> {
  const current = als.getStore() || {};
  // «return await» اینجا ظاهربینانه زائد به‌نظر می‌رسد ولی حیاتی است: بدون await صریح، این تابع async
  // فقط Promise ساخته‌نشده‌ی fn() را برمی‌گرداند و بلافاصله (هم‌گام) تمام می‌شود — یعنی als.run زمینه را
  // همان لحظه پاپ می‌کند، قبل از این‌که Query تنبلِ prisma واقعاً اجرا شود. با await صریح، این تابع تا
  // تمام‌شدن واقعیِ fn() معلق می‌ماند، پس زمینه تا همان لحظه فعال می‌ماند.
  return als.run({ ...current, bypassFiscalScope: true }, async () => await fn());
}
