import { prisma } from "../lib/prisma";

// حقوق و دستمزد › وام: منطق «مانده‌محور» اقساط (تنها محل محاسبه‌ی مانده و قسط هر ماه — هم محاسبه‌ی حقوق و هم انتخابگرها از اینجا می‌خوانند).
//  • مانده‌ی وام در پایان هر ماهِ محاسبه‌شده (همزمان با «حقوق ماهانه») در LoanMonthlyBalance نگه داشته می‌شود؛ مانده‌ی اولِ یک ماه = مانده‌ی بعد از آخرین ماه
//    ثبت‌شده‌ی قبل از آن (یا مبلغ وام) منهای «تسویه‌ها»ی اصلاح مانده که ماه اثرشان در (آخرین ماه ثبت‌شده، این ماه] است.
//  • قسط هر ماه = min(قسط جاری، مانده)؛ «قسط جاری» آخرین اصلاح قسط تا آن ماه است؛ ماه تعلیق قسط صفر است و برنامه به همان اندازه عقب می‌رود؛ قبل از ماه شروع قسطی نیست.
//  • باقیمانده‌ی تقسیم (مبلغ وام − تعداد × قسط) طبق «کسر قسط»: همراه با قسط اول (قسط اول = قسط + باقیمانده) / همراه با قسط آخر (وقتی مانده کمتر از دو قسط شد، یک‌جا
//    کسر می‌شود) / در قسط آخر (یک قسط جدا و کوچک‌تر بعد از آخرین قسط کامل).

export class LoanError extends Error {}

export const ymOf = (year: number, month: number) => year * 12 + month;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;

export interface LoanCtx {
  id: number;
  number: number;
  employeeId: number;
  amount: number;
  installmentAmount: number;
  count: number;
  mode: "WITH_FIRST" | "WITH_LAST" | "EXTRA_LAST";
  startYm: number;
  rows: { ym: number; installment: number; balanceAfter: number }[];
  adj: { ym: number; id: number; settled: number | null; newInstallment: number | null }[];
  susp: { fromYm: number; toYm: number }[];
}

/** بارگذاری وضعیت وام‌ها (با مانده‌های ماهانه‌ی ثبت‌شده، اصلاح‌ها و تعلیق‌ها) */
export async function loadLoanContexts(where: object): Promise<LoanCtx[]> {
  const loans = await prisma.loan.findMany({
    where,
    orderBy: { id: "asc" },
    include: {
      startMonth: { select: { year: true, month: true } },
      balances: { select: { year: true, month: true, installment: true, balanceAfter: true } },
      adjustmentLines: { select: { id: true, settledAmount: true, newInstallment: true, adjustment: { select: { id: true, fromMonth: { select: { year: true, month: true } } } } } },
      suspensionLines: { select: { suspension: { select: { fromMonth: { select: { year: true, month: true } }, toMonth: { select: { year: true, month: true } } } } } },
    },
  });
  return loans.map((l) => ({
    id: l.id,
    number: l.number,
    employeeId: l.employeeId,
    amount: num(l.amount),
    installmentAmount: num(l.installmentAmount),
    count: l.installmentCount,
    mode: l.remainderMode,
    startYm: ymOf(l.startMonth.year, l.startMonth.month),
    rows: l.balances.map((b) => ({ ym: ymOf(b.year, b.month), installment: num(b.installment), balanceAfter: num(b.balanceAfter) })).sort((a, b) => a.ym - b.ym),
    adj: l.adjustmentLines
      .map((a) => ({ ym: ymOf(a.adjustment.fromMonth.year, a.adjustment.fromMonth.month), id: a.adjustment.id, settled: a.settledAmount === null ? null : num(a.settledAmount), newInstallment: a.newInstallment === null ? null : num(a.newInstallment) }))
      .sort((a, b) => a.ym - b.ym || a.id - b.id),
    susp: l.suspensionLines.map((s) => ({ fromYm: ymOf(s.suspension.fromMonth.year, s.suspension.fromMonth.month), toYm: ymOf(s.suspension.toMonth.year, s.suspension.toMonth.month) })),
  }));
}

