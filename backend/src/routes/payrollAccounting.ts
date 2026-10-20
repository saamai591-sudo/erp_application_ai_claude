import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { sendBulkError } from "../lib/bulkError";
import { nextSerialNumber } from "../utils/coding";
import { employeeIdsInPeriod } from "../services/employmentStatusService";
import { getCalendarMonth } from "../services/workCalendarService";
import {
  PayrollAcctError,
  PayrollIssueError,
  deletePayrollJournals,
  groupHasSettings,
  issuePayrollJournal,
  validateIssueSetting,
  validateTemplate,
  accountSlots,
} from "../services/payrollAccountingService";
import { DETAIL_TYPE_CODE_PARTY } from "../utils/detailValues";

// حقوق و دستمزد › حسابداری حقوق: گروه حساب حقوق، الگوی سند حقوق، تنظیمات صدور سند، و اکشن‌های «صدور/حذف سند» در محاسبه‌ی حقوق.
// قواعد: services/payrollAccountingService.ts.

const F_GROUP = findFormPrefix("payroll-account-groups");
const F_TPL = findFormPrefix("payroll-journal-templates");
const F_SET = findFormPrefix("payroll-issue-settings");
const F_CALC = findFormPrefix("payroll-calculation");
const router = Router();

function fail(res: any, e: any, fallback: string) {
  if (e instanceof PayrollIssueError) return sendBulkError(res, 400, e.message, e.problems as any);
  if (e instanceof PayrollAcctError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکورد تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);
const personName = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";

// ── گروه حساب حقوق ──

router.get("/payroll-account-groups", async (_req, res) => {
  const rows = await prisma.payrollAccountGroup.findMany({ orderBy: { code: "asc" } });
  res.json(rows);
});

router.get("/payroll-account-groups/:id", can(`${F_GROUP}.view`), async (req, res) => {
  const g = await prisma.payrollAccountGroup.findUnique({ where: { id: Number(req.params.id) } });
  if (!g) return res.status(404).json({ error: "گروه حساب حقوق یافت نشد" });
  res.json({ ...g, locked: await groupHasSettings(g.id) });
});

router.post("/payroll-account-groups", can(`${F_GROUP}.create`), async (req, res) => {
  try {
    const title = str(req.body.title);
    if (!title) throw new PayrollAcctError("عنوان الزامی است");
    if (await prisma.payrollAccountGroup.findUnique({ where: { title } })) throw new PayrollAcctError("گروه دیگری با همین عنوان وجود دارد");
    let code: number | null = null;
    if (req.body.code !== undefined && req.body.code !== null && req.body.code !== "") {
      code = Number(req.body.code);
      if (!Number.isInteger(code) || code < 1) throw new PayrollAcctError("کد باید عدد صحیح مثبت باشد");
      if (await prisma.payrollAccountGroup.findUnique({ where: { code } })) throw new PayrollAcctError("کد تکراری است");
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.payrollAccountGroup.create({
          data: { code: code ?? (await nextSerialNumber(prisma.payrollAccountGroup, "code")), title, hasSecondment: !!req.body.hasSecondment, usesProject: !!req.body.usesProject },
        });
        return res.status(201).json({ id: created.id, code: created.code });
      } catch (e: any) {
        if (e?.code === "P2002" && !code && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت گروه حساب حقوق");
  }
});

router.put("/payroll-account-groups/:id", can(`${F_GROUP}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const g = await prisma.payrollAccountGroup.findUnique({ where: { id } });
    if (!g) return res.status(404).json({ error: "گروه حساب حقوق یافت نشد" });
    const title = str(req.body.title);
    if (!title) throw new PayrollAcctError("عنوان الزامی است");
    if (await prisma.payrollAccountGroup.findFirst({ where: { title, NOT: { id } } })) throw new PayrollAcctError("گروه دیگری با همین عنوان وجود دارد");
    const usesProject = !!req.body.usesProject;
    // انواع تفصیل بعد از اولین «تنظیمات صدور سند» قفل می‌شود
    if (usesProject !== g.usesProject && (await groupHasSettings(id))) throw new PayrollAcctError("برای این گروه «تنظیمات صدور سند» ثبت شده است؛ انواع تفصیل آن دیگر قابل تغییر نیست");
    const hasSecondment = !!req.body.hasSecondment;
    if (hasSecondment !== g.hasSecondment && (await groupHasSettings(id))) throw new PayrollAcctError("برای این گروه «تنظیمات صدور سند» ثبت شده است؛ «مامور به خدمت دارد» قابل تغییر نیست");
    let code: number | undefined;
    if (req.body.code !== undefined && req.body.code !== null && req.body.code !== "" && Number(req.body.code) !== g.code) {
      code = Number(req.body.code);
      if (!Number.isInteger(code) || code < 1) throw new PayrollAcctError("کد باید عدد صحیح مثبت باشد");
      if (await prisma.payrollAccountGroup.findFirst({ where: { code, NOT: { id } } })) throw new PayrollAcctError("کد تکراری است");
    }
    await prisma.payrollAccountGroup.update({ where: { id }, data: { title, hasSecondment, usesProject, ...(code ? { code } : {}) } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش گروه حساب حقوق");
  }
});

router.delete("/payroll-account-groups/:id", can(`${F_GROUP}.delete`), async (req, res) => {
  try {
    await prisma.payrollAccountGroup.delete({ where: { id: Number(req.params.id) } }); // مانع‌ها (الگو/تنظیمات) را lib/deleteUsage.ts دقیق می‌گوید
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف گروه حساب حقوق");
  }
});

// ── الگوی سند حقوق ──

const tplInclude = {
  fromMonth: { select: { year: true, month: true } },
  group: { select: { id: true, title: true } },
  payrollComponent: { select: { id: true, title: true, kind: true } },
  decreeComponent: { select: { id: true, title: true } },
  netCalcType: { select: { id: true, title: true } },
  loanType: { select: { id: true, title: true } },
  account: { select: { id: true, code: true, title: true } },
} as const;

const KIND_FA: Record<string, string> = { EARNING: "پرداختی", DEDUCTION: "کسر", EMPLOYER_COST: "هزینه کارفرما", INFO: "اطلاعاتی" };

function shapeTemplate(t: any) {
  let refType = "";
  let refTitle = "";
  if (t.payrollComponent) { refType = "عامل حقوق"; refTitle = `${t.payrollComponent.title} (${KIND_FA[t.payrollComponent.kind] ?? t.payrollComponent.kind})`; }
  else if (t.decreeComponent) { refType = "عامل حکم"; refTitle = t.decreeComponent.title; }
  else if (t.netCalcType) { refType = "خالص پرداختی"; refTitle = t.netCalcType.title; }
  else if (t.loanType) { refType = "وام"; refTitle = t.loanType.title; }
  return {
    id: t.id,
    fromYear: t.fromMonth.year,
    fromMonth: t.fromMonth.month,
    groupId: t.groupId,
    groupTitle: t.group.title,
    payrollComponentId: t.payrollComponentId,
    decreeComponentId: t.decreeComponentId,
    netCalcTypeId: t.netCalcTypeId,
    loanTypeId: t.loanTypeId,
    refType,
    refTitle,
    accountId: t.accountId,
    accountCode: t.account.code,
    accountTitle: t.account.title,
    nature: t.nature,
    description: t.description,
    partyKind: t.partyKind,
    isActive: t.isActive,
  };
}

router.get("/payroll-journal-templates", can(`${F_TPL}.view`), async (_req, res) => {
  const rows = await prisma.payrollJournalTemplate.findMany({ include: tplInclude, orderBy: [{ groupId: "asc" }, { id: "asc" }] });
  res.json(rows.map(shapeTemplate));
});

/** گزینه‌های فرم: گروه‌ها، مرجع‌ها (عامل حقوق/حکم، خالص پرداختی هر نوع محاسبه، وام هر نوع)، حساب‌های معین با «دارای سطح طرف حساب» */
router.get("/payroll-journal-templates/options", async (_req, res) => {
  const [groups, comps, decrees, calcTypes, loanTypes, accounts] = await Promise.all([
    prisma.payrollAccountGroup.findMany({ orderBy: { code: "asc" } }),
    prisma.payrollComponent.findMany({ where: { kind: { not: "WORK" } }, orderBy: { id: "asc" }, select: { id: true, title: true, kind: true, beneficiaryOrgId: true, isActive: true } }),
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true } }),
    prisma.payrollCalcType.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true } }),
    prisma.loanType.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.account.findMany({
      where: { level: { order: { gte: 3 } }, children: { none: {} } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, title: true, detailType1: { select: { id: true, code: true, title: true } }, detailType2: { select: { id: true, code: true, title: true } }, detailType3: { select: { id: true, code: true, title: true } } },
    }),
  ]);
  res.json({
    groups,
    refs: [
      ...comps.map((c) => ({ key: `P:${c.id}`, field: "payrollComponentId", id: c.id, type: "عامل حقوق", title: c.title, extra: KIND_FA[c.kind] ?? c.kind, hasOrg: !!c.beneficiaryOrgId })),
      ...decrees.map((d) => ({ key: `D:${d.id}`, field: "decreeComponentId", id: d.id, type: "عامل حکم", title: d.title, extra: "پرداختی", hasOrg: false })),
      ...calcTypes.map((c) => ({ key: `N:${c.id}`, field: "netCalcTypeId", id: c.id, type: "خالص پرداختی", title: c.title, extra: "", hasOrg: false })),
      ...loanTypes.map((l) => ({ key: `L:${l.id}`, field: "loanTypeId", id: l.id, type: "وام", title: l.title, extra: "", hasOrg: false })),
    ],
    accounts: accounts.map((a) => ({ id: a.id, code: a.code, title: a.title, hasPartySlot: accountSlots(a).some((s) => s.type.code === DETAIL_TYPE_CODE_PARTY) })),
  });
});

router.get("/payroll-journal-templates/:id", can(`${F_TPL}.view`), async (req, res) => {
  const t = await prisma.payrollJournalTemplate.findUnique({ where: { id: Number(req.params.id) }, include: tplInclude });
  if (!t) return res.status(404).json({ error: "رکورد الگو یافت نشد" });
  res.json(shapeTemplate(t));
});

router.post("/payroll-journal-templates", can(`${F_TPL}.create`), async (req, res) => {
  try {
    const created = await prisma.payrollJournalTemplate.create({ data: await validateTemplate(req.body) });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت الگوی سند حقوق");
  }
});

router.put("/payroll-journal-templates/:id", can(`${F_TPL}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.payrollJournalTemplate.findUnique({ where: { id } }))) return res.status(404).json({ error: "رکورد الگو یافت نشد" });
    await prisma.payrollJournalTemplate.update({ where: { id }, data: await validateTemplate(req.body, id) });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش الگوی سند حقوق");
  }
});

