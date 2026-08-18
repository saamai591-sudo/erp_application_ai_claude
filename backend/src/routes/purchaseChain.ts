import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { getAllowedGoodsTypes } from "../data/warehouseDocNatureMatrix";

// =========================================================================
// ماژول «زنجیره تامین» > تنظیمات: مسیر خرید، تامین‌کننده، گروه خرید، کارشناس خرید
// طبق مستندات 03_مسیر خرید، 00_تامین کننده، 01_گروه خرید، 02_کارشناس خرید.
// تصمیم‌های تفسیری (طبق تایید کاربر) در claude/سرویس-زنجیره-تامین-تنظیمات.md مستند شده است.
// =========================================================================

const router = Router();

// ------------------------------------------------------------------ مسیر خرید

router.get("/purchase-routes", async (_req, res) => {
  res.json(await prisma.purchaseRoute.findMany({ orderBy: { code: "asc" } }));
});

router.post("/purchase-routes", async (req, res) => {
  const body = req.body as { code?: number; title: string; nature: string; isActive?: boolean };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.nature) return res.status(400).json({ error: "ماهیت الزامی است" });

  try {
    const dup = await prisma.purchaseRoute.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.purchaseRoute, "code"));
    const created = await prisma.purchaseRoute.create({
      data: { code: finalCode, title: body.title, nature: body.nature as any, isActive: body.isActive ?? true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت مسیر خرید" });
  }
});

router.put("/purchase-routes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; nature?: string; isActive?: boolean };

  if (body.title) {
    const dup = await prisma.purchaseRoute.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.purchaseRoute.update({
      where: { id },
      data: { title: body.title, nature: body.nature as any, isActive: body.isActive },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش مسیر خرید" });
  }
});

router.delete("/purchase-routes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.purchaseRoute.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "مسیر خرید یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: "این مسیر خرید گردش دارد و قابل حذف نیست" });
  await prisma.purchaseRoute.delete({ where: { id } });
  res.status(204).send();
});

// ------------------------------------------------------------------ تامین‌کننده

router.get("/suppliers", async (_req, res) => {
  const items = await prisma.supplier.findMany({
    include: { party: true, groups: { include: { purchaseGroup: true }, orderBy: { rowOrder: "asc" } } },
    orderBy: { code: "asc" },
  });
  res.json(
    items.map((s: any) => ({
      id: s.id,
      code: s.code,
      partyId: s.partyId,
      party: s.party,
      isActive: s.isActive,
      hasTransactions: s.hasTransactions,
      groupIds: s.groups.map((g: any) => g.purchaseGroupId),
      groups: s.groups.map((g: any) => ({ id: g.purchaseGroupId, code: g.purchaseGroup.code, title: g.purchaseGroup.title })),
    }))
  );
});

async function setSupplierGroups(tx: any, supplierId: number, groupIds: number[]) {
  await tx.purchaseGroupSupplier.deleteMany({ where: { supplierId } });
  if (groupIds.length) {
    await tx.purchaseGroupSupplier.createMany({
      data: groupIds.map((purchaseGroupId, idx) => ({ supplierId, purchaseGroupId, rowOrder: idx })),
    });
  }
}

router.post("/suppliers", async (req, res) => {
  const body = req.body as { code?: number; partyId: number; isActive?: boolean; groupIds?: number[] };
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party) return res.status(404).json({ error: "طرف حساب یافت نشد" });

    const dup = await prisma.supplier.findUnique({ where: { partyId: body.partyId } });
    if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان تامین‌کننده تعریف شده است" });

    const groupIds = Array.from(new Set(body.groupIds || []));
    if (groupIds.length) {
      const count = await prisma.purchaseGroup.count({ where: { id: { in: groupIds } } });
      if (count !== groupIds.length) return res.status(400).json({ error: "یکی از گروه‌های خرید انتخاب‌شده یافت نشد" });
    }

    const finalCode = body.code ?? (await nextSerialNumber(prisma.supplier, "code"));
    const created = await prisma.$transaction(async (tx: any) => {
      const s = await tx.supplier.create({ data: { code: finalCode, partyId: body.partyId, isActive: body.isActive ?? true } });
      await setSupplierGroups(tx, s.id, groupIds);
      return s;
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت تامین‌کننده" });
  }
});

