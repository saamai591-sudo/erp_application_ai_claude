import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";

// «نوع تضمین» (مدیریت خزانه › تنظیمات): نوع (دریافت/پرداخت)، کد خودکار (آخرین کد + ۱، هرگز از کلاینت نمی‌آید) و عنوان یکتا.
// فعلاً فقط تعریف پایه است؛ حذف فقط وقتی ممکن است که جایی استفاده نشده باشد (FK از «موارد استفاده» گزارش می‌شود).

const FORM = findFormPrefix("guarantee-types");
const router = Router();

function shape(r: any) {
  return { id: r.id, code: r.code, direction: r.direction, title: r.title, updatedAt: r.updatedAt };
}

function clean(body: any) {
  const direction = body?.direction;
  if (direction !== "RECEIPT" && direction !== "PAYMENT") throw new Error("نوع (دریافت/پرداخت) را انتخاب کنید");
  const title = typeof body?.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new Error("عنوان الزامی است");
  return { direction: direction as "RECEIPT" | "PAYMENT", title };
}

async function assertUniqueTitle(title: string, excludeId?: number) {
  if (await prisma.guaranteeType.findFirst({ where: { title, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } })) {
    throw new Error("عنوان تکراری است؛ نوع تضمین دیگری با همین عنوان وجود دارد");
  }
}

router.get("/", async (_req, res) => {
  res.json((await prisma.guaranteeType.findMany({ orderBy: { code: "asc" } })).map(shape));
});

router.get("/:id", async (req, res) => {
  const r = await prisma.guaranteeType.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) return res.status(404).json({ error: "نوع تضمین یافت نشد" });
  res.json(shape(r));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = clean(req.body);
    await assertUniqueTitle(d.title);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const last = await tx.guaranteeType.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
          return tx.guaranteeType.create({ data: { code: (last?.code ?? 0) + 1, ...d } });
        });
        return res.status(201).json(shape(created));
      } catch (e: any) {
        if (e?.code === "P2002" && attempt < 3 && String(e?.meta?.target ?? "").includes("code")) continue;
        throw e;
      }
    }
  } catch (e: any) {
    res.status(400).json({ error: e?.code === "P2002" ? "عنوان تکراری است" : e?.message || "خطا در ثبت نوع تضمین" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.guaranteeType.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "نوع تضمین یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع تضمین");
    const d = clean(req.body);
    await assertUniqueTitle(d.title, id);
    // کد هرگز تغییر نمی‌کند
    res.json(shape(await prisma.guaranteeType.update({ where: { id }, data: d })));
  } catch (e: any) {
    res.status(400).json({ error: e?.code === "P2002" ? "عنوان تکراری است" : e?.message || "خطا در ویرایش نوع تضمین" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.guaranteeType.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "نوع تضمین یافت نشد" });
    await prisma.guaranteeType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "خطا در حذف نوع تضمین" });
  }
});

export default router;
