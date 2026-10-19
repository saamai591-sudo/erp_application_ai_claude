import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { WorkCalendarError, day, getCalendarMonth, missingMonthMessage, parseDay } from "../services/workCalendarService";
import { employeeIdsInPeriod } from "../services/employmentStatusService";
import {
  LoanError,
  assertNoCalculationFrom,
  balanceBefore,
  installmentAt,
  lastCalculatedYm,
  loadLoanContexts,
  nextNumber,
  pickableLoans,
  ymOf,
} from "../services/payrollLoanService";

// حقوق و دستمزد › وام: نوع وام، پرداخت وام، اصلاح مانده و قسط، تعلیق وام (منطق مانده و قسط: services/payrollLoanService.ts).

const F_TYPE = findFormPrefix("loan-types");
const F_LOAN = findFormPrefix("loan-payments");
const F_ADJ = findFormPrefix("loan-adjustments");
const F_SUSP = findFormPrefix("loan-suspensions");
const router = Router();

function fail(res: any, e: any, fallback: string) {
  if (e instanceof LoanError || e instanceof WorkCalendarError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکوردی با همین مشخصات (عنوان/شماره) قبلاً ثبت شده است؛ دوباره تلاش کنید" });
  if (e?.statusCode || e?.status) return res.status(e.statusCode ?? e.status).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
}

const partyName = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
const mon = (m: { year: number; month: number } | null | undefined) => (m ? { year: m.year, month: m.month } : null);

function wholeAmount(v: unknown, label: string): number {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !isFinite(n) || n <= 0) throw new LoanError(`${label} باید عددی بزرگ‌تر از صفر باشد`);
  if (!Number.isInteger(n)) throw new LoanError(`${label} باید عدد صحیح (ریال) باشد`);
  return n;
}

async function monthRef(year: unknown, month: unknown, label: string) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) throw new LoanError(`${label} را انتخاب کنید`);
  const row = await getCalendarMonth(y, m);
  if (!row) throw new LoanError((await missingMonthMessage(y, m))!);
  return row;
}

// ── کارمندان فعال در یک تاریخ (انتخابگر پرداخت وام) ──

async function activeEmployeesAt(date: Date, ids?: number[]) {
  const inPeriod = await employeeIdsInPeriod(date, date, ids);
  const emps = await prisma.employee.findMany({
    where: { id: { in: inPeriod } },
    orderBy: { personnelCode: "asc" },
    include: {
      party: { select: { firstName: true, lastName: true, name: true } },
      decrees: { where: { status: "APPROVED", effectiveDate: { lte: date } }, orderBy: { effectiveDate: "desc" }, take: 1, select: { employmentType: { select: { title: true } } } },
      assignments: { where: { fromDate: { lte: date } }, orderBy: { fromDate: "desc" }, take: 1, select: { orgUnit: { select: { title: true } } } },
    },
  });
  return emps.map((e) => ({
    id: e.id,
    personnelCode: e.personnelCode,
    fullName: partyName(e.party),
    employmentType: e.decrees[0]?.employmentType?.title ?? "",
    serviceLocation: e.assignments[0]?.orgUnit?.title ?? "",
  }));
}

router.get("/loan-payments/employees", async (req, res) => {
  try {
    res.json(await activeEmployeesAt(parseDay(req.query.date, "تاریخ پرداخت")));
  } catch (e) {
    fail(res, e, "خطا در دریافت کارمندان");
  }
});

// ── نوع وام ──

const shapeType = (t: any) => ({
  id: t.id,
  title: t.title,
  institutionPartyId: t.institutionPartyId,
  institutionTitle: t.institution?.detailTitle ?? "",
  institutionCode: t.institution?.detailCode ?? "",
  isActive: t.isActive,
  loanCount: t._count?.loans ?? 0,
});

router.get("/loan-types/institutions", async (_req, res) => {
  const rows = await prisma.party.findMany({
    where: { category: "LEGAL", legalType: "BANK", isActive: true },
    orderBy: { detailCode: "asc" },
    select: { id: true, detailCode: true, detailTitle: true, nationalId: true },
  });
  res.json(rows);
});

