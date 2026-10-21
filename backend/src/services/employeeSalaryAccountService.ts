import { prisma } from "../lib/prisma";
import { jalaliMonthRange, toJalaliYearMonth } from "../utils/jalaliDate";
import { getCalendarMonth, missingMonthMessage } from "./workCalendarService";

// حساب دریافت حقوق کارمند (منابع انسانی › پرسنلی › «حساب دریافت حقوق»): هر رکورد = «از ماه» (تقویم کاری) × نوع پرداخت حقوق × یکی از حساب‌های بانکیِ همان شخص.
// ماه بر اساس تقویم کاری انتخاب می‌شود و مؤثرِ ماه M برای نوع T = آخرین رکورد همان نوع با «از ماه» ≤ M. هر حساب باید به یک نوع پرداخت وصل شود
// (رکورد «همه‌ی انواع» وجود ندارد). فقط نوع‌هایی که «پرداخت به: پرسنل» هستند مجازند (سازمان‌های ذینفع حساب کارمند نمی‌خواهند).
// تنها نویسنده و خواننده‌ی EmployeeSalaryAccount همین سرویس است (فرم‌ها، اکسل، فیش حقوق و فایل بانکی همه از اینجا رد می‌شوند).
// قفلی ندارد: محاسبه‌ی حقوق از این حساب استفاده نمی‌کند؛ قفل منطقی (فایل/سند پرداخت) بعد از ساخت فرم پرداخت اضافه می‌شود.

export class SalaryAccountError extends Error {}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const monthLabel = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

export interface AccountLite {
  id: number;
  partyId: number;
  bankPartyId: number | null;
  accountNumber: string | null;
  iban: string | null;
  cardNumber: string | null;
}

/** عنوان نمایشی حساب: شماره حساب، در نبود آن شبا، در نبود آن کارت */
export const accountLabel = (a: { accountNumber: string | null; iban: string | null; cardNumber: string | null; id: number }) =>
  a.accountNumber || a.iban || a.cardNumber || String(a.id);

/** عنوان تفصیلیِ شخصِ بانک‌ها */
async function bankTitles(ids: (number | null)[]): Promise<Map<number, string>> {
  const list = [...new Set(ids.filter((x): x is number => !!x))];
  if (!list.length) return new Map();
  const rows = await prisma.party.findMany({ where: { id: { in: list } }, select: { id: true, detailTitle: true } });
  return new Map(rows.map((r) => [r.id, r.detailTitle]));
}

/**
 * حساب مؤثر هر کارمند در یک ماه. با paymentTypeId = همان نوع؛ بدون آن (چاپ فیش و فایل بانکیِ فعلی که نوع پرداخت ندارند) = رکوردِ با بزرگ‌ترین «از ماه» که
 * ≤ ماه باشد و در تساوی کم‌ترین شناسه‌ی نوع پرداخت. کارمندِ بدون حساب در نقشه نمی‌آید.
 */
export async function loadSalaryAccounts(employeeIds: number[], year: number, month: number, paymentTypeId?: number): Promise<Map<number, AccountLite>> {
  const out = new Map<number, AccountLite>();
  if (!employeeIds.length) return out;
  const ref = jalaliMonthRange(year, month).end;
  const rows = await prisma.employeeSalaryAccount.findMany({
    where: { employeeId: { in: employeeIds }, ...(paymentTypeId ? { paymentTypeId } : {}), fromMonth: { startDate: { lte: ref } } },
    orderBy: [{ fromMonth: { startDate: "desc" } }, { paymentTypeId: "asc" }],
    include: { bankAccount: true },
  });
  for (const r of rows) if (!out.has(r.employeeId)) out.set(r.employeeId, r.bankAccount);
  return out;
}

async function loadCalendarMonthId(year: number, month: number): Promise<number> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new SalaryAccountError("«از ماه» نامعتبر است");
  const cal = await getCalendarMonth(year, month);
  if (!cal) throw new SalaryAccountError((await missingMonthMessage(year, month)) ?? "ماه در تقویم کاری تعریف نشده است");
  return cal.id;
}

export interface SalaryAccountInput {
  employeeId: number;
  paymentTypeId: number;
  year: number;
  month: number;
  bankAccountId: number;
  note?: unknown;
}

