import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { getCurrentFiscalPeriod } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { FORM_TITLE, NumberingFormKey } from "../services/numberingPatternService";

// =========================================================================
// «الگوی شماره‌گذاری» (تنظیمات). الگو مالک دنباله‌ی شماره است (نه حافظه مالیاتی)؛ تخصیص شماره/کنترل تاریخ:
// services/numberingPatternService.ts (اتمی و ایمن در برابر هم‌زمانی). در این فاز فقط «فاکتور فروش» و «برگشت از فروش» با پارامترهای
// نوع فروش + مرکز فروش پشتیبانی می‌شوند.
// =========================================================================

const FORM = findFormPrefix("numbering-patterns");
const router = Router();
const FORMS = new Set<string>(["SALES_INVOICE", "SALES_RETURN"]);

interface ItemIn { form: NumberingFormKey; salesTypeId: number; salesCenterId: number }
interface Body {
  title?: string;
  hasTaxMemory?: boolean;
  taxMemoryId?: number | null;
  resetPerFiscalYear?: boolean;
  restrictEarlierDates?: boolean;
  lastNumber?: number | string | null;
  items?: ItemIn[];
}

const INCLUDE = { taxMemory: { select: { id: true, persianCompanyName: true, englishCompanyName: true } }, items: { include: { salesType: true, salesCenter: true }, orderBy: { id: "asc" } } } as const;

function serialize(p: any, documentCount: number) {
  return {
    id: p.id,
    title: p.title,
    hasTaxMemory: p.hasTaxMemory,
    taxMemoryId: p.taxMemoryId,
    taxMemoryTitle: p.taxMemory ? p.taxMemory.persianCompanyName : null,
    resetPerFiscalYear: p.resetPerFiscalYear,
    restrictEarlierDates: p.restrictEarlierDates,
    lastNumber: p.lastNumber,
    // وقتی سندی با این الگو شماره گرفته، «آخرین شماره»/«ریست سالانه» قفل می‌شوند
    hasDocuments: documentCount > 0,
    items: p.items.map((i: any) => ({
      id: i.id,
      form: i.form,
      formTitle: FORM_TITLE[i.form as NumberingFormKey],
      salesTypeId: i.salesTypeId,
      salesTypeTitle: i.salesType?.title,
      salesCenterId: i.salesCenterId,
      salesCenterTitle: i.salesCenter?.title,
    })),
    updatedAt: p.updatedAt,
  };
}

async function documentCount(patternId: number) {
  const [a, b] = await withoutFiscalPeriodScope(() =>
    Promise.all([prisma.salesInvoice.count({ where: { numberingPatternId: patternId } }), prisma.salesReturnInvoice.count({ where: { numberingPatternId: patternId } })])
  );
  return a + b;
}

