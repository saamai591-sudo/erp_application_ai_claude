import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { HrError, checkAssignmentRefs, changeAssignment } from "../services/employeeAssignmentService";
import { getEffectiveDecree } from "../services/employmentDecreeService";
import { jalaliMonthRange } from "../utils/jalaliDate";

// منابع انسانی › پرسنلی › حکم کارگزینی (قرارداد و حکم یک سند است).
// پیش‌نویس ⇄ تایید؛ حکم تاییدشده تغییر نمی‌کند (حکم جدید با تاریخ اعمال جدید صادر می‌شود). اعتبار از تاریخ اعمال تا min(پایان، روز قبل از حکم بعدی)
// محاسبه می‌شود (services/employmentDecreeService.ts). تغییر انتصاب اختیاری با تایید، از همان تابع انتصاب فرم کارمند اعمال می‌شود.

const FORM = findFormPrefix("employment-decrees");
const router = Router();

const TYPES = ["HIRE", "RENEWAL", "ANNUAL_RAISE", "PROMOTION", "AMENDMENT"];
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
function parseDay(v: unknown, label: string, required = true): Date | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new HrError(`${label} الزامی است`);
    return null;
  }
  const d = new Date(`${String(v)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new HrError(`${label} نامعتبر است`);
  return d;
}
function fullName(p: { firstName: string | null; lastName: string | null; name: string | null }) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
}
/** پیام قفل اگر این حکم مبنای محاسبه‌ی حقوق بوده است (فیش ثبت‌شده)؛ null = قفل نیست */
async function payrollLockMessage(decreeId: number): Promise<string | null> {
  const slip = await prisma.payrollSlip.findFirst({ where: { decreeId }, select: { year: true, month: true }, orderBy: [{ year: "asc" }, { month: "asc" }] });
  return slip ? `این حکم مبنای محاسبه‌ی حقوق ${slip.year}/${slip.month} بوده و قفل است؛ ابتدا آن محاسبه‌ها را حذف کنید` : null;
}

function fail(res: any, e: any, fallback: string) {
  if (e instanceof HrError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "شماره حکم یا تاریخ اعمال تکراری است؛ دوباره تلاش کنید" });
  return res.status(400).json({ error: e?.message || fallback });
}

const include = {
  employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } },
  employmentType: { select: { id: true, title: true } },
  position: { select: { id: true, title: true } },
  orgUnit: { select: { id: true, title: true } },
  costCenter: { select: { id: true, title: true } },
  lines: { include: { component: { select: { id: true, code: true, title: true, valueType: true } } }, orderBy: { id: "asc" as const } },
};

function shape(d: any) {
  return {
    id: d.id,
    number: d.number,
    employeeId: d.employeeId,
    personnelCode: d.employee.personnelCode,
    employeeName: fullName(d.employee.party),
    type: d.type,
    issueDate: day(d.issueDate),
    effectiveDate: day(d.effectiveDate),
    endDate: day(d.endDate),
    employmentTypeId: d.employmentTypeId,
    employmentTypeTitle: d.employmentType.title,
    weeklyHours: d.weeklyHours?.toString() ?? null,
    description: d.description,
    status: d.status,
    positionId: d.positionId,
    positionTitle: d.position?.title ?? null,
    orgUnitId: d.orgUnitId,
    orgUnitTitle: d.orgUnit?.title ?? null,
    costCenterId: d.costCenterId,
    costCenterTitle: d.costCenter?.title ?? null,
    approvedAt: d.approvedAt,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      componentId: l.componentId,
      componentTitle: l.component.title,
      valueType: l.component.valueType,
      value: l.value.toString(),
    })),
  };
}

/** اعتبارسنجی بدنه‌ی پیش‌نویس (ایجاد/ویرایش) → داده‌ی ذخیره */
async function buildDraft(b: any, employeeId: number) {
  if (!TYPES.includes(b.type)) throw new HrError("نوع حکم نامعتبر است");
  const issueDate = parseDay(b.issueDate, "تاریخ صدور")!;
  const effectiveDate = parseDay(b.effectiveDate, "تاریخ اعمال")!;
  const endDate = parseDay(b.endDate, "تاریخ پایان", false);
  if (endDate && endDate < effectiveDate) throw new HrError("تاریخ پایان نباید قبل از تاریخ اعمال باشد");
  const empType = await prisma.employmentType.findUnique({ where: { id: Number(b.employmentTypeId) } });
  if (!empType) throw new HrError("نوع همکاری الزامی است");
  if (!empType.isActive) throw new HrError("نوع همکاری انتخاب‌شده غیرفعال است");
  let weeklyHours: number | null = null;
  if (b.weeklyHours !== undefined && b.weeklyHours !== null && b.weeklyHours !== "") {
    weeklyHours = Number(b.weeklyHours);
    if (!isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 168) throw new HrError("ساعت کار هفتگی باید بین ۰ و ۱۶۸ باشد");
  }
  const lines: { componentId: number; value: number }[] = Array.isArray(b.lines) ? b.lines : [];
  if (lines.length === 0) throw new HrError("حکم باید حداقل یک عامل داشته باشد");
  const seen = new Set<number>();
  const out: { componentId: number; value: number }[] = [];
  for (const l of lines) {
    const componentId = Number(l.componentId);
    const comp = componentId ? await prisma.decreeComponent.findUnique({ where: { id: componentId } }) : null;
    if (!comp) throw new HrError("عامل حکم یافت نشد");
    if (!comp.isActive) throw new HrError(`عامل «${comp.title}» غیرفعال است`);
    if (seen.has(componentId)) throw new HrError(`عامل «${comp.title}» بیش از یک‌بار آمده است`);
    seen.add(componentId);
    const value = Number(l.value);
    if (!isFinite(value) || value < 0) throw new HrError(`مقدار «${comp.title}» نامعتبر است`);
    if (comp.valueType === "PERCENT" && value > 100) throw new HrError(`درصد «${comp.title}» نباید بیش از ۱۰۰ باشد`);
    out.push({ componentId, value });
  }
  // تغییر انتصاب (اختیاری)
  let assign: { positionId: number | null; orgUnitId: number | null; costCenterId: number | null } = { positionId: null, orgUnitId: null, costCenterId: null };
  if (b.positionId) {
    const a = { positionId: Number(b.positionId), orgUnitId: b.orgUnitId ? Number(b.orgUnitId) : null, costCenterId: b.costCenterId ? Number(b.costCenterId) : null };
    await checkAssignmentRefs(a);
    assign = { positionId: a.positionId, orgUnitId: a.orgUnitId!, costCenterId: a.costCenterId };
  }
  return {
    header: {
      employeeId,
      type: b.type,
      issueDate,
      effectiveDate,
      endDate,
      employmentTypeId: empType.id,
      weeklyHours,
      description: str(b.description),
      ...assign,
    },
    lines: out,
  };
}

// ── فهرست ──
router.get("/employment-decrees", async (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const rows = await prisma.employmentDecree.findMany({
    where: employeeId ? { employeeId } : {},
    include: { ...include, lines: false },
    orderBy: [{ employeeId: "asc" }, { effectiveDate: "desc" }, { id: "desc" }],
  } as any);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  // «جاری»: آخرین حکم تاییدشده‌ی هر کارمند با تاریخ اعمال ≤ امروز
  const current = new Map<number, number>();
  for (const r of rows as any[]) {
    if (r.status === "APPROVED" && r.effectiveDate <= today && !current.has(r.employeeId)) current.set(r.employeeId, r.id);
  }
  res.json(
    (rows as any[]).map((d) => ({
      id: d.id,
      number: d.number,
      employeeId: d.employeeId,
      personnelCode: d.employee.personnelCode,
      employeeName: fullName(d.employee.party),
      type: d.type,
      issueDate: day(d.issueDate),
      effectiveDate: day(d.effectiveDate),
      endDate: day(d.endDate),
      employmentTypeTitle: d.employmentType.title,
      positionTitle: d.position?.title ?? null,
      status: d.status,
      isCurrent: current.get(d.employeeId) === d.id,
    }))
  );
});

// حکم مؤثر یک کارمند (برای پیش‌پر کردن حکم جدید)
router.get("/employment-decrees/effective", async (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) return res.status(400).json({ error: "کارمند الزامی است" });
  const { decree, validity } = await getEffectiveDecree(employeeId);
  if (!decree) return res.json({ validity, decree: null });
  const full = await prisma.employmentDecree.findUnique({ where: { id: decree.id }, include });
  res.json({ validity, decree: shape(full) });
});

// آخرین حکم کارمند (برای پیش‌پر کردن حکم جدید): آخرین حکم تاییدشده با تاریخ اعمال، وگرنه آخرین حکمِ هر وضعیت
router.get("/employment-decrees/latest", async (req, res) => {
  const employeeId = Number(req.query.employeeId);
  if (!employeeId) return res.status(400).json({ error: "کارمند الزامی است" });
  const approved = await prisma.employmentDecree.findFirst({ where: { employeeId, status: "APPROVED" }, orderBy: [{ effectiveDate: "desc" }, { id: "desc" }], include });
  const d = approved ?? (await prisma.employmentDecree.findFirst({ where: { employeeId }, orderBy: [{ effectiveDate: "desc" }, { id: "desc" }], include }));
  res.json({ decree: d ? shape(d) : null });
});

router.get("/employment-decrees/:id", async (req, res) => {
  const d = await prisma.employmentDecree.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!d) return res.status(404).json({ error: "حکم یافت نشد" });
  const lock = await payrollLockMessage(d.id);
  res.json({ ...shape(d), payrollLocked: !!lock, payrollLockMessage: lock });
});

// ── ایجاد (پیش‌نویس) ──
/** ساخت پیش‌نویس حکم (تنها مسیر ساخت: فرم و ورود از اکسل). خطا = HrError */
export async function createDecreeDraft(b: any): Promise<{ id: number; number: number }> {
  const employeeId = Number(b.employeeId);
  if (!employeeId || !(await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }))) {
    throw new HrError("کارمند را انتخاب کنید");
  }
  const { header, lines } = await buildDraft(b, employeeId);
  for (let attempt = 0; ; attempt++) {
    try {
      const last = await prisma.employmentDecree.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
      const created = await prisma.employmentDecree.create({
        data: { ...header, number: (last?.number ?? 0) + 1, lines: { create: lines } },
      });
      return { id: created.id, number: created.number };
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

router.post("/employment-decrees", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createDecreeDraft(req.body));
  } catch (e: any) {
    fail(res, e, "خطا در ثبت حکم");
  }
});

// ── ویرایش (فقط پیش‌نویس) ──
router.put("/employment-decrees/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const existing = await prisma.employmentDecree.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "حکم یافت نشد" });
    const lockMsg = await payrollLockMessage(id);
    if (lockMsg) throw new HrError(lockMsg);
    if (existing.status !== "DRAFT") throw new HrError("حکم تاییدشده قابل ویرایش نیست؛ ابتدا برگشت از تایید یا حکم جدید صادر کنید");
    assertRecordNotStale(existing.updatedAt, b.updatedAt, "این حکم");
    const { header, lines } = await buildDraft(b, existing.employeeId); // کارمند حکم تغییر نمی‌کند
    await prisma.$transaction([
      prisma.employmentDecreeLine.deleteMany({ where: { decreeId: id } }),
      prisma.employmentDecree.update({ where: { id }, data: { ...header, lines: { create: lines } } }),
    ]);
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در ویرایش حکم");
  }
});

// ── تایید ──
/** تایید پیش‌نویس (قفل کارمند، کنترل دوره‌ی همکاری/فیش/تکراری، اعمال انتصاب). تنها مسیر تایید: دکمه‌ی فرم و ورود از اکسل. خطا = HrError */
export async function approveDecree(id: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const d = await tx.employmentDecree.findUnique({ where: { id }, include: { lines: true } });
    if (!d) throw new HrError("حکم یافت نشد");
    if (d.status !== "DRAFT") throw new HrError("این حکم قبلاً تایید شده است");
    // قفل ردیف کارمند: تایید هم‌زمان دو حکم یک کارمند پشت سر هم اجرا می‌شود
    await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${d.employeeId} FOR UPDATE`;
    // تاریخ اعمال باید داخل یک دوره‌ی همکاری باشد
    const periods = await tx.employmentPeriod.findMany({ where: { employeeId: d.employeeId } });
    const inside = periods.some((p) => p.startDate <= d.effectiveDate && (!p.endDate || p.endDate >= d.effectiveDate));
    if (!inside) throw new HrError("تاریخ اعمال حکم داخل هیچ دوره‌ی همکاری کارمند نیست");
    // حکمی که از ماهِ دارای محاسبه (یا قبل از آن) اجرا می‌شود مبنای فیش ثبت‌شده را عوض می‌کند
    const slips = await tx.payrollSlip.findMany({ where: { employeeId: d.employeeId }, select: { year: true, month: true } });
    const hit = slips.find((x) => jalaliMonthRange(x.year, x.month).end >= d.effectiveDate);
    if (hit) throw new HrError(`برای این کارمند حقوق ${hit.year}/${hit.month} محاسبه شده است؛ برای تایید حکمی با تاریخ اعمال قبل از پایان آن ماه، ابتدا محاسبه را حذف کنید`);
    const same = await tx.employmentDecree.findFirst({
      where: { employeeId: d.employeeId, status: "APPROVED", effectiveDate: d.effectiveDate, NOT: { id } },
      select: { number: true },
    });
    if (same) throw new HrError(`حکم تاییدشده‌ی شماره ${same.number} با همین تاریخ اعمال وجود دارد`);

    let applied: { appliedId: number; previousId: number | null } | null = null;
    if (d.positionId) {
      const later = await tx.employmentDecree.findFirst({
        where: { employeeId: d.employeeId, status: "APPROVED", effectiveDate: { gt: d.effectiveDate } },
        select: { number: true },
      });
      if (later) throw new HrError(`حکم دارای تغییر انتصاب باید آخرین حکم کارمند باشد (حکم بعدی: شماره ${later.number})`);
      applied = await changeAssignment(tx, d.employeeId, { positionId: d.positionId, orgUnitId: d.orgUnitId, costCenterId: d.costCenterId }, d.effectiveDate);
    }
    await tx.employmentType.update({ where: { id: d.employmentTypeId }, data: { hasTransactions: true } });
    await tx.decreeComponent.updateMany({ where: { id: { in: d.lines.map((l) => l.componentId) } }, data: { hasTransactions: true } });
    await tx.employmentDecree.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date(), appliedAssignmentId: applied?.appliedId ?? null, previousAssignmentId: applied?.previousId ?? null },
    });
  });
}

