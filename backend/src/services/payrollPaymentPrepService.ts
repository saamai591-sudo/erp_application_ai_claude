import { prisma } from "../lib/prisma";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { hasExcessDecimals } from "../utils/amountDecimals";
import { getCalendarMonth, missingMonthMessage } from "./workCalendarService";
import { loadSalaryAccounts, accountLabel } from "./employeeSalaryAccountService";
import { loadStructure } from "./fileStructureService";
import { generateFiles, type GenResult } from "./fileGeneratorService";

// حقوق و دستمزد › عملیات › «آماده‌سازی پرداخت». تنها نویسنده‌ی PayrollPaymentPrep/PayrollPaymentPrepLine همین سرویس است.
// سند = ماه تقویم کاری + نوع پرداخت حقوق (+ شعبه‌ی سازمان برای نوع سازمانی، + ساختار فایل برای نوع «فایل دارد») + ردیف‌ها. هر ردیف یک آیتمِ نوع پرداخت
// (عامل حقوق / نوع وام / خالص پرداختیِ یک نوع محاسبه) از فیشِ یک کارمند است. «مبلغ قابل پرداخت» پیش‌فرض = مانده‌ی آماده‌نشده؛ کنترل اصلی:
//   مبلغ قابل پرداخت ≤ مبلغِ آیتمِ فیش − مجموع مبالغ آماده‌شده‌ی همان آیتم در سایر سندها (هر نوع پرداخت، هر وضعیت).
// نوع پرداخت سازمانی: مبلغ قابل پرداخت قابل اصلاح نیست (= کل مانده). ردیفِ «محاسبه‌شده با نتیجه‌ی صفر» لود و ذخیره می‌شود (در فایل با «حذف ردیف صفر» ساختار می‌افتد)،
// آیتمی که برای کارمند اصلاً ردیفی در فیش ندارد (مثلاً کارمندِ بدون وام) لود نمی‌شود. سند حسابداری ندارد؛ بعد از «تایید» می‌توان از روی آن فایل ساخت (ذخیره نمی‌شود).
// فیشی که در یک سند آماده‌سازی هست حذف/محاسبه‌ی دوباره نمی‌شود (slipPrepLockMessage).

export class PrepError extends Error {}

const LOCK_KEY = 7100007;
const EPS = 1e-6;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const monthLabel = (y: number, m: number) => `${MONTHS[m - 1]} ${y}`;
const fullName = (p: { firstName: string | null; lastName: string | null; name: string | null } | null | undefined) => (p ? [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "" : "");
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};

export type ItemKind = "PAYROLL_FACTOR" | "LOAN_TYPE" | "NET_PAY";
export const itemKey = (slipId: number, kind: string, refId: number | null | undefined) => `${slipId}:${kind}:${refId ?? 0}`;

export interface HeaderInput {
  year: number;
  month: number;
  paymentTypeId: number;
  branchId?: number | null;
  fileStructureId?: number | null;
}

/** آیتمِ قابل آماده‌سازی از یک فیش (قبل از کسر مانده) */
interface ItemAmt {
  slipId: number;
  employeeId: number;
  kind: ItemKind;
  refId: number | null;
  amount: number;
  itemTitle: string;
  calcTypeTitle: string;
}

async function loadType(id: number) {
  const type = await prisma.payrollPaymentType.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          payrollComponent: { select: { id: true, title: true, calcTypeId: true } },
          loanType: { select: { id: true, title: true } },
          netCalcType: { select: { id: true, title: true } },
        },
        orderBy: { id: "asc" },
      },
      beneficiaryOrg: { select: { id: true, title: true } },
    },
  });
  if (!type) throw new PrepError("نوع پرداخت حقوق را انتخاب کنید");
  return type;
}
type TypeRow = Awaited<ReturnType<typeof loadType>>;

/** ساختارهای فایلِ قابل انتخاب برای یک نوع پرداخت: نوع پرسنل ⇒ ساختارهای مربوط به یک بانک؛ نوع سازمانی ⇒ ساختارهای همان سازمان */
export async function fileStructuresForType(paymentTypeId: number) {
  const type = await loadType(paymentTypeId);
  if (!type.hasFile) return [];
  const rows = await prisma.fileStructure.findMany({
    where: { isActive: true, ...(type.payTo === "FACTOR_ORG" ? { beneficiaryOrgId: type.beneficiaryOrgId } : { bankPartyId: { not: null } }) },
    orderBy: { code: "asc" },
    select: { id: true, title: true, bankParty: { select: { detailTitle: true } }, beneficiaryOrg: { select: { title: true } } },
  });
  return rows.map((r) => ({ id: r.id, title: r.title, ownerTitle: r.bankParty?.detailTitle ?? r.beneficiaryOrg?.title ?? "" }));
}

