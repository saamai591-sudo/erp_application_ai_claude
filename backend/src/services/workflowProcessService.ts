import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { CONDITION_FIELDS, EVENT_BY_KEY, ROOT_TYPE_FA, WORKFLOW_EVENTS, cleanConditions, type RootType } from "./workflowEvents";

// تعریف فرایند (کارتابل): هویت + نسخه‌ها + مراحل + مسئول‌ها. تنها نویسنده‌ی WorkflowProcess/Version/Step/StepAssignee همین سرویس است.
// ویرایش: اگر برای نسخه‌ی جاری نمونه‌ای ساخته شده باشد، «نسخه‌ی تازه» ساخته می‌شود (نمونه‌های در جریان با نسخه‌ی خودشان ادامه می‌دهند)،
// وگرنه مراحل همان نسخه جایگزین می‌شود. فرایند فعال باید برای هر مرحله‌ی دستی دست‌کم یک مسئول داشته باشد.

export class ProcessError extends Error {}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);
const posInt = (v: unknown, label: string): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 24 * 365) throw new ProcessError(`${label} باید عدد صحیح مثبت باشد`);
  return n;
};

interface StepData {
  seq: number;
  title: string;
  description: string | null;
  completion: "MANUAL" | "EVENT";
  completionEvent: string | null;
  deadlineHours: number | null;
  reminderHours: number | null;
  escalateUserId: number | null;
  escalateRoleId: number | null;
  entryCondition: any;
  assignees: { kind: "USER" | "ROLE" | "CREATOR"; userId: number | null; roleId: number | null }[];
}
interface ProcessData {
  title: string;
  description: string | null;
  isActive: boolean;
  rootType: RootType;
  startEvent: string;
  startCondition: any;
  steps: StepData[];
}

