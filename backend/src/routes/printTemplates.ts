import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { DEFAULT_PRINT_TEMPLATES } from "../data/printDefaultTemplates";
import { ensureDefaultPrintTemplates, getDesignSchema, getPrintDocType, PRINT_DOC_TYPES, printLayout, renderPrintDocument, renderSavedTemplate } from "../services/printService";
import { defaultDesign, normalizeDesign } from "../services/printDesign";

// «قالب‌های چاپ» (تنظیمات › عملیات) + «چاپ سند» (دکمه‌ی چاپ فرم‌ها). قالب = HTML/CSS با متغیرهای Handlebars (services/printService.ts).
// چاپ هر سند فقط مجوز «مشاهده»ی همان سند را می‌خواهد؛ طراحی قالب مجوز فرم «قالب‌های چاپ» را.

const FORM = findFormPrefix("print-templates");

/** مجوز مشاهده‌ی هر نوع سندِ قابل‌چاپ (کلید فرمِ همان سند) */
const VIEW_GUARD_BY_TYPE: Record<string, ReturnType<typeof can>> = {
  SALES_QUOTE: can(`${findFormPrefix("sales-quotes")}.view`),
  SALES_INVOICE: can(`${findFormPrefix("sales-invoices")}.view`),
  JOURNAL_ENTRY: can(`${findFormPrefix("journal-entries")}.view`),
};

const router = Router();

const PAPERS = ["A4", "A5"];
const ORIENTATIONS = ["PORTRAIT", "LANDSCAPE"];
const DIGITS = ["LATIN", "PERSIAN"];

function cleanTexts(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) out[k] = String(v ?? "").slice(0, 2000);
    }
  }
  return out;
}

/** طراحیِ کامل و معتبر یک قالب (برای نوع‌های دارای طراح)؛ نوع بدون طراح → null */
function designOf(t: any) {
  const schema = getDesignSchema(t.documentType);
  return schema ? normalizeDesign(schema, t.design) : null;
}

/** مقدار design برای ذخیره: undefined = بدون تغییر، null = پیش‌فرض، وگرنه نرمال‌شده (نوع بدون طراح نادیده گرفته می‌شود) */
function designForSave(documentType: string, raw: unknown) {
  if (raw === undefined) return undefined;
  const schema = getDesignSchema(documentType);
  if (!schema) return undefined;
  if (raw === null) return Prisma.JsonNull;
  return normalizeDesign(schema, raw) as any;
}

function serialize(t: any, withHtml = true) {
  return {
    id: t.id,
    documentType: t.documentType,
    documentTypeTitle: PRINT_DOC_TYPES[t.documentType]?.title ?? t.documentType,
    title: t.title,
    paper: t.paper,
    orientation: t.orientation,
    marginMm: t.marginMm,
    digits: t.digits,
    ...(withHtml ? { html: t.html, texts: t.texts ?? {}, design: designOf(t) } : {}),
    isDefault: t.isDefault,
    isActive: t.isActive,
    updatedAt: t.updatedAt,
  };
}

interface TemplateBody {
  documentType?: string;
  title?: string;
  paper?: string;
  orientation?: string;
  marginMm?: number;
  digits?: string;
  html?: string;
  texts?: Record<string, string>;
  design?: unknown;
  isDefault?: boolean;
  isActive?: boolean;
}

function validateBody(b: TemplateBody, isNew: boolean) {
  if (isNew && !b.documentType) throw new Error("نوع سند الزامی است");
  if (b.documentType !== undefined) getPrintDocType(b.documentType);
  if (b.title !== undefined && !String(b.title).trim()) throw new Error("عنوان قالب الزامی است");
  if (isNew && !String(b.title ?? "").trim()) throw new Error("عنوان قالب الزامی است");
  if (b.paper !== undefined && !PAPERS.includes(b.paper)) throw new Error("اندازه‌ی کاغذ نامعتبر است");
  if (b.orientation !== undefined && !ORIENTATIONS.includes(b.orientation)) throw new Error("جهت کاغذ نامعتبر است");
  if (b.marginMm !== undefined && !(Number(b.marginMm) >= 0 && Number(b.marginMm) <= 40)) throw new Error("حاشیه باید بین ۰ تا ۴۰ میلی‌متر باشد");
  if (b.digits !== undefined && !DIGITS.includes(b.digits)) throw new Error("نوع ارقام نامعتبر است");
  if (b.html !== undefined && String(b.html).length > 500_000) throw new Error("حجم قالب بیش از حد مجاز است");
  if ((isNew && !String(b.html ?? "").trim()) || (b.html !== undefined && !String(b.html).trim())) throw new Error("متن قالب (HTML) الزامی است");
}

// ─── مدیریت قالب‌ها ─────────────────────────────────────────────────────────

router.get("/print-templates", can(`${FORM}.view`), async (_req, res) => {
  await ensureDefaultPrintTemplates();
  const rows = await prisma.printTemplate.findMany({ orderBy: [{ documentType: "asc" }, { id: "asc" }] });
  res.json(rows.map((t) => serialize(t, false)));
});