router.put("/suppliers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { partyId?: number; isActive?: boolean; groupIds?: number[] };

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "تامین‌کننده یافت نشد" });

  try {
    if (body.partyId && body.partyId !== existing.partyId) {
      const party = await prisma.party.findUnique({ where: { id: body.partyId } });
      if (!party) return res.status(404).json({ error: "طرف حساب یافت نشد" });
      const dup = await prisma.supplier.findFirst({ where: { partyId: body.partyId, NOT: { id } } });
      if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان تامین‌کننده تعریف شده است" });
    }

    const groupIds = body.groupIds ? Array.from(new Set(body.groupIds)) : undefined;
    if (groupIds && groupIds.length) {
      const count = await prisma.purchaseGroup.count({ where: { id: { in: groupIds } } });
      if (count !== groupIds.length) return res.status(400).json({ error: "یکی از گروه‌های خرید انتخاب‌شده یافت نشد" });
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const s = await tx.supplier.update({ where: { id }, data: { partyId: body.partyId, isActive: body.isActive } });
      if (groupIds !== undefined) await setSupplierGroups(tx, id, groupIds);
      return s;
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش تامین‌کننده" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.supplier.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "تامین‌کننده یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: "این تامین‌کننده گردش دارد و قابل حذف نیست" });
  await prisma.supplier.delete({ where: { id } });
  res.status(204).send();
});

// ------------------------------------------------------------------ گروه خرید

router.get("/purchase-groups", async (_req, res) => {
  const items = await prisma.purchaseGroup.findMany({
    include: {
      suppliers: { include: { supplier: { include: { party: true } } }, orderBy: { rowOrder: "asc" } },
      goodsItems: { include: { goodsItem: { include: { mainUnit: true } } }, orderBy: { rowOrder: "asc" } },
    },
    orderBy: { code: "asc" },
  });
  res.json(
    items.map((g: any) => ({
      id: g.id,
      code: g.code,
      title: g.title,
      isActive: g.isActive,
      hasTransactions: g.hasTransactions,
      supplierCount: g.suppliers.length,
      goodsItemCount: g.goodsItems.length,
      suppliers: g.suppliers.map((s: any) => ({
        supplierId: s.supplierId,
        code: s.supplier.code,
        partyId: s.supplier.partyId,
        party: s.supplier.party,
      })),
      goodsItems: g.goodsItems.map((gi: any) => ({
        goodsItemId: gi.goodsItemId,
        fullCode: gi.goodsItem.fullCode,
        title: gi.goodsItem.title,
        unitTitle: gi.goodsItem.mainUnit?.title || "",
      })),
    }))
  );
});

async function setGroupSuppliers(tx: any, purchaseGroupId: number, supplierIds: number[]) {
  await tx.purchaseGroupSupplier.deleteMany({ where: { purchaseGroupId } });
  if (supplierIds.length) {
    await tx.purchaseGroupSupplier.createMany({
      data: supplierIds.map((supplierId, idx) => ({ purchaseGroupId, supplierId, rowOrder: idx })),
    });
  }
}

async function setGroupGoodsItems(tx: any, purchaseGroupId: number, goodsItemIds: number[]) {
  await tx.purchaseGroupGoodsItem.deleteMany({ where: { purchaseGroupId } });
  if (goodsItemIds.length) {
    await tx.purchaseGroupGoodsItem.createMany({
      data: goodsItemIds.map((goodsItemId, idx) => ({ purchaseGroupId, goodsItemId, rowOrder: idx })),
    });
  }
}