router.delete("/payroll-journal-templates/:id", can(`${F_TPL}.delete`), async (req, res) => {
  try {
    await prisma.payrollJournalTemplate.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف رکورد الگو");
  }
});

// ── تنظیمات صدور سند حقوق ──

const setInclude = {
  fromMonth: { select: { year: true, month: true } },
  employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } },
  group: { select: { id: true, title: true, hasSecondment: true, usesProject: true } },
  secondingParty: { select: { id: true, detailCode: true, detailTitle: true } },
  project: { select: { id: true, detailCode: true, title: true } },
} as const;

function shapeSetting(s: any) {
  return {
    id: s.id,
    fromYear: s.fromMonth.year,
    fromMonth: s.fromMonth.month,
    employeeId: s.employeeId,
    personnelCode: s.employee.personnelCode,
    employeeName: personName(s.employee.party),
    groupId: s.groupId,
    groupTitle: s.group.title,
    hasSecondment: s.group.hasSecondment,
    usesProject: s.group.usesProject,
    secondingPartyId: s.secondingPartyId,
    secondingPartyTitle: s.secondingParty?.detailTitle ?? null,
    projectId: s.projectId,
    projectTitle: s.project?.title ?? null,
  };
}

router.get("/payroll-issue-settings", can(`${F_SET}.view`), async (_req, res) => {
  const rows = await prisma.payrollIssueSetting.findMany({ include: setInclude, orderBy: [{ employeeId: "asc" }, { id: "asc" }] });
  res.json(rows.map(shapeSetting));
});

