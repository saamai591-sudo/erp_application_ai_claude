import { prisma } from "../lib/prisma";

export type ImportRowContext = { allowDuplicates: boolean };
export type ImportRowResult = { ok: boolean; error?: string };
export type ImportRowProcessor = (row: Record<string, string>, ctx: ImportRowContext) => Promise<ImportRowResult>;
/** برای رکوردهای چندردیفی (مثل سند حسابداری): چند ردیف اکسل با هم یک رکورد می‌سازند */
export type ImportGroupProcessor = (rows: Record<string, string>[], ctx: ImportRowContext) => Promise<ImportRowResult>;

interface EntityConfig {
  row?: ImportRowProcessor;
  group?: ImportGroupProcessor;
  /** نام یک ستون (برای گروه‌بندی تک‌فیلدی)، یا تابعی که کلید گروه‌بندی را از کل ردیف می‌سازد (برای
   * گروه‌بندی ترکیبی — مثلاً «شماره گروه سند» + «تاریخ» با هم، تا دو سند با شماره گروه یکسان در دو
   * تاریخ متفاوت اشتباهاً یکی نشوند) */
  groupByKey?: string | ((row: Record<string, string>) => string);
}

const registry: Record<string, EntityConfig> = {};

/** هر ماژول، پردازشگر ردیف خودش را اینجا ثبت می‌کند (مشابه الگوی سرویس مرکزی صدور سند) */
export function registerImportEntity(entityType: string, config: EntityConfig) {
  registry[entityType] = config;
}

export function isImportEntityRegistered(entityType: string): boolean {
  return !!registry[entityType];
}

/** فقط رکورد Job را می‌سازد و پردازش را در پس‌زمینه (بدون انتظار درخواست HTTP) آغاز می‌کند */
export async function startImportJob(entityType: string, rows: Record<string, string>[], allowDuplicates: boolean): Promise<number> {
  const config = registry[entityType];
  if (!config) throw new Error(`نوع ورودی «${entityType}» پشتیبانی نمی‌شود`);

  const job = await prisma.importJob.create({
    data: { entityType, totalRows: rows.length, status: "PENDING" },
  });

  // fire-and-forget: عمداً await نمی‌شود تا پاسخ HTTP فوری برگردد
  processJob(job.id, config, rows, allowDuplicates).catch((err) => {
    console.error(`Import job ${job.id} crashed:`, err);
    prisma.importJob.update({ where: { id: job.id }, data: { status: "DONE" } }).catch(() => {});
  });

  return job.id;
}

async function processJob(jobId: number, config: EntityConfig, rows: Record<string, string>[], allowDuplicates: boolean) {
  await prisma.importJob.update({ where: { id: jobId }, data: { status: "RUNNING" } });

  const ctx: ImportRowContext = { allowDuplicates };
  const results: { rowIndex: number; data: Record<string, string>; status: "ok" | "error"; error?: string }[] = [];
  let success = 0;
  let failed = 0;

  async function flushProgress(processed: number) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { processedRows: processed, successCount: success, errorCount: failed },
    });
  }

  if (config.groupByKey && config.group) {
    const groupOrder: string[] = [];
    const groupIndices = new Map<string, number[]>();
    rows.forEach((r, i) => {
      const key = (typeof config.groupByKey === "function" ? config.groupByKey(r) : r[config.groupByKey!]) || `__row_${i}`;
      if (!groupIndices.has(key)) {
        groupIndices.set(key, []);
        groupOrder.push(key);
      }
      groupIndices.get(key)!.push(i);
    });

    let processedCount = 0;
    for (const key of groupOrder) {
      const indices = groupIndices.get(key)!;
      const groupRows = indices.map((i) => rows[i]);
      let result: ImportRowResult;
      try {
        result = await config.group(groupRows, ctx);
      } catch (e: any) {
        result = { ok: false, error: e.message || "خطای غیرمنتظره" };
      }
      for (const i of indices) {
        results.push({ rowIndex: i + 2, data: rows[i], status: result.ok ? "ok" : "error", error: result.error });
      }
      result.ok ? (success += indices.length) : (failed += indices.length);
      processedCount += indices.length;
      if (processedCount % 20 === 0 || processedCount === rows.length) await flushProgress(processedCount);
    }
  } else if (config.row) {
    for (let i = 0; i < rows.length; i++) {
      let result: ImportRowResult;
      try {
        result = await config.row(rows[i], ctx);
      } catch (e: any) {
        result = { ok: false, error: e.message || "خطای غیرمنتظره" };
      }
      results.push({ rowIndex: i + 2, data: rows[i], status: result.ok ? "ok" : "error", error: result.error });
      result.ok ? success++ : failed++;
      if ((i + 1) % 20 === 0 || i === rows.length - 1) await flushProgress(i + 1);
    }
  }

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: "DONE",
      processedRows: rows.length,
      successCount: success,
      errorCount: failed,
      resultData: results as any,
    },
  });
}
