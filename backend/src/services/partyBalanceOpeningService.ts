import { prisma, getCurrentFiscalPeriod } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { hasExcessDecimals } from "../utils/amountDecimals";
import { PartyBalanceRole, ROLE_TITLE, closingBalances, openingLockReason } from "./partyBalanceService";
import { getCloseContext } from "../utils/fiscalPeriodValidation";

// =========================================================================
// رکوردهای «مانده اول دوره» مشتریان/تامین‌کنندگان (فرم داده‌ای) — تنها نویسنده‌ی این جدول‌ها: فرم و «ورود از اکسل» هر دو از همین توابع می‌گذرند.
// سال مالی = سال مالی انتخاب‌شده‌ی کاربر (دوره‌ی جاری درخواست)؛ ردیف‌ها ستون سال ندارند و از طریق سرصفحه‌ی PartyBalanceOpening (یکتا برای هر سال) به سال وصل‌اند،
// پس فیلتر خودکار سال مالی روی آن‌ها اعمال نمی‌شود و همه‌ی کوئری‌ها صراحتاً با opening.fiscalPeriodId فیلتر می‌کنند.
// قواعد قفل و بستن: partyBalanceService.ts.
// =========================================================================

export interface OpeningLineView {
  id: number;
  partyId: number;
  partyCode: number | null;
  partyTitle: string;
  currencyId: number;
  currencyTitle: string;
  amount: number;
  nature: "DEBIT" | "CREDIT";
  description: string | null;
  isSystemGenerated: boolean;
}

export interface OpeningInput {
  partyId: number;
  currencyId: number;
  amount: number | string;
  nature: string;
  description?: string | null;
}

const noun = (role: PartyBalanceRole) => (role === "CUSTOMER" ? "مشتری" : "تامین‌کننده");

async function requireCurrent() {
  const current = await getCurrentFiscalPeriod();
  if (!current) throw new Error("دوره مالی جاری مشخص نیست");
  return current;
}

const LINE_INCLUDE = { party: { select: { detailTitle: true } }, currency: { select: { title: true } } } as const;

const viewOf = (l: any, code: number | null): OpeningLineView => ({
  id: l.id,
  partyId: l.partyId,
  partyCode: code,
  partyTitle: l.party.detailTitle,
  currencyId: l.currencyId,
  currencyTitle: l.currency.title,
  amount: Math.abs(Number(l.balance)),
  nature: Number(l.balance) >= 0 ? "DEBIT" : "CREDIT",
  description: l.description,
  isSystemGenerated: l.isSystemGenerated,
});

/** کد مشتری/تامین‌کننده‌ی هر طرف‌حساب (برای نمایش) */
async function roleCodes(role: PartyBalanceRole, partyIds: number[]): Promise<Map<number, number>> {
  if (!partyIds.length) return new Map();
  const rows: any[] =
    role === "CUSTOMER"
      ? await prisma.customer.findMany({ where: { partyId: { in: partyIds } }, select: { partyId: true, code: true } })
      : await prisma.supplier.findMany({ where: { partyId: { in: partyIds } }, select: { partyId: true, code: true } });
  return new Map(rows.map((r) => [r.partyId, r.code]));
}

/** وضعیت فرم برای سال مالی انتخاب‌شده: فقط‌خواندنی بودن و دلیلش، و وضعیت بستن */
export async function openingStatus(role: PartyBalanceRole) {
  const current = await requireCurrent();
  const lockReason = await openingLockReason(role, current.id);
  const close = await withoutFiscalPeriodScope(() => prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: current.id, role } } }));
  return {
    role,
    roleTitle: ROLE_TITLE[role],
    current: { id: current.id, title: current.title, fromDate: current.fromDate, toDate: current.toDate },
    readOnly: !!lockReason,
    readOnlyReason: lockReason,
    closedAt: close?.closedAt ?? null,
  };
}

export async function listOpeningLines(role: PartyBalanceRole): Promise<OpeningLineView[]> {
  const current = await requireCurrent();
  const rows: any[] = await withoutFiscalPeriodScope(() =>
    prisma.partyBalanceOpeningLine.findMany({ where: { role, opening: { fiscalPeriodId: current.id } }, include: LINE_INCLUDE, orderBy: { id: "asc" } })
  );
  const codes = await roleCodes(role, rows.map((r) => r.partyId));
  return rows.map((r) => viewOf(r, codes.get(r.partyId) ?? null));
}

