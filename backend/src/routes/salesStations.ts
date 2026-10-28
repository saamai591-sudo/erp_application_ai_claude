import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { BANK_ACCOUNT_TITLE_INCLUDE, bankAccountDetailTitle } from "../utils/detailValues";

// فروش فروشگاهی › تنظیمات › «ایستگاه فروش»: صندوقِ دریافت نقد، انبارِ کسر موجودی (فقط وقتی ارائه شامل کالاست)، نوع ارائه (کالا / خدمت / هر دو)، نوع فروش،
// مشتری پیش‌فرض و مرکز هزینه. کارتخوان‌های ایستگاه در تب «کارتخوان‌ها» تعیین می‌شود (برای دریافت کارتیِ فروش). فی ایستگاه از «اعلامیه قیمت فروش» با حوزه‌ی «ایستگاه» می‌آید.

const FORM = findFormPrefix("sales-stations");
const router = Router();

class StationError extends Error {}

const OFFERINGS = ["GOODS", "SERVICES", "BOTH"] as const;
type Offering = (typeof OFFERINGS)[number];

const INCLUDE = {
  cashBox: { select: { id: true, title: true } },
  warehouse: { select: { id: true, code: true, title: true } },
  salesType: { select: { id: true, title: true } },
  customer: { select: { id: true, code: true, party: { select: { detailTitle: true, name: true, firstName: true, lastName: true, category: true } } } },
  costCenter: { select: { id: true, title: true, detailCode: true } },
  bankAccounts: { include: { bankAccount: { select: { id: true, detailCode: true, accountNumber: true, ...BANK_ACCOUNT_TITLE_INCLUDE } } }, orderBy: { bankAccountId: "asc" } },
  cardReaders: { include: { cardReader: { include: { bankAccount: { select: { id: true, detailCode: true, accountNumber: true, ...BANK_ACCOUNT_TITLE_INCLUDE } } } } }, orderBy: { cardReader: { code: "asc" } } },
} as const;

function customerTitle(c: any): string {
  const p = c?.party;
  if (!p) return "";
  return p.detailTitle || (p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim());
}

export function stationShape(s: any) {
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    isActive: s.isActive,
    offering: s.offering as Offering,
    cashBoxId: s.cashBoxId,
    cashBoxTitle: s.cashBox?.title ?? "",
    warehouseId: s.warehouseId,
    warehouseTitle: s.warehouse?.title ?? "",
    salesTypeId: s.salesTypeId,
    salesTypeTitle: s.salesType?.title ?? "",
    customerId: s.customerId,
    customerCode: s.customer?.code ?? null,
    customerTitle: customerTitle(s.customer),
    costCenterId: s.costCenterId,
    costCenterTitle: s.costCenter?.title ?? "",
    description: s.description ?? "",
    cardReaders: (s.cardReaders ?? []).map((l: any) => ({
      id: l.cardReader.id,
      code: l.cardReader.code,
      title: l.cardReader.title,
      terminalNumber: l.cardReader.terminalNumber,
      merchantNumber: l.cardReader.merchantNumber,
      bankAccountId: l.cardReader.bankAccountId,
      bankAccountCode: l.cardReader.bankAccount?.detailCode ?? "",
      bankAccountTitle: l.cardReader.bankAccount ? bankAccountDetailTitle(l.cardReader.bankAccount) : "",
    })),
    bankAccounts: (s.bankAccounts ?? []).map((l: any) => ({ id: l.bankAccount.id, detailCode: l.bankAccount.detailCode, detailTitle: bankAccountDetailTitle(l.bankAccount) })),
    updatedAt: s.updatedAt,
  };
}

async function clean(b: any) {
  const title = String(b?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new StationError("عنوان الزامی است");
  const offering = String(b?.offering ?? "");
  if (!(OFFERINGS as readonly string[]).includes(offering)) throw new StationError("نوع ارائه (کالا / خدمت / هر دو) را انتخاب کنید");
  const cashBoxId = Number(b?.cashBoxId);
  if (!cashBoxId || !(await prisma.cashBox.findUnique({ where: { id: cashBoxId } }))) throw new StationError("صندوق را انتخاب کنید");
  let warehouseId: number | null = null;
  if (offering !== "SERVICES") {
    warehouseId = Number(b?.warehouseId) || null;
    if (!warehouseId) throw new StationError("برای ایستگاهی که کالا ارائه می‌کند انتخاب انبار الزامی است");
    const w = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!w) throw new StationError("انبار یافت نشد");
    if (!w.isActive) throw new StationError(`انبار «${w.title}» غیرفعال است`);
  }
  const salesTypeId = Number(b?.salesTypeId);
  if (!salesTypeId || !(await prisma.salesType.findUnique({ where: { id: salesTypeId } }))) throw new StationError("نوع فروش را انتخاب کنید");
  const customerId = Number(b?.customerId);
  const customer = customerId ? await prisma.customer.findUnique({ where: { id: customerId } }) : null;
  if (!customer) throw new StationError("مشتری پیش‌فرض را انتخاب کنید");
  if (!customer.isActive) throw new StationError("مشتری پیش‌فرض غیرفعال است");
  const costCenterId = Number(b?.costCenterId);
  if (!costCenterId || !(await prisma.costCenter.findUnique({ where: { id: costCenterId } }))) throw new StationError("مرکز هزینه را انتخاب کنید");
  const description = String(b?.description ?? "").trim() || null;
  // کارتخوان‌ها: مجموعه‌ی کامل (undefined = دست‌نخورده)
  let cardReaderIds: number[] | undefined;
  if (b?.cardReaderIds !== undefined) {
    if (!Array.isArray(b.cardReaderIds)) throw new StationError("فهرست کارتخوان‌ها نامعتبر است");
    cardReaderIds = [...new Set<number>(b.cardReaderIds.map((x: unknown) => Number(x)))];
    if (cardReaderIds.some((x) => !x)) throw new StationError("کارتخوان نامعتبر است");
    const found = await prisma.cardReader.count({ where: { id: { in: cardReaderIds } } });
    if (found !== cardReaderIds.length) throw new StationError("کارتخوان یافت نشد");
  }
  // حساب‌های بانکیِ قابل دریافت: مجموعه‌ی کامل (undefined = دست‌نخورده)
  let bankAccountIds: number[] | undefined;
  if (b?.bankAccountIds !== undefined) {
    if (!Array.isArray(b.bankAccountIds)) throw new StationError("فهرست حساب‌های بانکی نامعتبر است");
    bankAccountIds = [...new Set<number>(b.bankAccountIds.map((x: unknown) => Number(x)))];
    if (bankAccountIds.some((x) => !x)) throw new StationError("حساب بانکی نامعتبر است");
    const found = await prisma.bankAccount.count({ where: { id: { in: bankAccountIds } } });
    if (found !== bankAccountIds.length) throw new StationError("حساب بانکی یافت نشد");
  }
  return { cardReaderIds, bankAccountIds, title, offering: offering as Offering, cashBoxId, warehouseId, salesTypeId, customerId, costCenterId, description, isActive: b?.isActive !== false };
}