/** کنترل‌های هدر؛ خروجی: نوع، شعبه و ساختار فایل */
async function checkHeader(h: HeaderInput) {
  if (!Number.isInteger(h.year) || !Number.isInteger(h.month) || h.month < 1 || h.month > 12) throw new PrepError("ماه را انتخاب کنید");
  if (!(await getCalendarMonth(h.year, h.month))) throw new PrepError((await missingMonthMessage(h.year, h.month)) ?? "ماه در تقویم کاری تعریف نشده است");
  const type = await loadType(Number(h.paymentTypeId));
  if (!type.isActive) throw new PrepError(`نوع پرداخت «${type.title}» غیرفعال است`);
  if (type.items.length === 0) throw new PrepError(`نوع پرداخت «${type.title}» آیتمی ندارد`);
  let branch: { id: number; organizationId: number } | null = null;
  if (type.payTo === "FACTOR_ORG") {
    if (!h.branchId) throw new PrepError("شعبه‌ی سازمان الزامی است");
    branch = await prisma.beneficiaryBranch.findUnique({ where: { id: Number(h.branchId) }, select: { id: true, organizationId: true, isActive: true } });
    if (!branch) throw new PrepError("شعبه‌ی انتخاب‌شده یافت نشد");
    if (branch.organizationId !== type.beneficiaryOrgId) throw new PrepError(`شعبه باید از شعبه‌های سازمان «${type.beneficiaryOrg?.title ?? ""}» باشد`);
  } else if (h.branchId) throw new PrepError("برای نوع پرداخت «پرسنل» شعبه انتخاب نمی‌شود");
  let structure: { id: number; bankPartyId: number | null; beneficiaryOrgId: number | null } | null = null;
  if (type.hasFile) {
    if (!h.fileStructureId) throw new PrepError("ساختار فایل الزامی است");
    structure = await prisma.fileStructure.findUnique({ where: { id: Number(h.fileStructureId) }, select: { id: true, isActive: true, title: true, bankPartyId: true, beneficiaryOrgId: true } });
    if (!structure) throw new PrepError("ساختار فایل یافت نشد");
    const ok = type.payTo === "FACTOR_ORG" ? structure.beneficiaryOrgId === type.beneficiaryOrgId : !!structure.bankPartyId;
    if (!ok) throw new PrepError("این ساختار فایل به این نوع پرداخت مربوط نیست (بانک/سازمان آن را در «ساختار فایل» تعیین کنید)");
  } else if (h.fileStructureId) throw new PrepError("این نوع پرداخت «فایل دارد» نیست؛ ساختار فایل انتخاب نمی‌شود");
  return { type, branch, structure };
}