// جستجوی بدون مجوز فرم (انتخابگر نوع وام در پرداخت وام)
router.get("/loan-types/lookup", async (_req, res) => {
  const rows = await prisma.loanType.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, include: { institution: { select: { detailTitle: true, detailCode: true } } } });
  res.json(rows.map((t) => ({ id: t.id, title: t.title, institutionTitle: t.institution?.detailTitle ?? "" })));
});

router.get("/loan-types", can(`${F_TYPE}.view`), async (_req, res) => {
  const rows = await prisma.loanType.findMany({ orderBy: { title: "asc" }, include: { institution: { select: { detailTitle: true, detailCode: true } }, _count: { select: { loans: true } } } });
  res.json(rows.map(shapeType));
});

router.get("/loan-types/:id", can(`${F_TYPE}.view`), async (req, res) => {
  const t = await prisma.loanType.findUnique({ where: { id: Number(req.params.id) }, include: { institution: { select: { detailTitle: true, detailCode: true } }, _count: { select: { loans: true } } } });
  if (!t) return res.status(404).json({ error: "نوع وام یافت نشد" });
  res.json(shapeType(t));
});

async function typeData(b: any, id: number | null) {
  const title = String(b.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new LoanError("عنوان الزامی است");
  if (await prisma.loanType.findFirst({ where: { title, ...(id ? { NOT: { id } } : {}) } })) throw new LoanError("نوع وام دیگری با همین عنوان وجود دارد");
  // سازمان مرتبط اختیاری است؛ خالی = بدون سازمان
  const rawInst = b.institutionPartyId;
  const institutionPartyId: number | null = rawInst === undefined || rawInst === null || rawInst === "" ? null : Number(rawInst);
  if (institutionPartyId !== null) {
    const inst = Number.isInteger(institutionPartyId) ? await prisma.party.findUnique({ where: { id: institutionPartyId } }) : null;
    if (!inst) throw new LoanError("سازمان مرتبط یافت نشد");
    if (inst.category !== "LEGAL" || inst.legalType !== "BANK") throw new LoanError("سازمان مرتبط باید شخص حقوقی از نوع بانک / موسسه مالی و اعتباری باشد");
  }
  return { title, institutionPartyId, isActive: b.isActive === undefined ? true : !!b.isActive };
}

router.post("/loan-types", can(`${F_TYPE}.create`), async (req, res) => {
  try {
    const t = await prisma.loanType.create({ data: await typeData(req.body, null) });
    res.status(201).json({ id: t.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع وام");
  }
});

router.put("/loan-types/:id", can(`${F_TYPE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loanType.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "نوع وام یافت نشد" });
    const data = await typeData(req.body, id);
    if (data.institutionPartyId !== ex.institutionPartyId && (await prisma.loan.count({ where: { loanTypeId: id } })) > 0) {
      throw new LoanError("برای این نوع وام، وام پرداخت شده است؛ سازمان مرتبط قابل تغییر نیست");
    }
    await prisma.loanType.update({ where: { id }, data });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع وام");
  }
});

router.delete("/loan-types/:id", can(`${F_TYPE}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if ((await prisma.loan.count({ where: { loanTypeId: id } })) > 0) throw new LoanError("برای این نوع وام، وام پرداخت شده است و قابل حذف نیست");
    await prisma.loanType.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف نوع وام");
  }
});

// ── پرداخت وام ──

const MODE_VALUES = ["WITH_FIRST", "WITH_LAST", "EXTRA_LAST"];

const loanInclude = {
  employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } },
  loanType: { select: { title: true } },
  startMonth: { select: { year: true, month: true } },
} as const;

async function loanLockMessage(loanId: number): Promise<string | null> {
  if (await prisma.loanMonthlyBalance.findFirst({ where: { loanId }, select: { id: true } })) return "از این وام در محاسبه‌ی حقوق قسط کسر شده است؛ ابتدا محاسبه‌های مربوط را حذف کنید";
  if (await prisma.loanAdjustmentLine.findFirst({ where: { loanId }, select: { id: true } })) return "این وام در «اصلاح مانده و قسط» استفاده شده است";
  if (await prisma.loanSuspensionLine.findFirst({ where: { loanId }, select: { id: true } })) return "این وام در «تعلیق وام» استفاده شده است";
  return null;
}