router.post("/employment-decrees/:id/approve", can(`${FORM}.approve`), async (req, res) => {
  try {
    await approveDecree(Number(req.params.id));
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در تایید حکم");
  }
});

// ── برگشت از تایید (فقط آخرین حکم تاییدشده‌ی کارمند) ──
router.post("/employment-decrees/:id/unapprove", can(`${FORM}.unapprove`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.$transaction(async (tx) => {
      const d = await tx.employmentDecree.findUnique({ where: { id } });
      if (!d) throw new HrError("حکم یافت نشد");
      if (d.status !== "APPROVED") throw new HrError("این حکم تایید نشده است");
      const slip = await tx.payrollSlip.findFirst({ where: { decreeId: id }, select: { year: true, month: true } });
      if (slip) throw new HrError(`این حکم در محاسبه‌ی حقوق ${slip.year}/${slip.month} استفاده شده است؛ ابتدا آن محاسبه را حذف کنید`);
      await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id" = ${d.employeeId} FOR UPDATE`;
      const later = await tx.employmentDecree.findFirst({
        where: { employeeId: d.employeeId, status: "APPROVED", effectiveDate: { gt: d.effectiveDate } },
        select: { number: true },
      });
      if (later) throw new HrError(`فقط آخرین حکم کارمند قابل برگشت از تایید است (حکم بعدی: شماره ${later.number})`);
      // برگشت انتصابی که همین حکم ساخته؛ فقط اگر هنوز همان انتصاب فعلی است
      if (d.appliedAssignmentId) {
        const a = await tx.employeeAssignment.findUnique({ where: { id: d.appliedAssignmentId } });
        if (a) {
          if (a.toDate) throw new HrError("انتصابی که این حکم ساخته بعداً تغییر کرده است؛ برگشت از تایید ممکن نیست");
          await tx.employmentDecree.update({ where: { id }, data: { appliedAssignmentId: null } });
          await tx.employeeAssignment.delete({ where: { id: a.id } });
          if (d.previousAssignmentId) {
            await tx.employeeAssignment.updateMany({ where: { id: d.previousAssignmentId }, data: { toDate: null } });
          }
        }
      }
      await tx.employmentDecree.update({
        where: { id },
        data: { status: "DRAFT", approvedAt: null, appliedAssignmentId: null, previousAssignmentId: null },
      });
    });
    res.json({ ok: true });
  } catch (e: any) {
    fail(res, e, "خطا در برگشت از تایید");
  }
});

// ── حذف (فقط پیش‌نویس) ──
router.delete("/employment-decrees/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.employmentDecree.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "حکم یافت نشد" });
  const lockMsg = await payrollLockMessage(id);
  if (lockMsg) return res.status(400).json({ error: lockMsg });
  if (d.status !== "DRAFT") return res.status(400).json({ error: "حکم تاییدشده قابل حذف نیست؛ ابتدا برگشت از تایید کنید" });
  await prisma.employmentDecree.delete({ where: { id } });
  res.status(204).send();
});

export default router;