/** آیتم‌های قابل آماده‌سازیِ فیش‌های یک ماه (نوع پرداخت داده‌شده)؛ slipIds/employeeIds برای محدودکردن */
async function collectItems(type: TypeRow, year: number, month: number, scope: { slipIds?: number[]; employeeIds?: Set<number> | null } = {}): Promise<ItemAmt[]> {
  const out: ItemAmt[] = [];
  const baseType = await prisma.payrollCalcType.findFirst({ where: { isBase: true }, select: { id: true, title: true } });
  const whereSlip = (calcTypeIds: number[]) => ({
    year,
    month,
    calcTypeId: { in: calcTypeIds },
    ...(scope.slipIds ? { id: { in: scope.slipIds } } : {}),
    ...(scope.employeeIds ? { employeeId: { in: [...scope.employeeIds] } } : {}),
  });

  // عامل‌های حقوق: ردیف‌های فیشِ همان نوع محاسبه‌ی عامل (ردیفِ بدون خطا؛ مبلغ صفر هم می‌آید)
  const factors = type.items.filter((i) => i.payrollComponent).map((i) => i.payrollComponent!);
  if (factors.length) {
    const slips = await prisma.payrollSlip.findMany({
      where: whereSlip([...new Set(factors.map((f) => f.calcTypeId))]),
      select: {
        id: true,
        employeeId: true,
        calcTypeId: true,
        calcType: { select: { title: true } },
        lines: { where: { source: "PAYROLL_COMPONENT", refId: { in: factors.map((f) => f.id) }, error: null }, select: { refId: true, amount: true } },
      },
    });
    for (const s of slips) {
      for (const l of s.lines) {
        const f = factors.find((x) => x.id === l.refId && x.calcTypeId === s.calcTypeId);
        const amount = Number(l.amount);
        if (!f || amount < 0) continue;
        out.push({ slipId: s.id, employeeId: s.employeeId, kind: "PAYROLL_FACTOR", refId: f.id, amount: r4(amount), itemTitle: f.title, calcTypeTitle: s.calcType.title });
      }
    }
  }
  // خالص پرداختیِ یک نوع محاسبه: فیشِ بدون خطا و با خالصِ نامنفی
  for (const it of type.items.filter((i) => i.netCalcType)) {
    const slips = await prisma.payrollSlip.findMany({
      where: { ...whereSlip([it.netCalcType!.id]), hasErrors: false },
      select: { id: true, employeeId: true, netPay: true, calcType: { select: { title: true } } },
    });
    for (const s of slips) {
      const amount = Number(s.netPay);
      if (amount < 0) continue;
      out.push({ slipId: s.id, employeeId: s.employeeId, kind: "NET_PAY", refId: null, amount: r4(amount), itemTitle: `خالص پرداختی — ${it.netCalcType!.title}`, calcTypeTitle: s.calcType.title });
    }
  }
  // اقساط وام به تفکیک نوع وام: از مانده‌ی ماهانه‌ی ذخیره‌شده‌ی همان فیشِ حقوق ماهانه (وامِ تمام‌شده/بی‌حرکت ردیف نمی‌شود)
  const loanTypes = type.items.filter((i) => i.loanType).map((i) => i.loanType!);
  if (loanTypes.length && baseType) {
    const slips = await prisma.payrollSlip.findMany({
      where: whereSlip([baseType.id]),
      select: {
        id: true,
        employeeId: true,
        calcType: { select: { title: true } },
        loanBalances: { select: { installment: true, balanceBefore: true, loan: { select: { loanTypeId: true } } } },
      },
    });
    for (const s of slips) {
      for (const lt of loanTypes) {
        const bals = s.loanBalances.filter((b) => b.loan.loanTypeId === lt.id && (Number(b.balanceBefore) > 0 || Number(b.installment) > 0));
        if (!bals.length) continue;
        out.push({ slipId: s.id, employeeId: s.employeeId, kind: "LOAN_TYPE", refId: lt.id, amount: r4(bals.reduce((a, b) => a + Number(b.installment), 0)), itemTitle: `وام — ${lt.title}`, calcTypeTitle: s.calcType.title });
      }
    }
  }
  return out;
}

/** مجموع مبلغ آماده‌شده و تعداد ردیف‌ها برای هر آیتمِ فیش در همه‌ی سندها به‌جز excludePrepId */
async function preparedByOthers(db: any, slipIds: number[], excludePrepId?: number | null) {
  const map = new Map<string, { sum: number; count: number }>();
  if (!slipIds.length) return map;
  const rows = await db.payrollPaymentPrepLine.findMany({
    where: { slipId: { in: slipIds }, ...(excludePrepId ? { prepId: { not: excludePrepId } } : {}) },
    select: { slipId: true, kind: true, payrollComponentId: true, loanTypeId: true, payableAmount: true },
  });
  for (const r of rows) {
    const k = itemKey(r.slipId, r.kind, r.payrollComponentId ?? r.loanTypeId);
    const cur = map.get(k) ?? { sum: 0, count: 0 };
    cur.sum += Number(r.payableAmount);
    cur.count++;
    map.set(k, cur);
  }
  return map;
}