const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان یا کد تکراری است" });
  return res.status(400).json({ error: e instanceof StationError ? e.message : e?.message || fallback });
};

// فهرست برای انتخابگرها و فرم فروش (activeOnly=true فقط فعال‌ها)
router.get("/sales-stations", async (req, res) => {
  const rows = await prisma.salesStation.findMany({ where: req.query.activeOnly === "true" ? { isActive: true } : {}, include: INCLUDE, orderBy: { code: "asc" } });
  res.json(rows.map(stationShape));
});

router.get("/sales-stations/:id", async (req, res) => {
  const s = await prisma.salesStation.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!s) return res.status(404).json({ error: "ایستگاه فروش یافت نشد" });
  res.json(stationShape(s));
});

router.post("/sales-stations", can(`${FORM}.create`), async (req, res) => {
  try {
    const { cardReaderIds, bankAccountIds, ...data } = await clean(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const code = await nextSerialNumber(prisma.salesStation, "code");
        const created = await prisma.salesStation.create({ data: { ...data, code, cardReaders: { create: (cardReaderIds ?? []).map((cardReaderId) => ({ cardReaderId })) }, bankAccounts: { create: (bankAccountIds ?? []).map((bankAccountId) => ({ bankAccountId })) } }, include: INCLUDE });
        return res.status(201).json(stationShape(created));
      } catch (e: any) {
        if (e?.code === "P2002" && String(e?.meta?.target ?? "").includes("code") && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    fail(res, e, "خطا در ثبت ایستگاه فروش");
  }
});

router.put("/sales-stations/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.salesStation.findUnique({ where: { id } });
    if (!ex) return res.status(404).json({ error: "ایستگاه فروش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "ایستگاه فروش");
    const { cardReaderIds, bankAccountIds, ...data } = await clean(req.body);
    const updated = await prisma.$transaction(async (tx) => {
      if (cardReaderIds) {
        // کارتخوانِ حذف‌شده از ایستگاه نباید در دریافتِ همین ایستگاه استفاده شده باشد
        const used = await tx.storeReceipt.findMany({ where: { stationId: id, cardReaderId: { not: null, notIn: cardReaderIds } }, select: { cardReader: { select: { title: true } } }, distinct: ["cardReaderId"], take: 5 });
        if (used.length) throw new StationError(`کارتخوان «${used.map((u) => u.cardReader?.title).join("، ")}» در دریافت‌های این ایستگاه استفاده شده و حذف نمی‌شود`);
        await tx.salesStationCardReader.deleteMany({ where: { stationId: id, cardReaderId: { notIn: cardReaderIds } } });
        const have = new Set((await tx.salesStationCardReader.findMany({ where: { stationId: id }, select: { cardReaderId: true } })).map((x) => x.cardReaderId));
        const add = cardReaderIds.filter((x) => !have.has(x));
        if (add.length) await tx.salesStationCardReader.createMany({ data: add.map((cardReaderId) => ({ stationId: id, cardReaderId })) });
      }
      if (bankAccountIds) {
        const used = await tx.storeReceipt.findMany({ where: { stationId: id, bankAccountId: { not: null, notIn: bankAccountIds } }, select: { bankAccountId: true }, distinct: ["bankAccountId"], take: 5 });
        if (used.length) throw new StationError("حساب بانکی‌ای که در دریافت‌های این ایستگاه استفاده شده از فهرست حذف نمی‌شود");
        await tx.salesStationBankAccount.deleteMany({ where: { stationId: id, bankAccountId: { notIn: bankAccountIds } } });
        const haveB = new Set((await tx.salesStationBankAccount.findMany({ where: { stationId: id }, select: { bankAccountId: true } })).map((x) => x.bankAccountId));
        const addB = bankAccountIds.filter((x) => !haveB.has(x));
        if (addB.length) await tx.salesStationBankAccount.createMany({ data: addB.map((bankAccountId) => ({ stationId: id, bankAccountId })) });
      }
      return tx.salesStation.update({ where: { id }, data, include: INCLUDE });
    });
    res.json(stationShape(updated));
  } catch (e) {
    fail(res, e, "خطا در ویرایش ایستگاه فروش");
  }
});

router.delete("/sales-stations/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.salesStation.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "ایستگاه فروش یافت نشد" });
    await prisma.salesStation.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف ایستگاه فروش");
  }
});

export default router;