export async function getOpeningLine(role: PartyBalanceRole, id: number): Promise<OpeningLineView | null> {
  const current = await requireCurrent();
  const l: any = await withoutFiscalPeriodScope(() => prisma.partyBalanceOpeningLine.findFirst({ where: { id, role, opening: { fiscalPeriodId: current.id } }, include: LINE_INCLUDE }));
  if (!l) return null;
  return viewOf(l, (await roleCodes(role, [l.partyId])).get(l.partyId) ?? null);
}

/** اعتبارسنجی یک رکورد (مبلغ مثبت + نوع مانده؛ اعشار ≤ اعشار ارز؛ طرف‌حساب باید همین نقش را داشته باشد) */
async function cleanInput(role: PartyBalanceRole, raw: OpeningInput) {
  const partyId = Number(raw.partyId);
  const currencyId = Number(raw.currencyId);
  const amount = Number(String(raw.amount ?? "").replace(/,/g, ""));
  if (!partyId) throw new Error(`${noun(role)} انتخاب نشده است`);
  const cur = await prisma.currency.findUnique({ where: { id: currencyId }, select: { title: true, decimalPlaces: true } });
  if (!cur) throw new Error("ارز انتخاب نشده است");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("مبلغ باید بزرگ‌تر از صفر باشد (برای بستانکار، «نوع مانده» را بستانکار بگذارید)");
  if (hasExcessDecimals(amount, cur.decimalPlaces)) throw new Error(`مبلغ بیش از تعداد رقم اعشار ارز «${cur.title}» (${cur.decimalPlaces} رقم) است`);
  if (raw.nature !== "DEBIT" && raw.nature !== "CREDIT") throw new Error("نوع مانده (بدهکار/بستانکار) انتخاب نشده است");
  const has: any = role === "CUSTOMER" ? await prisma.customer.findUnique({ where: { partyId }, select: { id: true } }) : await prisma.supplier.findUnique({ where: { partyId }, select: { id: true } });
  if (!has) throw new Error(`این طرف‌حساب ${noun(role)} نیست`);
  const description = typeof raw.description === "string" && raw.description.trim() ? raw.description.trim().slice(0, 500) : null;
  return { partyId, currencyId, balance: raw.nature === "CREDIT" ? -amount : amount, description };
}

const DUP_MESSAGE = "برای این طرف‌حساب و ارز قبلاً مانده‌ی اول دوره ثبت شده است؛ همان رکورد را ویرایش کنید";

export async function createOpeningLine(role: PartyBalanceRole, raw: OpeningInput): Promise<{ id: number }> {
  const current = await requireCurrent();
  const reason = await openingLockReason(role, current.id);
  if (reason) throw new Error(reason);
  const data = await cleanInput(role, raw);
  return withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7100071)");
      let opening = await tx.partyBalanceOpening.findUnique({ where: { fiscalPeriodId: current.id } });
      if (!opening) opening = await tx.partyBalanceOpening.create({ data: { fiscalPeriodId: current.id } });
      const dup = await tx.partyBalanceOpeningLine.findFirst({ where: { openingId: opening.id, role, partyId: data.partyId, currencyId: data.currencyId }, select: { id: true } });
      if (dup) throw new Error(DUP_MESSAGE);
      const line = await tx.partyBalanceOpeningLine.create({ data: { ...data, openingId: opening.id, role, isSystemGenerated: false } });
      return { id: line.id };
    })
  );
}

export async function updateOpeningLine(role: PartyBalanceRole, id: number, raw: OpeningInput): Promise<void> {
  const current = await requireCurrent();
  const reason = await openingLockReason(role, current.id);
  if (reason) throw new Error(reason);
  const data = await cleanInput(role, raw);
  await withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7100071)");
      const line = await tx.partyBalanceOpeningLine.findFirst({ where: { id, role, opening: { fiscalPeriodId: current.id } } });
      if (!line) throw new Error("رکورد یافت نشد");
      if (line.isSystemGenerated) throw new Error("این رکورد را «بستن سال» ساخته و قابل ویرایش نیست");
      const dup = await tx.partyBalanceOpeningLine.findFirst({ where: { openingId: line.openingId, role, partyId: data.partyId, currencyId: data.currencyId, id: { not: id } }, select: { id: true } });
      if (dup) throw new Error(DUP_MESSAGE);
      await tx.partyBalanceOpeningLine.update({ where: { id }, data });
    })
  );
}