// کارمندانی که در ماه انتخاب‌شده در وضعیت همکاری‌اند (انتخابگر کارمند فرم)
router.get("/payroll-issue-settings/employees", async (req, res) => {
  try {
    const cal = await getCalendarMonth(Number(req.query.year), Number(req.query.month));
    if (!cal) return res.json([]);
    const ids = await employeeIdsInPeriod(cal.startDate, cal.endDate);
    const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, orderBy: { personnelCode: "asc" }, select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } });
    res.json(emps.map((e) => ({ id: e.id, personnelCode: e.personnelCode, fullName: personName(e.party) })));
  } catch (e) {
    fail(res, e, "خطا در دریافت کارمندان");
  }
});

router.get("/payroll-issue-settings/:id", can(`${F_SET}.view`), async (req, res) => {
  const s = await prisma.payrollIssueSetting.findUnique({ where: { id: Number(req.params.id) }, include: setInclude });
  if (!s) return res.status(404).json({ error: "تنظیمات یافت نشد" });
  res.json(shapeSetting(s));
});

router.post("/payroll-issue-settings", can(`${F_SET}.create`), async (req, res) => {
  try {
    const created = await prisma.payrollIssueSetting.create({ data: await validateIssueSetting(req.body) });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت تنظیمات صدور سند");
  }
});