/** مانده‌ی اولِ ماه (قبل از کسر قسط همان ماه، با احتساب تسویه‌های اصلاح مانده تا همان ماه) */
export function balanceBefore(c: LoanCtx, ym: number): number {
  let prev: LoanCtx["rows"][number] | undefined;
  for (const r of c.rows) if (r.ym < ym) prev = r;
  let b = prev ? prev.balanceAfter : c.amount;
  const floor = prev ? prev.ym : -Infinity;
  for (const a of c.adj) if (a.ym > floor && a.ym <= ym && a.settled) b -= a.settled;
  return Math.max(r4(b), 0);
}

/** قسط جاری در یک ماه: آخرین اصلاح قسط تا آن ماه، وگرنه قسط وام */
export function installmentAt(c: LoanCtx, ym: number): number {
  let v = c.installmentAmount;
  for (const a of c.adj) if (a.newInstallment !== null && a.ym <= ym) v = a.newInstallment;
  return v;
}

export const isSuspendedAt = (c: LoanCtx, ym: number) => c.susp.some((s) => s.fromYm <= ym && ym <= s.toYm);

export interface LoanMonthItem {
  loanId: number;
  number: number;
  installment: number;
  balanceBefore: number;
  balanceAfter: number;
  suspended: boolean;
}

/** قسط و مانده‌ی یک وام در یک ماه؛ null = وام در این ماه کاری ندارد (هنوز شروع نشده یا تسویه شده) */
export function computeLoanItem(c: LoanCtx, ym: number): LoanMonthItem | null {
  if (ym < c.startYm) return null;
  const before = balanceBefore(c, ym);
  if (before <= 0) return null;
  const suspended = isSuspendedAt(c, ym);
  let due = 0;
  if (!suspended) {
    const inst = installmentAt(c, ym);
    const remainder = r4(c.amount - c.count * c.installmentAmount);
    const isFirst = !c.rows.some((r) => r.ym < ym && r.installment > 0);
    if (c.mode === "WITH_FIRST" && isFirst && remainder > 0) due = inst + remainder;
    else if (c.mode === "WITH_LAST" && before < 2 * inst) due = before;
    else due = inst;
    due = r4(Math.min(due, before));
  }
  return { loanId: c.id, number: c.number, installment: due, balanceBefore: before, balanceAfter: r4(before - due), suspended };
}

/** اقساط یک کارمند در یک ماه (برای محاسبه‌ی حقوق ماهانه) */
export async function computeLoanMonth(employeeId: number, year: number, month: number): Promise<LoanMonthItem[]> {
  const ctxs = await loadLoanContexts({ employeeId });
  const ym = ymOf(year, month);
  const out: LoanMonthItem[] = [];
  for (const c of ctxs) {
    const it = computeLoanItem(c, ym);
    if (it) out.push(it);
  }
  return out;
}

/** جمع اقساطِ ثبت‌شده‌ی یک فیش (برای نوع‌های غیرپایه که از فیش حقوق ماهانه می‌خوانند) */
export async function storedLoanSum(slipId: number): Promise<number> {
  const a = await prisma.loanMonthlyBalance.aggregate({ where: { slipId }, _sum: { installment: true } });
  return num(a._sum.installment);
}

