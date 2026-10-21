// ساختارهای پیش‌فرض نصب برای «ساختار فایل»: فهرست حقوق مالیاتی (WH)، فهرست کارکنان مالیاتی (WP) و لیست بیمه تامین اجتماعی (DSKKAR/DSKWOR).
// فقط‌خواندنی‌اند و در کد می‌مانند؛ کاربر با «کپی» یک نسخه‌ی قابل‌ویرایش در دیتابیس می‌سازد. عامل‌های مجموع‌گیری‌شده با «عنوان» پیشنهاد می‌شوند
// (suggest) و هنگام تولید فایل/کپی با عنوان عامل‌ها و نوع‌های محاسبه‌ی همین نصب تطبیق داده می‌شوند؛ عنوانی که پیدا نشود صفر می‌شود (و هشدار می‌دهد).
// منبع: مشخصات رسمی راهنمای فایل مالیات حقوق (نسخه ۱.۷.۰.۵)، ساختار DSKKAR/DSKWOR نسخه ۶ و تعریف‌های نرم‌افزار قبلی (سام) که کاربر داده است.

export type FieldSource = "CONSTANT" | "EMPLOYEE_FIELD" | "FACTOR_SUM" | "AGGREGATE" | "PARAM" | "EXPR" | "EMPTY";

export interface FieldDef {
  name: string;
  title: string;
  dataType: "TEXT" | "NUMBER";
  length?: number | null;
  decimals?: number;
  zeroPad?: boolean;
  source: FieldSource;
  constantValue?: string | null;
  systemField?: string | null;
  paramKey?: string | null;
  aggFunc?: "SUM" | "COUNT" | null;
  aggFileSeq?: number | null;
  aggFieldName?: string | null;
  exprText?: string | null;
  /** مرجع‌های ذخیره‌شده (ساختار دیتابیسی) */
  refs?: { payroll: number[]; decree: number[]; net: number[] };
  /** عنوان عامل‌ها / نوع‌های محاسبه‌ی پیشنهادی (ساختار پیش‌فرض نصب) */
  suggest?: { factorTitles?: string[]; netCalcTypeTitles?: string[] };
  maps?: { sourceValue: string; targetValue: string }[];
}

export interface FileDef {
  seq: number;
  nameTemplate: string;
  format: "DELIMITED" | "DBF";
  rowKind: "PER_EMPLOYEE" | "SINGLE";
  delimiter: string;
  encoding: "UTF8" | "UTF8_BOM" | "IRAN_SYSTEM";
  lineEnding: "LF" | "CRLF";
  trailingNewline: boolean;
  fields: FieldDef[];
}

export interface StructureDef {
  id?: number | null;
  systemKey?: string | null;
  code?: number | null;
  title: string;
  description?: string | null;
  sourceKind: "PAYROLL_LIST";
  isActive: boolean;
  zipNameTemplate?: string | null;
  files: FileDef[];
}

const num = (name: string, title: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, title, dataType: "NUMBER", source: "CONSTANT", constantValue: "0", ...extra });
const text = (name: string, title: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, title, dataType: "TEXT", source: "EMPTY", ...extra });
const emp = (name: string, title: string, systemField: string, extra: Partial<FieldDef> = {}): FieldDef => ({ name, title, dataType: "TEXT", source: "EMPLOYEE_FIELD", systemField, ...extra });
const sum = (name: string, title: string, factorTitles: string[], extra: Partial<FieldDef> = {}): FieldDef => ({ name, title, dataType: "NUMBER", source: "FACTOR_SUM", suggest: { factorTitles }, ...extra });

