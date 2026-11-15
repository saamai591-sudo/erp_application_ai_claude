import { prisma } from "../lib/prisma";

/**
 * منبع حقیقتِ «ارز پایه» و نرخ تبدیل. هر مسیر/سرویس که ارز پایه یا تعداد رقم اعشار آن را لازم دارد از همین‌جا می‌خواند
 * (قبلاً در حدود ۸۰ جا `currency.findFirst({ where: { isBase: true } })` و چند نسخه‌ی محلیِ getBaseCurrency/baseDecimals بود).
 * `db` برای اجرا داخل تراکنش است.
 */

type Db = { currency: { findFirst: (args: any) => Promise<any> } };

const NO_BASE_CURRENCY_MESSAGE = "ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید";

/** ارز پایه یا null (برای جاهایی که نبودنش خطا نیست). */
async function findBaseCurrency(db: Db = prisma) {
  return db.currency.findFirst({ where: { isBase: true } });
}

/** ارز پایه؛ اگر تعریف نشده باشد خطای فارسی می‌دهد. */
export async function getBaseCurrency(db: Db = prisma) {
  const base = await findBaseCurrency(db);
  if (!base) throw new Error(NO_BASE_CURRENCY_MESSAGE);
  return base as NonNullable<Awaited<ReturnType<typeof prisma.currency.findFirst>>>;
}

/** تعداد رقم اعشار ارز پایه؛ ۰ اگر ارز پایه‌ای تعریف نشده باشد (برای محاسبه‌هایی که نبودِ ارز پایه را جای دیگر کنترل می‌کنند). */
export async function getBaseCurrencyDecimals(db: Db = prisma): Promise<number> {
  const base = await findBaseCurrency(db);
  return base?.decimalPlaces ?? 0;
}

/** تعداد رقم اعشار ارز پایه؛ نبودِ ارز پایه خطاست. */
export async function getBaseCurrencyDecimalsStrict(db: Db = prisma): Promise<number> {
  return (await getBaseCurrency(db)).decimalPlaces;
}

/**
 * طبق Documents/تبدیل ارز.md — اگر ارز سند همان ارز پایه باشد نرخ همیشه ۱ است، در غیر این‌صورت کاربر باید نرخ را وارد کند.
 */
export function resolveFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | null | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}
