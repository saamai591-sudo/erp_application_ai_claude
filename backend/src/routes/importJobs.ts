import { Router } from "express";
import { prisma } from "../lib/prisma";
import { startImportJob, isImportEntityRegistered } from "../services/importJobService";

const router = Router();

router.post("/", async (req, res) => {
  const { entityType, rows, allowDuplicates } = req.body as {
    entityType: string;
    rows: Record<string, string>[];
    allowDuplicates?: boolean;
  };
  if (!entityType || !isImportEntityRegistered(entityType)) {
    return res.status(400).json({ error: `نوع ورودی «${entityType}» پشتیبانی نمی‌شود` });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "هیچ ردیفی برای ورود اطلاعات ارسال نشده است" });
  }
  try {
    const jobId = await startImportJob(entityType, rows, !!allowDuplicates);
    res.status(201).json({ jobId });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در شروع پردازش" });
  }
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const job = await prisma.importJob.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ error: "یافت نشد" });
  res.json({
    id: job.id,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successCount: job.successCount,
    errorCount: job.errorCount,
    resultData: job.status === "DONE" ? job.resultData : undefined,
  });
});

export default router;
