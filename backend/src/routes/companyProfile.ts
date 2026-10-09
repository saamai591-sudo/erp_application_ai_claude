import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";

// «مشخصات شرکت» (تنظیمات › عملیات) — یک رکورد (id=1) در هر نصب؛ در قالب‌های چاپ به‌عنوان «فروشنده» (company.*) استفاده می‌شود.
// لوگو و مهر/امضا تصویرند: کلاینت {name, mimeType, dataBase64} می‌فرستد (undefined = بدون تغییر، null = حذف).

const FORM = findFormPrefix("company-profile");
const router = Router();

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

interface ImageInput {
  name?: string;
  mimeType: string;
  dataBase64: string;
}

function bank(x: any) {
  return {
    bankName: String(x?.bankName ?? "").trim().slice(0, 100),
    branch: String(x?.branch ?? "").trim().slice(0, 100),
    accountNumber: String(x?.accountNumber ?? "").trim().slice(0, 50),
    iban: String(x?.iban ?? "").trim().replace(/\s+/g, "").slice(0, 40),
  };
}

function dataUri(a: { mimeType: string; data: Uint8Array } | null | undefined) {
  return a ? `data:${a.mimeType};base64,${Buffer.from(a.data).toString("base64")}` : null;
}

async function load() {
  return prisma.companyProfile.findUnique({ where: { id: 1 }, include: { logoAsset: true, stampAsset: true } });
}

function serialize(c: Awaited<ReturnType<typeof load>>) {
  if (!c) {
    return { exists: false, name: "", economicCode: "", registrationNumber: "", nationalId: "", phone: "", address: "", postalCode: "", website: "", logo: null, stamp: null, bankAccounts: [], updatedAt: null };
  }
  return {
    exists: true,
    name: c.name,
    economicCode: c.economicCode ?? "",
    registrationNumber: c.registrationNumber ?? "",
    nationalId: c.nationalId ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    postalCode: c.postalCode ?? "",
    website: c.website ?? "",
    logo: dataUri(c.logoAsset),
    stamp: dataUri(c.stampAsset),
    bankAccounts: (Array.isArray(c.bankAccounts) ? c.bankAccounts : []).map(bank),
    updatedAt: c.updatedAt,
  };
}

async function toAssetData(img: ImageInput, label: string) {
  if (!img || typeof img.dataBase64 !== "string" || !IMAGE_TYPES.includes(img.mimeType)) throw new Error(`تصویر ${label} باید png، jpeg، webp یا gif باشد`);
  const data = Buffer.from(img.dataBase64, "base64");
  if (data.length === 0) throw new Error(`تصویر ${label} خالی است`);
  if (data.length > MAX_IMAGE_BYTES) throw new Error(`حجم تصویر ${label} بیش از ۳ مگابایت است`);
  return { name: String(img.name ?? label).slice(0, 200), mimeType: img.mimeType, data };
}

router.get("/company-profile", can(`${FORM}.view`), async (_req, res) => {
  res.json(serialize(await load()));
});

router.put("/company-profile", can(`${FORM}.edit`), async (req, res) => {
  try {
    const b = req.body ?? {};
    const name = String(b.name ?? "").trim();
    if (!name) throw new Error("نام شرکت الزامی است");
    const existing = await prisma.companyProfile.findUnique({ where: { id: 1 } });
    if (existing) assertRecordNotStale(existing.updatedAt, b.updatedAt, "مشخصات شرکت");
    const banks = (Array.isArray(b.bankAccounts) ? b.bankAccounts : []).map(bank).filter((x: any) => x.bankName || x.accountNumber || x.iban);
    if (banks.length > 6) throw new Error("حداکثر ۶ حساب بانکی قابل تعریف است");
    const text = (v: unknown, max = 500) => (String(v ?? "").trim().slice(0, max) || null);

    await prisma.$transaction(async (tx) => {
      let logoAssetId: number | null | undefined;
      let stampAssetId: number | null | undefined;
      for (const [key, label] of [["logo", "لوگو"], ["stamp", "مهر و امضا"]] as const) {
        const img = b[key];
        if (img === undefined) continue;
        let newId: number | null = null;
        if (img !== null) newId = (await tx.printAsset.create({ data: await toAssetData(img, label) })).id;
        if (key === "logo") logoAssetId = newId;
        else stampAssetId = newId;
      }
      const data = {
        name,
        economicCode: text(b.economicCode, 50),
        registrationNumber: text(b.registrationNumber, 50),
        nationalId: text(b.nationalId, 50),
        phone: text(b.phone, 100),
        address: text(b.address, 500),
        postalCode: text(b.postalCode, 20),
        website: text(b.website, 200),
        bankAccounts: banks,
        ...(logoAssetId !== undefined ? { logoAssetId } : {}),
        ...(stampAssetId !== undefined ? { stampAssetId } : {}),
      };
      await tx.companyProfile.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      // تصویرهای جایگزین‌شده/حذف‌شده‌ی قبلی دیگر ارجاعی ندارند
      const stale: number[] = [];
      if (logoAssetId !== undefined && existing?.logoAssetId) stale.push(existing.logoAssetId);
      if (stampAssetId !== undefined && existing?.stampAssetId) stale.push(existing.stampAssetId);
      if (stale.length) await tx.printAsset.deleteMany({ where: { id: { in: stale } } });
    });
    res.json(serialize(await load()));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره‌ی مشخصات شرکت" });
  }
});

export default router;
