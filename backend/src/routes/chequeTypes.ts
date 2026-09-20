import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// =========================================================================
// ماژول «خزانه‌داری» > تنظیمات > «نوع چک دریافتی» و «نوع چک پرداختی» — طبق
// Documents/نوع چک دریافتی و پرداختی.md. هر دو: کد عددی (اگر کاربر وارد نکند، آخرین کد + ۱) و عنوان یکتا.
// «نوع چک پرداختی» گزینه‌ی «چک روز» (isSameDay) هم دارد. هر دو مستر در یک فایل ثبت می‌شوند چون رفتار
// یکسانی دارند و فقط فیلد اضافه‌ی isSameDay متفاوت است.
// =========================================================================

interface ChequeTypeDelegate {
  findMany(args: any): Promise<any[]>;
  findUnique(args: any): Promise<any>;
  findFirst(args: any): Promise<any>;
  create(args: any): Promise<any>;
  update(args: any): Promise<any>;
  delete(args: any): Promise<any>;
}

function registerChequeTypeRoutes(router: Router, opts: { path: string; formKey: string; delegate: ChequeTypeDelegate; label: string; hasSameDay: boolean }) {
  const { path, delegate, label, hasSameDay } = opts;
  const FORM = findFormPrefix(opts.formKey);

  router.get(`/${path}`, async (_req, res) => {
    res.json(await delegate.findMany({ orderBy: { code: "asc" } }));
  });

  router.post(`/${path}`, can(`${FORM}.create`), async (req, res) => {
    const body = req.body as { code?: number | null; title?: string; isSameDay?: boolean };
    const title = body.title?.trim();
    if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
    if (body.code != null && !(Number.isInteger(body.code) && body.code > 0)) {
      return res.status(400).json({ error: "کد باید عددی صحیح و مثبت باشد" });
    }
    try {
      if (await delegate.findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
      if (body.code != null && (await delegate.findUnique({ where: { code: body.code } }))) {
        return res.status(400).json({ error: "کد تکراری است" });
      }
      const code = body.code ?? (await nextSerialNumber(delegate as any, "code"));
      const created = await delegate.create({
        data: { code, title, ...(hasSameDay ? { isSameDay: !!body.isSameDay } : {}) },
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
      res.status(400).json({ error: e.message || `خطا در ثبت ${label}` });
    }
  });

  router.put(`/${path}/:id`, can(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as { title?: string; isSameDay?: boolean };
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${label} یافت نشد` });

    const title = body.title?.trim();
    if (body.title !== undefined && !title) return res.status(400).json({ error: "عنوان الزامی است" });
    try {
      if (title && (await delegate.findFirst({ where: { title, NOT: { id } } }))) {
        return res.status(400).json({ error: "عنوان تکراری است" });
      }
      const updated = await delegate.update({
        where: { id },
        data: { title, ...(hasSameDay && body.isSameDay !== undefined ? { isSameDay: !!body.isSameDay } : {}) },
      });
      res.json(updated);
    } catch (e: any) {
      if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
      res.status(400).json({ error: e.message || `خطا در ویرایش ${label}` });
    }
  });

  router.delete(`/${path}/:id`, can(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await delegate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${label} یافت نشد` });
    try {
      await delegate.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      if (e.code === "P2003") return res.status(400).json({ error: `این ${label} در جایی استفاده شده و قابل حذف نیست` });
      res.status(400).json({ error: e.message || `خطا در حذف ${label}` });
    }
  });
}

const router = Router();
registerChequeTypeRoutes(router, {
  path: "receivable-cheque-types",
  formKey: "receivable-cheque-types",
  delegate: prisma.receivableChequeType as unknown as ChequeTypeDelegate,
  label: "نوع چک دریافتی",
  hasSameDay: false,
});
registerChequeTypeRoutes(router, {
  path: "payable-cheque-types",
  formKey: "payable-cheque-types",
  delegate: prisma.payableChequeType as unknown as ChequeTypeDelegate,
  label: "نوع چک پرداختی",
  hasSameDay: true,
});

export default router;