/** بدنه‌ی فرم → داده‌ی نرمال‌شده (همه‌ی کنترل‌ها) */
export async function validateProcess(b: any, excludeId?: number): Promise<ProcessData> {
  const title = str(b.title);
  if (!title) throw new ProcessError("عنوان الزامی است");
  if (await prisma.workflowProcess.findFirst({ where: { title, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) throw new ProcessError("فرایند دیگری با همین عنوان وجود دارد");
  const rootType: RootType = "SALES_QUOTE";
  const ev = EVENT_BY_KEY.get(String(b.startEvent));
  if (!ev || !ev.canStart || ev.rootType !== rootType) throw new ProcessError("رویداد شروع را انتخاب کنید");
  const isActive = b.isActive === undefined ? true : !!b.isActive;
  let startCondition: any;
  let steps: StepData[] = [];
  try {
    startCondition = cleanConditions(b.startCondition, rootType);
  } catch (e: any) {
    throw new ProcessError(`شرط شروع: ${e.message}`);
  }
  const raw = Array.isArray(b.steps) ? b.steps : [];
  if (raw.length === 0) throw new ProcessError("دست‌کم یک مرحله لازم است");
  const userIds = new Set<number>(), roleIds = new Set<number>();
  for (const [i, r] of raw.entries()) {
    const n = i + 1;
    const stepTitle = str(r.title);
    if (!stepTitle) throw new ProcessError(`مرحله ${n}: عنوان الزامی است`);
    const completion = r.completion === "EVENT" ? "EVENT" : "MANUAL";
    let completionEvent: string | null = null;
    if (completion === "EVENT") {
      const e = EVENT_BY_KEY.get(String(r.completionEvent));
      if (!e || !e.canComplete) throw new ProcessError(`مرحله ${n}: رویداد بسته‌شدن را انتخاب کنید`);
      completionEvent = e.key;
    }
    const deadlineHours = posInt(r.deadlineHours, `مرحله ${n}: مهلت`);
    const reminderHours = posInt(r.reminderHours, `مرحله ${n}: یادآوری`);
    if (reminderHours && !deadlineHours) throw new ProcessError(`مرحله ${n}: برای یادآوری مهلت لازم است`);
    if (reminderHours && deadlineHours && reminderHours >= deadlineHours) throw new ProcessError(`مرحله ${n}: یادآوری باید قبل از مهلت باشد`);
    const escalateUserId = r.escalateUserId ? Number(r.escalateUserId) : null;
    const escalateRoleId = r.escalateRoleId ? Number(r.escalateRoleId) : null;
    if ((escalateUserId || escalateRoleId) && !deadlineHours) throw new ProcessError(`مرحله ${n}: برای تشدید مهلت لازم است`);
    if (escalateUserId) userIds.add(escalateUserId);
    if (escalateRoleId) roleIds.add(escalateRoleId);
    let entryCondition: any;
    try {
      entryCondition = cleanConditions(r.entryCondition, rootType);
    } catch (e: any) {
      throw new ProcessError(`مرحله ${n}: شرط ورود: ${e.message}`);
    }
    const assignees: StepData["assignees"] = [];
    const seen = new Set<string>();
    for (const a of Array.isArray(r.assignees) ? r.assignees : []) {
      if (a.kind === "CREATOR") {
        if (!seen.has("C")) assignees.push({ kind: "CREATOR", userId: null, roleId: null });
        seen.add("C");
      } else if (a.kind === "USER" && Number(a.userId)) {
        if (!seen.has(`U${a.userId}`)) { assignees.push({ kind: "USER", userId: Number(a.userId), roleId: null }); userIds.add(Number(a.userId)); }
        seen.add(`U${a.userId}`);
      } else if (a.kind === "ROLE" && Number(a.roleId)) {
        if (!seen.has(`R${a.roleId}`)) { assignees.push({ kind: "ROLE", userId: null, roleId: Number(a.roleId) }); roleIds.add(Number(a.roleId)); }
        seen.add(`R${a.roleId}`);
      } else throw new ProcessError(`مرحله ${n}: مسئول ناقص است`);
    }
    if (isActive && completion === "MANUAL" && assignees.length === 0) throw new ProcessError(`مرحله ${n} («${stepTitle}»): برای فرایند فعال، مرحله‌ی دستی باید دست‌کم یک مسئول داشته باشد`);
    steps.push({ seq: n, title: stepTitle, description: str(r.description), completion, completionEvent, deadlineHours, reminderHours, escalateUserId, escalateRoleId, entryCondition, assignees });
  }
  if (userIds.size && (await prisma.user.count({ where: { id: { in: [...userIds] } } })) !== userIds.size) throw new ProcessError("یکی از کاربران انتخاب‌شده یافت نشد");
  if (roleIds.size && (await prisma.role.count({ where: { id: { in: [...roleIds] } } })) !== roleIds.size) throw new ProcessError("یکی از نقش‌های انتخاب‌شده یافت نشد");
  return { title, description: str(b.description), isActive, rootType, startEvent: ev.key, startCondition, steps };
}

const stepCreate = (steps: StepData[]) =>
  steps.map((s) => ({
    seq: s.seq,
    title: s.title,
    description: s.description,
    completion: s.completion,
    completionEvent: s.completionEvent,
    deadlineHours: s.deadlineHours,
    reminderHours: s.reminderHours,
    escalateUserId: s.escalateUserId,
    escalateRoleId: s.escalateRoleId,
    entryCondition: s.entryCondition,
    assignees: { create: s.assignees.map((a) => ({ kind: a.kind, userId: a.userId, roleId: a.roleId })) },
  }));

export async function createProcess(d: ProcessData): Promise<{ id: number }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const p = await prisma.workflowProcess.create({
        data: {
          code: await nextSerialNumber(prisma.workflowProcess, "code"),
          title: d.title,
          description: d.description,
          rootType: d.rootType,
          startEvent: d.startEvent,
          startCondition: d.startCondition,
          isActive: d.isActive,
          versions: { create: { version: 1, isCurrent: true, steps: { create: stepCreate(d.steps) } } },
        },
      });
      return { id: p.id };
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateProcess(id: number, d: ProcessData): Promise<void> {
  const p = await prisma.workflowProcess.findUnique({ where: { id }, include: { versions: { where: { isCurrent: true }, include: { _count: { select: { instances: true } } } } } });
  if (!p) throw new ProcessError("فرایند یافت نشد");
  const cur = p.versions[0];
  await prisma.$transaction(async (tx) => {
    await tx.workflowProcess.update({ where: { id }, data: { title: d.title, description: d.description, startEvent: d.startEvent, startCondition: d.startCondition, isActive: d.isActive } });
    if (cur && cur._count.instances === 0) {
      await tx.workflowStep.deleteMany({ where: { versionId: cur.id } });
      await tx.workflowProcessVersion.update({ where: { id: cur.id }, data: { steps: { create: stepCreate(d.steps) } } });
    } else {
      const last = await tx.workflowProcessVersion.findFirst({ where: { processId: id }, orderBy: { version: "desc" }, select: { version: true } });
      if (cur) await tx.workflowProcessVersion.update({ where: { id: cur.id }, data: { isCurrent: false } });
      await tx.workflowProcessVersion.create({ data: { processId: id, version: (last?.version ?? 0) + 1, isCurrent: true, steps: { create: stepCreate(d.steps) } } });
      // نسخه‌های قدیمیِ بدون نمونه لازم نیست بمانند
      await tx.workflowProcessVersion.deleteMany({ where: { processId: id, isCurrent: false, instances: { none: {} } } });
    }
  });
}

export async function deleteProcess(id: number): Promise<void> {
  const p = await prisma.workflowProcess.findUnique({ where: { id }, include: { _count: { select: { instances: true } } } });
  if (!p) throw new ProcessError("فرایند یافت نشد");
  if (p._count.instances > 0) throw new ProcessError("برای این فرایند نمونه‌ی اجراشده وجود دارد و حذف نمی‌شود؛ آن را غیرفعال کنید");
  await prisma.workflowProcess.delete({ where: { id } });
}

export async function listProcesses() {
  const rows = await prisma.workflowProcess.findMany({
    orderBy: { code: "asc" },
    include: { versions: { where: { isCurrent: true }, include: { _count: { select: { steps: true } } } }, _count: { select: { instances: true } } },
  });
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title,
    rootType: p.rootType,
    rootTypeTitle: ROOT_TYPE_FA[p.rootType as RootType],
    startEventTitle: EVENT_BY_KEY.get(p.startEvent)?.title ?? p.startEvent,
    isActive: p.isActive,
    version: p.versions[0]?.version ?? 0,
    stepCount: p.versions[0]?._count.steps ?? 0,
    instanceCount: p._count.instances,
  }));
}