async function validateGroupGoodsItems(goodsItemIds: number[]) {
  if (!goodsItemIds.length) return;
  // طبق مستند «گروه خرید»: کالاهای مجاز، همان کالاهای مجاز در ماهیت «خرید» طبق مستند
  // «نوع کالا-ماهیت سند انبار» هستند (وارده/خرید) + kind=GOODS.
  const allowedTypes = getAllowedGoodsTypes("INBOUND", "خرید") || [];
  const items = await prisma.goodsItem.findMany({
    where: { id: { in: goodsItemIds } },
    include: { accountingGroup: true },
  });
  if (items.length !== goodsItemIds.length) throw new Error("یکی از کالاهای انتخاب‌شده یافت نشد");
  for (const item of items) {
    if (item.kind !== "GOODS") throw new Error(`ردیف کالا «${item.title}»: فقط کالا قابل انتخاب است (نه خدمت)`);
    if (!allowedTypes.includes(item.accountingGroup.goodsType as any)) {
      throw new Error(`ردیف کالا «${item.title}»: نوع کالای این آیتم در ماهیت خرید مجاز نیست`);
    }
  }
}

router.post("/purchase-groups", async (req, res) => {
  const body = req.body as { code?: number; title: string; isActive?: boolean; supplierIds?: number[]; goodsItemIds?: number[] };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });

  try {
    const dup = await prisma.purchaseGroup.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const supplierIds = Array.from(new Set(body.supplierIds || []));
    const goodsItemIds = Array.from(new Set(body.goodsItemIds || []));
    if (supplierIds.length) {
      const count = await prisma.supplier.count({ where: { id: { in: supplierIds } } });
      if (count !== supplierIds.length) return res.status(400).json({ error: "یکی از تامین‌کنندگان انتخاب‌شده یافت نشد" });
    }
    await validateGroupGoodsItems(goodsItemIds);

    const finalCode = body.code ?? (await nextSerialNumber(prisma.purchaseGroup, "code"));
    const created = await prisma.$transaction(async (tx: any) => {
      const g = await tx.purchaseGroup.create({ data: { code: finalCode, title: body.title, isActive: body.isActive ?? true } });
      await setGroupSuppliers(tx, g.id, supplierIds);
      await setGroupGoodsItems(tx, g.id, goodsItemIds);
      return g;
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت گروه خرید" });
  }
});

router.put("/purchase-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; isActive?: boolean; supplierIds?: number[]; goodsItemIds?: number[] };

  const existing = await prisma.purchaseGroup.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "گروه خرید یافت نشد" });

  if (body.title) {
    const dup = await prisma.purchaseGroup.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const supplierIds = body.supplierIds ? Array.from(new Set(body.supplierIds)) : undefined;
    const goodsItemIds = body.goodsItemIds ? Array.from(new Set(body.goodsItemIds)) : undefined;
    if (supplierIds && supplierIds.length) {
      const count = await prisma.supplier.count({ where: { id: { in: supplierIds } } });
      if (count !== supplierIds.length) return res.status(400).json({ error: "یکی از تامین‌کنندگان انتخاب‌شده یافت نشد" });
    }
    if (goodsItemIds) await validateGroupGoodsItems(goodsItemIds);

    const updated = await prisma.$transaction(async (tx: any) => {
      const g = await tx.purchaseGroup.update({ where: { id }, data: { title: body.title, isActive: body.isActive } });
      if (supplierIds !== undefined) await setGroupSuppliers(tx, id, supplierIds);
      if (goodsItemIds !== undefined) await setGroupGoodsItems(tx, id, goodsItemIds);
      return g;
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش گروه خرید" });
  }
});

router.delete("/purchase-groups/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.purchaseGroup.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "گروه خرید یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: "این گروه خرید گردش دارد و قابل حذف نیست" });
  await prisma.purchaseGroup.delete({ where: { id } });
  res.status(204).send();
});

// ------------------------------------------------------------------ کارشناس خرید

