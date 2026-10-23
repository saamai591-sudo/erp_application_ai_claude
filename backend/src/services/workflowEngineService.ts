import { prisma } from "../lib/prisma";
import { getRequestContext } from "../lib/requestContext";
import { EVENT_BY_KEY, conditionOk, deliveryDocsOf, docNumberOf, loadRoot, quoteDeliveryProgress, resolveRoots, type RootType } from "./workflowEvents";

// موتور کارتابل/گردش کار (تنها نویسنده‌ی WorkflowInstance/Task/InstanceEvent/Log/Notification). طراحی: Documents/WorkflowInbox.md
//  • emitWorkflowEvent(eventKey, docId): بعد از انجام موفق کارِ سند اعلام می‌شود؛ خطا هرگز کارِ اصلی را خراب نمی‌کند (فقط لاگ می‌شود).
//  • رویداد شروع ⇒ نمونه (Instance) برای سندِ ریشه + کارِ اولین مرحله؛ مرحله‌ها به‌ترتیب فعال می‌شوند (شرط ورود برقرار نباشد ⇒ رد می‌شود).
//  • مرحله‌ی «خودکار» با رویدادِ مرتبط بسته می‌شود؛ رویدادی که قبل از فعال‌شدن مرحله رخ داده فوراً آن را می‌بندد (WorkflowInstanceEvent).
//  • مرحله‌ی «هر رویداد یک شاخه» (branchPerEvent، مثلاً ثبت حواله): با اولین رویداد بسته نمی‌شود؛ برای هر سندِ رویداد (هر حواله) یک نمونه‌ی شاخه
//    (parentInstanceId، ریشه = خودِ حواله) برای مرحله‌های بعدی ساخته می‌شود. خودِ مرحله تا کامل‌شدن حواله‌ی پیش‌فاکتور یا بستن پیگیری آن باز می‌ماند
//    و نمونه‌ی والد فقط تا همین مرحله می‌رود. برگشت از فروش مسیر جداست و روی این فرایند اثری ندارد.
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
  const deliveries = await deliveryDocsOf(eventKey, docId);
  const actorId = getRequestContext()?.userId ?? null;
  for (const rootId of roots) {
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${Number(rootId)})`);
        if (def.canStart) await startInstances(tx, def.rootType, rootId, eventKey, docType, docId, docNumber, actorId);
        // بازگشایی پیگیری: فرایندِ لغوشده‌ی پیش‌فاکتورِ تاییدشده از اول شروع می‌شود (نمونه‌ی تمام‌شده/در جریان دست نمی‌خورد)
        if (def.restarts) {
          await startInstances(tx, def.rootType, rootId, "SALES_QUOTE_APPROVED", docType, docId, docNumber, actorId, true);
          return;
        }
        const instances = await tx.workflowInstance.findMany({ where: { rootType: def.rootType, rootId, status: "RUNNING" }, select: { id: true } });
        for (const inst of instances) {
          if (def.cancels) {
            await cancelInstance(tx, inst.id, actorId, "تایید پیش‌فاکتور برگشت خورد");
            continue;
          }
          if (def.closesRepeat) {
            // پیگیری پیش‌فاکتور بسته شد (مشتری منصرف شد). چیزی حواله نشده ⇒ کل فرایند و همه‌ی کارهای بازش لغو می‌شود و به مسئولان اطلاعیه می‌رود؛
            // اگر بخشی حواله شده ⇒ فقط پیگیریِ حواله‌ی باقی‌مانده (مرحله‌ی «هر رویداد یک شاخه») بسته می‌شود و مسیر حواله‌های ثبت‌شده ادامه دارد
            const delivered = (await tx.workflowInstanceEvent.count({ where: { instanceId: inst.id, eventType: "SALES_DELIVERY_REGISTERED" } })) > 0 || (await tx.workflowInstance.count({ where: { parentInstanceId: inst.id } })) > 0;
            if (!delivered) {
              const q = await tx.salesQuote.findUnique({ where: { id: rootId }, select: { followUpNote: true, followUpReason: { select: { title: true } } } });
              const why = [q?.followUpReason?.title, q?.followUpNote].filter(Boolean).join(" — ") || "بدون دلیل ثبت‌شده";
              const hasReceipt = (await tx.workflowInstanceEvent.count({ where: { instanceId: inst.id, eventType: "RECEIPT_APPROVED" } })) > 0;
              await cancelInstance(tx, inst.id, actorId, `مشتری منصرف شد: ${why}`, `پیش‌فاکتور ${docNumber ?? docId} بسته شد؛ مشتری منصرف شد (${why})${hasReceipt ? "؛ توجه: برای این پیش‌فاکتور دریافت ثبت شده است، برگشت وجه را بررسی کنید" : ""}`);
            } else {
              const repeat = await tx.workflowTask.findMany({ where: { instanceId: inst.id, status: { in: ["OPEN", "CLAIMED"] }, step: { branchPerEvent: true } }, select: { id: true } });
              for (const t of repeat) await completeTask(tx, t.id, { userId: actorId, kind: "EVENT", eventRef: `بستن پیگیری پیش‌فاکتور ${docNumber ?? docId}` });
            }
            continue;
          }
          await tx.workflowInstanceEvent.createMany({ data: [{ instanceId: inst.id, eventType: eventKey, docType, docId, docNumber }], skipDuplicates: true });
          const tasks = await tx.workflowTask.findMany({
            where: { instanceId: inst.id, status: { in: ["OPEN", "CLAIMED"] }, step: { completion: "EVENT", completionEvent: eventKey } },
            select: { id: true, seq: true, step: { select: { branchPerEvent: true } } },
          });
          for (const t of tasks) {
            if (t.step.branchPerEvent) {
              // اولین رویداد مرحله را نمی‌بندد: برای این سند شاخه می‌سازد؛ مرحله فقط با کامل‌شدن حواله‌ی پیش‌فاکتور بسته می‌شود
              if (def.canBranch) await ensureBranch(tx, inst.id, t.seq, docId, docNumber, actorId);
              if ((await quoteDeliveryProgress(rootId)).complete) await completeTask(tx, t.id, { userId: actorId, kind: "EVENT", eventRef: "حواله‌ی کامل پیش‌فاکتور" });
            } else await completeTask(tx, t.id, { userId: actorId, kind: "EVENT", eventRef: `${docType}:${docNumber ?? docId}` });
          }
        }
        // رویدادِ فاکتور/ارسال مودیان ← شاخه‌های همان حواله‌ها (حتی وقتی نمونه‌ی والد تمام شده است)
        if (deliveries.length && !def.canBranch && !def.cancels && !def.closesRepeat) {
          const branches = await tx.workflowInstance.findMany({ where: { rootType: "SALES_DELIVERY", rootId: { in: deliveries }, status: "RUNNING", parent: { is: { rootType: def.rootType, rootId } } }, select: { id: true } });
          for (const b of branches) {
            await tx.workflowInstanceEvent.createMany({ data: [{ instanceId: b.id, eventType: eventKey, docType, docId, docNumber }], skipDuplicates: true });
            const bt = await tx.workflowTask.findMany({ where: { instanceId: b.id, status: { in: ["OPEN", "CLAIMED"] }, step: { completion: "EVENT", completionEvent: eventKey } }, select: { id: true } });
            for (const t of bt) await completeTask(tx, t.id, { userId: actorId, kind: "EVENT", eventRef: `${docType}:${docNumber ?? docId}` });
          }
        }
      },
      { timeout: 30000 }
    );
  }
}

async function startInstances(tx: Tx, rootType: RootType, rootId: number, eventKey: string, docType: string, docId: number, docNumber: number | null, actorId: number | null, requireApproved = false) {
  const processes = await tx.workflowProcess.findMany({
    where: { isActive: true, rootType, startEvent: eventKey },
    include: { versions: { where: { isCurrent: true }, include: { steps: { orderBy: { seq: "asc" } } } } },
  });
  if (processes.length === 0) return;
  const root = await loadRoot(rootType, rootId);
  if (!root) return;
  if (requireApproved && root.status !== "APPROVED") return;
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
  // نمونه‌ی والد (غیرشاخه) فقط تا مرحله‌ی «هر رویداد یک شاخه» می‌رود؛ مرحله‌های بعد را شاخه‌ها اجرا می‌کنند
  const branchStep = inst.parentInstanceId ? null : await tx.workflowStep.findFirst({ where: { versionId: inst.versionId, branchPerEvent: true }, select: { seq: true } });
  const now = new Date();
  for (const step of steps) {
    if (branchStep && step.seq > branchStep.seq) break;
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
    if (step.branchPerEvent && step.completion === "EVENT" && step.completionEvent) {
      // رویدادهای قبل‌رخ‌داده (مثلاً حواله‌هایی که پیش از رسیدن به این مرحله ثبت شده‌اند) هر کدام شاخه‌ی خود را می‌سازند
      for (const e of inst.events.filter((x) => x.eventType === step.completionEvent)) await ensureBranch(tx, inst.id, step.seq, e.docId, e.docNumber, actorId);
      if ((await quoteDeliveryProgress(inst.rootId)).complete) {
        await finishTask(tx, task.id, { userId: actorId, kind: "EVENT", eventRef: "حواله‌ی کامل پیش‌فاکتور" });
        continue;
      }
      return; // مرحله باز می‌ماند
    }
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

/** شاخه‌ی یک حواله: نمونه‌ی فرزند با ریشه‌ی خودِ حواله که مرحله‌های بعد از مرحله‌ی «هر رویداد یک شاخه» را اجرا می‌کند (تکراری ساخته نمی‌شود) */
async function ensureBranch(tx: Tx, parentId: number, branchSeq: number, docId: number, docNumber: number | null, actorId: number | null) {
  const parent = await tx.workflowInstance.findUnique({ where: { id: parentId }, include: { events: true } });
  if (!parent) return;
  const exists = await tx.workflowInstance.findUnique({ where: { processId_rootType_rootId: { processId: parent.processId, rootType: "SALES_DELIVERY", rootId: docId } }, select: { id: true } });
  if (exists) return;
  const branch = await tx.workflowInstance.create({
    data: {
      processId: parent.processId,
      versionId: parent.versionId,
      rootType: "SALES_DELIVERY",
      rootId: docId,
      rootNumber: docNumber,
      rootTitle: `حواله فروش ${docNumber ?? docId} — ${parent.rootTitle}`,
      creatorUserId: parent.creatorUserId,
      context: parent.context as any,
      parentInstanceId: parent.id,
    },
  });
  await tx.workflowInstanceEvent.create({ data: { instanceId: branch.id, eventType: "SALES_DELIVERY_REGISTERED", docType: "SALES_DELIVERY", docId, docNumber } });
  // فاکتور/ارسال مودیانی که پیش از ساخت شاخه برای والد ثبت شده و به همین حواله مربوط است، برای شاخه هم به‌یاد می‌ماند
  for (const e of parent.events.filter((x) => x.docType === "SALES_INVOICE")) {
    if ((await deliveryDocsOf(e.eventType, e.docId)).includes(docId)) {
      await tx.workflowInstanceEvent.createMany({ data: [{ instanceId: branch.id, eventType: e.eventType, docType: e.docType, docId: e.docId, docNumber: e.docNumber }], skipDuplicates: true });
    }
  }
  await activateFrom(tx, branch.id, branchSeq, actorId);
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

/** notifyText: اگر داده شود به مسئولان (و برداشتنده‌ی) هر کار بازِ لغوشده اطلاعیه‌ی «کار لغو شد» می‌رود */
export async function cancelInstance(tx: Tx, instanceId: number, actorId: number | null, reason: string, notifyText?: string) {
  const open = await tx.workflowTask.findMany({ where: { instanceId, status: { in: ["OPEN", "CLAIMED"] } }, select: { id: true, stepId: true, claimedById: true, step: { select: { title: true } } } });
  const creator = notifyText ? (await tx.workflowInstance.findUnique({ where: { id: instanceId }, select: { creatorUserId: true } }))?.creatorUserId ?? null : null;
  const now = new Date();
  for (const t of open) {
    await tx.workflowTask.update({ where: { id: t.id }, data: { status: "CANCELLED", completedAt: now, completionKind: "CANCELLED" } });
    await tx.workflowTaskLog.create({ data: { taskId: t.id, userId: actorId, action: "CANCELLED", message: reason } });
    if (notifyText) {
      const users = new Set(await stepUserIds(t.stepId, creator));
      if (t.claimedById) users.add(t.claimedById);
      if (users.size) await tx.workflowNotification.createMany({ data: [...users].map((userId) => ({ userId, taskId: t.id, kind: "CANCELLED" as const, message: `کار «${t.step.title}» لغو شد — ${notifyText}` })) });
    }
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
export interface DeadlineItem {
  taskId: number;
  kind: "REMINDER" | "OVERDUE";
  title: string;
  rootTitle: string;
  users: number;
}

/** dryRun=true: فقط می‌شمارد و چیزی نمی‌نویسد (حالت آزمایشی کار زمان‌بندی‌شده) */
export async function processDeadlines(throttled = false, dryRun = false): Promise<{ reminders: number; escalations: number; items: DeadlineItem[] }> {
  const items: DeadlineItem[] = [];
  if (throttled && Date.now() - lastDeadlineRun < 60_000) return { reminders: 0, escalations: 0, items };
  if (!dryRun) lastDeadlineRun = Date.now();
  const now = new Date();
  let reminders = 0, escalations = 0;
  const open = { status: { in: ["OPEN", "CLAIMED"] as ("OPEN" | "CLAIMED")[] } };
  const due = await prisma.workflowTask.findMany({
    where: { ...open, reminderAt: { lte: now }, reminderSentAt: null },
    include: { step: true, instance: { select: { rootTitle: true, creatorUserId: true } } },
  });
  for (const t of due) {
    const users = await stepUserIds(t.stepId, t.instance.creatorUserId);
    items.push({ taskId: t.id, kind: "REMINDER", title: t.step.title, rootTitle: t.instance.rootTitle, users: users.length });
    if (dryRun) { reminders++; continue; }
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
    items.push({ taskId: t.id, kind: "OVERDUE", title: t.step.title, rootTitle: t.instance.rootTitle, users: users.size + esc.length });
    if (dryRun) { escalations++; continue; }
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
  return { reminders, escalations, items };
}