/** اعتبارسنجی مشترک و ساخت داده‌ی ذخیره */
async function buildData(b: SalaryAccountInput) {
  const emp = await prisma.employee.findUnique({ where: { id: Number(b.employeeId) }, select: { id: true, partyId: true, personnelCode: true } });
  if (!emp) throw new SalaryAccountError("کارمند را انتخاب کنید");
  const type = await prisma.payrollPaymentType.findUnique({ where: { id: Number(b.paymentTypeId) } });
  if (!type) throw new SalaryAccountError("نوع پرداخت حقوق را انتخاب کنید");
  if (!type.isActive) throw new SalaryAccountError(`نوع پرداخت «${type.title}» غیرفعال است`);
  if (type.payTo !== "EMPLOYEE") throw new SalaryAccountError(`نوع پرداخت «${type.title}» به سازمان پرداخت می‌شود و حساب کارمند نمی‌خواهد`);
  const acc = await prisma.partyBankAccount.findUnique({ where: { id: Number(b.bankAccountId) } });
  if (!acc) throw new SalaryAccountError("حساب بانکی را انتخاب کنید");
  if (acc.partyId !== emp.partyId) throw new SalaryAccountError("حساب دریافت حقوق باید از حساب‌های بانکی همین شخص باشد");
  const fromMonthId = await loadCalendarMonthId(Number(b.year), Number(b.month));
  return { emp, type, data: { employeeId: emp.id, paymentTypeId: type.id, fromMonthId, bankAccountId: acc.id, note: str(b.note) } };
}

const DUP = "برای این کارمند، نوع پرداخت و ماه قبلاً حساب ثبت شده است";

export async function createSalaryAccount(b: SalaryAccountInput): Promise<{ id: number }> {
  const { data } = await buildData(b);
  try {
    const r = await prisma.employeeSalaryAccount.create({ data });
    return { id: r.id };
  } catch (e: any) {
    if (e?.code === "P2002") throw new SalaryAccountError(DUP);
    throw e;
  }
}

/** کارمند قابل تغییر نیست؛ نوع پرداخت، ماه، حساب و توضیح قابل ویرایش‌اند */
export async function updateSalaryAccount(id: number, b: SalaryAccountInput): Promise<void> {
  const existing = await prisma.employeeSalaryAccount.findUnique({ where: { id } });
  if (!existing) throw new SalaryAccountError("رکورد یافت نشد");
  const { data } = await buildData({ ...b, employeeId: existing.employeeId });
  try {
    await prisma.employeeSalaryAccount.update({ where: { id }, data });
  } catch (e: any) {
    if (e?.code === "P2002") throw new SalaryAccountError(DUP);
    throw e;
  }
}

/** برای ورود از اکسل: همان (کارمند، نوع، ماه) هست ⇒ حساب را عوض می‌کند، وگرنه رکورد تازه می‌سازد */
export async function upsertSalaryAccount(b: SalaryAccountInput): Promise<{ id: number; action: "CREATED" | "UPDATED" }> {
  const { data } = await buildData(b);
  const existing = await prisma.employeeSalaryAccount.findUnique({
    where: { employeeId_paymentTypeId_fromMonthId: { employeeId: data.employeeId, paymentTypeId: data.paymentTypeId, fromMonthId: data.fromMonthId } },
  });
  if (existing) {
    await prisma.employeeSalaryAccount.update({ where: { id: existing.id }, data: { bankAccountId: data.bankAccountId, ...(data.note ? { note: data.note } : {}) } });
    return { id: existing.id, action: "UPDATED" };
  }
  const r = await prisma.employeeSalaryAccount.create({ data });
  return { id: r.id, action: "CREATED" };
}

export async function deleteSalaryAccount(id: number): Promise<void> {
  const existing = await prisma.employeeSalaryAccount.findUnique({ where: { id } });
  if (!existing) throw new SalaryAccountError("رکورد یافت نشد");
  await prisma.employeeSalaryAccount.delete({ where: { id } });
}

const fullName = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";