const shapeLoan = (l: any, lockedReason: string | null = null) => ({
  id: l.id,
  number: l.number,
  paymentDate: day(l.paymentDate),
  employeeId: l.employeeId,
  personnelCode: l.employee.personnelCode,
  employeeName: partyName(l.employee.party),
  loanTypeId: l.loanTypeId,
  loanTypeTitle: l.loanType.title,
  amount: Number(l.amount),
  installmentCount: l.installmentCount,
  installmentAmount: Number(l.installmentAmount),
  startYear: l.startMonth.year,
  startMonth: l.startMonth.month,
  remainderMode: l.remainderMode,
  description: l.description ?? "",
  updatedAt: l.updatedAt,
  locked: !!lockedReason,
  lockedReason,
});

// ── انتخابگر وام (اصلاح و تعلیق): وام‌هایی که در «ماه» مانده دارند؛ مانده = مانده‌ی محاسبه‌شده‌ی ماه قبل (با اصلاح‌های ثبت‌شده) ──

router.get("/loan-payments/pickable", async (req, res) => {
  try {
    const m = await monthRef(req.query.year, req.query.month, "ماه");
    const exclude = {
      adjustmentId: req.query.excludeAdjustmentId ? Number(req.query.excludeAdjustmentId) : undefined,
    };
    res.json(await pickableLoans(m.year, m.month, exclude));
  } catch (e) {
    fail(res, e, "خطا در دریافت وام‌ها");
  }
});

router.get("/loan-payments/next-number", can(`${F_LOAN}.create`), async (_req, res) => {
  res.json({ number: await nextNumber("loan") });
});

router.get("/loan-payments", can(`${F_LOAN}.view`), async (_req, res) => {
  const rows = await prisma.loan.findMany({ orderBy: { number: "desc" }, include: loanInclude });
  res.json(rows.map((l) => shapeLoan(l)));
});

router.get("/loan-payments/:id", can(`${F_LOAN}.view`), async (req, res) => {
  const l = await prisma.loan.findUnique({ where: { id: Number(req.params.id) }, include: loanInclude });
  if (!l) return res.status(404).json({ error: "وام یافت نشد" });
  res.json(shapeLoan(l, await loanLockMessage(l.id)));
});

