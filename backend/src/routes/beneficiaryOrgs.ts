import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { nextSerialNumber } from "../utils/coding";
import { BENEFICIARY_TYPES, BENEFICIARY_TYPE_FA, BeneficiaryType, branchLabel } from "../services/beneficiaryService";

// منابع انسانی › تنظیمات › «سازمان ذینفع» و «شعب سازمان ذینفع». قواعد مشترک: services/beneficiaryService.ts.

const F_ORG = findFormPrefix("beneficiary-orgs");
const F_BRANCH = findFormPrefix("beneficiary-branches");
const router = Router();

class BErr extends Error {}
function fail(res: any, e: any, fallback: string) {
  if (e instanceof BErr) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکورد تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);

// ── سازمان ذینفع ──

const shapeOrg = (o: any) => ({ id: o.id, code: o.code, title: o.title, type: o.type, typeTitle: BENEFICIARY_TYPE_FA[o.type as BeneficiaryType], isActive: o.isActive, branchCount: o._count?.branches ?? 0 });

router.get("/beneficiary-orgs", async (req, res) => {
  const rows = await prisma.beneficiaryOrg.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : {}, orderBy: { code: "asc" }, include: { _count: { select: { branches: true } } } });
  res.json(rows.map(shapeOrg));
});

/** گزینه‌های فرم کارمند: سازمان‌های فعال با شعبه‌های فعالشان (برچسب = عنوان شعبه + ردیف پیمان) */
router.get("/beneficiary-orgs/employee-options", async (_req, res) => {
  const orgs = await prisma.beneficiaryOrg.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: { branches: { include: { party: { select: { detailTitle: true } } }, orderBy: { id: "asc" } } },
  });
  res.json(
    orgs.map((o) => ({
      id: o.id,
      code: o.code,
      title: o.title,
      type: o.type,
      fileNumberLabel: o.type === "SOCIAL_SECURITY" ? "کد کارگاه" : "شماره پرونده",
      branches: o.branches.map((b) => ({ id: b.id, isActive: b.isActive, label: branchLabel(b.party.detailTitle, b.contractRow), fileNumber: b.fileNumber })),
    }))
  );
});

router.get("/beneficiary-orgs/:id", can(`${F_ORG}.view`), async (req, res) => {
  const o = await prisma.beneficiaryOrg.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { branches: true } } } });
  if (!o) return res.status(404).json({ error: "سازمان ذینفع یافت نشد" });
  res.json(shapeOrg(o));
});

async function orgData(b: any, id: number | null) {
  const title = str(b.title);
  if (!title) throw new BErr("عنوان الزامی است");
  if (await prisma.beneficiaryOrg.findFirst({ where: { title, ...(id ? { NOT: { id } } : {}) } })) throw new BErr("سازمان ذینفع دیگری با همین عنوان وجود دارد");
  if (!BENEFICIARY_TYPES.includes(b.type)) throw new BErr("نوع سازمان را انتخاب کنید");
  let code: number | null = null;
  if (b.code !== undefined && b.code !== null && b.code !== "") {
    code = Number(b.code);
    if (!Number.isInteger(code) || code < 1) throw new BErr("کد باید عدد صحیح مثبت باشد");
    if (await prisma.beneficiaryOrg.findFirst({ where: { code, ...(id ? { NOT: { id } } : {}) } })) throw new BErr("کد تکراری است");
  }
  return { title, type: b.type as BeneficiaryType, isActive: b.isActive === undefined ? true : !!b.isActive, code };
}

