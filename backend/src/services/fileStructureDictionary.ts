// فهرست فیلدهای سیستمیِ قابل‌استفاده در «ساختار فایل» (EMPLOYEE_FIELD): کلید، عنوان فارسی و دامنه.
// EMP = مقدار هر کارمند؛ GLOBAL = مقدار کل فایل (شرکت، شعبه‌ی انتخاب‌شده، دوره). فیلد «pending» هنوز داده‌ی سیستمی ندارد و خالی چاپ می‌شود
// (وقتی داده‌اش به پرسنل اضافه شد، فقط محاسبه‌گر عوض می‌شود و ساختارها همان می‌مانند).

export interface DictField {
  key: string;
  title: string;
  scope: "EMP" | "GLOBAL";
  group: string;
  pending?: boolean;
  hint?: string;
}

export const DICTIONARY: DictField[] = [
  // کارمند
  { key: "ROW_NO", title: "ردیف", scope: "EMP", group: "کارمند" },
  { key: "PERSONNEL_CODE", title: "کد پرسنلی", scope: "EMP", group: "کارمند" },
  { key: "NATIONAL_ID", title: "کد ملی", scope: "EMP", group: "کارمند" },
  { key: "FIRST_NAME", title: "نام", scope: "EMP", group: "کارمند" },
  { key: "LAST_NAME", title: "نام خانوادگی", scope: "EMP", group: "کارمند" },
  { key: "FATHER_NAME", title: "نام پدر", scope: "EMP", group: "کارمند" },
  { key: "BIRTH_DATE_J8", title: "تاریخ تولد (شمسی YYYYMMDD)", scope: "EMP", group: "کارمند" },
  { key: "BIRTH_CERT_NO", title: "شماره شناسنامه", scope: "EMP", group: "کارمند" },
  { key: "BIRTH_PLACE", title: "محل تولد", scope: "EMP", group: "کارمند" },
  { key: "ISSUE_PLACE", title: "محل صدور (در نبود آن، محل تولد)", scope: "EMP", group: "کارمند" },
  { key: "GENDER_TEXT", title: "جنسیت (مرد / زن)", scope: "EMP", group: "کارمند" },
  { key: "NATIONALITY_CODE", title: "کد ملیت (۱ ایرانی، ۲ خارجی)", scope: "EMP", group: "کارمند" },
  { key: "NATIONALITY_TITLE", title: "ملیت (ایرانی / خارجی)", scope: "EMP", group: "کارمند" },
  { key: "EDUCATION_TITLE", title: "مدرک تحصیلی (عنوان؛ با نگاشت به کد)", scope: "EMP", group: "کارمند", hint: "آخرین سابقه‌ی تحصیلی تا پایان ماه" },
  { key: "INSURANCE_NUMBER", title: "شماره بیمه", scope: "EMP", group: "کارمند" },
  { key: "ADDRESS", title: "آدرس (نشانی اصلی)", scope: "EMP", group: "کارمند" },
  { key: "POSTAL_CODE", title: "کد پستی (نشانی اصلی)", scope: "EMP", group: "کارمند" },
  // قرارداد و انتصاب
  { key: "JOB_TITLE", title: "عنوان شغل (در نبود آن، عنوان پست)", scope: "EMP", group: "قرارداد" },
  { key: "JOB_SS_CODE", title: "کد شغل تامین اجتماعی", scope: "EMP", group: "قرارداد" },
  { key: "POSITION_TITLE", title: "عنوان پست", scope: "EMP", group: "قرارداد" },
  { key: "EMPLOYMENT_TYPE_TITLE", title: "نوع استخدام (عنوان؛ با نگاشت به کد)", scope: "EMP", group: "قرارداد", hint: "از حکمی که فیش ماه با آن محاسبه شده" },
  { key: "START_DATE_J8", title: "تاریخ شروع همکاری (شمسی YYYYMMDD)", scope: "EMP", group: "قرارداد" },
  { key: "END_DATE_J8", title: "تاریخ پایان همکاری (آخرین روز همکاری)", scope: "EMP", group: "قرارداد" },
  { key: "START_DATE_IN_MONTH_J8", title: "تاریخ شروع همکاری (فقط اگر در همین ماه باشد)", scope: "EMP", group: "قرارداد" },
  { key: "END_DATE_IN_MONTH_J8", title: "تاریخ پایان همکاری (فقط اگر در همین ماه باشد)", scope: "EMP", group: "قرارداد" },
  // هنوز داده‌ی سیستمی ندارند
  { key: "INSURANCE_TYPE_CODE", title: "کد نوع بیمه", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "INSURANCE_TYPE_TITLE", title: "نام بیمه", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "TAX_EXEMPTION_CODE", title: "کد نوع معافیت مالیاتی", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "WORKPLACE_STATUS_CODE", title: "کد وضعیت محل خدمت", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "HOUSING_STATUS_CODE", title: "کد نحوه استفاده از مسکن", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "VEHICLE_STATUS_CODE", title: "کد نحوه استفاده از اتومبیل", scope: "EMP", group: "هنوز بدون داده", pending: true },
  { key: "JOB_CLASS_CODE", title: "کد رسته‌ی شغلی", scope: "EMP", group: "هنوز بدون داده", pending: true },
  // کل فایل
  { key: "COMPANY_NAME", title: "نام شرکت", scope: "GLOBAL", group: "شرکت و دوره" },
  { key: "PERIOD_YEAR4", title: "سال (۴ رقمی)", scope: "GLOBAL", group: "شرکت و دوره" },
  { key: "PERIOD_YEAR2", title: "سال (۲ رقمی)", scope: "GLOBAL", group: "شرکت و دوره" },
  { key: "PERIOD_MONTH", title: "ماه (۱ تا ۱۲)", scope: "GLOBAL", group: "شرکت و دوره" },
  { key: "PERIOD_MONTH2", title: "ماه (دو رقمی)", scope: "GLOBAL", group: "شرکت و دوره" },
  { key: "BRANCH_CODE", title: "کد کارگاه / شماره پرونده‌ی شعبه", scope: "GLOBAL", group: "شعبه‌ی سازمان", hint: "نیازمند انتخاب شعبه هنگام تولید" },
  { key: "BRANCH_EMPLOYER", title: "نام کارفرمای شعبه", scope: "GLOBAL", group: "شعبه‌ی سازمان", hint: "نیازمند انتخاب شعبه هنگام تولید" },
  { key: "BRANCH_ADDRESS", title: "آدرس شعبه", scope: "GLOBAL", group: "شعبه‌ی سازمان", hint: "نیازمند انتخاب شعبه هنگام تولید" },
  { key: "BRANCH_CONTRACT_ROW", title: "ردیف پیمان شعبه", scope: "GLOBAL", group: "شعبه‌ی سازمان", hint: "نیازمند انتخاب شعبه هنگام تولید" },
];

export const DICT_BY_KEY = new Map(DICTIONARY.map((d) => [d.key, d]));
export const usesBranch = (key: string) => key.startsWith("BRANCH_");