// ── فهرست حقوق مالیاتی (WH) — جدول اقلام حقوق و دستمزد (ریالی)، ۳۹ فیلد ──
const WH_FIELDS: FieldDef[] = [
  emp("F01", "کد ملی", "NATIONAL_ID"),
  num("F02", "نوع پرداختی (۱ = ریالی)", { constantValue: "1" }),
  emp("F03", "وضعیت محل خدمت", "WORKPLACE_STATUS_CODE"),
  num("F04", "استثنائات موضوع قانون بودجه (۱ = عادی)", { constantValue: "1" }),
  num("F05", "نوع ارز (۸۴ = ریال ایران)", { constantValue: "84" }),
  num("F06", "نرخ تسعیر ارز", { constantValue: "1" }),
  sum("F07", "مبلغ جمع ناخالص حقوق و مزایای مستمر نقدی ماه جاری", ["حقوق پایه", "سایر مزایا", "پایه سنوات"]),
  num("F08", "مبلغ حقوق و مزایای مستمر نقدی معوق که مالیاتی برای آنها محاسبه نشده است"),
  emp("F09", "مسکن (نحوه استفاده از مسکن)", "HOUSING_STATUS_CODE"),
  num("F10", "مبلغ کسر شده از حقوق کارمند بابت مسکن ماه جاری"),
  emp("F11", "اتومبیل اختصاصی (نحوه استفاده از اتومبیل)", "VEHICLE_STATUS_CODE"),
  num("F12", "مبلغ کسر شده از حقوق کارمند بابت اتومبیل اختصاصی ماه جاری"),
  num("F13", "مبلغ قیمت تمام شده سایر مزایای مستمر غیرنقدی"),
  num("F14", "مبلغ حقوق و مزایای مستمر غیر نقدی معوق که مالیاتی برای آنها محاسبه نشده است"),
  num("F15", "مبلغ حق الزحمه/حق مشاوره/حق حضور/حق نظارت/حق التالیف/حق فنی/پاداش شورای حل اختلاف"),
  num("F16", "مبلغ قراردادهای پژوهشی"),
  sum("F17", "اضافه کاری", ["اضافه کاری"]),
  num("F18", "هزینه سفر"),
  sum("F19", "فوق العاده مسافرت (ماموریت)", ["حق ماموریت"]),
  sum("F20", "کارانه", ["کارانه"]),
  sum("F21", "پاداش (به استثنای پاداش آخر سال و پاداش پایان خدمت و پاداش بهره وری)", ["پاداش مجمع"]),
  sum("F22", "پاداش آخر سال", ["پاداش پایان سال"]),
  sum("F23", "عیدی سالانه", ["مزایای عیدی"]),
  num("F24", "پاداش پایان خدمت"),
  num("F25", "خسارت اخراج"),
  sum("F26", "بازخرید خدمت", ["مزایای بازخرید سنوات"]),
  num("F27", "حق سنوات"),
  sum("F28", "حقوق ایام مرخصی استفاده نشده", ["مبلغ بازخرید مرخصی"]),
  num("F29", "سایر حقوق و مزایای غیر مستمر نقدی ماه جاری"),
  num("F30", "مبلغ حقوق و مزایای غیر مستمر نقدی معوق که مالیاتی برای آنها محاسبه نشده است"),
  sum("F31", "مبلغ قیمت تمام شده مزایای غیر مستمر غیرنقدی ماه جاری", ["مزایای غیر نقدی"]),
  num("F32", "مبلغ مزایای غیر مستمر غیر نقدی معوق که مالیاتی برای آنها محاسبه نشده است"),
  sum("F33", "حق بیمه های درمان موضوع ماده ۱۳۷ ق.م.م.", ["بیمه کارمند"]),
  sum("F34", "حق بیمه های عمر و زندگی موضوع ماده ۱۳۷ ق.م.م", ["بیمه تکمیلی"]),
  { name: "F35", title: "خالص پرداختی به حقوق بگیر", dataType: "NUMBER", source: "FACTOR_SUM", suggest: { netCalcTypeTitles: ["حقوق ماهانه", "عیدی", "بازخرید مرخصی", "بازخرید سنوات"] } },
  num("F36", "حق التدریس/حق التحقیق/حق پژوهش"),
  num("F37", "حق کشیک"),
  sum("F38", "رفاهی و انگیزشی و بهره وری", ["حق مسکن", "حق بن کارگری", "حق اولاد", "ایاب و ذهاب", "حق تاهل", "ایاب و ذهاب روزانه", "حق نهاری روزانه"]),
  num("F39", "حق السعی (به استثنای مزد، حقوق، پاداش)"),
];

