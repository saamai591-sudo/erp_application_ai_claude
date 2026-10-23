import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { completeTask, processDeadlines } from "./workflowEngineService";
import { quoteDeliveryProgress, rootSummary, type InstanceRootType } from "./workflowEvents";

// کارتابل: فهرست/جزئیات کارها، برداشتن، انجام‌شدنِ دستی (توضیح + مدرک)، پیوست‌ها، شمارنده و اطلاعیه‌ها. موتور: workflowEngineService.ts
// دیدن یک کار: کاربرِ ثابت / عضو نقش / ثبت‌کننده‌ی سندِ ریشه (بر اساس مسئول‌های مرحله) یا — برای تشدید — کاربر/نقشِ تشدید؛ «همه‌ی کارها» دسترسی جدا دارد.

export class WorkflowError extends Error {}

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MIME_OK = (m: string) => m.startsWith("image/") || m === "application/pdf";

const fullName = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}`.trim() : "");
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function roleIdsOf(userId: number): Promise<number[]> {
  return (await prisma.userRole.findMany({ where: { userId }, select: { roleId: true } })).map((r) => r.roleId);
}

/** شرط Prisma: کارهایی که این کاربر مسئولِ دیدنشان است */
function visibleWhere(userId: number, roleIds: number[]) {
  return {
    OR: [
      { step: { assignees: { some: { OR: [{ kind: "USER" as const, userId }, ...(roleIds.length ? [{ kind: "ROLE" as const, roleId: { in: roleIds } }] : [])] } } } },
      { AND: [{ instance: { creatorUserId: userId } }, { step: { assignees: { some: { kind: "CREATOR" as const } } } }] },
      { step: { OR: [{ escalateUserId: userId }, ...(roleIds.length ? [{ escalateRoleId: { in: roleIds } }] : [])] }, dueAt: { lte: new Date() } },
    ],
  };
}

const TASK_INCLUDE = {
  step: { select: { id: true, title: true, description: true, completion: true, completionEvent: true, requireNote: true, requireAttachment: true, branchPerEvent: true } },
  instance: { select: { id: true, rootType: true, rootId: true, rootNumber: true, rootTitle: true, creatorUserId: true, status: true, parentInstanceId: true, parent: { select: { rootTitle: true, rootId: true } } } },
  claimedBy: { select: { id: true, firstName: true, lastName: true } },
  completedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

function shape(t: any, userId: number) {
  const overdue = !!t.dueAt && t.dueAt.getTime() < Date.now() && (t.status === "OPEN" || t.status === "CLAIMED");
  const active = t.status === "OPEN" || t.status === "CLAIMED";
  return {
    id: t.id,
    instanceId: t.instanceId,
    rootType: t.instance.rootType,
    rootId: t.instance.rootId,
    rootTitle: t.instance.rootTitle,
    stepTitle: t.step.title,
    completion: t.step.completion,
    requireNote: t.step.requireNote,
    requireAttachment: t.step.requireAttachment,
    branchPerEvent: t.step.branchPerEvent,
    completionEvent: t.step.completionEvent,
    // پیش‌فاکتورِ مبنا (برای شاخه‌ی حواله = پیش‌فاکتورِ نمونه‌ی والد) و حواله‌ی شاخه؛ دکمه‌ی «اقدام» فرم بعدی را با این‌ها باز می‌کند
    quoteId: t.instance.rootType === "SALES_QUOTE" ? t.instance.rootId : t.instance.parent?.rootId ?? null,
    deliveryId: t.instance.rootType === "SALES_DELIVERY" ? t.instance.rootId : null,
    parentTitle: t.instance.parent?.rootTitle ?? null,
    status: t.status,
    claimedById: t.claimedById,
    claimedByName: fullName(t.claimedBy),
    createdAt: iso(t.createdAt),
    dueAt: iso(t.dueAt),
    overdue,
    completedAt: iso(t.completedAt),
    completedByName: fullName(t.completedBy),
    completionKind: t.completionKind,
    isMine: t.claimedById === userId,
    canClaim: active && t.status === "OPEN",
    canComplete: active && t.step.completion === "MANUAL" && (t.status === "OPEN" || t.claimedById === userId),
  };
}

export type Scope = "mine" | "claimed" | "overdue" | "done" | "cancelled" | "all";

export async function listTasks(userId: number, scope: Scope, canSeeAll: boolean) {
  const roleIds = await roleIdsOf(userId);
  const active = { status: { in: ["OPEN", "CLAIMED"] as ("OPEN" | "CLAIMED")[] } };
  let where: any;
  if (scope === "all") {
    if (!canSeeAll) throw new WorkflowError("دسترسی به همه‌ی کارها را ندارید");
    where = {};
  } else if (scope === "claimed") where = { ...active, claimedById: userId };
  else if (scope === "overdue") where = { ...active, dueAt: { lt: new Date() }, AND: [visibleWhere(userId, roleIds)] };
  else if (scope === "done") where = { status: "DONE", OR: [{ completedById: userId }, { claimedById: userId }, visibleWhere(userId, roleIds)] };
  else if (scope === "cancelled") where = { status: "CANCELLED", AND: [visibleWhere(userId, roleIds)] };
  else where = { ...active, AND: [visibleWhere(userId, roleIds)], OR: [{ claimedById: null }, { claimedById: userId }] };
  const rows = await prisma.workflowTask.findMany({ where, include: TASK_INCLUDE, orderBy: scope === "done" || scope === "cancelled" ? { completedAt: "desc" } : [{ dueAt: "asc" }, { createdAt: "asc" }], take: scope === "done" || scope === "cancelled" || scope === "all" ? 300 : 500 });
  return Promise.all(rows.map(async (t) => ({ ...shape(t, userId), progress: await repeatProgress(t) })));
}

/** پیشرفت مرحله‌ی «هر رویداد یک شاخه» (مثلاً حواله‌شدن پیش‌فاکتور): مقدار کل/حواله‌شده و حواله‌های ثبت‌شده با وضعیت مسیرشان؛ برای بقیه‌ی کارها null */
async function repeatProgress(t: any) {
  if (!t.step.branchPerEvent || t.instance.rootType !== "SALES_QUOTE") return null;
  const [p, branches] = await Promise.all([
    quoteDeliveryProgress(t.instance.rootId),
    prisma.workflowInstance.findMany({ where: { parentInstanceId: t.instance.id }, orderBy: { id: "asc" }, select: { rootNumber: true, status: true } }),
  ]);
  return { total: p.total, done: p.done, branches: branches.map((b) => ({ docNumber: b.rootNumber, status: b.status })) };
}

/** اطلاعات پیش‌پر کردن فرم بعدی از روی کار (طرف حساب پیش‌فاکتور)؛ فقط در جزئیات کار */
async function actionContextOf(t: any) {
  const quoteId = t.instance.rootType === "SALES_QUOTE" ? t.instance.rootId : t.instance.parent?.rootId;
  if (!quoteId) return null;
  const q = await withoutFiscalPeriodScope(() => prisma.salesQuote.findUnique({ where: { id: quoteId }, select: { number: true, customer: { select: { party: { select: { id: true, detailTitle: true, firstName: true, lastName: true, name: true } } } } } }));
  if (!q) return null;
  const p = q.customer.party;
  return { quoteNumber: q.number, partyId: p.id, partyTitle: p.detailTitle || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "" };
}

async function loadVisible(userId: number, taskId: number, canSeeAll: boolean) {
  const roleIds = await roleIdsOf(userId);
  const t = await prisma.workflowTask.findFirst({ where: { id: taskId, ...(canSeeAll ? {} : { OR: [visibleWhere(userId, roleIds), { claimedById: userId }, { completedById: userId }] }) }, include: TASK_INCLUDE });
  if (!t) throw new WorkflowError("کار یافت نشد یا به شما مربوط نیست");
  return t;
}

export async function getTask(userId: number, taskId: number, canSeeAll: boolean) {
  const t = await loadVisible(userId, taskId, canSeeAll);
  const [logs, atts, events, summary] = await Promise.all([
    prisma.workflowTaskLog.findMany({ where: { taskId }, orderBy: { at: "asc" }, include: { user: { select: { firstName: true, lastName: true } } } }),
    prisma.workflowAttachment.findMany({ where: { taskId }, orderBy: { id: "asc" }, select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true, uploadedById: true } }),
    prisma.workflowInstanceEvent.findMany({ where: { instanceId: t.instanceId }, orderBy: { at: "asc" } }),
    rootSummary(t.instance.rootType as InstanceRootType, t.instance.rootId),
  ]);
  await prisma.workflowNotification.updateMany({ where: { userId, taskId, readAt: null }, data: { readAt: new Date() } });
  return {
    ...shape(t, userId),
    progress: await repeatProgress(t),
    actionContext: await actionContextOf(t),
    stepDescription: t.step.description,
    note: t.note,
    eventRef: t.eventRef,
    summary,
    events: events.map((e) => ({ eventType: e.eventType, docType: e.docType, docNumber: e.docNumber, at: iso(e.at) })),
    logs: logs.map((l) => ({ action: l.action, message: l.message, at: iso(l.at), userName: fullName(l.user) })),
    attachments: atts.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, size: a.size, createdAt: iso(a.createdAt), mine: a.uploadedById === userId })),
  };
}

export async function claimTask(userId: number, taskId: number) {
  const t = await loadVisible(userId, taskId, false);
  const r = await prisma.workflowTask.updateMany({ where: { id: t.id, status: "OPEN" }, data: { status: "CLAIMED", claimedById: userId, claimedAt: new Date() } });
  if (r.count === 0) throw new WorkflowError("این کار قبلاً برداشته شده یا بسته شده است");
  await prisma.workflowTaskLog.create({ data: { taskId, userId, action: "CLAIMED" } });
}

export async function releaseTask(userId: number, taskId: number, canReassign: boolean) {
  const t = await loadVisible(userId, taskId, canReassign);
  if (t.status !== "CLAIMED") throw new WorkflowError("این کار برداشته نشده است");
  if (t.claimedById !== userId && !canReassign) throw new WorkflowError("فقط کسی که کار را برداشته می‌تواند آن را رها کند");
  await prisma.workflowTask.update({ where: { id: taskId }, data: { status: "OPEN", claimedById: null, claimedAt: null } });
  await prisma.workflowTaskLog.create({ data: { taskId, userId, action: "RELEASED" } });
}

export async function reassignTask(actorId: number, taskId: number, toUserId: number) {
  const t = await prisma.workflowTask.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!t || (t.status !== "OPEN" && t.status !== "CLAIMED")) throw new WorkflowError("کار باز نیست");
  const u = await prisma.user.findUnique({ where: { id: toUserId }, select: { firstName: true, lastName: true, isActive: true } });
  if (!u || !u.isActive) throw new WorkflowError("کاربر مقصد یافت نشد یا غیرفعال است");
  await prisma.workflowTask.update({ where: { id: taskId }, data: { status: "CLAIMED", claimedById: toUserId, claimedAt: new Date() } });
  await prisma.workflowTaskLog.create({ data: { taskId, userId: actorId, action: "REASSIGNED", message: fullName(u) } });
}

export async function addAttachment(userId: number, taskId: number, b: { fileName?: unknown; mimeType?: unknown; dataBase64?: unknown }) {
  const t = await loadVisible(userId, taskId, false);
  if (t.status !== "OPEN" && t.status !== "CLAIMED") throw new WorkflowError("کار بسته شده است و پیوست نمی‌پذیرد");
  const fileName = typeof b.fileName === "string" ? b.fileName.trim().slice(0, 200) : "";
  const mimeType = typeof b.mimeType === "string" ? b.mimeType.trim() : "";
  if (!fileName) throw new WorkflowError("نام فایل الزامی است");
  if (!MIME_OK(mimeType)) throw new WorkflowError("فقط تصویر یا PDF پذیرفته می‌شود");
  const raw = typeof b.dataBase64 === "string" ? b.dataBase64.replace(/^data:[^;]*;base64,/, "") : "";
  const data = Buffer.from(raw, "base64");
  if (data.length === 0) throw new WorkflowError("فایل خالی است");
  if (data.length > MAX_ATTACHMENT_BYTES) throw new WorkflowError("حجم فایل بیش از ۵ مگابایت است");
  const a = await prisma.workflowAttachment.create({ data: { taskId, fileName, mimeType, size: data.length, data, uploadedById: userId } });
  await prisma.workflowTaskLog.create({ data: { taskId, userId, action: "ATTACHED", message: fileName } });
  return { id: a.id };
}

export async function getAttachment(userId: number, attachmentId: number, canSeeAll: boolean) {
  const a = await prisma.workflowAttachment.findUnique({ where: { id: attachmentId } });
  if (!a) throw new WorkflowError("پیوست یافت نشد");
  await loadVisible(userId, a.taskId, canSeeAll);
  return a;
}

export async function deleteAttachment(userId: number, attachmentId: number) {
  const a = await prisma.workflowAttachment.findUnique({ where: { id: attachmentId }, include: { task: { select: { status: true } } } });
  if (!a) throw new WorkflowError("پیوست یافت نشد");
  if (a.uploadedById !== userId) throw new WorkflowError("فقط بارگذارنده می‌تواند پیوست را حذف کند");
  if (a.task.status !== "OPEN" && a.task.status !== "CLAIMED") throw new WorkflowError("کار بسته شده است");
  await prisma.workflowAttachment.delete({ where: { id: attachmentId } });
}

/** «انجام شد» برای مرحله‌ی دستی: توضیح و حداقل یک مدرک اجباری است */
export async function completeManual(userId: number, taskId: number, note: unknown) {
  const t = await loadVisible(userId, taskId, false);
  if (t.step.completion !== "MANUAL") throw new WorkflowError("این مرحله با ثبت سند خودکار بسته می‌شود");
  if (t.status !== "OPEN" && t.status !== "CLAIMED") throw new WorkflowError("کار قبلاً بسته شده است");
  if (t.status === "CLAIMED" && t.claimedById !== userId) throw new WorkflowError("این کار را کاربر دیگری برداشته است");
  const text = typeof note === "string" ? note.trim() : "";
  if (t.step.requireNote && !text) throw new WorkflowError("توضیح الزامی است");
  if (t.step.requireAttachment && (await prisma.workflowAttachment.count({ where: { taskId } })) === 0) throw new WorkflowError("حداقل یک مدرک (پیوست) الزامی است");
  await prisma.$transaction(async (tx) => {
    // قفل هر ریشه‌ی پیش‌فاکتور؛ شاخه‌ی حواله زیر قفل پیش‌فاکتور والدش کار می‌کند (همان کلیدی که رویدادها می‌گیرند)
    const lockRoot = t.instance.parentInstanceId ? (await tx.workflowInstance.findUnique({ where: { id: t.instance.parentInstanceId }, select: { rootId: true } }))?.rootId ?? t.instance.rootId : t.instance.rootId;
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100010, ${Number(lockRoot)})`);
    const fresh = await tx.workflowTask.findUnique({ where: { id: taskId }, select: { status: true } });
    if (!fresh || (fresh.status !== "OPEN" && fresh.status !== "CLAIMED")) throw new WorkflowError("کار قبلاً بسته شده است");
    await tx.workflowTask.update({ where: { id: taskId }, data: { claimedById: t.claimedById ?? userId, claimedAt: t.claimedBy ? undefined : new Date() } });
    await completeTask(tx, taskId, { userId, kind: "MANUAL", note: text || null });
  });
}

/** شمارنده‌ها (نوار بالا و «کارهای من») */
export async function summaryCounts(userId: number) {
  await processDeadlines(true).catch(() => {});
  const roleIds = await roleIdsOf(userId);
  const active = { status: { in: ["OPEN", "CLAIMED"] as ("OPEN" | "CLAIMED")[] } };
  const [open, overdue, unread] = await Promise.all([
    prisma.workflowTask.count({ where: { ...active, AND: [visibleWhere(userId, roleIds)], OR: [{ claimedById: null }, { claimedById: userId }] } }),
    prisma.workflowTask.count({ where: { ...active, dueAt: { lt: new Date() }, AND: [visibleWhere(userId, roleIds)] } }),
    prisma.workflowNotification.count({ where: { userId, readAt: null } }),
  ]);
  return { open, overdue, unread };
}

export async function listNotifications(userId: number) {
  const rows = await prisma.workflowNotification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map((n) => ({ id: n.id, taskId: n.taskId, kind: n.kind, message: n.message, createdAt: iso(n.createdAt), read: !!n.readAt }));
}

export async function markNotificationsRead(userId: number) {
  await prisma.workflowNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
