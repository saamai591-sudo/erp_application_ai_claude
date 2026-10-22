import { Router } from "express";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import {
  WorkflowError,
  addAttachment,
  claimTask,
  completeManual,
  deleteAttachment,
  getAttachment,
  getTask,
  listNotifications,
  listTasks,
  markNotificationsRead,
  reassignTask,
  releaseTask,
  summaryCounts,
  type Scope,
} from "../services/workflowTaskService";

// کارتابل: کارهای من، جزئیات، برداشتن/رها کردن، پیوست، انجام شد، شمارنده و اطلاعیه‌ها + «همه‌ی کارها» (گزارش). قواعد: services/workflowTaskService.ts

const INBOX = findFormPrefix("my-tasks");
const ALL = findFormPrefix("workflow-all-tasks");
const router = Router();

const uid = (req: any) => (req as AuthedRequest).user!.id;
const fail = (res: any, e: any, fallback: string) => {
  if (e instanceof WorkflowError) return res.status(400).json({ error: e.message });
  return res.status(400).json({ error: e?.message || fallback });
};
const canAll = (req: any) => userHasAction(uid(req), `${ALL}.view`);

// شمارنده‌ی نوار بالا (هر کاربرِ وارد‌شده؛ بدون مجوز فرم)
router.get("/workflow/summary", async (req, res) => {
  try {
    res.json(await summaryCounts(uid(req)));
  } catch (e) {
    fail(res, e, "خطا در خواندن شمارنده");
  }
});

router.get("/workflow/tasks", can(`${INBOX}.view`), async (req, res) => {
  try {
    const scope = (["mine", "claimed", "overdue", "done", "all"].includes(String(req.query.scope)) ? String(req.query.scope) : "mine") as Scope;
    res.json(await listTasks(uid(req), scope, await canAll(req)));
  } catch (e) {
    fail(res, e, "خطا در خواندن کارها");
  }
});

// گزارش «همه‌ی کارها» با مجوز جدا
router.get("/workflow/all-tasks", can(`${ALL}.view`), async (req, res) => {
  try {
    res.json(await listTasks(uid(req), "all", true));
  } catch (e) {
    fail(res, e, "خطا در خواندن کارها");
  }
});

router.get("/workflow/tasks/:id", can(`${INBOX}.view`), async (req, res) => {
  try {
    res.json(await getTask(uid(req), Number(req.params.id), await canAll(req)));
  } catch (e) {
    fail(res, e, "خطا در خواندن کار");
  }
});

router.post("/workflow/tasks/:id/claim", can(`${INBOX}.act`), async (req, res) => {
  try {
    await claimTask(uid(req), Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در برداشتن کار");
  }
});

router.post("/workflow/tasks/:id/release", can(`${INBOX}.act`), async (req, res) => {
  try {
    await releaseTask(uid(req), Number(req.params.id), await userHasAction(uid(req), `${ALL}.reassign`));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در رها کردن کار");
  }
});

router.post("/workflow/tasks/:id/reassign", can(`${ALL}.reassign`), async (req, res) => {
  try {
    await reassignTask(uid(req), Number(req.params.id), Number(req.body?.userId));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در واگذاری کار");
  }
});

router.post("/workflow/tasks/:id/attachments", can(`${INBOX}.act`), async (req, res) => {
  try {
    res.status(201).json(await addAttachment(uid(req), Number(req.params.id), req.body ?? {}));
  } catch (e) {
    fail(res, e, "خطا در افزودن پیوست");
  }
});

router.get("/workflow/attachments/:id", can(`${INBOX}.view`), async (req, res) => {
  try {
    const a = await getAttachment(uid(req), Number(req.params.id), await canAll(req));
    res.setHeader("Content-Type", a.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(a.data));
  } catch (e) {
    fail(res, e, "خطا در خواندن پیوست");
  }
});

router.delete("/workflow/attachments/:id", can(`${INBOX}.act`), async (req, res) => {
  try {
    await deleteAttachment(uid(req), Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف پیوست");
  }
});

router.post("/workflow/tasks/:id/complete", can(`${INBOX}.act`), async (req, res) => {
  try {
    await completeManual(uid(req), Number(req.params.id), req.body?.note);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ثبت انجام کار");
  }
});

router.get("/workflow/notifications", async (req, res) => {
  res.json(await listNotifications(uid(req)));
});

router.post("/workflow/notifications/read", async (req, res) => {
  await markNotificationsRead(uid(req));
  res.json({ ok: true });
});

export default router;