/** کارمندان مجاز: نوع سازمانی = مشمولِ سازمان در شعبه‌ی انتخاب‌شده؛ نوع پرسنل با ساختار بانکی = حسابِ مؤثرِ ماه (و نوع) در همان بانک */
async function eligibleEmployees(type: TypeRow, branchId: number | null, structure: { bankPartyId: number | null } | null, employeeIds: number[], year: number, month: number) {
  const out = { ok: new Set<number>(employeeIds), noAccount: 0, otherBank: 0, notIncluded: 0 };
  if (type.payTo === "FACTOR_ORG") {
    const inc = await prisma.employeeBeneficiary.findMany({ where: { organizationId: type.beneficiaryOrgId!, isIncluded: true, branchId, employeeId: { in: employeeIds } }, select: { employeeId: true } });
    const set = new Set(inc.map((x) => x.employeeId));
    out.notIncluded = [...out.ok].filter((id) => !set.has(id)).length;
    out.ok = new Set([...out.ok].filter((id) => set.has(id)));
  } else if (structure?.bankPartyId) {
    const acc = await loadSalaryAccounts([...out.ok], year, month, type.id);
    for (const id of [...out.ok]) {
      const a = acc.get(id);
      if (!a) { out.noAccount++; out.ok.delete(id); }
      else if (a.bankPartyId !== structure.bankPartyId) { out.otherBank++; out.ok.delete(id); }
    }
  }
  return out;
}

export interface PrepRow {
  key: string;
  slipId: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  kind: ItemKind;
  refId: number | null;
  itemTitle: string;
  calcTypeTitle: string;
  amount: number;
  /** مانده‌ی آماده‌نشده (بدون احتساب همین سند) */
  remaining: number;
  payableAmount: number;
  orgUnit: string;
  costCenter: string;
  accountLabel: string;
  bankTitle: string;
}

/** نمایش ردیف‌ها: اطلاعات کارمند، واحد سازمانی/مرکز هزینه (انتصابِ پایان ماه) و حساب مؤثر */
async function decorate(items: (ItemAmt & { remaining: number; payableAmount: number })[], type: TypeRow, year: number, month: number): Promise<PrepRow[]> {
  if (!items.length) return [];
  const empIds = [...new Set(items.map((i) => i.employeeId))];
  const { end: monthEnd } = jalaliMonthRange(year, month);
  const [emps, accs] = await Promise.all([
    prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: {
        id: true,
        personnelCode: true,
        party: { select: { firstName: true, lastName: true, name: true } },
        assignments: { orderBy: [{ fromDate: "asc" }, { id: "asc" }], select: { fromDate: true, toDate: true, orgUnit: { select: { title: true } }, costCenter: { select: { title: true } } } },
      },
    }),
    type.payTo === "EMPLOYEE" ? loadSalaryAccounts(empIds, year, month, type.id) : Promise.resolve(new Map<number, any>()),
  ]);
  const byId = new Map(emps.map((e) => [e.id, e]));
  const bankIds = [...new Set([...accs.values()].map((a: any) => a.bankPartyId).filter((x: number | null): x is number => !!x))];
  const banks = bankIds.length ? await prisma.party.findMany({ where: { id: { in: bankIds } }, select: { id: true, detailTitle: true } }) : [];
  const bankTitle = new Map(banks.map((b) => [b.id, b.detailTitle]));
  return items
    .map((i) => {
      const e = byId.get(i.employeeId)!;
      const asg = e.assignments.filter((a) => a.fromDate <= monthEnd && (!a.toDate || a.toDate >= monthEnd)).pop() ?? e.assignments[e.assignments.length - 1];
      const acc = accs.get(i.employeeId);
      return {
        key: itemKey(i.slipId, i.kind, i.refId),
        slipId: i.slipId,
        employeeId: i.employeeId,
        personnelCode: e.personnelCode,
        employeeName: fullName(e.party),
        kind: i.kind,
        refId: i.refId,
        itemTitle: i.itemTitle,
        calcTypeTitle: i.calcTypeTitle,
        amount: i.amount,
        remaining: i.remaining,
        payableAmount: i.payableAmount,
        orgUnit: asg?.orgUnit?.title ?? "",
        costCenter: asg?.costCenter?.title ?? "",
        accountLabel: acc ? accountLabel(acc) : "",
        bankTitle: acc?.bankPartyId ? bankTitle.get(acc.bankPartyId) ?? "" : "",
      } as PrepRow;
    })
    .sort((a, b) => a.personnelCode.localeCompare(b.personnelCode, "en", { numeric: true }) || a.itemTitle.localeCompare(b.itemTitle, "fa"));
}