router.post("/beneficiary-orgs", can(`${F_ORG}.create`), async (req, res) => {
  try {
    const d = await orgData(req.body, null);
    for (let attempt = 0; ; attempt++) {
      try {
        // کد خالی = آخرین کد + ۱
        const code = d.code ?? (await nextSerialNumber(prisma.beneficiaryOrg, "code"));
        const created = await prisma.beneficiaryOrg.create({ data: { code, title: d.title, type: d.type, isActive: d.isActive } });
        return res.status(201).json({ id: created.id, code: created.code });
      } catch (e: any) {
        if (e?.code === "P2002" && !d.code && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت سازمان ذینفع");
  }
});

router.put("/beneficiary-orgs/:id", can(`${F_ORG}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.beneficiaryOrg.findUnique({ where: { id }, include: { _count: { select: { branches: true } } } });
    if (!ex) return res.status(404).json({ error: "سازمان ذینفع یافت نشد" });
    const d = await orgData(req.body, id);
    // نوع تعیین‌کننده‌ی فیلدهای شعبه (کد کارگاه/ردیف پیمان/کارفرما/آدرس) است؛ بعد از تعریف شعبه عوض نمی‌شود
    if (d.type !== ex.type && ex._count.branches > 0) throw new BErr("برای این سازمان شعبه تعریف شده است؛ نوع سازمان قابل تغییر نیست");
    await prisma.beneficiaryOrg.update({ where: { id }, data: { title: d.title, type: d.type, isActive: d.isActive, ...(d.code ? { code: d.code } : {}) } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش سازمان ذینفع");
  }
});

router.delete("/beneficiary-orgs/:id", can(`${F_ORG}.delete`), async (req, res) => {
  try {
    await prisma.beneficiaryOrg.delete({ where: { id: Number(req.params.id) } }); // مانع‌ها (شعبه/مشمولیت کارمند) را lib/deleteUsage.ts دقیق می‌گوید
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف سازمان ذینفع");
  }
});

// ── شعبه ──

const branchInclude = { organization: { select: { id: true, code: true, title: true, type: true } }, party: { select: { id: true, detailCode: true, detailTitle: true } } } as const;

function shapeBranch(b: any) {
  return {
    id: b.id,
    organizationId: b.organizationId,
    organizationTitle: b.organization.title,
    organizationType: b.organization.type,
    partyId: b.partyId,
    partyCode: b.party.detailCode,
    partyTitle: b.party.detailTitle,
    fileNumber: b.fileNumber,
    contractRow: b.contractRow,
    employer: b.employer,
    address: b.address,
    isActive: b.isActive,
    label: branchLabel(b.party.detailTitle, b.contractRow),
  };
}

router.get("/beneficiary-branches", can(`${F_BRANCH}.view`), async (_req, res) => {
  const rows = await prisma.beneficiaryBranch.findMany({ include: branchInclude, orderBy: [{ organizationId: "asc" }, { id: "asc" }] });
  res.json(rows.map(shapeBranch));
});

// اشخاص حقوقیِ فعال برای انتخابگر «شعبه»
router.get("/beneficiary-branches/parties", async (_req, res) => {
  res.json(await prisma.party.findMany({ where: { category: "LEGAL", isActive: true }, orderBy: { detailCode: "asc" }, select: { id: true, detailCode: true, detailTitle: true, nationalId: true } }));
});

// پیش‌فرض کارفرما/آدرس = عنوان و آدرس شرکت (مشخصات شرکت)
router.get("/beneficiary-branches/company-defaults", async (_req, res) => {
  const c = await prisma.companyProfile.findFirst({ select: { name: true, address: true } });
  res.json({ employer: c?.name ?? "", address: c?.address ?? "" });
});

router.get("/beneficiary-branches/:id", can(`${F_BRANCH}.view`), async (req, res) => {
  const b = await prisma.beneficiaryBranch.findUnique({ where: { id: Number(req.params.id) }, include: branchInclude });
  if (!b) return res.status(404).json({ error: "شعبه یافت نشد" });
  res.json(shapeBranch(b));
});

async function branchData(b: any, existing: { id: number; organizationId: number } | null) {
  const org = await prisma.beneficiaryOrg.findUnique({ where: { id: Number(b.organizationId) } });
  if (!org) throw new BErr("سازمان ذینفع را انتخاب کنید");
  if (!org.isActive && existing?.organizationId !== org.id) throw new BErr(`سازمان «${org.title}» غیرفعال است`);
  if (existing && existing.organizationId !== org.id) throw new BErr("سازمان شعبه قابل تغییر نیست؛ شعبه‌ی جدید تعریف کنید");
  const party = await prisma.party.findUnique({ where: { id: Number(b.partyId) } });
  if (!party) throw new BErr("شعبه را (از اشخاص حقوقی) انتخاب کنید");
  if (party.category !== "LEGAL") throw new BErr("شعبه باید شخص حقوقی باشد");
  const social = org.type === "SOCIAL_SECURITY";
  const fileNumber = str(b.fileNumber);
  if (!fileNumber) throw new BErr(social ? "کد کارگاه الزامی است" : "شماره پرونده الزامی است");
  // فیلدهای ویژه‌ی تامین اجتماعی: ردیف پیمان (اختیاری)، کارفرما و آدرس (الزامی)؛ برای سایر سازمان‌ها نگه‌داشته نمی‌شوند
  const contractRow = social ? str(b.contractRow) ?? "" : "";
  const employer = social ? str(b.employer) : null;
  const address = social ? str(b.address) : null;
  if (social && !employer) throw new BErr("کارفرما الزامی است");
  if (social && !address) throw new BErr("آدرس الزامی است");
  return { organizationId: org.id, partyId: party.id, fileNumber, contractRow, employer, address, isActive: b.isActive === undefined ? true : !!b.isActive };
}

async function assertBranchUnique(d: { organizationId: number; partyId: number; fileNumber: string; contractRow: string }, excludeId: number | null) {
  const dup = await prisma.beneficiaryBranch.findFirst({ where: { organizationId: d.organizationId, partyId: d.partyId, fileNumber: d.fileNumber, contractRow: d.contractRow, ...(excludeId ? { NOT: { id: excludeId } } : {}) } });
  if (dup) throw new BErr("شعبه‌ای با همین سازمان، شخص حقوقی، شماره پرونده/کد کارگاه و ردیف پیمان قبلاً تعریف شده است");
}

router.post("/beneficiary-branches", can(`${F_BRANCH}.create`), async (req, res) => {
  try {
    const d = await branchData(req.body, null);
    await assertBranchUnique(d, null);
    const created = await prisma.beneficiaryBranch.create({ data: d });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت شعبه");
  }
});

router.put("/beneficiary-branches/:id", can(`${F_BRANCH}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.beneficiaryBranch.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "شعبه یافت نشد" });
    const d = await branchData(req.body, ex);
    await assertBranchUnique(d, id);
    await prisma.beneficiaryBranch.update({ where: { id }, data: d });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش شعبه");
  }
});

router.delete("/beneficiary-branches/:id", can(`${F_BRANCH}.delete`), async (req, res) => {
  try {
    await prisma.beneficiaryBranch.delete({ where: { id: Number(req.params.id) } }); // کارمندهای مشمولِ این شعبه را lib/deleteUsage.ts می‌گوید
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف شعبه");
  }
});

export default router;