router.get("/purchase-experts", async (_req, res) => {
  const items = await prisma.purchaseExpert.findMany({
    include: { party: true, groups: { include: { purchaseGroup: true }, orderBy: { rowOrder: "asc" } } },
    orderBy: { code: "asc" },
  });
  res.json(
    items.map((e: any) => ({
      id: e.id,
      code: e.code,
      partyId: e.partyId,
      party: e.party,
      isActive: e.isActive,
      hasTransactions: e.hasTransactions,
      groupIds: e.groups.map((g: any) => g.purchaseGroupId),
      groups: e.groups.map((g: any) => ({ id: g.purchaseGroupId, code: g.purchaseGroup.code, title: g.purchaseGroup.title })),
    }))
  );
});

async function setExpertGroups(tx: any, purchaseExpertId: number, groupIds: number[]) {
  await tx.purchaseExpertGroup.deleteMany({ where: { purchaseExpertId } });
  if (groupIds.length) {
    await tx.purchaseExpertGroup.createMany({
      data: groupIds.map((purchaseGroupId, idx) => ({ purchaseExpertId, purchaseGroupId, rowOrder: idx })),
    });
  }
}

router.post("/purchase-experts", async (req, res) => {
  const body = req.body as { code?: number; partyId: number; isActive?: boolean; groupIds?: number[] };
  if (!body.partyId) return res.status(400).json({ error: "طرف حساب الزامی است" });

  try {
    const party = await prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party || party.category !== "INDIVIDUAL") {
      return res.status(400).json({ error: "کارشناس خرید باید یک طرف‌حساب از نوع شخص حقیقی باشد" });
    }

    const dup = await prisma.purchaseExpert.findUnique({ where: { partyId: body.partyId } });
    if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان کارشناس خرید تعریف شده است" });

    const groupIds = Array.from(new Set(body.groupIds || []));
    if (groupIds.length) {
      const count = await prisma.purchaseGroup.count({ where: { id: { in: groupIds } } });
      if (count !== groupIds.length) return res.status(400).json({ error: "یکی از گروه‌های خرید انتخاب‌شده یافت نشد" });
    }

    const finalCode = body.code ?? (await nextSerialNumber(prisma.purchaseExpert, "code"));
    const created = await prisma.$transaction(async (tx: any) => {
      const ex = await tx.purchaseExpert.create({ data: { code: finalCode, partyId: body.partyId, isActive: body.isActive ?? true } });
      await setExpertGroups(tx, ex.id, groupIds);
      return ex;
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت کارشناس خرید" });
  }
});

router.put("/purchase-experts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { partyId?: number; isActive?: boolean; groupIds?: number[] };

  const existing = await prisma.purchaseExpert.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "کارشناس خرید یافت نشد" });

  try {
    if (body.partyId && body.partyId !== existing.partyId) {
      const party = await prisma.party.findUnique({ where: { id: body.partyId } });
      if (!party || party.category !== "INDIVIDUAL") {
        return res.status(400).json({ error: "کارشناس خرید باید یک طرف‌حساب از نوع شخص حقیقی باشد" });
      }
      const dup = await prisma.purchaseExpert.findFirst({ where: { partyId: body.partyId, NOT: { id } } });
      if (dup) return res.status(400).json({ error: "این طرف حساب قبلاً به‌عنوان کارشناس خرید تعریف شده است" });
    }

    let groupIds: number[] | undefined;
    if (body.groupIds !== undefined) {
      groupIds = Array.from(new Set(body.groupIds));
      if (groupIds.length) {
        const count = await prisma.purchaseGroup.count({ where: { id: { in: groupIds } } });
        if (count !== groupIds.length) return res.status(400).json({ error: "یکی از گروه‌های خرید انتخاب‌شده یافت نشد" });
      }
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const ex = await tx.purchaseExpert.update({ where: { id }, data: { partyId: body.partyId, isActive: body.isActive } });
      if (groupIds !== undefined) await setExpertGroups(tx, id, groupIds);
      return ex;
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش کارشناس خرید" });
  }
});

router.delete("/purchase-experts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.purchaseExpert.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ error: "کارشناس خرید یافت نشد" });
  if (item.hasTransactions) return res.status(400).json({ error: "این کارشناس خرید گردش دارد و قابل حذف نیست" });
  await prisma.purchaseExpert.delete({ where: { id } });
  res.status(204).send();
});

export default router;