export async function getProcess(id: number) {
  const p = await prisma.workflowProcess.findUnique({
    where: { id },
    include: { versions: { where: { isCurrent: true }, include: { steps: { orderBy: { seq: "asc" }, include: { assignees: { orderBy: { id: "asc" } } } } } }, _count: { select: { instances: true } } },
  });
  if (!p) return null;
  const v = p.versions[0];
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    description: p.description,
    isActive: p.isActive,
    rootType: p.rootType,
    startEvent: p.startEvent,
    startCondition: p.startCondition,
    version: v?.version ?? 0,
    instanceCount: p._count.instances,
    updatedAt: p.updatedAt,
    steps: (v?.steps ?? []).map((s) => ({
      title: s.title,
      description: s.description,
      completion: s.completion,
      completionEvent: s.completionEvent,
      deadlineHours: s.deadlineHours,
      reminderHours: s.reminderHours,
      escalateUserId: s.escalateUserId,
      escalateRoleId: s.escalateRoleId,
      entryCondition: s.entryCondition,
      assignees: s.assignees.map((a) => ({ kind: a.kind, userId: a.userId, roleId: a.roleId })),
    })),
  };
}

/** گزینه‌های فرم: رویدادها، فیلدهای شرط، کاربران، نقش‌ها و فهرست مقدارهای شرط */
export async function processMeta() {
  const [users, roles, centers, types, customers, currencies] = await Promise.all([
    prisma.user.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, firstName: true, lastName: true, isLight: true } }),
    prisma.role.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true } }),
    prisma.salesCenter.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true } }),
    prisma.salesType.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true } }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, party: { select: { detailTitle: true } } } }),
    prisma.currency.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true } }),
  ]);
  return {
    rootType: "SALES_QUOTE",
    startEvents: WORKFLOW_EVENTS.filter((e) => e.canStart).map((e) => ({ key: e.key, title: e.title })),
    completionEvents: WORKFLOW_EVENTS.filter((e) => e.canComplete).map((e) => ({ key: e.key, title: e.title })),
    conditionFields: CONDITION_FIELDS.SALES_QUOTE,
    users: users.map((u) => ({ id: u.id, title: `${u.firstName} ${u.lastName}`.trim(), isLight: u.isLight })),
    roles,
    values: {
      salesCenterId: centers,
      salesTypeId: types,
      customerId: customers.map((c) => ({ id: c.id, title: c.party.detailTitle })),
      currencyId: currencies,
    },
  };
}

/** الگوی «زنجیره‌ی فروش»: فرایند غیرفعال با مراحل آماده؛ مسئول‌ها را مدیر تعیین می‌کند */
export async function createSalesChainTemplate(): Promise<{ id: number }> {
  let title = "زنجیره‌ی فروش (الگو)";
  for (let n = 2; await prisma.workflowProcess.findUnique({ where: { title } }); n++) title = `زنجیره‌ی فروش (الگو) ${n}`;
  const steps: Omit<StepData, "seq">[] = [
    { title: "پیگیری پیش‌فاکتور و دریافت وجه از مشتری", description: "با مشتری هماهنگ و پیگیری کنید؛ نتیجه و مدرک (مثلاً رسید یا پیام) را ثبت کنید", completion: "MANUAL", completionEvent: null, deadlineHours: 48, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [{ kind: "CREATOR", userId: null, roleId: null }] },
    { title: "ثبت دریافت", description: null, completion: "EVENT", completionEvent: "RECEIPT_APPROVED", deadlineHours: null, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [] },
    { title: "هماهنگی لجستیک", description: "زمان و نحوه‌ی ارسال کالا را با مشتری و انبار هماهنگ کنید", completion: "MANUAL", completionEvent: null, deadlineHours: 24, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [] },
    { title: "صدور حواله فروش", description: "انباردار حواله را ثبت می‌کند", completion: "EVENT", completionEvent: "SALES_DELIVERY_REGISTERED", deadlineHours: 48, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [] },
    { title: "صدور فاکتور فروش", description: "حسابداری فاکتور را ثبت می‌کند", completion: "EVENT", completionEvent: "SALES_INVOICE_CREATED", deadlineHours: 48, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [] },
    { title: "ارسال فاکتور به مودیان", description: null, completion: "EVENT", completionEvent: "TAX_INVOICE_SENT", deadlineHours: 72, reminderHours: null, escalateUserId: null, escalateRoleId: null, entryCondition: [], assignees: [] },
  ];
  return createProcess({ title, description: "الگوی پیشنهادی؛ مسئول و مهلت مرحله‌ها را تنظیم و فرایند را فعال کنید", isActive: false, rootType: "SALES_QUOTE", startEvent: "SALES_QUOTE_APPROVED", startCondition: [], steps: steps.map((s, i) => ({ ...s, seq: i + 1 })) });
}