async function loanData(b: any, existing: { id: number; loanTypeId: number } | null) {
  const paymentDate = parseDay(b.paymentDate, "تاریخ پرداخت");
  const employeeId = Number(b.employeeId);
  if (!employeeId) throw new LoanError("کارمند را انتخاب کنید");
  if ((await activeEmployeesAt(paymentDate, [employeeId])).length === 0) throw new LoanError("کارمند در تاریخ پرداخت فعال (دارای دوره‌ی همکاری) نبوده است");
  const loanTypeId = Number(b.loanTypeId);
  const type = loanTypeId ? await prisma.loanType.findUnique({ where: { id: loanTypeId } }) : null;
  if (!type) throw new LoanError("نوع وام را انتخاب کنید");
  if (!type.isActive && existing?.loanTypeId !== type.id) throw new LoanError(`نوع وام «${type.title}» غیرفعال است`);
  const amount = wholeAmount(b.amount, "مبلغ وام");
  const installmentCount = Number(b.installmentCount);
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 600) throw new LoanError("تعداد اقساط باید عدد صحیح بین ۱ و ۶۰۰ باشد");
  const installmentAmount = wholeAmount(b.installmentAmount, "مبلغ هر قسط");
  if (installmentAmount > amount) throw new LoanError("مبلغ هر قسط نمی‌تواند از مبلغ وام بیشتر باشد");
  if ((installmentCount - 1) * installmentAmount >= amount) throw new LoanError("تعداد اقساط با مبلغ قسط سازگار نیست؛ قسط آخر مبلغی نخواهد داشت (تعداد را کمتر یا قسط را کمتر کنید)");
  const start = await monthRef(b.startYear, b.startMonth, "شروع قسط");
  // «کسر قسط» فقط وقتی لازم است که باقیمانده‌ی تقسیم مثبت باشد؛ وگرنه مقدار خنثی ذخیره می‌شود
  // (EXTRA_LAST بدون باقیمانده اثری ندارد؛ WITH_LAST برخلاف آن بعد از اصلاح مانده، باقی را یک‌جا کسر می‌کند)
  const hasRemainder = amount - installmentCount * installmentAmount > 0;
  if (hasRemainder && !MODE_VALUES.includes(b.remainderMode)) throw new LoanError("نحوه‌ی کسر باقیمانده‌ی قسط را انتخاب کنید");
  const remainderMode = hasRemainder ? b.remainderMode : "EXTRA_LAST";
  // کنترل: اگر از ماه شروع قسط (یا بعد از آن) برای کارمند محاسبه‌ی حقوق انجام شده، ذخیره‌ی وام ممکن نیست
  await assertNoCalculationFrom([employeeId], ymOf(start.year, start.month), (who, y, m) =>
    `برای کارمند ${who} در ${y}/${m} محاسبه‌ی حقوق انجام شده و ماه شروع قسط (${start.year}/${start.month}) همان ماه یا قبل از آن است؛ ذخیره‌ی وام ممکن نیست — ابتدا محاسبه‌های حقوق را حذف کنید یا ماه شروع قسط را بعد از آخرین ماه محاسبه‌شده بگذارید`
  );
  return {
    paymentDate,
    employeeId,
    loanTypeId,
    amount,
    installmentCount,
    installmentAmount,
    startMonthId: start.id,
    remainderMode,
    description: String(b.description ?? "").trim() || null,
  };
}

router.post("/loan-payments", can(`${F_LOAN}.create`), async (req, res) => {
  try {
    const data = await loanData(req.body, null);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.loan.create({ data: { ...data, number: await nextNumber("loan") } });
        return res.status(201).json({ id: created.id, number: created.number });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت وام");
  }
});

router.put("/loan-payments/:id", can(`${F_LOAN}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loan.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "وام یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body.updatedAt, "این وام");
    const lock = await loanLockMessage(id);
    if (lock) throw new LoanError(lock);
    await prisma.loan.update({ where: { id }, data: await loanData(req.body, ex) });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش وام");
  }
});

router.delete("/loan-payments/:id", can(`${F_LOAN}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lock = await loanLockMessage(id);
    if (lock) throw new LoanError(lock);
    await prisma.loan.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف وام");
  }
});

// ── اصلاح مانده و قسط ──

const adjInclude = { fromMonth: { select: { year: true, month: true } }, lines: { orderBy: { id: "asc" as const } } } as const;

/** قفل: اگر برای کارمندِ یکی از وام‌ها در ماهِ اصلاح یا بعد از آن حقوق محاسبه شده باشد */
async function lockedByCalc(loanIds: number[], fromYm: number): Promise<string | null> {
  const loans = await prisma.loan.findMany({ where: { id: { in: loanIds } }, select: { employeeId: true } });
  const last = await lastCalculatedYm([...new Set(loans.map((l) => l.employeeId))]);
  for (const v of last.values()) if (v.ym >= fromYm) return `برای یکی از کارمندان حقوق ${v.year}/${v.month} محاسبه شده است؛ ابتدا محاسبه‌ی حقوق را حذف کنید`;
  return null;
}

async function loanRowInfo(loanIds: number[], year: number, month: number, excludeAdjustmentId?: number) {
  const ctxs = await loadLoanContexts({ id: { in: loanIds } });
  const info = await prisma.loan.findMany({ where: { id: { in: loanIds } }, include: { ...loanInclude } });
  const ym = ymOf(year, month);
  return info.map((l) => {
    const c = ctxs.find((x) => x.id === l.id)!;
    if (excludeAdjustmentId) c.adj = c.adj.filter((a) => a.id !== excludeAdjustmentId);
    return { ...shapeLoan(l), installment: installmentAt(c, ym), balance: balanceBefore(c, ym) };
  });
}