export async function deleteOpeningLine(role: PartyBalanceRole, id: number): Promise<void> {
  const current = await requireCurrent();
  const reason = await openingLockReason(role, current.id);
  if (reason) throw new Error(reason);
  await withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(7100071)");
      const line = await tx.partyBalanceOpeningLine.findFirst({ where: { id, role, opening: { fiscalPeriodId: current.id } } });
      if (!line) throw new Error("رکورد یافت نشد");
      if (line.isSystemGenerated) throw new Error("این رکورد را «بستن سال» ساخته و قابل حذف نیست");
      await tx.partyBalanceOpeningLine.delete({ where: { id } });
      if (!(await tx.partyBalanceOpeningLine.count({ where: { openingId: line.openingId } }))) await tx.partyBalanceOpening.delete({ where: { id: line.openingId } });
    })
  );
}

/** طرف‌حساب‌های دارای نقش (برای انتخابگر فرم) */
export async function listRoleParties(role: PartyBalanceRole) {
  const rows: any[] =
    role === "CUSTOMER"
      ? await prisma.customer.findMany({ select: { code: true, isActive: true, party: { select: { id: true, detailTitle: true } } }, orderBy: { code: "asc" } })
      : await prisma.supplier.findMany({ select: { code: true, isActive: true, party: { select: { id: true, detailTitle: true } } }, orderBy: { code: "asc" } });
  return rows.map((r) => ({ id: r.party.id, code: r.code, title: r.party.detailTitle, isActive: r.isActive }));
}

/** وضعیت «بستن سال» برای صفحه‌ی بستن؛ دلیل غیرفعال‌بودن هر دکمه هم می‌آید تا صفحه آن را در متن نشان دهد */
export async function closeStatus(role: PartyBalanceRole) {
  const { current, next } = await getCloseContext();
  const [close, nextClosed, rowCount] = await Promise.all([
    withoutFiscalPeriodScope(() => prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: current.id, role } } })),
    next ? withoutFiscalPeriodScope(() => prisma.partyBalanceYearClose.findUnique({ where: { fiscalPeriodId_role: { fiscalPeriodId: next.id, role } } })) : Promise.resolve(null),
    closingBalances(current, role).then((r) => r.length),
  ]);
  const nextManual = next ? await withoutFiscalPeriodScope(() => prisma.partyBalanceOpeningLine.count({ where: { role, opening: { fiscalPeriodId: next.id }, isSystemGenerated: false } })) : 0;
  let closeBlockedReason: string | null = null;
  if (close) closeBlockedReason = "مانده‌ی این سال قبلاً بسته شده است";
  else if (!next) closeBlockedReason = "سال مالی بعد تعریف نشده است؛ ابتدا آن را در «دوره‌های مالی» تعریف کنید";
  else if (nextManual) closeBlockedReason = "برای سال مالی بعد مانده‌ی اول دوره‌ی دستی ثبت شده است؛ ابتدا آن را حذف کنید تا بستن بتواند افتتاحیه‌ی سیستمی بسازد";
  let reopenBlockedReason: string | null = null;
  if (!close) reopenBlockedReason = "مانده‌ی این سال بسته نشده است";
  else if (nextClosed) reopenBlockedReason = "سال مالی بعد هم بسته شده است؛ ابتدا بستن سال بعد را باز کنید";
  return {
    role,
    roleTitle: ROLE_TITLE[role],
    current: { id: current.id, title: current.title, fromDate: current.fromDate, toDate: current.toDate },
    next: next ? { id: next.id, title: next.title, fromDate: next.fromDate, toDate: next.toDate } : null,
    closedAt: close?.closedAt ?? null,
    rowCount,
    closeBlockedReason,
    reopenBlockedReason,
  };
}