// دیکشنری فیلدها و کلیدهای متن‌های ثابت هر نوع سند (برای فرم قالب)
router.get("/print-templates/meta", can(`${FORM}.view`), async (_req, res) => {
  res.json(
    Object.entries(PRINT_DOC_TYPES).map(([type, d]) => ({
      type,
      title: d.title,
      fields: d.fields,
      textKeys: d.textKeys,
      // طراح ساده: تعریف ستون‌ها/بخش‌ها (برای نمایش فرم) و طراحی پیش‌فرض؛ نبودنش = این نوع طراح ندارد
      designSchema: d.designSchema ? { columns: d.designSchema.columns, sections: d.designSchema.sections, defaults: defaultDesign(d.designSchema) } : null,
    }))
  );
});

router.get("/print-templates/:id", can(`${FORM}.view`), async (req, res) => {
  const t = await prisma.printTemplate.findUnique({ where: { id: Number(req.params.id) } });
  if (!t) return res.status(404).json({ error: "قالب یافت نشد" });
  res.json(serialize(t));
});

router.post("/print-templates", can(`${FORM}.create`), async (req, res) => {
  try {
    const b = req.body as TemplateBody;
    validateBody(b, true);
    const created = await prisma.$transaction(async (tx) => {
      const hasAny = (await tx.printTemplate.count({ where: { documentType: b.documentType as any } })) > 0;
      const makeDefault = b.isDefault === true || !hasAny;
      if (makeDefault) await tx.printTemplate.updateMany({ where: { documentType: b.documentType as any, isDefault: true }, data: { isDefault: false } });
      return tx.printTemplate.create({
        data: {
          documentType: b.documentType as any,
          title: String(b.title).trim(),
          paper: (b.paper as any) ?? "A4",
          orientation: (b.orientation as any) ?? "PORTRAIT",
          marginMm: b.marginMm !== undefined ? Number(b.marginMm) : 10,
          digits: (b.digits as any) ?? "PERSIAN",
          html: String(b.html),
          texts: cleanTexts(b.texts),
          design: designForSave(b.documentType as string, b.design),
          isDefault: makeDefault,
          isActive: makeDefault ? true : b.isActive ?? true,
        },
      });
    });
    res.status(201).json(serialize(created));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان قالب برای این نوع سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت قالب" });
  }
});

router.put("/print-templates/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.printTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "قالب یافت نشد" });
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این قالب");
    const b = req.body as TemplateBody;
    if (b.documentType !== undefined && b.documentType !== existing.documentType) throw new Error("نوع سند قالب قابل تغییر نیست");
    validateBody(b, false);
    const makeDefault = b.isDefault === true && !existing.isDefault;
    if (b.isDefault === false && existing.isDefault) throw new Error("برای تغییر قالب پیش‌فرض، قالب دیگری را «پیش‌فرض» کنید");
    if (b.isActive === false && (existing.isDefault || makeDefault)) throw new Error("قالب پیش‌فرض را نمی‌توان غیرفعال کرد");
    const updated = await prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.printTemplate.updateMany({ where: { documentType: existing.documentType, isDefault: true }, data: { isDefault: false } });
      return tx.printTemplate.update({
        where: { id },
        data: {
          title: b.title !== undefined ? String(b.title).trim() : undefined,
          paper: b.paper as any,
          orientation: b.orientation as any,
          marginMm: b.marginMm !== undefined ? Number(b.marginMm) : undefined,
          digits: b.digits as any,
          html: b.html !== undefined ? String(b.html) : undefined,
          texts: b.texts !== undefined ? cleanTexts(b.texts) : undefined,
          design: designForSave(existing.documentType, b.design),
          isDefault: makeDefault ? true : undefined,
          isActive: b.isActive,
        },
      });
    });
    res.json(serialize(updated));
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان قالب برای این نوع سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش قالب" });
  }
});

router.delete("/print-templates/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.printTemplate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "قالب یافت نشد" });
  if (existing.isDefault) return res.status(400).json({ error: "قالب پیش‌فرض را نمی‌توان حذف کرد؛ ابتدا قالب دیگری را «پیش‌فرض» کنید" });
  await prisma.printTemplate.delete({ where: { id } });
  res.json({ ok: true });
});