/** «لود اطلاعات»: ردیف‌های قابل آماده‌سازی (با مانده) که هنوز در existingKeys نیستند */
export async function loadCandidates(h: HeaderInput, opts: { excludePrepId?: number | null; existingKeys?: string[] } = {}) {
  const { type, structure } = await checkHeader(h);
  const items = await collectItems(type, h.year, h.month);
  const prepared = await preparedByOthers(prisma, [...new Set(items.map((i) => i.slipId))], opts.excludePrepId);
  const existing = new Set(opts.existingKeys ?? []);
  const elig = await eligibleEmployees(type, h.branchId ? Number(h.branchId) : null, structure, [...new Set(items.map((i) => i.employeeId))], h.year, h.month);
  const rows: (ItemAmt & { remaining: number; payableAmount: number })[] = [];
  for (const i of items) {
    const k = itemKey(i.slipId, i.kind, i.refId);
    if (existing.has(k) || !elig.ok.has(i.employeeId)) continue;
    const p = prepared.get(k) ?? { sum: 0, count: 0 };
    const remaining = r4(i.amount - p.sum);
    // مانده‌دار، یا ردیفِ صفرِ محاسبه‌شده‌ای که هنوز در هیچ سندی نیامده
    if (remaining > EPS || (Math.abs(i.amount) <= EPS && p.count === 0)) rows.push({ ...i, remaining, payableAmount: Math.max(remaining, 0) });
  }
  return {
    rows: await decorate(rows, type, h.year, h.month),
    excluded: { noAccount: elig.noAccount, otherBank: elig.otherBank, notIncluded: elig.notIncluded },
  };
}

export interface LineInput {
  slipId: number;
  kind: ItemKind;
  refId?: number | null;
  payableAmount: number;
}

export interface PrepInput extends HeaderInput {
  date: string;
  description?: unknown;
  lines: LineInput[];
}

async function baseDecimals(): Promise<number> {
  const c = await prisma.currency.findFirst({ where: { isBase: true }, select: { decimalPlaces: true } });
  return c?.decimalPlaces ?? 0;
}

function parseDay(v: unknown): Date {
  const d = new Date(`${String(v ?? "")}T00:00:00.000Z`);
  if (!v || isNaN(d.getTime())) throw new PrepError("تاریخ سند الزامی است");
  return d;
}

/** کنترل ردیف‌ها (داخل تراکنش و زیر قفل): وجود آیتم در فیش و نوع پرداخت، مجاز بودن کارمند، اعشار و سقف مبلغ قابل پرداخت */
async function validateLines(db: any, h: HeaderInput, ctx: Awaited<ReturnType<typeof checkHeader>>, lines: LineInput[], prepId: number | null) {
  if (!Array.isArray(lines) || lines.length === 0) throw new PrepError("هیچ ردیفی برای ذخیره وجود ندارد؛ «لود اطلاعات» را بزنید");
  const dec = await baseDecimals();
  const seen = new Set<string>();
  for (const l of lines) {
    const k = itemKey(Number(l.slipId), l.kind, l.refId);
    if (seen.has(k)) throw new PrepError("یک آیتم فیش بیش از یک بار در سند آمده است");
    seen.add(k);
  }
  const slipIds = [...new Set(lines.map((l) => Number(l.slipId)))];
  const items = await collectItems(ctx.type, h.year, h.month, { slipIds });
  const live = new Map(items.map((i) => [itemKey(i.slipId, i.kind, i.refId), i]));
  const others = await preparedByOthers(db, slipIds, prepId);
  const emps = new Map(items.map((i) => [i.slipId, i.employeeId]));
  const elig = await eligibleEmployees(ctx.type, h.branchId ? Number(h.branchId) : null, ctx.structure, [...new Set(emps.values())], h.year, h.month);
  const names = new Map(
    (await prisma.employee.findMany({ where: { id: { in: [...elig.ok, ...emps.values()] } }, select: { id: true, personnelCode: true } })).map((e) => [e.id, e.personnelCode])
  );
  for (const l of lines) {
    const k = itemKey(Number(l.slipId), l.kind, l.refId);
    const it = live.get(k);
    if (!it) throw new PrepError("یکی از ردیف‌ها دیگر معتبر نیست (فیش یا آیتم نوع پرداخت تغییر کرده است)؛ دوباره «لود اطلاعات» بزنید");
    const who = `کارمند ${names.get(it.employeeId) ?? it.employeeId} — ${it.itemTitle}`;
    if (!elig.ok.has(it.employeeId)) throw new PrepError(`${who}: این کارمند با شرایط این سند (شعبه/بانک) همخوان نیست`);
    const pay = Number(l.payableAmount);
    if (!isFinite(pay) || pay < 0) throw new PrepError(`${who}: مبلغ قابل پرداخت نامعتبر است`);
    if (hasExcessDecimals(pay, dec)) throw new PrepError(`${who}: تعداد اعشار مبلغ بیش از ارز پایه (${dec}) است`);
    const remaining = r4(it.amount - (others.get(k)?.sum ?? 0));
    if (pay > remaining + EPS) throw new PrepError(`${who}: مبلغ قابل پرداخت (${r4(pay)}) از مانده‌ی آماده‌نشده (${remaining}) بیشتر است`);
    if (ctx.type.payTo === "FACTOR_ORG" && Math.abs(pay - remaining) > EPS) throw new PrepError(`${who}: در نوع پرداخت سازمانی مبلغ قابل پرداخت قابل اصلاح نیست (باید ${remaining} باشد)`);
  }
  return live;
}