const shapeAdj = async (a: any) => {
  const rows = await loanRowInfo(a.lines.map((l: any) => l.loanId), a.fromMonth.year, a.fromMonth.month, a.id);
  return {
    id: a.id,
    number: a.number,
    date: day(a.date),
    fromYear: a.fromMonth.year,
    fromMonth: a.fromMonth.month,
    description: a.description ?? "",
    updatedAt: a.updatedAt,
    lines: a.lines.map((l: any) => {
      const r = rows.find((x) => x.id === l.loanId)!;
      return { loanId: l.loanId, number: r.number, paymentDate: r.paymentDate, loanTypeTitle: r.loanTypeTitle, personnelCode: r.personnelCode, employeeName: r.employeeName, installment: r.installment, balance: r.balance, settledAmount: l.settledAmount === null ? "" : Number(l.settledAmount), newInstallment: l.newInstallment === null ? "" : Number(l.newInstallment) };
    }),
  };
};

router.get("/loan-adjustments/next-number", can(`${F_ADJ}.create`), async (_req, res) => {
  res.json({ number: await nextNumber("loanAdjustment") });
});

router.get("/loan-adjustments", can(`${F_ADJ}.view`), async (_req, res) => {
  const rows = await prisma.loanAdjustment.findMany({ orderBy: { number: "desc" }, include: { fromMonth: { select: { year: true, month: true } }, _count: { select: { lines: true } } } });
  res.json(rows.map((a) => ({ id: a.id, number: a.number, date: day(a.date), fromYear: a.fromMonth.year, fromMonth: a.fromMonth.month, lineCount: a._count.lines, description: a.description ?? "" })));
});

router.get("/loan-adjustments/:id", can(`${F_ADJ}.view`), async (req, res) => {
  const a = await prisma.loanAdjustment.findUnique({ where: { id: Number(req.params.id) }, include: adjInclude });
  if (!a) return res.status(404).json({ error: "سند یافت نشد" });
  const lock = await lockedByCalc(a.lines.map((l) => l.loanId), ymOf(a.fromMonth.year, a.fromMonth.month));
  res.json({ ...(await shapeAdj(a)), locked: !!lock, lockedReason: lock });
});

async function adjData(b: any, id: number | null) {
  const date = parseDay(b.date, "تاریخ");
  const from = await monthRef(b.fromYear, b.fromMonth, "از ماه");
  const fromYm = ymOf(from.year, from.month);
  const raw: any[] = Array.isArray(b.lines) ? b.lines : [];
  if (raw.length === 0) throw new LoanError("حداقل یک وام را انتخاب کنید");
  const loanIds = raw.map((l) => Number(l.loanId));
  if (new Set(loanIds).size !== loanIds.length) throw new LoanError("یک وام بیش از یک‌بار آمده است");
  const ctxs = await loadLoanContexts({ id: { in: loanIds } });
  if (ctxs.length !== loanIds.length) throw new LoanError("وام انتخاب‌شده یافت نشد");
  const lines = raw.map((l) => {
    const c = ctxs.find((x) => x.id === Number(l.loanId))!;
    if (id) c.adj = c.adj.filter((a) => a.id !== id);
    const settled = l.settledAmount === "" || l.settledAmount === null || l.settledAmount === undefined ? null : wholeAmount(l.settledAmount, `مبلغ تسویه‌ی وام ${c.number}`);
    const newInstallment = l.newInstallment === "" || l.newInstallment === null || l.newInstallment === undefined ? null : wholeAmount(l.newInstallment, `قسط جدید وام ${c.number}`);
    if (settled === null && newInstallment === null) throw new LoanError(`برای وام ${c.number} مبلغ تسویه یا قسط جدید را وارد کنید`);
    const bal = balanceBefore(c, fromYm);
    if (bal <= 0) throw new LoanError(`وام ${c.number} در ماه ${from.year}/${from.month} مانده ندارد`);
    if (settled !== null && settled > bal) throw new LoanError(`مبلغ تسویه‌ی وام ${c.number} (${settled.toLocaleString("en-US")}) از مانده‌ی آن (${bal.toLocaleString("en-US")}) بیشتر است`);
    if (newInstallment !== null && newInstallment > bal - (settled ?? 0)) throw new LoanError(`قسط جدید وام ${c.number} از مانده‌ی آن بیشتر است`);
    return { loanId: c.id, settledAmount: settled, newInstallment };
  });
  // از ماه نباید قبل از (یا برابر) آخرین ماه محاسبه‌شده‌ی کارمندان وام‌ها باشد
  await assertNoCalculationFrom([...new Set(ctxs.map((c) => c.employeeId))], fromYm, (who, y, m) => `برای کارمند ${who} حقوق ${y}/${m} محاسبه شده است؛ «از ماه» باید بعد از آخرین ماه محاسبه‌شده باشد`);
  return { date, fromMonthId: from.id, description: String(b.description ?? "").trim() || null, lines };
}

