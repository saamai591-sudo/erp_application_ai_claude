import { prisma } from "../lib/prisma";
import { AssetError } from "./assetError";
import { assetSettingIdsInUse, assetSettingUsageMessage } from "./settingUsageService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// «حسابهای دارایی ثابت»: حساب هر نوع برای هر گروه دارایی (و برای دو حساب بیمه، به‌تفکیک نوع بیمه) با تاریخ اجرا — مثل «تعیین حسابهای معین» خزانه‌داری.
// حساب مؤثر برای یک سند = آخرین رکورد کلید با تاریخ اجرای ≤ تاریخ سند. تنها محل خواندن/نوشتن این رکوردها همین سرویس است.
// قفل زنده: رکوردی که در سند حسابداری صادرشده استفاده شده (AccountingSettingUsage) قابل ویرایش/حذف نیست؛ حذف سند آن را آزاد می‌کند.

export const ASSET_ACCOUNT_TYPES: { key: string; title: string; perInsuranceType?: boolean }[] = [
  { key: "ASSET_COST", title: "دارایی ثابت" },
  { key: "DEPRECIATION_EXPENSE", title: "هزینه استهلاک" },
  { key: "ACCUMULATED_DEPRECIATION", title: "استهلاک انباشته" },
  { key: "INSURANCE_EXPENSE", title: "هزینه بیمه", perInsuranceType: true },
  { key: "PREPAID_INSURANCE", title: "پیش‌پرداخت بیمه", perInsuranceType: true },
  { key: "SALE_GAIN_LOSS", title: "سود و زیان ناشی از فروش دارایی" },
  { key: "INSURANCE_GAIN_LOSS", title: "سود و زیان ناشی از بیمه دارایی" },
  { key: "REPAIR_EXPENSE", title: "هزینه تعمیر" },
  { key: "DONATION_EXPENSE", title: "هزینه اهدا" },
  { key: "SCRAP_LOSS", title: "زیان ناشی از اسقاط" },
  { key: "PRIOR_PERIOD_ADJUSTMENT", title: "تعدیلات سنواتی" },
];
const BY_KEY = new Map(ASSET_ACCOUNT_TYPES.map((t) => [t.key, t]));

/** کد انواع تفصیلی که سیستم برای هر نوع حساب می‌تواند خودش پر کند: ۱ طرف حساب، ۲ مرکز هزینه، ۸ پروژه */
const ALLOWED_DETAIL_CODES: Record<string, number[]> = {
  ASSET_COST: [2, 8],
  DEPRECIATION_EXPENSE: [2, 8],
  ACCUMULATED_DEPRECIATION: [2, 8],
  INSURANCE_EXPENSE: [1, 2, 8],
  PREPAID_INSURANCE: [1, 2, 8],
  SALE_GAIN_LOSS: [1, 2, 8],
  INSURANCE_GAIN_LOSS: [1, 2, 8],
  REPAIR_EXPENSE: [1, 2, 8],
  DONATION_EXPENSE: [1, 2, 8],
  SCRAP_LOSS: [2, 8],
  PRIOR_PERIOD_ADJUSTMENT: [2, 8],
};

const fail = (msg: string): never => {
  throw new AssetError(msg);
};

async function assertAccountUsable(accountId: number, accountType: string) {
  const acc = await prisma.account.findUnique({
    where: { id: accountId },
    include: { level: true, detailType1: true, detailType2: true, detailType3: true },
  });
  if (!acc) return fail("حساب یافت نشد");
  if (acc!.level.order < 3 || (await prisma.account.count({ where: { parentId: accountId } })) > 0) fail(`حساب «${acc!.title}» آخرین سطح نیست و قابل انتخاب نیست`);
  const allowed = ALLOWED_DETAIL_CODES[accountType] ?? [];
  for (const dt of [acc!.detailType1, acc!.detailType2, acc!.detailType3]) {
    if (dt && !allowed.includes(dt.code)) {
      fail(`حساب «${acc!.title}» به نوع تفصیل «${dt.title}» وصل است که سیستم برای این نوع حساب نمی‌تواند خودکار پر کند (مجاز: ${allowed.map((c) => ({ 1: "طرف حساب", 2: "مرکز هزینه", 8: "پروژه" } as Record<number, string>)[c]).join("، ")})`);
    }
  }
}

const SETTING_INCLUDE = {
  assetGroup: { select: { id: true, title: true } },
  insuranceType: { select: { id: true, title: true } },
  account: { select: { id: true, code: true, title: true } },
} as const;

function shape(r: any, locked: boolean) {
  return {
    id: r.id,
    accountType: r.accountType,
    accountTypeTitle: BY_KEY.get(r.accountType)?.title ?? r.accountType,
    assetGroupId: r.assetGroupId,
    assetGroupTitle: r.assetGroup.title,
    insuranceTypeId: r.insuranceTypeId,
    insuranceTypeTitle: r.insuranceType?.title ?? null,
    effectiveDate: r.effectiveDate,
    accountId: r.accountId,
    accountCode: r.account.code,
    accountTitle: r.account.title,
    locked,
  };
}

