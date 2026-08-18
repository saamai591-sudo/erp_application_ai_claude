import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getDetailOptions } from "../utils/detailValues";

const router = Router();

router.get("/", async (_req, res) => {
  const types = await prisma.detailType.findMany({ orderBy: { code: "asc" } });
  res.json(types);
});

router.get("/:id/options", async (req, res) => {
  const options = await getDetailOptions(Number(req.params.id));
  res.json(options);
});

// پاکسازی یک‌باره‌ی رکوردهای یتیم DetailCodeUsage (باقی‌مانده از موجودیت‌هایی که قبل از افزودن پاکسازی خودکار حذف شده بودند)
async function cleanupOrphans(_req: any, res: any) {
  const usages = await prisma.detailCodeUsage.findMany();
  let removed = 0;
  for (const u of usages) {
    let exists = false;
    switch (u.entityTable) {
      case "Party":
        exists = !!(await prisma.party.findUnique({ where: { id: u.entityId } }));
        break;
      case "CashBox":
        exists = !!(await prisma.cashBox.findUnique({ where: { id: u.entityId } }));
        break;
      case "BankAccount":
        exists = !!(await prisma.bankAccount.findUnique({ where: { id: u.entityId } }));
        break;
      case "CostCenter":
        exists = !!(await prisma.costCenter.findUnique({ where: { id: u.entityId } }));
        break;
      case "FiscalPeriod":
        exists = !!(await prisma.fiscalPeriod.findUnique({ where: { id: u.entityId } }));
        break;
      default:
        exists = true; // نوع ناشناخته را دست‌نخورده باقی می‌گذاریم
    }
    if (!exists) {
      await prisma.detailCodeUsage.delete({ where: { id: u.id } });
      removed++;
    }
  }
  res.json({ removed, total: usages.length });
}

// هم GET (برای اجرا با باز کردن لینک در مرورگر) و هم POST پشتیبانی می‌شود
router.get("/cleanup-orphans", cleanupOrphans);
router.post("/cleanup-orphans", cleanupOrphans);

// طول کد، شماره شروع، شماره پایان قابل ویرایش‌اند؛ کد و عنوان قابل ویرایش نیستند.
// اگر از این نوع تفصیل رکوردی صادر شده باشد، شماره شروع و طول کد دیگر قابل تغییر نیست.
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { codeLength, startNumber, endNumber } = req.body as {
    codeLength?: number;
    startNumber?: number;
    endNumber?: number;
  };

  const type = await prisma.detailType.findUnique({ where: { id } });
  if (!type) return res.status(404).json({ error: "نوع تفصیل یافت نشد" });

  const usageCount = await prisma.detailCodeUsage.count({ where: { detailTypeId: id } });

  if (usageCount > 0 && (codeLength !== undefined || startNumber !== undefined)) {
    return res.status(400).json({
      error: "با ثبت اولین تفصیل از این نوع، طول کد و شماره شروع دیگر قابل تغییر نیستند",
    });
  }

  if (codeLength !== undefined && codeLength > 15) {
    return res.status(400).json({ error: "طول کد حداکثر می‌تواند ۱۵ باشد" });
  }

  const maxAllowed = codeLength ? Math.pow(10, codeLength) - 1 : Math.pow(10, type.codeLength) - 1;
  if (startNumber !== undefined && startNumber > maxAllowed) {
    return res.status(400).json({ error: `شماره شروع نمی‌تواند بیشتر از ${maxAllowed} باشد` });
  }
  if (endNumber !== undefined && endNumber > maxAllowed) {
    return res.status(400).json({ error: `شماره پایان نمی‌تواند بیشتر از ${maxAllowed} باشد` });
  }

  const updated = await prisma.detailType.update({
    where: { id },
    data: { codeLength, startNumber, endNumber },
  });
  res.json(updated);
});

export default router;