// ── فهرست کارکنان مالیاتی (WP)، ۲۳ فیلد ──
const EDUCATION_MAP = [
  ["زیر دیپلم", "1"], ["دیپلم", "2"], ["فوق دیپلم", "3"], ["کاردانی", "3"], ["کارشناسی", "4"], ["لیسانس", "4"],
  ["کارشناسی ارشد", "5"], ["فوق لیسانس", "5"], ["دکتری", "6"], ["فوق دکتری", "7"],
].map(([sourceValue, targetValue]) => ({ sourceValue, targetValue }));
const EMPLOYMENT_MAP = [
  ["قراردادی", "1"], ["شرکتی", "2"], ["رسمی", "3"], ["پیمانی", "4"], ["مامور", "5"], ["کارمزدی", "6"], ["خرید خدمت", "7"],
  ["ساعتی", "8"], ["روزمزد", "9"], ["رسمی-آزمایشی", "10"], ["رسمی آزمایشی", "10"], ["رسمی فصلی", "11"], ["سایر", "12"],
].map(([sourceValue, targetValue]) => ({ sourceValue, targetValue }));

const WP_FIELDS: FieldDef[] = [
  emp("P01", "ملیت (۱ = ایرانی، ۲ = خارجی)", "NATIONALITY_CODE"),
  emp("P02", "کد ملی", "NATIONAL_ID"),
  emp("P03", "نام", "FIRST_NAME"),
  emp("P04", "نام خانوادگی", "LAST_NAME"),
  emp("P05", "نام پدر", "FATHER_NAME"),
  emp("P06", "تاریخ تولد", "BIRTH_DATE_J8"),
  emp("P07", "شماره شناسنامه", "BIRTH_CERT_NO"),
  emp("P08", "محل تولد", "BIRTH_PLACE"),
  emp("P09", "مدرک تحصیلی", "EDUCATION_TITLE", { maps: EDUCATION_MAP }),
  emp("P10", "نوع بیمه", "INSURANCE_TYPE_CODE"),
  emp("P11", "شماره بیمه", "INSURANCE_NUMBER"),
  emp("P12", "نام بیمه", "INSURANCE_TYPE_TITLE"),
  emp("P13", "نوع معافیت", "TAX_EXEMPTION_CODE"),
  { name: "P14", title: "کشور محل تابعیت", dataType: "TEXT", source: "CONSTANT", constantValue: "103" },
  { name: "P15", title: "کشور محل زندگی", dataType: "TEXT", source: "CONSTANT", constantValue: "103" },
  emp("P16", "کد پستی", "POSTAL_CODE"),
  emp("P17", "آدرس", "ADDRESS"),
  emp("P18", "رسته", "JOB_CLASS_CODE"),
  emp("P19", "سمت", "JOB_TITLE"),
  emp("P20", "نوع استخدام", "EMPLOYMENT_TYPE_TITLE", { maps: EMPLOYMENT_MAP }),
  emp("P21", "تاریخ شروع به کار", "START_DATE_J8"),
  emp("P22", "تاریخ پایان کار", "END_DATE_J8"),
  text("P23", "تاریخ بازنشستگی"),
];