router.post("/loan-adjustments", can(`${F_ADJ}.create`), async (req, res) => {
  try {
    const { lines, ...head } = await adjData(req.body, null);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.loanAdjustment.create({ data: { ...head, number: await nextNumber("loanAdjustment"), lines: { create: lines } } });
        return res.status(201).json({ id: created.id, number: created.number });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت اصلاح");
  }
});

router.put("/loan-adjustments/:id", can(`${F_ADJ}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loanAdjustment.findUnique({ where: { id }, include: adjInclude });
    if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body.updatedAt, "این سند");
    const lock = await lockedByCalc(ex.lines.map((l) => l.loanId), ymOf(ex.fromMonth.year, ex.fromMonth.month));
    if (lock) throw new LoanError(lock);
    const { lines, ...head } = await adjData(req.body, id);
    await prisma.$transaction([
      prisma.loanAdjustmentLine.deleteMany({ where: { adjustmentId: id } }),
      prisma.loanAdjustment.update({ where: { id }, data: { ...head, lines: { create: lines } } }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش اصلاح");
  }
});

router.delete("/loan-adjustments/:id", can(`${F_ADJ}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loanAdjustment.findUnique({ where: { id }, include: adjInclude });
    if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
    const lock = await lockedByCalc(ex.lines.map((l) => l.loanId), ymOf(ex.fromMonth.year, ex.fromMonth.month));
    if (lock) throw new LoanError(lock);
    await prisma.loanAdjustment.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف اصلاح");
  }
});

// ── تعلیق وام ──

const suspInclude = { fromMonth: { select: { year: true, month: true, endDate: true } }, toMonth: { select: { year: true, month: true, endDate: true } }, lines: { orderBy: { id: "asc" as const } } } as const;

const shapeSusp = async (s: any) => {
  const rows = await loanRowInfo(s.lines.map((l: any) => l.loanId), s.fromMonth.year, s.fromMonth.month);
  return {
    id: s.id,
    number: s.number,
    date: day(s.date),
    fromYear: s.fromMonth.year,
    fromMonth: s.fromMonth.month,
    toYear: s.toMonth.year,
    toMonth: s.toMonth.month,
    description: s.description ?? "",
    updatedAt: s.updatedAt,
    lines: s.lines.map((l: any) => {
      const r = rows.find((x) => x.id === l.loanId)!;
      return { loanId: l.loanId, number: r.number, paymentDate: r.paymentDate, loanTypeTitle: r.loanTypeTitle, personnelCode: r.personnelCode, employeeName: r.employeeName, installment: r.installment, balance: r.balance };
    }),
  };
};

router.get("/loan-suspensions/next-number", can(`${F_SUSP}.create`), async (_req, res) => {
  res.json({ number: await nextNumber("loanSuspension") });
});

router.get("/loan-suspensions", can(`${F_SUSP}.view`), async (_req, res) => {
  const rows = await prisma.loanSuspension.findMany({ orderBy: { number: "desc" }, include: { fromMonth: { select: { year: true, month: true } }, toMonth: { select: { year: true, month: true } }, _count: { select: { lines: true } } } });
  res.json(rows.map((s) => ({ id: s.id, number: s.number, date: day(s.date), fromYear: s.fromMonth.year, fromMonth: s.fromMonth.month, toYear: s.toMonth.year, toMonth: s.toMonth.month, lineCount: s._count.lines, description: s.description ?? "" })));
});

