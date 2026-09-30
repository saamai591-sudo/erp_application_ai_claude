// =========================================================================
// «نوع فرم» (Form Type) — تعریف مرکزیِ رفتار و ظاهر مشترکِ فرم‌ها در لایه‌ی پایه (base/framework). هر آیتم منو (navConfig.ts) فقط «نوع» خودش را
// مشخص می‌کند (یا از روی ساختارش استنتاج می‌شود)؛ همه‌ی رفتارهای مشترک وابسته به نوع اینجا یک‌بار تعریف و مصرف می‌شوند، نه در هر فرم/هر محل رندر:
//
//   list        فرم فهرستی: فهرست رکوردها + فرم «جدید»/ویرایش (اسناد، اطلاعات پایه، …).
//               منوی سمت راست: برچسب فرم «جدید» را باز می‌کند و آیکن «فهرست» کنارش نمایش داده می‌شود.
//   operational فرم عملیاتی: یک صفحه‌ی واحد که خودش عملیات است و فهرست جدا ندارد (بستن سال، تایید اسناد، قیمت‌گذاری، تنظیمات،
//               فرم‌های درختی مثل حسابها/گروه کالا، …). منوی سمت راست: آیکن «فهرست» ندارد؛ برچسب همان صفحه را باز می‌کند.
//   report      گزارش: صفحه‌ی گزارش/مرور (فیلتر + گرید فقط‌خواندنی)، بدون فهرست جدا. منوی سمت راست: آیکن «فهرست» ندارد.
//
// افزودن نوع تازه: فقط یک ورودی به FORM_TYPE_BEHAVIOR اضافه کنید؛ منوی سمت راست (و هر مصرف‌کننده‌ی دیگرِ resolveNavBehavior) خودکار تبعیت می‌کند.
// =========================================================================

export type FormType = "list" | "operational" | "report";

export interface FormTypeBehavior {
  /** آیکن «فهرست» (پوشه) کنار برچسب فرم در منوی سمت راست */
  showListIcon: boolean;
  /** عبارتِ راهنمای برچسب فرم در منو (وقتی فرم «جدید» دارد یا ندارد) */
  labelTitle: { withCreate: string; withoutCreate: string };
}

export const FORM_TYPE_BEHAVIOR: Record<FormType, FormTypeBehavior> = {
  list: {
    showListIcon: true,
    labelTitle: { withCreate: "باز کردن فرم جدید در تب جدید", withoutCreate: "باز کردن فهرست در تب جدید" },
  },
  operational: {
    showListIcon: false,
    labelTitle: { withCreate: "باز کردن فرم در تب جدید", withoutCreate: "باز کردن فرم در تب جدید" },
  },
  report: {
    showListIcon: false,
    labelTitle: { withCreate: "باز کردن گزارش در تب جدید", withoutCreate: "باز کردن گزارش در تب جدید" },
  },
};

export interface FormTypeSource {
  create?: string;
  type?: FormType;
}

/**
 * نوع فرم: اگر صریحاً داده شده همان؛ وگرنه از ساختار استنتاج می‌شود — فرمی که «جدید» دارد فهرستی (list) است و فرمی که «جدید» ندارد
 * (برچسبش همان تنها صفحه را باز می‌کند و آیکن فهرست تکراری می‌شد) عملیاتی (operational). گزارش‌ها باید صریحاً type: "report" بگیرند.
 */
export function resolveFormType(item: FormTypeSource): FormType {
  return item.type ?? (item.create ? "list" : "operational");
}

export interface NavBehavior {
  type: FormType;
  showListIcon: boolean;
  /** مسیری که کلیک روی برچسب فرم باز می‌کند */
  labelTarget: string;
  labelTitle: string;
}

/** رفتار مشترک منوی سمت راست برای یک آیتم — تنها نقطه‌ای که Layout از آن می‌خواند. */
export function resolveNavBehavior(item: FormTypeSource & { list: string }): NavBehavior {
  const type = resolveFormType(item);
  const behavior = FORM_TYPE_BEHAVIOR[type];
  return {
    type,
    showListIcon: behavior.showListIcon,
    labelTarget: item.create ?? item.list,
    labelTitle: item.create ? behavior.labelTitle.withCreate : behavior.labelTitle.withoutCreate,
  };
}
