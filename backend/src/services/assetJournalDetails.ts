// تفصیل‌های یک خط سند دارایی ثابت: نوع تفصیل ۹ = پلاک، ۲ = مرکز هزینه، ۸ = پروژه (هر کدام فقط اگر خودِ حساب به آن نوع وصل باشد)؛ بقیه‌ی انواع را سیستم نمی‌تواند پر کند.
// تنها پیاده‌سازی مشترک برای اسناد «تغییر گروه» (اسناد تحصیل و استهلاک همین قاعده را دارند).

export interface DetailTypeLike {
  code: number;
  title: string;
}
export interface AccountLike {
  title: string;
  detailType1: DetailTypeLike | null;
  detailType2: DetailTypeLike | null;
  detailType3: DetailTypeLike | null;
}

export function fillAssetDetails(
  account: AccountLike,
  ctx: { plaque: string; costCenter: string | null; project: string | null; party?: string | null },
  label: string
): { details: [string | null, string | null, string | null]; error: string | null } {
  const details: [string | null, string | null, string | null] = [null, null, null];
  let error: string | null = null;
  [account.detailType1, account.detailType2, account.detailType3].forEach((dt, i) => {
    if (!dt || error) return;
    if (dt.code === 9) details[i] = ctx.plaque;
    else if (dt.code === 1 && ctx.party) details[i] = ctx.party; // طرف حساب: فقط در اسناد بیمه (بیمه‌گر فاکتور)
    else if (dt.code === 2) {
      details[i] = ctx.costCenter;
      if (!details[i]) error = `${label}: حساب «${account.title}» تفصیل مرکز هزینه دارد ولی موقعیت دارایی مرکز هزینه ندارد`;
    } else if (dt.code === 8) {
      details[i] = ctx.project;
      if (!details[i]) error = `${label}: حساب «${account.title}» تفصیل پروژه دارد ولی موقعیت دارایی پروژه ندارد`;
    } else error = `${label}: تفصیل «${dt.title}» حساب «${account.title}» را سیستم نمی‌تواند پر کند`;
  });
  return { details, error };
}