async function lockAll(tx: any) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
}

const lineData = (l: LineInput, it: ItemAmt, employeeId: number) => ({
  slipId: Number(l.slipId),
  employeeId,
  kind: l.kind,
  payrollComponentId: l.kind === "PAYROLL_FACTOR" ? it.refId : null,
  loanTypeId: l.kind === "LOAN_TYPE" ? it.refId : null,
  amount: it.amount,
  payableAmount: r4(Number(l.payableAmount)),
});

export async function createPrep(b: PrepInput, userId: number | null): Promise<{ id: number; number: number }> {
  const date = parseDay(b.date);
  const ctx = await checkHeader(b);
  return prisma.$transaction(
    async (tx) => {
      await lockAll(tx);
      const live = await validateLines(tx, b, ctx, b.lines, null);
      const last = await tx.payrollPaymentPrep.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const number = (last?.number ?? 0) + 1;
      const created = await tx.payrollPaymentPrep.create({
        data: {
          number,
          date,
          description: str(b.description),
          year: b.year,
          month: b.month,
          paymentTypeId: ctx.type.id,
          branchId: ctx.branch?.id ?? null,
          fileStructureId: ctx.structure?.id ?? null,
          createdById: userId,
          lines: { create: b.lines.map((l) => { const it = live.get(itemKey(Number(l.slipId), l.kind, l.refId))!; return lineData(l, it, it.employeeId); }) },
        },
      });
      return { id: created.id, number };
    },
    { timeout: 60000 }
  );
}

export async function updatePrep(id: number, b: PrepInput): Promise<void> {
  const date = parseDay(b.date);
  const ctx = await checkHeader(b);
  await prisma.$transaction(
    async (tx) => {
      await lockAll(tx);
      const existing = await tx.payrollPaymentPrep.findUnique({ where: { id }, select: { status: true } });
      if (!existing) throw new PrepError("سند آماده‌سازی پرداخت یافت نشد");
      if (existing.status !== "DRAFT") throw new PrepError("سند تاییدشده قابل ویرایش نیست؛ ابتدا «برگشت از تایید» بزنید");
      const live = await validateLines(tx, b, ctx, b.lines, id);
      await tx.payrollPaymentPrepLine.deleteMany({ where: { prepId: id } });
      await tx.payrollPaymentPrep.update({
        where: { id },
        data: {
          date,
          description: str(b.description),
          year: b.year,
          month: b.month,
          paymentTypeId: ctx.type.id,
          branchId: ctx.branch?.id ?? null,
          fileStructureId: ctx.structure?.id ?? null,
          lines: { create: b.lines.map((l) => { const it = live.get(itemKey(Number(l.slipId), l.kind, l.refId))!; return lineData(l, it, it.employeeId); }) },
        },
      });
    },
    { timeout: 60000 }
  );
}

export async function deletePrep(id: number): Promise<void> {
  const p = await prisma.payrollPaymentPrep.findUnique({ where: { id }, select: { status: true } });
  if (!p) throw new PrepError("سند آماده‌سازی پرداخت یافت نشد");
  if (p.status !== "DRAFT") throw new PrepError("سند تاییدشده حذف نمی‌شود؛ ابتدا «برگشت از تایید» بزنید");
  await prisma.payrollPaymentPrep.delete({ where: { id } });
}