function shape(r: any, bankTitle: Map<number, string>, currentIds: Set<number>) {
  const ym = toJalaliYearMonth(r.fromMonth.startDate);
  return {
    id: r.id,
    employeeId: r.employeeId,
    personnelCode: r.employee.personnelCode,
    employeeName: fullName(r.employee.party),
    paymentTypeId: r.paymentTypeId,
    paymentTypeTitle: r.paymentType.title,
    fromYear: ym.year,
    fromMonth: ym.month,
    fromMonthTitle: monthLabel(ym.year, ym.month),
    bankAccountId: r.bankAccountId,
    accountLabel: accountLabel(r.bankAccount),
    iban: r.bankAccount.iban,
    cardNumber: r.bankAccount.cardNumber,
    bankTitle: r.bankAccount.bankPartyId ? bankTitle.get(r.bankAccount.bankPartyId) ?? null : null,
    note: r.note,
    updatedAt: r.updatedAt,
    isCurrent: currentIds.has(r.id),
  };
}

const INCLUDE = {
  employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } },
  paymentType: { select: { id: true, title: true } },
  fromMonth: { select: { startDate: true } },
  bankAccount: true,
} as const;

/** فهرست رکوردها؛ «جاری» = رکورد مؤثر هر (کارمند، نوع پرداخت) در ماهِ امروز (برای نشان‌دادن حساب فعلی) */
export async function listSalaryAccounts(employeeId?: number) {
  const rows = await prisma.employeeSalaryAccount.findMany({
    where: employeeId ? { employeeId } : {},
    include: INCLUDE,
    orderBy: [{ employeeId: "asc" }, { paymentTypeId: "asc" }, { fromMonth: { startDate: "desc" } }],
  });
  const now = toJalaliYearMonth(new Date());
  const ref = jalaliMonthRange(now.year, now.month).end;
  const current = new Set<number>();
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.employeeId}:${r.paymentTypeId}`;
    if (!seen.has(key) && r.fromMonth.startDate <= ref) {
      seen.add(key);
      current.add(r.id);
    }
  }
  const titles = await bankTitles(rows.map((r) => r.bankAccount.bankPartyId));
  return rows.map((r) => shape(r, titles, current));
}

export async function getSalaryAccount(id: number) {
  const r = await prisma.employeeSalaryAccount.findUnique({ where: { id }, include: INCLUDE });
  if (!r) return null;
  const titles = await bankTitles([r.bankAccount.bankPartyId]);
  return shape(r, titles, new Set());
}

/** گزینه‌های فرم برای یک کارمند: حساب‌های بانکی همان شخص و نوع‌های پرداخت «پرسنل» */
export async function salaryAccountOptions(employeeId?: number) {
  const types = await prisma.payrollPaymentType.findMany({ where: { payTo: "EMPLOYEE", isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true } });
  if (!employeeId) return { types, accounts: [] as any[] };
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { partyId: true } });
  const accs = emp ? await prisma.partyBankAccount.findMany({ where: { partyId: emp.partyId }, orderBy: { id: "asc" } }) : [];
  const titles = await bankTitles(accs.map((a) => a.bankPartyId));
  return {
    types,
    accounts: accs.map((a) => ({ id: a.id, label: accountLabel(a), iban: a.iban, cardNumber: a.cardNumber, bankTitle: a.bankPartyId ? titles.get(a.bankPartyId) ?? null : null })),
  };
}

/** حساب مؤثر ماهِ امروز به تفکیک نوع پرداخت، برای نمایش در فرم کارمند */
export async function currentSalaryAccounts(employeeId: number) {
  const all = await listSalaryAccounts(employeeId);
  return all.filter((r) => r.isCurrent).map((r) => ({ id: r.id, paymentTypeTitle: r.paymentTypeTitle, accountLabel: r.accountLabel, bankTitle: r.bankTitle, fromMonthTitle: r.fromMonthTitle }));
}

/** آیا حساب بانکیِ داده‌شده در رکورد حقوق کارمندی استفاده شده است؟ (برای پیام دوستانه‌ی حذف حساب از فرم شخص؛ پشتوانه‌ی دیتابیسی: FK با Restrict) */
export async function salaryAccountUsedBy(bankAccountIds: number[]): Promise<string | null> {
  const used = await prisma.employeeSalaryAccount.findFirst({ where: { bankAccountId: { in: bankAccountIds } }, select: { employee: { select: { party: { select: { detailTitle: true } } } } } });
  return used ? used.employee.party.detailTitle : null;
}