// کپی قالب: همه‌ی تنظیمات و متن همین قالب، با عنوان «… (کپی)»؛ پیش‌فرض نمی‌شود
router.post("/print-templates/:id/copy", can(`${FORM}.create`), async (req, res) => {
  try {
    const src = await prisma.printTemplate.findUnique({ where: { id: Number(req.params.id) } });
    if (!src) return res.status(404).json({ error: "قالب یافت نشد" });
    const existing = new Set((await prisma.printTemplate.findMany({ where: { documentType: src.documentType }, select: { title: true } })).map((t) => t.title));
    let title = `${src.title} (کپی)`;
    for (let n = 2; existing.has(title); n += 1) title = `${src.title} (کپی ${n})`;
    const created = await prisma.printTemplate.create({
      data: {
        documentType: src.documentType,
        title: title.slice(0, 200),
        paper: src.paper,
        orientation: src.orientation,
        marginMm: src.marginMm,
        digits: src.digits,
        html: src.html,
        texts: (src.texts as any) ?? {},
        design: (src.design as any) ?? Prisma.JsonNull,
        isDefault: false,
        isActive: true,
      },
    });
    res.status(201).json(serialize(created));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در کپی قالب" });
  }
});

// بازگردانی محتوای قالب به قالب پیش‌فرض نصب همان نوع سند (عنوان، پیش‌فرض‌بودن و فعال‌بودن دست‌نخورده می‌ماند)
router.post("/print-templates/:id/reset-to-install-default", can(`${FORM}.edit`), async (req, res) => {
  try {
    const existing = await prisma.printTemplate.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: "قالب یافت نشد" });
    const def = DEFAULT_PRINT_TEMPLATES.find((t) => t.documentType === existing.documentType);
    if (!def) return res.status(400).json({ error: "برای این نوع سند قالب پیش‌فرض نصب تعریف نشده است" });
    const updated = await prisma.printTemplate.update({
      where: { id: existing.id },
      data: { paper: def.paper, orientation: def.orientation, marginMm: def.marginMm, digits: def.digits, html: def.html, texts: def.texts, design: Prisma.JsonNull },
    });
    res.json(serialize(updated));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بازگردانی قالب" });
  }
});

// پیش‌نمایش قالبِ در حال ویرایش (ذخیره‌نشده) روی یک سند واقعی (آخرین سند، یا sourceId) یا داده‌ی نمونه
router.post("/print-templates/preview", can(`${FORM}.view`), async (req, res) => {
  try {
    const b = req.body as TemplateBody & { sourceId?: number };
    validateBody({ ...b, title: b.title || "پیش‌نمایش", documentType: b.documentType ?? "" }, true);
    const def = getPrintDocType(String(b.documentType));
    const sourceId = b.sourceId ?? (await def.latestSourceId());
    const paper = (b.paper as any) ?? "A4";
    const orientation = (b.orientation as any) ?? "PORTRAIT";
    const marginMm = b.marginMm !== undefined ? Number(b.marginMm) : 10;
    const layout = printLayout(paper, orientation, marginMm);
    const data = sourceId ? await def.load(Number(sourceId), layout) : def.sample(layout);
    const html = renderPrintDocument(
      { html: String(b.html), texts: cleanTexts(b.texts), paper, orientation, marginMm, digits: (b.digits as any) ?? "PERSIAN", documentType: String(b.documentType), design: b.design },
      data
    );
    res.json({ html, usedSample: !sourceId });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در پیش‌نمایش" });
  }
});

// ─── چاپ سند (دکمه‌ی «چاپ» فرم‌ها) ───────────────────────────────────────────

function guardByType(req: any, res: any, next: any) {
  const g = VIEW_GUARD_BY_TYPE[String(req.params.docType)];
  if (!g) return res.status(404).json({ error: "نوع سند چاپ نامعتبر است" });
  return g(req, res, next);
}

// قالب‌های فعالِ یک نوع سند برای انتخاب هنگام چاپ
router.get("/print/:docType/templates", guardByType, async (req, res) => {
  await ensureDefaultPrintTemplates();
  const rows = await prisma.printTemplate.findMany({
    where: { documentType: String(req.params.docType) as any, isActive: true },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
  });
  res.json(rows.map((t) => ({ id: t.id, title: t.title, isDefault: t.isDefault, paper: t.paper, orientation: t.orientation, digits: t.digits })));
});

router.get("/print/:docType/:id/render", guardByType, async (req, res) => {
  try {
    await ensureDefaultPrintTemplates();
    const docType = String(req.params.docType);
    let templateId = req.query.templateId ? Number(req.query.templateId) : null;
    if (!templateId) {
      const def = await prisma.printTemplate.findFirst({ where: { documentType: docType as any, isDefault: true, isActive: true } });
      if (!def) throw new Error("قالب پیش‌فرضی برای این نوع سند تعریف نشده است");
      templateId = def.id;
    } else {
      const t = await prisma.printTemplate.findUnique({ where: { id: templateId } });
      if (!t || t.documentType !== docType) throw new Error("قالب انتخاب‌شده برای این نوع سند نیست");
      if (!t.isActive) throw new Error("قالب انتخاب‌شده غیرفعال است");
    }
    const digits = req.query.digits === undefined || req.query.digits === "" ? undefined : String(req.query.digits);
    if (digits !== undefined && !DIGITS.includes(digits)) throw new Error("نوع ارقام نامعتبر است");
    res.json(await renderSavedTemplate(templateId, Number(req.params.id), digits as any));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تولید چاپ" });
  }
});

export default router;
