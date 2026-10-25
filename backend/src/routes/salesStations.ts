import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";

// فروش فروشگاهی › تنظیمات › «ایستگاه فروش»: صندوقِ دریافت نقد، انبارِ کسر موجودی (فقط وقتی ارائه شامل کالاست)، نوع ارائه (کالا / خدمت / هر دو)، نوع فروش،
// مشتری پیش‌فرض و مرکز هزینه. کارتخوان فعلاً تعریف نمی‌شود (در آینده به همین فرم اضافه می‌شود). فی ایستگاه از «اعلامیه قیمت فروش» با حوزه‌ی «ایستگاه» می‌آید.

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
  return { title, offering: offering as Offering, cashBoxId, warehouseId, salesTypeId, customerId, costCenterId, description, isActive: b?.isActive !== false };
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
    const data = await clean(req.body);
    for (let attempt = 0; ; attempt++) {
      try {
        const code = await nextSerialNumber(prisma.salesStation, "code");
        const created = await prisma.salesStation.create({ data: { ...data, code }, include: INCLUDE });
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
    const data = await clean(req.body);
    const updated = await prisma.salesStation.update({ where: { id }, data, include: INCLUDE });
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
