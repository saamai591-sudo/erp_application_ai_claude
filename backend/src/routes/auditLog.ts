import { Router } from "express";
import { Prisma } from "@prisma/client";
import { rawPrisma } from "../lib/rawPrisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AUDITED_MODELS, getAuditConfig } from "../services/auditService";

// «مرور لاگ تغییرات» (تنظیمات › گزارش) و «تاریخچه‌ی رکورد» داخل فرم‌ها. فقط خواندن؛ داده در schema جدای audit (services/auditService.ts).
// مجوز: فرم audit-log (requiresFeature AUDIT_LOG ⇒ بدون مجوز لایسنس منو و کلید دسترسی هم نیست) + کنترل صریحِ لایسنس همین‌جا.

const FORM = findFormPrefix("audit-log");
const router = Router();

const TEHRAN = "+03:30";
const dayStart = (iso: string) => new Date(`${iso}T00:00:00${TEHRAN}`);
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

async function requireLicensed(res: any): Promise<boolean> {
  const cfg = await getAuditConfig();
  if (!cfg.licensed) {
    res.status(403).json({ error: "لایسنس این نصب «لاگ تغییرات» ندارد", code: "FEATURE_NOT_LICENSED" });
    return false;
  }
  return true;
}

interface EventRow {
  id: bigint;
  at: Date;
  userId: number | null;
  userName: string | null;
  kind: string;
  action: string;
  model: string | null;
  recordId: string | null;
  summary: string | null;
  changes: Record<string, [unknown, unknown]> | null;
  ip: string | null;
}
const shape = (r: EventRow) => ({
  id: Number(r.id),
  at: r.at.toISOString(),
  userId: r.userId,
  userName: r.userName,
  kind: r.kind,
  action: r.action,
  model: r.model,
  modelTitle: r.model ? AUDITED_MODELS[r.model] ?? r.model : null,
  recordId: r.recordId,
  summary: r.summary,
  changes: r.changes,
  ip: r.ip,
});
const COLS = Prisma.sql`id, at, "userId", "userName", kind, action, model, "recordId", summary, changes, ip`;

// فهرست صفحه‌بندی‌شده با فیلترهای هدر
router.get("/audit-log", can(`${FORM}.view`), async (req, res) => {
  try {
    if (!(await requireLicensed(res))) return;
    const q = req.query as Record<string, string | undefined>;
    const conds: Prisma.Sql[] = [];
    if (q.from && ISO_DAY.test(q.from)) conds.push(Prisma.sql`at >= ${dayStart(q.from)}`);
    if (q.to && ISO_DAY.test(q.to)) conds.push(Prisma.sql`at < ${new Date(dayStart(q.to).getTime() + 86_400_000)}`);
    if (q.userId && Number.isInteger(Number(q.userId))) conds.push(Prisma.sql`"userId" = ${Number(q.userId)}`);
    if (q.model) conds.push(Prisma.sql`model = ${q.model}`);
    if (q.action) conds.push(Prisma.sql`action = ${q.action}`);
    if (q.kind === "CHANGE" || q.kind === "EVENT" || q.kind === "AUTH") conds.push(Prisma.sql`kind = ${q.kind}`);
    if (q.recordId?.trim()) conds.push(Prisma.sql`"recordId" = ${q.recordId.trim()}`);
    const text = q.q?.trim();
    if (text) {
      const like = `%${text.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
      conds.push(Prisma.sql`(summary ILIKE ${like} OR "userName" ILIKE ${like})`);
    }
    const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
    const pageSize = Math.min(Math.max(Math.floor(Number(q.pageSize)) || 50, 10), 200);
    const page = Math.max(Math.floor(Number(q.page)) || 1, 1);
    const [cnt, rows] = await Promise.all([
      rawPrisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM audit.event ${where}`,
      rawPrisma.$queryRaw<EventRow[]>`SELECT ${COLS} FROM audit.event ${where} ORDER BY at DESC, id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    ]);
    const total = Number(cnt[0]?.n ?? 0);
    res.json({ rows: rows.map(shape), total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در خواندن لاگ" });
  }
});

// گزینه‌های فیلتر: کاربرانی که رویداد دارند، مدل‌های لاگ‌شونده و عمل‌های ثبت‌شده
router.get("/audit-log/options", can(`${FORM}.view`), async (_req, res) => {
  try {
    if (!(await requireLicensed(res))) return;
    const [users, actions] = await Promise.all([
      rawPrisma.$queryRaw<{ userId: number; userName: string | null }[]>`SELECT DISTINCT ON ("userId") "userId", "userName" FROM audit.event WHERE "userId" IS NOT NULL ORDER BY "userId", at DESC LIMIT 500`,
      rawPrisma.$queryRaw<{ action: string }[]>`SELECT DISTINCT action FROM audit.event ORDER BY action`,
    ]);
    res.json({
      users: users.map((u) => ({ id: u.userId, name: u.userName || `کاربر ${u.userId}` })).sort((a, b) => a.name.localeCompare(b.name, "fa")),
      models: Object.entries(AUDITED_MODELS).map(([model, title]) => ({ model, title })).sort((a, b) => a.title.localeCompare(b.title, "fa")),
      actions: actions.map((a) => a.action),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در خواندن گزینه‌ها" });
  }
});

// تاریخچه‌ی یک رکورد (برای دکمه‌ی «تاریخچه» در فرم‌ها)
router.get("/audit-log/record", can(`${FORM}.view`), async (req, res) => {
  try {
    if (!(await requireLicensed(res))) return;
    const model = String(req.query.model ?? "");
    const recordId = String(req.query.recordId ?? "");
    if (!AUDITED_MODELS[model] || !/^\d{1,12}$/.test(recordId)) return res.status(400).json({ error: "رکورد نامعتبر است" });
    const rows = await rawPrisma.$queryRaw<EventRow[]>`SELECT ${COLS} FROM audit.event WHERE model = ${model} AND "recordId" = ${recordId} ORDER BY at DESC, id DESC LIMIT 200`;
    res.json({ modelTitle: AUDITED_MODELS[model], rows: rows.map(shape) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "خطا در خواندن تاریخچه" });
  }
});

export default router;