/** پیام قفل حذف فیش «حقوق ماهانه»: اگر مانده‌ی وامی از این فیش در ماه‌های بعد هم ثبت شده باشد زنجیره‌ی مانده می‌شکند */
export async function loanChainMessage(baseSlips: { employeeId: number; year: number; month: number }[]): Promise<string | null> {
  for (const s of baseSlips) {
    const here = await prisma.loanMonthlyBalance.findMany({ where: { loan: { employeeId: s.employeeId }, year: s.year, month: s.month }, select: { loanId: true } });
    if (here.length === 0) continue;
    const later = await prisma.loanMonthlyBalance.findFirst({
      where: { loanId: { in: here.map((h) => h.loanId) }, OR: [{ year: { gt: s.year } }, { year: s.year, month: { gt: s.month } }] },
      select: { year: true, month: true, loan: { select: { number: true, employee: { select: { personnelCode: true } } } } },
    });
    if (later) {
      return `مانده‌ی وام شماره ${later.loan.number} (کارمند ${later.loan.employee.personnelCode}) در ${later.year}/${later.month} هم محاسبه شده است؛ ابتدا فیش ماه‌های بعد را حذف کنید`;
    }
  }
  return null;
}

/** آخرین ماه محاسبه‌شده (هر نوع فیش) هر کارمند: employeeId → ym */
export async function lastCalculatedYm(employeeIds: number[]): Promise<Map<number, { ym: number; year: number; month: number }>> {
  const out = new Map<number, { ym: number; year: number; month: number }>();
  if (employeeIds.length === 0) return out;
  const rows = await prisma.payrollSlip.findMany({ where: { employeeId: { in: employeeIds } }, select: { employeeId: true, year: true, month: true } });
  for (const r of rows) {
    const ym = ymOf(r.year, r.month);
    const cur = out.get(r.employeeId);
    if (!cur || ym > cur.ym) out.set(r.employeeId, { ym, year: r.year, month: r.month });
  }
  return out;
}

/** کنترل «محاسبه‌ی بعد از ماه»: برای هر کارمند فیشی در ماه گفته‌شده یا بعد از آن نباشد؛ اولین مورد خطا می‌دهد */
export async function assertNoCalculationFrom(employeeIds: number[], fromYm: number, message: (who: string, y: number, m: number) => string): Promise<void> {
  const last = await lastCalculatedYm(employeeIds);
  for (const [empId, v] of last) {
    if (v.ym >= fromYm) {
      const e = await prisma.employee.findUnique({ where: { id: empId }, select: { personnelCode: true } });
      throw new LoanError(message(e?.personnelCode ?? String(empId), v.year, v.month));
    }
  }
}

/** شماره‌ی بعدی (آخرین + ۱) برای فرم‌های وام */
export async function nextNumber(model: "loan" | "loanAdjustment" | "loanSuspension"): Promise<number> {
  const last = await (prisma as any)[model].findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

const partyName = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";

export interface PickableLoan {
  id: number;
  number: number;
  paymentDate: string;
  loanTypeTitle: string;
  personnelCode: string;
  employeeName: string;
  installment: number;
  balance: number;
}

/** وام‌هایی که در «ماه» مانده دارند (انتخابگر اصلاح و تعلیق)؛ مانده = مانده‌ی محاسبه‌شده‌ی ماه قبل با اصلاح‌های ثبت‌شده، و قسط = قسط جاری آن ماه */
export async function pickableLoans(year: number, month: number, opts: { adjustmentId?: number } = {}): Promise<PickableLoan[]> {
  const ym = ymOf(year, month);
  const [ctxs, info] = await Promise.all([
    loadLoanContexts({}),
    prisma.loan.findMany({
      orderBy: { number: "asc" },
      select: { id: true, paymentDate: true, loanType: { select: { title: true } }, employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
    }),
  ]);
  const out: PickableLoan[] = [];
  for (const l of info) {
    const c = ctxs.find((x) => x.id === l.id)!;
    if (opts.adjustmentId) c.adj = c.adj.filter((a) => a.id !== opts.adjustmentId);
    const balance = balanceBefore(c, ym);
    if (balance <= 0) continue;
    out.push({
      id: l.id,
      number: c.number,
      paymentDate: l.paymentDate.toISOString().slice(0, 10),
      loanTypeTitle: l.loanType.title,
      personnelCode: l.employee.personnelCode,
      employeeName: partyName(l.employee.party),
      installment: installmentAt(c, ym),
      balance,
    });
  }
  return out;
}