async function clean(body: Body, selfId?: number) {
  const title = (body.title || "").trim();
  if (!title) throw new Error("عنوان الزامی است");
  const dupTitle = await prisma.numberingPattern.findFirst({ where: { title, ...(selfId ? { NOT: { id: selfId } } : {}) } });
  if (dupTitle) throw new Error("عنوان تکراری است");

  const hasTaxMemory = !!body.hasTaxMemory;
  let taxMemoryId: number | null = null;
  if (hasTaxMemory) {
    if (!body.taxMemoryId) throw new Error("با فعال‌بودن «دارای حافظه مالیاتی»، انتخاب حافظه مالیاتی الزامی است");
    const tm = await prisma.taxMemory.findUnique({ where: { id: Number(body.taxMemoryId) } });
    if (!tm) throw new Error("حافظه مالیاتی یافت نشد");
    taxMemoryId = tm.id;
  } else if (body.taxMemoryId) {
    throw new Error("حافظه مالیاتی فقط وقتی «دارای حافظه مالیاتی» فعال است قابل انتخاب است");
  }

  const rawLast = body.lastNumber === undefined || body.lastNumber === null || body.lastNumber === "" ? 0 : Number(body.lastNumber);
  if (!Number.isInteger(rawLast) || rawLast < 0) throw new Error("«آخرین شماره» باید عددی صحیح و غیرمنفی باشد");

  const items = body.items || [];
  if (items.length === 0) throw new Error("حداقل یک ردیف (فرم + نوع فروش + مرکز فروش) لازم است");
  const seen = new Set<string>();
  for (const [idx, it] of items.entries()) {
    if (!it.form || !FORMS.has(it.form)) throw new Error(`ردیف ${idx + 1}: فرم نامعتبر است`);
    if (!it.salesTypeId) throw new Error(`ردیف ${idx + 1}: نوع فروش الزامی است`);
    if (!it.salesCenterId) throw new Error(`ردیف ${idx + 1}: مرکز فروش الزامی است`);
    const key = `${it.form}:${it.salesTypeId}:${it.salesCenterId}`;
    if (seen.has(key)) throw new Error(`ردیف ${idx + 1}: این ترکیب در همین الگو تکراری است`);
    seen.add(key);
    // eslint-disable-next-line no-await-in-loop
    const [st, sc] = await Promise.all([prisma.salesType.findUnique({ where: { id: it.salesTypeId } }), prisma.salesCenter.findUnique({ where: { id: it.salesCenterId } })]);
    if (!st) throw new Error(`ردیف ${idx + 1}: نوع فروش یافت نشد`);
    if (!sc) throw new Error(`ردیف ${idx + 1}: مرکز فروش یافت نشد`);
    // یک ترکیب فرم + پارامترها فقط در یک الگو (همپوشانی ممنوع)
    // eslint-disable-next-line no-await-in-loop
    const clash = await prisma.numberingPatternItem.findFirst({
      where: { form: it.form, salesTypeId: it.salesTypeId, salesCenterId: it.salesCenterId, ...(selfId ? { NOT: { patternId: selfId } } : {}) },
      include: { pattern: true },
    });
    if (clash) {
      throw new Error(`ردیف ${idx + 1}: ترکیب «${FORM_TITLE[it.form]} | ${st.title} | ${sc.title}» قبلاً در الگوی «${clash.pattern.title}» ثبت شده است`);
    }
  }
  return {
    title,
    hasTaxMemory,
    taxMemoryId,
    resetPerFiscalYear: !!body.resetPerFiscalYear,
    restrictEarlierDates: !!body.restrictEarlierDates,
    lastNumber: rawLast,
    items: items.map((i) => ({ form: i.form, salesTypeId: i.salesTypeId, salesCenterId: i.salesCenterId })),
  };
}

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const list = await prisma.numberingPattern.findMany({ include: INCLUDE, orderBy: { id: "desc" } });
  res.json(await Promise.all(list.map(async (p: any) => serialize(p, await documentCount(p.id)))));
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const p = await prisma.numberingPattern.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!p) return res.status(404).json({ error: "الگوی شماره‌گذاری یافت نشد" });
  res.json(serialize(p, await documentCount(p.id)));
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = await clean(req.body as Body);
    const current = await getCurrentFiscalPeriod();
    const created = await prisma.numberingPattern.create({
      data: {
        title: d.title,
        hasTaxMemory: d.hasTaxMemory,
        taxMemoryId: d.taxMemoryId,
        resetPerFiscalYear: d.resetPerFiscalYear,
        restrictEarlierDates: d.restrictEarlierDates,
        lastNumber: d.lastNumber,
        // در حالت ریست سالانه «آخرین شماره» فقط برای سال مالی جاریِ زمان ایجاد الگو اعمال می‌شود (سال‌های بعد از صفر)
        seedFiscalPeriodId: current?.id ?? null,
        items: { create: d.items },
      },
      include: INCLUDE,
    });
    res.status(201).json(serialize(created, 0));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان یا ترکیب فرم و پارامترها تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت الگوی شماره‌گذاری" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.numberingPattern.findUnique({ where: { id }, include: { items: true } });
  if (!existing) return res.status(404).json({ error: "الگوی شماره‌گذاری یافت نشد" });
  try {
    const d = await clean(req.body as Body, id);
    const used = await documentCount(id);
    if (used > 0) {
      if (d.lastNumber !== existing.lastNumber) throw new Error("با این الگو سند شماره گرفته است؛ «آخرین شماره» قابل تغییر نیست");
      if (d.resetPerFiscalYear !== existing.resetPerFiscalYear) throw new Error("با این الگو سند شماره گرفته است؛ «ریست در سطح سال مالی» قابل تغییر نیست");
      // ردیفی که اسنادش با این الگو شماره گرفته‌اند حذف نمی‌شود
      const kept = new Set(d.items.map((i) => `${i.form}:${i.salesTypeId}:${i.salesCenterId}`));
      for (const it of existing.items) {
        if (kept.has(`${it.form}:${it.salesTypeId}:${it.salesCenterId}`)) continue;
        // eslint-disable-next-line no-await-in-loop
        const n = await withoutFiscalPeriodScope(() =>
          it.form === "SALES_INVOICE"
            ? prisma.salesInvoice.count({ where: { numberingPatternId: id, salesTypeId: it.salesTypeId, salesCenterId: it.salesCenterId } })
            : prisma.salesReturnInvoice.count({ where: { numberingPatternId: id, salesTypeId: it.salesTypeId, salesCenterId: it.salesCenterId } })
        );
        if (n > 0) throw new Error("برای یکی از ردیف‌های حذف‌شده با این الگو سند شماره گرفته است و قابل حذف نیست");
      }
    }
    const updated = await prisma.$transaction(async (tx: any) => {
      await tx.numberingPatternItem.deleteMany({ where: { patternId: id } });
      return tx.numberingPattern.update({
        where: { id },
        data: {
          title: d.title,
          hasTaxMemory: d.hasTaxMemory,
          taxMemoryId: d.taxMemoryId,
          resetPerFiscalYear: d.resetPerFiscalYear,
          restrictEarlierDates: d.restrictEarlierDates,
          lastNumber: d.lastNumber,
          items: { create: d.items },
        },
        include: INCLUDE,
      });
    });
    res.json(serialize(updated, used));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان یا ترکیب فرم و پارامترها تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش الگوی شماره‌گذاری" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.numberingPattern.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "الگوی شماره‌گذاری یافت نشد" });
  if ((await documentCount(id)) > 0) return res.status(400).json({ error: "با این الگو سند شماره گرفته است و قابل حذف نیست" });
  await prisma.numberingPattern.delete({ where: { id } });
  res.status(204).send();
});

export default router;