/** تایید: کنترل‌ها دوباره (فیش‌ها/سایر سندها بین ذخیره و تایید عوض نشده باشند) */
export async function approvePrep(id: number): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await lockAll(tx);
      const p = await tx.payrollPaymentPrep.findUnique({ where: { id }, include: { lines: true } });
      if (!p) throw new PrepError("سند آماده‌سازی پرداخت یافت نشد");
      if (p.status !== "DRAFT") throw new PrepError("این سند قبلاً تایید شده است");
      if (p.lines.length === 0) throw new PrepError("سند بدون ردیف قابل تایید نیست");
      const ctx = await checkHeader({ year: p.year, month: p.month, paymentTypeId: p.paymentTypeId, branchId: p.branchId, fileStructureId: p.fileStructureId });
      await validateLines(tx, { year: p.year, month: p.month, paymentTypeId: p.paymentTypeId, branchId: p.branchId, fileStructureId: p.fileStructureId }, ctx, p.lines.map((l) => ({ slipId: l.slipId, kind: l.kind, refId: l.payrollComponentId ?? l.loanTypeId, payableAmount: Number(l.payableAmount) })), id);
      await tx.payrollPaymentPrep.update({ where: { id }, data: { status: "APPROVED", approvedAt: new Date() } });
    },
    { timeout: 60000 }
  );
}

export async function unapprovePrep(id: number): Promise<void> {
  const p = await prisma.payrollPaymentPrep.findUnique({ where: { id }, select: { status: true } });
  if (!p) throw new PrepError("سند آماده‌سازی پرداخت یافت نشد");
  if (p.status !== "APPROVED") throw new PrepError("این سند تایید نشده است");
  await prisma.payrollPaymentPrep.update({ where: { id }, data: { status: "DRAFT", approvedAt: null } });
}

export async function listPreps() {
  const rows = await prisma.payrollPaymentPrep.findMany({
    orderBy: { number: "desc" },
    include: {
      paymentType: { select: { title: true } },
      branch: { select: { fileNumber: true, contractRow: true, party: { select: { detailTitle: true } } } },
      fileStructure: { select: { title: true } },
      lines: { select: { payableAmount: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    date: r.date.toISOString().slice(0, 10),
    year: r.year,
    month: r.month,
    monthTitle: monthLabel(r.year, r.month),
    paymentTypeTitle: r.paymentType.title,
    branchTitle: r.branch ? `${r.branch.party.detailTitle}${r.branch.contractRow ? ` (ردیف پیمان ${r.branch.contractRow})` : ""}` : "",
    fileStructureTitle: r.fileStructure?.title ?? "",
    status: r.status,
    description: r.description,
    lineCount: r.lines.length,
    totalPayable: r4(r.lines.reduce((a, l) => a + Number(l.payableAmount), 0)),
  }));
}

/** جزئیات سند: هدر + ردیف‌ها (با مبلغ زنده‌ی فیش و مانده‌ی بدون احتساب همین سند) + پارامترهای ساختار فایل */
export async function getPrep(id: number) {
  const p = await prisma.payrollPaymentPrep.findUnique({ where: { id }, include: { lines: true } });
  if (!p) return null;
  const type = await loadType(p.paymentTypeId);
  const slipIds = [...new Set(p.lines.map((l) => l.slipId))];
  const items = await collectItems(type, p.year, p.month, { slipIds });
  const live = new Map(items.map((i) => [itemKey(i.slipId, i.kind, i.refId), i]));
  const others = await preparedByOthers(prisma, slipIds, id);
  const rows = p.lines
    .map((l) => {
      const k = itemKey(l.slipId, l.kind, l.payrollComponentId ?? l.loanTypeId);
      const it = live.get(k);
      if (!it) return null;
      return { ...it, remaining: r4(it.amount - (others.get(k)?.sum ?? 0)), payableAmount: Number(l.payableAmount) };
    })
    .filter((x): x is ItemAmt & { remaining: number; payableAmount: number } => !!x);
  let fileParams: { key: string; title: string; default: string; required: boolean }[] = [];
  if (p.fileStructureId) {
    const s = await loadStructure(p.fileStructureId);
    const m = new Map<string, { key: string; title: string; default: string; required: boolean }>();
    for (const f of s?.def.files.flatMap((x) => x.fields) ?? []) if (f.source === "PARAM" && f.paramKey && !m.has(f.paramKey)) m.set(f.paramKey, { key: f.paramKey, title: f.title, default: f.constantValue ?? "", required: !!f.required });
    fileParams = [...m.values()];
  }
  return {
    id: p.id,
    number: p.number,
    date: p.date.toISOString().slice(0, 10),
    description: p.description,
    year: p.year,
    month: p.month,
    paymentTypeId: p.paymentTypeId,
    payTo: type.payTo,
    branchId: p.branchId,
    fileStructureId: p.fileStructureId,
    status: p.status,
    updatedAt: p.updatedAt,
    rows: await decorate(rows, type, p.year, p.month),
    fileParams,
  };
}

/** گزینه‌های فرم: نوع‌های پرداخت فعال + شعبه‌های سازمان‌ها */
export async function prepOptions() {
  const [types, branches] = await Promise.all([
    prisma.payrollPaymentType.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, title: true, payTo: true, beneficiaryOrgId: true, hasFile: true } }),
    prisma.beneficiaryBranch.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, organizationId: true, fileNumber: true, contractRow: true, party: { select: { detailTitle: true } } } }),
  ]);
  return {
    types,
    branches: branches.map((b) => ({ id: b.id, organizationId: b.organizationId, title: `${b.party.detailTitle}${b.contractRow ? ` (ردیف پیمان ${b.contractRow})` : ""} — ${b.fileNumber}` })),
  };
}