// ── لیست بیمه تامین اجتماعی: DSKKAR00.DBF (سرلیست، یک ردیف) + DSKWOR00.DBF (کارکنان) ──
const MAH_TITLES = ["حقوق پایه", "سایر مزایا", "پایه سنوات"];
const MAZ_TITLES = ["اضافه کاری", "حق مسکن", "حق بن کارگری", "حق اولاد", "ایاب و ذهاب", "حق تاهل", "ایاب و ذهاب روزانه", "حق نهاری روزانه"];
const agg = (name: string, title: string, length: number, fieldName: string, aggFunc: "SUM" | "COUNT" = "SUM"): FieldDef => ({
  name, title, dataType: "NUMBER", length, source: "AGGREGATE", aggFunc, aggFileSeq: 2, aggFieldName: fieldName,
});
const DSKKAR_FIELDS: FieldDef[] = [
  { name: "DSK_ID", title: "کد کارگاه", dataType: "TEXT", length: 10, source: "EMPLOYEE_FIELD", systemField: "BRANCH_CODE" },
  { name: "DSK_NAME", title: "نام کارگاه", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "COMPANY_NAME" },
  { name: "DSK_FARM", title: "نام کارفرما", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "BRANCH_EMPLOYER" },
  { name: "DSK_ADRS", title: "آدرس کارگاه", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "BRANCH_ADDRESS" },
  { name: "DSK_KIND", title: "نوع لیست", dataType: "NUMBER", length: 1, source: "PARAM", paramKey: "LIST_KIND", constantValue: "1" },
  { name: "DSK_YY", title: "سال عملکرد", dataType: "NUMBER", length: 2, zeroPad: true, source: "EMPLOYEE_FIELD", systemField: "PERIOD_YEAR2" },
  { name: "DSK_MM", title: "ماه عملکرد", dataType: "NUMBER", length: 2, source: "EMPLOYEE_FIELD", systemField: "PERIOD_MONTH" },
  { name: "DSK_LISTNO", title: "شماره لیست", dataType: "TEXT", length: 12, source: "PARAM", paramKey: "LIST_NO", constantValue: "1" },
  { name: "DSK_DISC", title: "شرح لیست", dataType: "TEXT", length: 100, source: "PARAM", paramKey: "LIST_DESC", constantValue: "" },
  agg("DSK_NUM", "تعداد کارکنان", 5, "DSW_ID1", "COUNT"),
  agg("DSK_TDD", "مجموع روزهای کارکرد", 6, "DSW_DD"),
  agg("DSK_TROOZ", "مجموع دستمزد روزانه", 12, "DSW_ROOZ"),
  agg("DSK_TMAH", "مجموع دستمزد ماهانه", 12, "DSW_MAH"),
  agg("DSK_TMAZ", "مجموع مزایای ماهانه مشمول", 12, "DSW_MAZ"),
  agg("DSK_TMASH", "مجموع دستمزد و مزایای ماهانه مشمول", 12, "DSW_MASH"),
  agg("DSK_TTOTL", "مجموع کل دستمزد و مزایای ماهانه (مشمول و غیر مشمول)", 12, "DSW_TOTL"),
  agg("DSK_TBIME", "مجموع حق بیمه سهم بیمه شده", 12, "DSW_BIME"),
  { name: "DSK_TKOSO", title: "مجموع حق بیمه سهم کارفرما", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: ["بیمه کارفرما"] } },
  { name: "DSK_BIC", title: "مجموع حق بیمه بیکاری", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: ["بیمه بیکاری"] } },
  { name: "DSK_RATE", title: "نرخ حق بیمه", dataType: "NUMBER", length: 5, source: "PARAM", paramKey: "INSURANCE_RATE", constantValue: "27" },
  { name: "DSK_PRATE", title: "نرخ پورسانتاژ", dataType: "NUMBER", length: 2, source: "PARAM", paramKey: "PORSANT_RATE", constantValue: "0" },
  { name: "DSK_BIMH", title: "نرخ مشاغل سخت و زیان آور", dataType: "NUMBER", length: 12, source: "PARAM", paramKey: "HARD_JOB_RATE", constantValue: "0" },
  { name: "MON_PYM", title: "ردیف پیمان", dataType: "TEXT", length: 3, source: "EMPLOYEE_FIELD", systemField: "BRANCH_CONTRACT_ROW" },
  agg("DSK_INC", "مجموع پایه سنوات", 12, "DSW_INC"),
  agg("DSK_SPOUSE", "مجموع حق تاهل", 12, "DSW_SPOUSE"),
];
const DSKWOR_FIELDS: FieldDef[] = [
  { name: "DSW_ID", title: "کد کارگاه", dataType: "TEXT", length: 10, source: "EMPLOYEE_FIELD", systemField: "BRANCH_CODE" },
  { name: "DSW_YY", title: "سال عملکرد", dataType: "NUMBER", length: 2, zeroPad: true, source: "EMPLOYEE_FIELD", systemField: "PERIOD_YEAR2" },
  { name: "DSW_MM", title: "ماه عملکرد", dataType: "NUMBER", length: 2, source: "EMPLOYEE_FIELD", systemField: "PERIOD_MONTH" },
  { name: "DSW_LISTNO", title: "شماره لیست", dataType: "TEXT", length: 12, source: "PARAM", paramKey: "LIST_NO", constantValue: "1" },
  { name: "DSW_ID1", title: "شماره بیمه", dataType: "TEXT", length: 10, zeroPad: true, source: "EMPLOYEE_FIELD", systemField: "INSURANCE_NUMBER" },
  { name: "DSW_FNAME", title: "نام", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "FIRST_NAME" },
  { name: "DSW_LNAME", title: "نام خانوادگی", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "LAST_NAME" },
  { name: "DSW_DNAME", title: "نام پدر", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "FATHER_NAME" },
  { name: "DSW_IDNO", title: "شماره شناسنامه", dataType: "TEXT", length: 15, source: "EMPLOYEE_FIELD", systemField: "BIRTH_CERT_NO" },
  { name: "DSW_IDPLC", title: "محل صدور", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "ISSUE_PLACE" },
  { name: "DSW_IDATE", title: "تاریخ صدور", dataType: "TEXT", length: 8, source: "EMPTY" },
  { name: "DSW_BDATE", title: "تاریخ تولد", dataType: "TEXT", length: 8, source: "EMPLOYEE_FIELD", systemField: "BIRTH_DATE_J8" },
  { name: "DSW_SEX", title: "جنسیت", dataType: "TEXT", length: 3, source: "EMPLOYEE_FIELD", systemField: "GENDER_TEXT" },
  { name: "DSW_NAT", title: "ملیت", dataType: "TEXT", length: 10, source: "EMPLOYEE_FIELD", systemField: "NATIONALITY_TITLE" },
  { name: "DSW_OCP", title: "شرح شغل", dataType: "TEXT", length: 100, source: "EMPLOYEE_FIELD", systemField: "JOB_TITLE" },
  { name: "DSW_SDATE", title: "تاریخ شروع به کار", dataType: "TEXT", length: 8, source: "EMPLOYEE_FIELD", systemField: "START_DATE_IN_MONTH_J8" },
  { name: "DSW_EDATE", title: "تاریخ ترک کار", dataType: "TEXT", length: 8, source: "EMPLOYEE_FIELD", systemField: "END_DATE_IN_MONTH_J8" },
  { name: "DSW_DD", title: "تعداد روزهای کارکرد", dataType: "NUMBER", length: 2, source: "FACTOR_SUM", suggest: { factorTitles: ["کارکرد عادی"] } },
  { name: "DSW_ROOZ", title: "دستمزد روزانه", dataType: "NUMBER", length: 12, source: "EXPR", exprText: "DSW_MAH / DSW_DD" },
  { name: "DSW_MAH", title: "دستمزد ماهانه", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: MAH_TITLES } },
  { name: "DSW_MAZ", title: "مزایای ماهانه", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: MAZ_TITLES } },
  { name: "DSW_MASH", title: "جمع دستمزد و مزایای ماهانه مشمول", dataType: "NUMBER", length: 12, source: "EXPR", exprText: "DSW_MAH + DSW_MAZ" },
  { name: "DSW_TOTL", title: "جمع کل دستمزد و مزایای ماهانه", dataType: "NUMBER", length: 12, source: "EXPR", exprText: "DSW_MAH + DSW_MAZ" },
  { name: "DSW_BIME", title: "حق بیمه سهم بیمه شده", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: ["بیمه کارمند"] } },
  { name: "DSW_PRATE", title: "نرخ پورسانتاژ", dataType: "NUMBER", length: 2, source: "CONSTANT", constantValue: "0" },
  { name: "DSW_JOB", title: "کد شغل", dataType: "TEXT", length: 6, source: "EMPLOYEE_FIELD", systemField: "JOB_SS_CODE" },
  { name: "PER_NATCOD", title: "کد ملی", dataType: "TEXT", length: 10, source: "EMPLOYEE_FIELD", systemField: "NATIONAL_ID" },
  { name: "DSW_INC", title: "پایه سنوات", dataType: "NUMBER", length: 12, source: "FACTOR_SUM" },
  { name: "DSW_SPOUSE", title: "حق تاهل", dataType: "NUMBER", length: 12, source: "FACTOR_SUM", suggest: { factorTitles: ["حق تاهل"] } },
];

