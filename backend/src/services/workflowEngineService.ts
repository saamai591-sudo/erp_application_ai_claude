import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { EVENT_BY_KEY, conditionOk, docNumberOf, loadRoot, resolveRoots, type RootType } from "./workflowEvents";

// موتور کارتابل/گردش کار (تنها نویسنده‌ی WorkflowInstance/Task/InstanceEvent/Log/Notification). طراحی: Documents/WorkflowInbox.md
//  • emitWorkflowEvent(eventKey, docId): بعد از انجام موفق کارِ سند اعلام می‌شود؛ خطا هرگز کارِ اصلی را خراب نمی‌کند (فقط لاگ می‌شود).
//  • رویداد شروع ⇒ نمونه (Instance) برای سندِ ریشه + کارِ اولین مرحله؛ مرحله‌ها به‌ترتیب فعال می‌شوند (شرط ورود برقرار نباشد ⇒ رد می‌شود).
//  • مرحله‌ی «خودکار» با رویدادِ مرتبط بسته می‌شود؛ رویدادی که قبل از فعال‌شدن مرحله رخ داده فوراً آن را می‌بندد (WorkflowInstanceEvent).
//  • مرحله‌ی «دستی» فقط با completeManual (توضیح + مدرک) بسته می‌شود (workflowTaskService).
//  • مهلت/یادآوری/تشدید: processDeadlines (کار زمان‌بندی‌شده + اجرای دوره‌ایِ سبک هنگام خواندن شمارنده).

const LOCK_KEY = 7100010;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function emitWorkflowEvent(eventKey: string, docId: number): Promise<void> {
  try {
    await handleEvent(eventKey, docId);
  } catch (e) {
    console.error(`[workflow] خطا در پردازش رویداد ${eventKey} (سند ${docId})`, e);
  }
}