export async function listAccountSettings() {
  const [rows, used] = await Promise.all([
    prisma.assetAccountSetting.findMany({ include: SETTING_INCLUDE, orderBy: [{ assetGroupId: "asc" }, { accountType: "asc" }, { effectiveDate: "desc" }] }),
    assetSettingIdsInUse(),
  ]);
  return rows.map((r) => shape(r, used.has(r.id)));
}

export async function getAccountSetting(id: number) {
  const r = await prisma.assetAccountSetting.findUnique({ where: { id }, include: SETTING_INCLUDE });
  if (!r) return null;
  const msg = await assetSettingUsageMessage(id);
  return { ...shape(r, !!msg), lockedReason: msg };
}

interface SettingBody {
  accountType?: string;
  assetGroupId?: number | string;
  insuranceTypeId?: number | string | null;
  effectiveDate?: string;
  accountId?: number | string;
}

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

/** اعتبارسنجی کامل یک رکورد (بدون نوشتن)؛ داده‌ی آماده‌ی ذخیره را برمی‌گرداند */
async function validateSetting(id: number | null, body: SettingBody) {
  const t = BY_KEY.get(String(body.accountType));
  if (!t) return fail("نوع حساب نامعتبر است");
  const assetGroupId = Number(body.assetGroupId);
  if (!assetGroupId || !(await prisma.assetGroup.findUnique({ where: { id: assetGroupId }, select: { id: true } }))) fail("گروه دارایی نامعتبر است");
  let insuranceTypeId: number | null = null;
  if (t!.perInsuranceType) {
    insuranceTypeId = Number(body.insuranceTypeId) || null;
    if (!insuranceTypeId || !(await prisma.assetInsuranceType.findUnique({ where: { id: insuranceTypeId }, select: { id: true } }))) fail("برای این نوع حساب، انتخاب نوع بیمه الزامی است");
  }
  const effectiveDate = new Date(String(body.effectiveDate ?? ""));
  if (!body.effectiveDate || Number.isNaN(effectiveDate.getTime())) fail("تاریخ اجرا نامعتبر است");
  const accountId = Number(body.accountId);
  if (!accountId) fail("حساب الزامی است");
  await assertAccountUsable(accountId, t!.key);

  if (id) {
    const existing = await prisma.assetAccountSetting.findUnique({ where: { id } });
    if (!existing) return fail("رکورد یافت نشد");
    const msg = await assetSettingUsageMessage(id);
    if (msg) fail(msg);
  }
  // ترتیب تاریخ: رکورد جدید باید بعد از آخرین رکورد کلید باشد؛ ویرایش نباید رکورد را از جایش در تاریخچه جابه‌جا کند
  const siblings = await prisma.assetAccountSetting.findMany({
    where: { accountType: t!.key as any, assetGroupId, insuranceTypeId, ...(id ? { id: { not: id } } : {}) },
    select: { effectiveDate: true },
    orderBy: { effectiveDate: "asc" },
  });
  if (siblings.some((s) => dayStr(s.effectiveDate) === dayStr(effectiveDate))) fail("برای این کلید در همین تاریخ قبلاً رکوردی ثبت شده است");
  if (!id && siblings.length && dayStr(siblings[siblings.length - 1].effectiveDate) > dayStr(effectiveDate)) {
    fail(`تاریخ اجرا باید بعد از آخرین رکورد این کلید (${formatJalaliDateForMessage(siblings[siblings.length - 1].effectiveDate)}) باشد`);
  }
  const data = { accountType: t!.key as any, assetGroupId, insuranceTypeId, effectiveDate, accountId };
  if (id) {
    const old = await prisma.assetAccountSetting.findUnique({ where: { id } });
    const before = siblings.filter((s) => dayStr(s.effectiveDate) < dayStr(old!.effectiveDate)).length;
    const beforeNew = siblings.filter((s) => dayStr(s.effectiveDate) < dayStr(effectiveDate)).length;
    if (before !== beforeNew) fail("تاریخ اجرا نباید رکورد را از جای خود در تاریخچه‌ی این کلید جابه‌جا کند");
  }
  return data;
}

export async function saveAccountSetting(id: number | null, body: SettingBody) {
  const data = await validateSetting(id, body);
  return id ? prisma.assetAccountSetting.update({ where: { id }, data }) : prisma.assetAccountSetting.create({ data });
}

// ───────────── درج گروهی ─────────────

export interface BulkCandidate {
  rowKey: string;
  accountType: string;
  title: string;
  perInsuranceType: boolean;
  prefillAccountId: number | null;
  prefillAccountLabel: string | null;
  blockedReason: string | null;
}