const delimited = (seq: number, nameTemplate: string, fields: FieldDef[]): FileDef => ({
  seq, nameTemplate, format: "DELIMITED", rowKind: "PER_EMPLOYEE", delimiter: ",", encoding: "UTF8_BOM", lineEnding: "LF", trailingNewline: true, fields,
});

export const SYSTEM_STRUCTURES: StructureDef[] = [
  {
    systemKey: "TAX_WH",
    title: "فهرست حقوق مالیاتی (WH)",
    description: "فایل فهرست حقوق سامانه مالیات بر درآمد حقوق (WHYYYYMM.TXT) — جدول اقلام حقوق و دستمزد (ریالی)، ۳۹ فیلد. اقلام بدون داده‌ی سیستمی (وضعیت محل خدمت، مسکن، اتومبیل) فعلاً خالی می‌ماند.",
    sourceKind: "PAYROLL_LIST",
    isActive: true,
    files: [delimited(1, "WH{YYYY}{MM}.TXT", WH_FIELDS)],
  },
  {
    systemKey: "TAX_WP",
    title: "فهرست کارکنان مالیاتی (WP)",
    description: "فایل فهرست کارکنان سامانه مالیات بر درآمد حقوق (WPYYYYMM.TXT)، ۲۳ فیلد؛ فقط برای کارمند تازه یا تغییر اطلاعات ارسال می‌شود. نوع بیمه، نوع معافیت و رسته فعلاً خالی می‌ماند.",
    sourceKind: "PAYROLL_LIST",
    isActive: true,
    files: [delimited(1, "WP{YYYY}{MM}.TXT", WP_FIELDS)],
  },
  {
    systemKey: "SSO_DSK",
    title: "لیست بیمه تامین اجتماعی (DSKKAR / DSKWOR)",
    description: "فایل‌های DBF لیست ماهانه بیمه (نسخه ۶ list disk): DSKKAR00.DBF (سرلیست) و DSKWOR00.DBF (کارکنان) در یک zip؛ متن‌ها با ایران‌سیستم. تولید نیاز به انتخاب شعبه‌ی سازمان تامین اجتماعی دارد.",
    sourceKind: "PAYROLL_LIST",
    isActive: true,
    zipNameTemplate: "DSKKAR00.zip",
    files: [
      { seq: 1, nameTemplate: "DSKKAR00.DBF", format: "DBF", rowKind: "SINGLE", delimiter: ",", encoding: "IRAN_SYSTEM", lineEnding: "LF", trailingNewline: false, fields: DSKKAR_FIELDS },
      { seq: 2, nameTemplate: "DSKWOR00.DBF", format: "DBF", rowKind: "PER_EMPLOYEE", delimiter: ",", encoding: "IRAN_SYSTEM", lineEnding: "LF", trailingNewline: false, fields: DSKWOR_FIELDS },
    ],
  },
];
