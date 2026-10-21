import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { DICTIONARY } from "../services/fileStructureDictionary";
import { FileStructureError, copyStructure, createStructure, isSystemRef, listStructures, loadStructure, updateStructure, validateDef } from "../services/fileStructureService";
import { generateFiles, type GenProblem } from "../services/fileGeneratorService";

// حقوق و دستمزد › تنظیمات › ساختار فایل: تعریف ساختار فایل‌های بانک‌ها و سازمان‌ها + پیش‌نمایش/تولید برای یک ماه.
// قواعد: services/fileStructureService.ts و services/fileGeneratorService.ts. ساختارهای پیش‌فرض نصب با شناسه‌ی «sys-<KEY>» فقط‌خواندنی‌اند.

const F = findFormPrefix("file-structures");
const router = Router();

function fail(res: any, e: any, fallback: string) {
  if (e instanceof FileStructureError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکورد تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}

router.get("/file-structures", can(`${F}.view`), async (_req, res) => {
  res.json(await listStructures());
});

/** گزینه‌های فرم: فهرست فیلدهای سیستمی، عامل‌ها، انواع محاسبه و شعبه‌های سازمان‌های ذینفع */
router.get("/file-structures/options", can(`${F}.view`), async (_req, res) => {
  const [payroll, decree, calc, orgs, branches] = await Promise.all([
    prisma.payrollComponent.findMany({ orderBy: { id: "asc" }, select: { id: true, title: true, kind: true, calcType: { select: { title: true } } } }),
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true } }),
    prisma.payrollCalcType.findMany({ orderBy: [{ isBase: "desc" }, { id: "asc" }], select: { id: true, title: true } }),
    prisma.beneficiaryOrg.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true, type: true } }),
    prisma.beneficiaryBranch.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, organizationId: true, fileNumber: true, contractRow: true, party: { select: { detailTitle: true } } } }),
  ]);
  res.json({
    dictionary: DICTIONARY,
    payrollFactors: payroll.map((c) => ({ id: c.id, title: c.title, kind: c.kind, calcTypeTitle: c.calcType.title })),
    decreeFactors: decree,
    calcTypes: calc,
    orgs,
    branches: branches.map((b) => ({ id: b.id, organizationId: b.organizationId, fileNumber: b.fileNumber, contractRow: b.contractRow, title: b.party.detailTitle })),
  });
});

router.get("/file-structures/:ref", can(`${F}.view`), async (req, res) => {
  const r = await loadStructure(req.params.ref);
  if (!r) return res.status(404).json({ error: "ساختار فایل یافت نشد" });
  res.json({ ...r.def, ref: req.params.ref, isSystem: isSystemRef(req.params.ref), unresolved: r.unresolved });
});

router.post("/file-structures", can(`${F}.create`), async (req, res) => {
  try {
    const created = await createStructure(validateDef(req.body));
    res.status(201).json({ id: created.id, code: created.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت ساختار فایل");
  }
});

router.put("/file-structures/:ref", can(`${F}.edit`), async (req, res) => {
  try {
    if (isSystemRef(req.params.ref)) throw new FileStructureError("ساختار پیش‌فرض نصب قابل ویرایش نیست؛ از آن «کپی» بگیرید");
    const id = Number(req.params.ref);
    if (!(await prisma.fileStructure.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "ساختار فایل یافت نشد" });
    await updateStructure(id, validateDef(req.body));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش ساختار فایل");
  }
});

router.delete("/file-structures/:ref", can(`${F}.delete`), async (req, res) => {
  try {
    if (isSystemRef(req.params.ref)) throw new FileStructureError("ساختار پیش‌فرض نصب حذف نمی‌شود");
    await prisma.fileStructure.delete({ where: { id: Number(req.params.ref) } });
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف ساختار فایل");
  }
});

router.post("/file-structures/:ref/copy", can(`${F}.create`), async (req, res) => {
  try {
    res.status(201).json(await copyStructure(req.params.ref, req.body?.title));
  } catch (e) {
    fail(res, e, "خطا در کپی ساختار فایل");
  }
});

async function run(req: any) {
  const r = await loadStructure(req.params.ref);
  if (!r) throw new FileStructureError("ساختار فایل یافت نشد");
  const b = req.body ?? {};
  const year = Number(b.year), month = Number(b.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new FileStructureError("سال و ماه را انتخاب کنید");
  const out = await generateFiles(r.def, {
    year,
    month,
    employeeIds: Array.isArray(b.employeeIds) ? b.employeeIds.map(Number).filter(Boolean) : null,
    orgId: b.orgId ? Number(b.orgId) : null,
    branchId: b.branchId ? Number(b.branchId) : null,
    params: b.params && typeof b.params === "object" ? b.params : {},
  });
  const problems: GenProblem[] = [...out.problems, ...r.unresolved.map((u) => ({ level: "WARNING" as const, message: `عامل «${u.title}» (فیلد ${u.field}) در این نصب پیدا نشد؛ مبلغ آن صفر لحاظ شد` }))];
  return { out, problems };
}

/** پیش‌نمایش: نام و اندازه‌ی فایل‌ها، چند ردیف اول و مشکل‌ها (بدون محتوای کامل فایل) */
router.post("/file-structures/:ref/preview", can(`${F}.view`), async (req, res) => {
  try {
    const { out, problems } = await run(req);
    res.json({
      employeeCount: out.employeeCount,
      problems,
      zipName: out.zip?.name ?? null,
      files: out.files.map((f) => ({ name: f.name, bytes: f.data.length, rows: f.rows, header: f.header, sample: f.sample })),
    });
  } catch (e) {
    fail(res, e, "خطا در پیش‌نمایش فایل");
  }
});

/** تولید: فایل‌ها (و zip در صورت تعریف) به‌صورت base64؛ با هر خطای بازدارنده تولید نمی‌شود */
router.post("/file-structures/:ref/generate", can(`${F}.generate`), async (req, res) => {
  try {
    const { out, problems } = await run(req);
    if (problems.some((p) => p.level === "ERROR")) return res.status(400).json({ error: "فایل ساخته نشد؛ مشکل‌های بازدارنده را برطرف کنید", problems });
    res.json({
      problems,
      zip: out.zip ? { name: out.zip.name, dataBase64: out.zip.data.toString("base64") } : null,
      files: out.files.map((f) => ({ name: f.name, dataBase64: f.data.toString("base64"), rows: f.rows })),
    });
  } catch (e) {
    fail(res, e, "خطا در تولید فایل");
  }
});

export default router;