async function handleEvent(eventKey: string, docId: number) {
  const def = EVENT_BY_KEY.get(eventKey);
  if (!def) return;
  const roots = await resolveRoots(eventKey, docId);
  if (roots.length === 0) return;
  const { docType, docNumber } = await docNumberOf(eventKey, docId);
  const actorId = getRequestContext()?.userId ?? null;
  for (const rootId of roots) {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${Number(rootId)})`);
        if (def.canStart) await startInstances(tx, def.rootType, rootId, eventKey, docType, docId, docNumber, actorId);
        const instances = await tx.workflowInstance.findMany({ where: { rootType: def.rootType, rootId, status: "RUNNING" }, select: { id: true } });
        for (const inst of instances) {
          if (def.cancels) {
            await cancelInstance(tx, inst.id, actorId, "تایید پیش‌فاکتور برگشت خورد");
            continue;
          }
          await tx.workflowInstanceEvent.createMany({ data: [{ instanceId: inst.id, eventType: eventKey, docType, docId, docNumber }], skipDuplicates: true });
          const tasks = await tx.workflowTask.findMany({
            where: { instanceId: inst.id, status: { in: ["OPEN", "CLAIMED"] }, step: { completion: "EVENT", completionEvent: eventKey } },
            select: { id: true },
          });
          for (const t of tasks) await completeTask(tx, t.id, { userId: actorId, kind: "EVENT", eventRef: `${docType}:${docNumber ?? docId}` });
        }
      },
      { timeout: 30000 }
    );
  }
}

async function startInstances(tx: Tx, rootType: RootType, rootId: number, eventKey: string, docType: string, docId: number, docNumber: number | null, actorId: number | null) {
  const processes = await tx.workflowProcess.findMany({
    where: { isActive: true, rootType, startEvent: eventKey },
    include: { versions: { where: { isCurrent: true }, include: { steps: { orderBy: { seq: "asc" } } } } },
  });
  if (processes.length === 0) return;
  const root = await loadRoot(rootType, rootId);
  if (!root) return;
  for (const p of processes) {
    const v = p.versions[0];
    if (!v || v.steps.length === 0) continue;
    if (!conditionOk(p.startCondition, root.context)) continue;
    const prev = await tx.workflowInstance.findUnique({ where: { processId_rootType_rootId: { processId: p.id, rootType, rootId } }, select: { id: true, status: true } });
    // نمونه‌ی لغوشده (تایید برگشت خورد) با تایید دوباره از نو شروع می‌شود؛ نمونه‌ی در جریان/انجام‌شده تکرار نمی‌شود
    if (prev && prev.status !== "CANCELLED") continue;
    if (prev) await tx.workflowInstance.delete({ where: { id: prev.id } });
    const inst = await tx.workflowInstance.create({
      data: { processId: p.id, versionId: v.id, rootType, rootId, rootNumber: root.number, rootTitle: root.title, creatorUserId: root.creatorUserId, context: root.context as any },
    });
    await tx.workflowInstanceEvent.create({ data: { instanceId: inst.id, eventType: eventKey, docType, docId, docNumber } });
    await activateFrom(tx, inst.id, 0, actorId);
  }
}

/** مرحله‌ی بعدیِ بعد از seq را فعال می‌کند؛ مرحله‌ی خودکارِ از قبل‌برقرار فوراً بسته می‌شود و ادامه می‌دهد؛ بدون مرحله‌ی دیگر ⇒ نمونه انجام‌شده */
async function activateFrom(tx: Tx, instanceId: number, afterSeq: number, actorId: number | null) {
  const inst = await tx.workflowInstance.findUnique({ where: { id: instanceId }, include: { events: true } });
  if (!inst || inst.status !== "RUNNING") return;
  const steps = await tx.workflowStep.findMany({ where: { versionId: inst.versionId, seq: { gt: afterSeq } }, orderBy: { seq: "asc" } });
  const now = new Date();
  for (const step of steps) {
    if (await tx.workflowTask.findUnique({ where: { instanceId_stepId: { instanceId, stepId: step.id } }, select: { id: true } })) continue;
    if (!conditionOk(step.entryCondition, inst.context as Record<string, unknown>)) {
      const t = await tx.workflowTask.create({ data: { instanceId, stepId: step.id, seq: step.seq, status: "SKIPPED", completedAt: now, completionKind: "SKIPPED" } });
      await tx.workflowTaskLog.create({ data: { taskId: t.id, action: "SKIPPED", message: "شرط ورود به مرحله برقرار نبود" } });
      continue;
    }
    const task = await tx.workflowTask.create({
      data: {
        instanceId,
        stepId: step.id,
        seq: step.seq,
        dueAt: step.deadlineHours ? new Date(now.getTime() + step.deadlineHours * 3600_000) : null,
        reminderAt: step.reminderHours ? new Date(now.getTime() + step.reminderHours * 3600_000) : null,
      },
    });
    await tx.workflowTaskLog.create({ data: { taskId: task.id, userId: actorId, action: "CREATED", message: step.title } });
    if (step.completion === "EVENT" && step.completionEvent) {
      const ev = inst.events.find((e) => e.eventType === step.completionEvent);
      if (ev) {
        await finishTask(tx, task.id, { userId: actorId, kind: "EVENT", eventRef: `${ev.docType}:${ev.docNumber ?? ev.docId}` });
        continue; // مرحله‌ی بعد
      }
    }
    return; // منتظر این کار
  }
  await tx.workflowInstance.update({ where: { id: instanceId }, data: { status: "DONE", finishedAt: now } });
}

async function finishTask(tx: Tx, taskId: number, p: { userId: number | null; kind: "MANUAL" | "EVENT"; note?: string | null; eventRef?: string | null }) {
  await tx.workflowTask.update({
    where: { id: taskId },
    data: { status: "DONE", completedAt: new Date(), completedById: p.userId, completionKind: p.kind, note: p.note ?? null, eventRef: p.eventRef ?? null },
  });
  await tx.workflowTaskLog.create({ data: { taskId, userId: p.userId, action: p.kind === "EVENT" ? "DONE_BY_EVENT" : "DONE", message: p.kind === "EVENT" ? p.eventRef ?? null : p.note ?? null } });
}

/** کار را می‌بندد و مرحله‌ی بعد را فعال می‌کند */
export async function completeTask(tx: Tx, taskId: number, p: { userId: number | null; kind: "MANUAL" | "EVENT"; note?: string | null; eventRef?: string | null }) {
  const t = await tx.workflowTask.findUnique({ where: { id: taskId }, select: { instanceId: true, seq: true, status: true } });
  if (!t || (t.status !== "OPEN" && t.status !== "CLAIMED")) return;
  await finishTask(tx, taskId, p);
  await activateFrom(tx, t.instanceId, t.seq, p.userId);
}

export async function cancelInstance(tx: Tx, instanceId: number, actorId: number | null, reason: string) {
  const open = await tx.workflowTask.findMany({ where: { instanceId, status: { in: ["OPEN", "CLAIMED"] } }, select: { id: true } });
  const now = new Date();
  for (const t of open) {
    await tx.workflowTask.update({ where: { id: t.id }, data: { status: "CANCELLED", completedAt: now, completionKind: "CANCELLED" } });
    await tx.workflowTaskLog.create({ data: { taskId: t.id, userId: actorId, action: "CANCELLED", message: reason } });
  }
  await tx.workflowInstance.update({ where: { id: instanceId }, data: { status: "CANCELLED", finishedAt: now } });
}

/** کاربران فعالِ مسئول یک مرحله (کاربر ثابت + اعضای نقش + ثبت‌کننده‌ی سند) */
export async function stepUserIds(stepId: number, creatorUserId: number | null): Promise<number[]> {
  const as = await prisma.workflowStepAssignee.findMany({ where: { stepId }, select: { kind: true, userId: true, roleId: true } });
  const ids = new Set<number>();
  const roleIds: number[] = [];
  for (const a of as) {
    if (a.kind === "USER" && a.userId) ids.add(a.userId);
    else if (a.kind === "ROLE" && a.roleId) roleIds.push(a.roleId);
    else if (a.kind === "CREATOR" && creatorUserId) ids.add(creatorUserId);
  }
  if (roleIds.length) for (const ur of await prisma.userRole.findMany({ where: { roleId: { in: roleIds } }, select: { userId: true } })) ids.add(ur.userId);
  if (ids.size === 0) return [];
  const active = await prisma.user.findMany({ where: { id: { in: [...ids] }, isActive: true }, select: { id: true } });
  return active.map((u) => u.id);
}

async function escalationUserIds(step: { escalateUserId: number | null; escalateRoleId: number | null }): Promise<number[]> {
  const ids = new Set<number>();
  if (step.escalateUserId) ids.add(step.escalateUserId);
  if (step.escalateRoleId) for (const ur of await prisma.userRole.findMany({ where: { roleId: step.escalateRoleId }, select: { userId: true } })) ids.add(ur.userId);
  if (ids.size === 0) return [];
  return (await prisma.user.findMany({ where: { id: { in: [...ids] }, isActive: true }, select: { id: true } })).map((u) => u.id);
}

let lastDeadlineRun = 0;

/** یادآوری و تشدیدِ کارهای باز (idempotent؛ هر اطلاعیه فقط یک‌بار). throttled=true ⇒ حداکثر هر ۶۰ ثانیه */
export async function processDeadlines(throttled = false): Promise<{ reminders: number; escalations: number }> {
  if (throttled && Date.now() - lastDeadlineRun < 60_000) return { reminders: 0, escalations: 0 };
  lastDeadlineRun = Date.now();
  const now = new Date();
  let reminders = 0, escalations = 0;
  const open = { status: { in: ["OPEN", "CLAIMED"] as ("OPEN" | "CLAIMED")[] } };
  const due = await prisma.workflowTask.findMany({
    where: { ...open, reminderAt: { lte: now }, reminderSentAt: null },
    include: { step: true, instance: { select: { rootTitle: true, creatorUserId: true } } },
  });
  for (const t of due) {
    const users = await stepUserIds(t.stepId, t.instance.creatorUserId);
    await prisma.$transaction([
      prisma.workflowTask.update({ where: { id: t.id }, data: { reminderSentAt: now } }),
      prisma.workflowNotification.createMany({ data: users.map((userId) => ({ userId, taskId: t.id, kind: "REMINDER" as const, message: `یادآوری: «${t.step.title}» — ${t.instance.rootTitle}` })) }),
    ]);
    reminders++;
  }
  const late = await prisma.workflowTask.findMany({
    where: { ...open, dueAt: { lte: now }, overdueNotifiedAt: null },
    include: { step: true, instance: { select: { rootTitle: true, creatorUserId: true } } },
  });
  for (const t of late) {
    const users = new Set(await stepUserIds(t.stepId, t.instance.creatorUserId));
    const esc = (await escalationUserIds(t.step)).filter((u) => !users.has(u));
    await prisma.$transaction([
      prisma.workflowTask.update({ where: { id: t.id }, data: { overdueNotifiedAt: now } }),
      prisma.workflowTaskLog.create({ data: { taskId: t.id, action: "OVERDUE", message: "مهلت کار گذشت" } }),
      prisma.workflowNotification.createMany({
        data: [
          ...[...users].map((userId) => ({ userId, taskId: t.id, kind: "OVERDUE" as const, message: `مهلت گذشت: «${t.step.title}» — ${t.instance.rootTitle}` })),
          ...esc.map((userId) => ({ userId, taskId: t.id, kind: "ESCALATED" as const, message: `تشدید: «${t.step.title}» — ${t.instance.rootTitle} در مهلت انجام نشد` })),
        ],
      }),
    ]);
    escalations++;
  }
  return { reminders, escalations };
}