/**
 * ردیف‌های «درج گروهی» برای یک گروه و یک تاریخ: هر نوع حسابی که در آن تاریخ حساب مؤثر ندارد (با includeExisting، انواعی که دارند هم و با حساب فعلی پیش‌پر).
 * دو نوع حساب بیمه همیشه یک ردیف دارند و نوع بیمه‌اش را کاربر انتخاب می‌کند (فرانت می‌تواند ردیف‌های بیشتری برای نوع‌های دیگر بیفزاید).
 * نوعی که رکوردی دیرتر یا هم‌تاریخ دارد «blockedReason» می‌گیرد (ترتیب تاریخ اجازه‌ی درج نمی‌دهد).
 */
export async function bulkCandidates(p: { groupId: number; date: string; includeExisting: boolean }): Promise<BulkCandidate[]> {
  const date = new Date(p.date);
  if (Number.isNaN(date.getTime())) fail("تاریخ اجرا نامعتبر است");
  if (!p.groupId || !(await prisma.assetGroup.findUnique({ where: { id: p.groupId }, select: { id: true } }))) fail("گروه دارایی نامعتبر است");
  const all = await prisma.assetAccountSetting.findMany({ where: { assetGroupId: p.groupId, insuranceTypeId: null }, include: { account: { select: { code: true, title: true } } }, orderBy: { effectiveDate: "desc" } });
  const out: BulkCandidate[] = [];
  for (const t of ASSET_ACCOUNT_TYPES) {
    if (t.perInsuranceType) {
      out.push({ rowKey: `${t.key}|0`, accountType: t.key, title: t.title, perInsuranceType: true, prefillAccountId: null, prefillAccountLabel: null, blockedReason: null });
      continue;
    }
    const mine = all.filter((x) => x.accountType === t.key);
    const effective = mine.find((x) => dayStr(x.effectiveDate) <= dayStr(date));
    const latest = mine[0];
    if (effective && !p.includeExisting) continue;
    const blocked = latest && dayStr(latest.effectiveDate) >= dayStr(date) ? `رکوردی با تاریخ اجرای ${formatJalaliDateForMessage(latest.effectiveDate)} دارد؛ تاریخ باید بعد از آن باشد` : null;
    out.push({ rowKey: `${t.key}|0`, accountType: t.key, title: t.title, perInsuranceType: false, prefillAccountId: effective?.accountId ?? null, prefillAccountLabel: effective ? `${effective.account.code} - ${effective.account.title}` : null, blockedReason: blocked });
  }
  return out;
}

export async function bulkCreate(p: { groupId: number; date: string; rows: { rowKey: string; accountType: string; insuranceTypeId?: number | null; accountId?: number | null }[] }) {
  const rows = p.rows.filter((r) => r.accountId);
  const skipped = p.rows.length - rows.length;
  if (rows.length === 0) fail("برای هیچ ردیفی حساب معین انتخاب نشده است");
  const errors: { rowKey: string; message: string }[] = [];
  const seen = new Set<string>();
  const data: Awaited<ReturnType<typeof validateSetting>>[] = [];
  for (const r of rows) {
    const key = `${r.accountType}|${r.insuranceTypeId ?? 0}`;
    if (seen.has(key)) { errors.push({ rowKey: r.rowKey, message: "این نوع حساب (با همین نوع بیمه) در چند ردیف آمده است" }); continue; }
    seen.add(key);
    try {
      data.push(await validateSetting(null, { accountType: r.accountType, assetGroupId: p.groupId, insuranceTypeId: r.insuranceTypeId ?? null, effectiveDate: p.date, accountId: r.accountId! }));
    } catch (e: any) {
      if (e instanceof AssetError) errors.push({ rowKey: r.rowKey, message: e.message });
      else throw e;
    }
  }
  if (errors.length) {
    const err = new AssetError("برخی ردیف‌ها خطا دارند؛ اصلاح یا حذفشان کنید (چیزی ذخیره نشد)");
    (err as any).details = errors;
    throw err;
  }
  await prisma.$transaction(data.map((d) => prisma.assetAccountSetting.create({ data: d })));
  return { created: data.length, skipped };
}

export async function deleteAccountSetting(id: number) {
  const msg = await assetSettingUsageMessage(id, true);
  if (msg) fail(msg);
  await prisma.assetAccountSetting.delete({ where: { id } });
}

/**
 * حساب مؤثر یک نوع برای گروه در تاریخ سند (همراه نوع‌های تفصیل و شناسه‌ی رکورد برای ثبت قفل)؛ null = تعریف نشده.
 * برای هزینه/پیش‌پرداخت بیمه، نوع بیمه الزامی است.
 */
export async function assetAccountOf(assetGroupId: number, accountType: string, date: Date, insuranceTypeId?: number | null) {
  const t = BY_KEY.get(accountType);
  if (!t) return null;
  if (t.perInsuranceType && !insuranceTypeId) return null;
  const s = await prisma.assetAccountSetting.findFirst({
    where: { accountType: accountType as any, assetGroupId, insuranceTypeId: t.perInsuranceType ? insuranceTypeId! : null, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
    include: { account: { include: { detailType1: true, detailType2: true, detailType3: true } } },
  });
  return s ? { accountId: s.accountId, account: s.account, settingId: s.id } : null;
}
