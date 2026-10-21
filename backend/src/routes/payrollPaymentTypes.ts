import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { nextSerialNumber } from "../utils/coding";
import { PayTypeError, itemCreateData, loadPayRefOptions, validatePaymentType } from "../services/payrollPaymentTypeService";

// حقوق و دستمزد › تنظیمات › نوع پرداخت حقوق (قواعد: services/payrollPaymentTypeService.ts)

const F = findFormPrefix("payroll-payment-types");
const router = Router();

function fail(res: any, e: any, fallback: string) {
  if (e instanceof PayTypeError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکورد تکراری است" });
  return res.status(400).json({ error: e?.message || fallback });
}

const include = {
  beneficiaryOrg: { select: { id: true, title: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      payrollComponent: { select: { id: true, title: true, kind: true, calcType: { select: { title: true } } } },
      loanType: { select: { id: true, title: true } },
      netCalcType: { select: { id: true, title: true } },
    },
  },
} as const;

const KIND_FA: Record<string, string> = { DEDUCTION: "کسر", EMPLOYER_COST: "هزینه کارفرما" };

function shape(t: any, baseTitle: string) {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    isActive: t.isActive,
    payTo: t.payTo,
    beneficiaryOrgId: t.beneficiaryOrgId,
    beneficiaryOrgTitle: t.beneficiaryOrg?.title ?? null,
    hasFile: t.hasFile,
    itemCount: t.items.length,
    items: t.items.map((i: any) =>
      i.payrollComponent
        ? { id: i.id, field: "payrollComponentId", refId: i.payrollComponent.id, key: `P:${i.payrollComponent.id}`, type: KIND_FA[i.payrollComponent.kind] ?? i.payrollComponent.kind, title: i.payrollComponent.title, calcTypeTitle: i.payrollComponent.calcType.title }
        : i.loanType
          ? { id: i.id, field: "loanTypeId", refId: i.loanType.id, key: `L:${i.loanType.id}`, type: "وام", title: i.loanType.title, calcTypeTitle: baseTitle }
          : { id: i.id, field: "netCalcTypeId", refId: i.netCalcType.id, key: `N:${i.netCalcType.id}`, type: "خالص پرداختی", title: "خالص پرداختی", calcTypeTitle: i.netCalcType.title }
    ),
  };
}
const baseCalcTitle = async () => (await prisma.payrollCalcType.findFirst({ where: { isBase: true }, select: { title: true } }))?.title ?? "";

router.get("/payroll-payment-types", can(`${F}.view`), async (_req, res) => {
  const [rows, base] = await Promise.all([prisma.payrollPaymentType.findMany({ include, orderBy: { code: "asc" } }), baseCalcTitle()]);
  res.json(rows.map((r) => shape(r, base)));
});

/** گزینه‌های فرم: عامل‌ها (کسور، هزینه کارفرما، وام، خالص پرداختی) و سازمان‌های ذینفع */
router.get("/payroll-payment-types/options", can(`${F}.view`), async (_req, res) => {
  const [refs, orgs] = await Promise.all([loadPayRefOptions(), prisma.beneficiaryOrg.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, title: true, isActive: true } })]);
  res.json({ refs, orgs });
});

router.get("/payroll-payment-types/:id", can(`${F}.view`), async (req, res) => {
  const t = await prisma.payrollPaymentType.findUnique({ where: { id: Number(req.params.id) }, include });
  if (!t) return res.status(404).json({ error: "نوع پرداخت حقوق یافت نشد" });
  res.json(shape(t, await baseCalcTitle()));
});

router.post("/payroll-payment-types", can(`${F}.create`), async (req, res) => {
  try {
    const d = await validatePaymentType(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const created = await prisma.payrollPaymentType.create({
          data: {
            code: d.code ?? (await nextSerialNumber(prisma.payrollPaymentType, "code")),
            title: d.title,
            isActive: d.isActive,
            payTo: d.payTo,
            beneficiaryOrgId: d.beneficiaryOrgId,
            hasFile: d.hasFile,
            items: { create: d.items.map(itemCreateData) },
          },
        });
        return res.status(201).json({ id: created.id, code: created.code });
      } catch (e: any) {
        if (e?.code === "P2002" && !d.code && attempt < 3) continue; // مسابقه روی کد خودکار
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع پرداخت حقوق");
  }
});

router.put("/payroll-payment-types/:id", can(`${F}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.payrollPaymentType.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "نوع پرداخت حقوق یافت نشد" });
    const d = await validatePaymentType(req.body, id);
    await prisma.$transaction([
      prisma.payrollPaymentTypeItem.deleteMany({ where: { paymentTypeId: id } }),
      prisma.payrollPaymentType.update({
        where: { id },
        data: {
          ...(d.code ? { code: d.code } : {}),
          title: d.title,
          isActive: d.isActive,
          payTo: d.payTo,
          beneficiaryOrgId: d.beneficiaryOrgId,
          hasFile: d.hasFile,
          items: { create: d.items.map(itemCreateData) },
        },
      }),
    ]);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع پرداخت حقوق");
  }
});

router.delete("/payroll-payment-types/:id", can(`${F}.delete`), async (req, res) => {
  try {
    await prisma.payrollPaymentType.delete({ where: { id: Number(req.params.id) } }); // مانع‌ها را lib/deleteUsage.ts دقیق می‌گوید
    res.status(204).end();
  } catch (e) {
    fail(res, e, "خطا در حذف نوع پرداخت حقوق");
  }
});

export default router;