router.get("/loan-suspensions/:id", can(`${F_SUSP}.view`), async (req, res) => {
  const s = await prisma.loanSuspension.findUnique({ where: { id: Number(req.params.id) }, include: suspInclude });
  if (!s) return res.status(404).json({ error: "سند یافت نشد" });
  const lock = await lockedByCalc(s.lines.map((l) => l.loanId), ymOf(s.fromMonth.year, s.fromMonth.month));
  res.json({ ...(await shapeSusp(s)), locked: !!lock, lockedReason: lock });
});

async function suspData(b: any) {
  const date = parseDay(b.date, "تاریخ");
  const from = await monthRef(b.fromYear, b.fromMonth, "از ماه");
  const to = await monthRef(b.toYear, b.toMonth, "تا ماه");
  // «تا ماه» نباید کوچک‌تر از «از ماه» باشد (مقایسه‌ی تاریخ پایان ماه‌ها)
  if (to.endDate < from.endDate) throw new LoanError("«تا ماه» نمی‌تواند کوچک‌تر از «از ماه» باشد");
  const fromYm = ymOf(from.year, from.month);
  const raw: any[] = Array.isArray(b.lines) ? b.lines : [];
  if (raw.length === 0) throw new LoanError("حداقل یک وام را انتخاب کنید");
  const loanIds = raw.map((l) => Number(l.loanId));
  if (new Set(loanIds).size !== loanIds.length) throw new LoanError("یک وام بیش از یک‌بار آمده است");
  const ctxs = await loadLoanContexts({ id: { in: loanIds } });
  if (ctxs.length !== loanIds.length) throw new LoanError("وام انتخاب‌شده یافت نشد");
  for (const c of ctxs) if (balanceBefore(c, fromYm) <= 0) throw new LoanError(`وام ${c.number} در ماه ${from.year}/${from.month} مانده ندارد`);
  await assertNoCalculationFrom([...new Set(ctxs.map((c) => c.employeeId))], fromYm, (who, y, m) => `برای کارمند ${who} حقوق ${y}/${m} محاسبه شده است؛ «از ماه» باید بعد از آخرین ماه محاسبه‌شده باشد`);
  return { date, fromMonthId: from.id, toMonthId: to.id, description: String(b.description ?? "").trim() || null, lines: loanIds.map((loanId) => ({ loanId })) };
}

router.post("/loan-suspensions", can(`${F_SUSP}.create`), async (req, res) => {
  try {
    const { lines, ...head } = await suspData(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.loanSuspension.create({ data: { ...head, number: await nextNumber("loanSuspension"), lines: { create: lines } } });
        return res.status(201).json({ id: created.id, number: created.number });
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت تعلیق");
  }
});

router.put("/loan-suspensions/:id", can(`${F_SUSP}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loanSuspension.findUnique({ where: { id }, include: suspInclude });
    if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body.updatedAt, "این سند");
    const lock = await lockedByCalc(ex.lines.map((l) => l.loanId), ymOf(ex.fromMonth.year, ex.fromMonth.month));
    if (lock) throw new LoanError(lock);
    const { lines, ...head } = await suspData(req.body);
    await prisma.$transaction([
      prisma.loanSuspensionLine.deleteMany({ where: { suspensionId: id } }),
      prisma.loanSuspension.update({ where: { id }, data: { ...head, lines: { create: lines } } }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش تعلیق");
  }
});

router.delete("/loan-suspensions/:id", can(`${F_SUSP}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loanSuspension.findUnique({ where: { id }, include: suspInclude });
    if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
    const lock = await lockedByCalc(ex.lines.map((l) => l.loanId), ymOf(ex.fromMonth.year, ex.fromMonth.month));
    if (lock) throw new LoanError(lock);
    await prisma.loanSuspension.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف تعلیق");
  }
});

export default router;
