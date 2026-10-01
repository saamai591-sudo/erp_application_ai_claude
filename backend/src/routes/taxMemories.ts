import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { toEnglishDigits } from "../utils/digits";
import { TAX_COUNTRY, generateTaxKeyMaterial, rebuildCsr } from "../services/taxMemoryService";

// =========================================================================
// «حافظه مالیاتی» (امور مالیاتی › تنظیمات). منطق کلید/CSR: services/taxMemoryService.ts.
// کلید خصوصی هرگز در پاسخ‌ها نیست: همه‌ی پاسخ‌ها از serialize() می‌گذرند (فهرست سفید فیلدها). کلید عمومی و CSR فقط خواندنی‌اند و
// کاربر نمی‌تواند آن‌ها (یا کشور) را در درخواست ایجاد/ویرایش بفرستد؛ فقط از طریق دانلود (public-key.txt / csr.txt) در دسترس‌اند.
// =========================================================================

const FORM = findFormPrefix("tax-memories");
const router = Router();

const FORBIDDEN_FIELDS = ["publicKeyPem", "csrPem", "privateKeyEncrypted", "privateKey", "publicKey", "csr"];

function serialize(m: any) {
  return {
    id: m.id,
    persianCompanyName: m.persianCompanyName,
    englishCompanyName: m.englishCompanyName,
    nationalId: m.nationalId,
    countryId: m.countryId,
    email: m.email,
    taxMemoryUniqueId: m.taxMemoryUniqueId,
    hasKeyPair: !!m.publicKeyPem,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

interface Body {
  persianCompanyName?: string;
  englishCompanyName?: string;
  nationalId?: string;
  countryId?: string;
  email?: string;
  taxMemoryUniqueId?: string | null;
}

/** اعتبارسنجی سمت سرور (فیلدهای الزامی، کشور = IR، جایگزین‌نشدن کلید/CSR) */
function clean(body: Body) {
  for (const f of FORBIDDEN_FIELDS) {
    if ((body as any)[f] !== undefined) throw new Error("کلید عمومی، CSR و کلید خصوصی توسط سیستم مدیریت می‌شوند و قابل تعیین/جایگزینی نیستند");
  }
  if (body.countryId !== undefined && body.countryId !== null && String(body.countryId).trim().toUpperCase() !== TAX_COUNTRY) {
    throw new Error("شناسه کشور همیشه IR است و قابل تغییر نیست");
  }
  const persianCompanyName = (body.persianCompanyName || "").trim();
  const englishCompanyName = (body.englishCompanyName || "").trim();
  const nationalId = toEnglishDigits((body.nationalId || "").trim());
  const email = (body.email || "").trim();
  if (!persianCompanyName) throw new Error("نام فارسی شرکت الزامی است");
  if (!englishCompanyName) throw new Error("نام انگلیسی شرکت الزامی است");
  if (!/^[\x20-\x7E]+$/.test(englishCompanyName)) throw new Error("نام انگلیسی شرکت فقط می‌تواند شامل حروف و علائم انگلیسی باشد");
  if (!nationalId) throw new Error("شناسه ملی الزامی است");
  if (!/^\d{10,11}$/.test(nationalId)) throw new Error("شناسه ملی باید ۱۰ یا ۱۱ رقم باشد");
  if (!email) throw new Error("ایمیل الزامی است");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("ایمیل نامعتبر است");
  const taxMemoryUniqueId = body.taxMemoryUniqueId ? String(body.taxMemoryUniqueId).trim() || null : null;
  return { persianCompanyName, englishCompanyName, nationalId, email, taxMemoryUniqueId };
}

router.get("/", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.taxMemory.findMany({ orderBy: { id: "desc" } });
  res.json(items.map(serialize));
});

router.get("/:id", can(`${FORM}.view`), async (req, res) => {
  const m = await prisma.taxMemory.findUnique({ where: { id: Number(req.params.id) } });
  if (!m) return res.status(404).json({ error: "حافظه مالیاتی یافت نشد" });
  res.json(serialize(m));
});

// اولین ذخیره: جفت‌کلید RSA 2048 + کلید عمومی + CSR از همان جفت‌کلید ساخته می‌شود
router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const data = clean(req.body as Body);
    const material = generateTaxKeyMaterial(data);
    const created = await prisma.taxMemory.create({ data: { ...data, countryId: TAX_COUNTRY, ...material } });
    res.status(201).json(serialize(created));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت حافظه مالیاتی" });
  }
});

// ویرایش: کلید عمومی و کلید خصوصی ثابت می‌مانند؛ اگر اطلاعات شرکت عوض شود CSR با همان جفت‌کلید دوباره ساخته می‌شود
router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.taxMemory.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "حافظه مالیاتی یافت نشد" });
  try {
    const data = clean(req.body as Body);
    const subjectChanged =
      data.persianCompanyName !== existing.persianCompanyName ||
      data.englishCompanyName !== existing.englishCompanyName ||
      data.nationalId !== existing.nationalId ||
      data.email !== existing.email;
    const updated = await prisma.taxMemory.update({
      where: { id },
      data: { ...data, countryId: TAX_COUNTRY, ...(subjectChanged ? { csrPem: rebuildCsr(existing.privateKeyEncrypted, data) } : {}) },
    });
    res.json(serialize(updated));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش حافظه مالیاتی" });
  }
});

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.taxMemory.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "حافظه مالیاتی یافت نشد" });
  await prisma.taxMemory.delete({ where: { id } });
  res.status(204).send();
});

function sendTextFile(res: any, filename: string, content: string) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(content);
}

router.get("/:id/public-key", can(`${FORM}.downloadPublicKey`), async (req, res) => {
  const m = await prisma.taxMemory.findUnique({ where: { id: Number(req.params.id) }, select: { publicKeyPem: true } });
  if (!m) return res.status(404).json({ error: "حافظه مالیاتی یافت نشد" });
  sendTextFile(res, "public-key.txt", m.publicKeyPem);
});

router.get("/:id/csr", can(`${FORM}.downloadCsr`), async (req, res) => {
  const m = await prisma.taxMemory.findUnique({ where: { id: Number(req.params.id) }, select: { csrPem: true } });
  if (!m) return res.status(404).json({ error: "حافظه مالیاتی یافت نشد" });
  sendTextFile(res, "csr.txt", m.csrPem);
});

export default router;