router.put("/payroll-issue-settings/:id", can(`${F_SET}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.payrollIssueSetting.findUnique({ where: { id } }))) return res.status(404).json({ error: "تنظیمات یافت نشد" });
    await prisma.payrollIssueSetting.update({ where: { id }, data: await validateIssueSetting(req.body, id) });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش تنظیمات صدور سند");
  }
});

router.delete("/payroll-issue-settings/:id", can(`${F_SET}.delete`), async (req, res) => {
  try {
    await prisma.payrollIssueSetting.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف تنظیمات");
  }
});

// ── صدور و حذف سند در «محاسبه حقوق» ──

router.post("/payroll-calculations/issue-journal", can(`${F_CALC}.issueJournalEntry`), async (req, res) => {
  const b = req.body as { year: number; month: number; calcTypeId?: number; employeeIds: number[]; date: string };
  try {
    const date = new Date(`${String(b.date ?? "")}T00:00:00.000Z`);
    const r = await issuePayrollJournal({ year: Number(b.year), month: Number(b.month), calcTypeId: b.calcTypeId ? Number(b.calcTypeId) : undefined, employeeIds: b.employeeIds, date });
    res.status(201).json(r);
  } catch (e) {
    fail(res, e, "خطا در صدور سند حقوق");
  }
});

router.post("/payroll-calculations/delete-journal", can(`${F_CALC}.deleteJournalEntry`), async (req, res) => {
  const b = req.body as { year: number; month: number; calcTypeId?: number; employeeIds: number[] };
  try {
    res.json(await deletePayrollJournals(Number(b.year), Number(b.month), b.calcTypeId ? Number(b.calcTypeId) : undefined, b.employeeIds));
  } catch (e) {
    fail(res, e, "خطا در حذف سند حقوق");
  }
});

export default router;