/** قفل فیش: فیشی که در سند آماده‌سازی پرداخت آمده حذف/محاسبه‌ی دوباره نمی‌شود */
export async function slipPrepLockMessage(where: object): Promise<string | null> {
  const l = await prisma.payrollPaymentPrepLine.findFirst({
    where: { slip: where as any },
    select: { prep: { select: { number: true } }, slip: { select: { year: true, month: true } }, employee: { select: { personnelCode: true } } },
  });
  return l ? `فیش حقوق ${l.slip.year}/${l.slip.month} کارمند ${l.employee.personnelCode} در سند آماده‌سازی پرداخت شماره ${l.prep.number} آمده است؛ ابتدا آن ردیف یا سند را حذف کنید` : null;
}

/** ایجاد فایل از روی سند تاییدشده: فقط کارمندانِ سند؛ مبلغِ فیلدهای «مجموع عامل‌ها»ی مرتبط با آیتم‌های سند = مبلغ قابل پرداخت (سایر فیلدها از فیش). نتیجه ذخیره نمی‌شود. */
export async function buildPrepFile(id: number, params: Record<string, string>): Promise<{ out: GenResult; problems: { level: "ERROR" | "WARNING"; message: string }[] }> {
  const p = await prisma.payrollPaymentPrep.findUnique({ where: { id }, include: { lines: { include: { slip: { select: { calcTypeId: true } } } } } });
  if (!p) throw new PrepError("سند آماده‌سازی پرداخت یافت نشد");
  if (p.status !== "APPROVED") throw new PrepError("ایجاد فایل فقط برای سند تاییدشده ممکن است");
  if (!p.fileStructureId) throw new PrepError("این سند ساختار فایل ندارد");
  const s = await loadStructure(p.fileStructureId);
  if (!s) throw new PrepError("ساختار فایل یافت نشد");
  const type = await loadType(p.paymentTypeId);
  const amounts = new Map<number, Map<string, number>>();
  for (const l of p.lines) {
    // اقساط وام در فیلدهای «مجموع عامل‌ها» مرجعی ندارند؛ فقط عامل حقوق و خالص پرداختی جایگزین می‌شوند
    const key = l.kind === "PAYROLL_FACTOR" ? `P:${l.payrollComponentId}` : l.kind === "NET_PAY" ? `N:${l.slip.calcTypeId}` : null;
    if (!key) continue;
    const m = amounts.get(l.employeeId) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + Number(l.payableAmount));
    amounts.set(l.employeeId, m);
  }
  const out = await generateFiles(s.def, {
    year: p.year,
    month: p.month,
    employeeIds: [...new Set(p.lines.map((l) => l.employeeId))],
    orgId: type.beneficiaryOrgId,
    branchId: p.branchId,
    params,
    paymentTypeId: p.paymentTypeId,
    prepAmounts: amounts,
  });
  return { out, problems: out.problems };
}
