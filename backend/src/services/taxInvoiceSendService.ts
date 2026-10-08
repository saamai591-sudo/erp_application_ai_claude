// ارسال صورتحساب‌های فروش به سامانه مودیان و استعلام وضعیت — هماهنگ‌کننده‌ی «ساخت JSON» (taxInvoiceBuilder) و «ارتباط» (taxTransport).
//
// ترتیب برای هر فاکتور (مثل سیستم سام: یک‌به‌یک):
//  ۱) اعتبارسنجی محلی؛ هر خطا ارسال را متوقف می‌کند.
//  ۲) در «یک تراکنش»: سریال حافظه رزرو می‌شود (UPDATE اتمی)، JSON با همان سریال ساخته و ردیف TaxInvoice (IN_PROGRESS) ذخیره می‌شود؛ هر شکستی همه را برمی‌گرداند (بدون شکاف سریال).
//  ۳) ارسال به سامانه؛ شماره پیگیری ذخیره می‌شود. اگر سامانه صریحاً رد کند ← FAILED؛ اگر نتیجه نامعلوم باشد (قطع ارتباط) ← IN_PROGRESS و بعداً با «استعلام» (uid) روشن می‌شود.
//  ۴) پس از ارسال، ~۱٫۵ ثانیه صبر و استعلام با شماره پیگیری (SUCCESS/FAILED + خطا/هشدارها).

import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { buildTaxInvoice, loadSalesInvoiceForTax, TaxInvoiceOptions } from "./taxInvoiceBuilder";
import { allocateTaxSerial } from "./taxId";
import { decryptPrivateKey } from "./taxMemoryService";
import { createTaxTransport, InquiryResult, TaxApiError, TaxTransport } from "./taxTransport";
import { toWireInvoice } from "./taxWire";

export interface SendItemInput extends Partial<TaxInvoiceOptions> {
  salesInvoiceId: number;
}
export interface SendItemResult {
  salesInvoiceId: number;
  invoiceNumber: number | null;
  ok: boolean;
  message: string;
  taxId?: string;
}

const transports = new Map<number, { key: string; transport: TaxTransport }>();

/** ترانسپورت حافظه‌ی مالیاتی (یک‌بار ساخته و تا تغییر شناسه/کلید نگه‌داشته می‌شود) */
function transportFor(memory: { id: number; taxMemoryUniqueId: string | null; privateKeyEncrypted: string }): TaxTransport {
  const fiscalId = (memory.taxMemoryUniqueId ?? "").trim().toUpperCase();
  if (!fiscalId) throw new TaxApiError("شناسه یکتای حافظه مالیاتی ثبت نشده است");
  const cacheKey = `${fiscalId}|${memory.privateKeyEncrypted.length}`;
  const hit = transports.get(memory.id);
  if (hit && hit.key === cacheKey) return hit.transport;
  const transport = createTaxTransport({ fiscalId, privateKeyPem: decryptPrivateKey(memory.privateKeyEncrypted) });
  transports.set(memory.id, { key: cacheKey, transport });
  return transport;
}

const toJson = (v: unknown) => v as Prisma.InputJsonValue;

function asList(v: unknown): { code?: string; message?: string }[] {
  return Array.isArray(v) ? (v as any[]).map((e) => ({ code: String(e?.code ?? e?.errorCode ?? ""), message: String(e?.message ?? e?.detail ?? "") })) : [];
}

/** نتیجه‌ی استعلام یک صورتحساب ← به‌روزرسانی ردیف TaxInvoice */
async function applyInquiry(taxInvoiceId: number, r: InquiryResult) {
  const status = r.status.toUpperCase();
  const data = r.data && typeof r.data === "object" ? r.data : null;
  const patch: Prisma.TaxInvoiceUpdateInput = { checkedAt: new Date() };
  if (status === "SUCCESS") patch.status = "SUCCESS";
  else if (status === "FAILED") patch.status = "FAILED";
  else if (status === "TIMEOUT") patch.status = "TIMEOUT";
  // IN_PROGRESS / NOT_FOUND: وضعیت دست‌نخورده
  if (data) {
    patch.errors = toJson(asList(data.error));
    patch.warnings = toJson(asList(data.warning));
  }
  if (r.referenceNumber) patch.referenceNumber = r.referenceNumber;
  await prisma.taxInvoice.update({ where: { id: taxInvoiceId }, data: patch });
}

export async function sendTaxInvoices(items: SendItemInput[]): Promise<SendItemResult[]> {
  const results: SendItemResult[] = [];
  const pending: { taxInvoiceId: number; referenceNumber: string; memoryId: number }[] = [];

  for (const it of items) {
    const base: SendItemResult = { salesInvoiceId: it.salesInvoiceId, invoiceNumber: null, ok: false, message: "" };
    try {
      const inv = await loadSalesInvoiceForTax(it.salesInvoiceId);
      if (!inv) {
        results.push({ ...base, message: "فاکتور یافت نشد" });
        continue;
      }
      base.invoiceNumber = inv.number;
      const options: Partial<TaxInvoiceOptions> = { invoiceType: it.invoiceType, isArticle9: it.isArticle9, settlementMethod: it.settlementMethod };

      const pre = await buildTaxInvoice(inv, options, { skipTaxId: true });
      if (pre.errorCount > 0) {
        results.push({ ...base, message: pre.problems.filter((p) => p.severity === "error").map((p) => p.message).join(" | ") });
        continue;
      }
      const memory = inv.numberingPattern!.taxMemory!;
      const transport = transportFor(memory); // اگر ارسال خاموش باشد همین‌جا خطا می‌دهد، پیش از رزرو سریال

      const nowMs = Date.now();
      const created = await prisma.$transaction(async (tx: any) => {
        const serial = await allocateTaxSerial(tx, memory.id);
        const built = await buildTaxInvoice(inv, options, { serial, nowMs });
        if (built.errorCount > 0 || !built.payload || !built.meta.taxId || built.meta.issuedAt == null) {
          throw new TaxApiError(built.problems.filter((p) => p.severity === "error").map((p) => p.message).join(" | ") || "ساخت صورتحساب ناموفق بود");
        }
        const wire = toWireInvoice(built.payload);
        const row = await tx.taxInvoice.create({
          data: {
            taxMemoryId: memory.id,
            salesInvoiceId: inv.id,
            subject: 1,
            invoiceType: built.payload.header.inty,
            settlementMethod: built.payload.header.setm,
            isArticle9: !!options.isArticle9,
            taxId: built.meta.taxId,
            serial,
            issuedAt: BigInt(built.meta.issuedAt),
            payload: toJson(wire),
            requestTraceId: crypto.randomUUID(),
            status: "IN_PROGRESS",
          },
        });
        return { row, wire };
      }, { timeout: 30_000 });

      try {
        const sent = await transport.sendInvoices([{ uid: created.row.requestTraceId, invoice: created.wire }]);
        const r = sent.find((s) => s.uid === created.row.requestTraceId) ?? sent[0];
        if (r?.referenceNumber) {
          await prisma.taxInvoice.update({ where: { id: created.row.id }, data: { referenceNumber: r.referenceNumber } });
          pending.push({ taxInvoiceId: created.row.id, referenceNumber: r.referenceNumber, memoryId: memory.id });
          results.push({ ...base, ok: true, taxId: created.row.taxId, message: "ارسال شد؛ در انتظار نتیجه‌ی اعتبارسنجی سامانه" });
        } else {
          const msg = r?.errorDetail || "سامانه شماره پیگیری برنگرداند";
          await prisma.taxInvoice.update({ where: { id: created.row.id }, data: { status: "FAILED", errors: toJson([{ code: r?.errorCode ?? "", message: msg }]) } });
          results.push({ ...base, taxId: created.row.taxId, message: msg });
        }
      } catch (e: any) {
        // خطای صریح سامانه (مثلاً احراز هویت) ⇒ بسته پذیرفته نشده؛ خطای ارتباطی ⇒ نتیجه نامعلوم (با «استعلام» روشن می‌شود)
        const explicit = e instanceof TaxApiError && !!e.errorCode;
        await prisma.taxInvoice.update({
          where: { id: created.row.id },
          data: { status: explicit ? "FAILED" : "IN_PROGRESS", errors: toJson([{ code: (e as TaxApiError).errorCode ?? "", message: e.message }]) },
        });
        results.push({ ...base, taxId: created.row.taxId, message: explicit ? e.message : `نتیجه‌ی ارسال نامعلوم است (${e.message}) — بعداً «استعلام وضعیت» بزنید` });
      }
    } catch (e: any) {
      results.push({ ...base, message: e.message || "خطا در ارسال" });
    }
  }

  // استعلام نتیجه‌ی ارسال‌های موفق (با کمی مهلت برای پردازش سامانه)
  if (pending.length) {
    await new Promise((r) => setTimeout(r, 1500));
    await inquirePending(pending).catch(() => undefined);
  }
  return results;
}

async function inquirePending(pending: { taxInvoiceId: number; referenceNumber: string; memoryId: number }[]) {
  const byMemory = new Map<number, typeof pending>();
  for (const p of pending) byMemory.set(p.memoryId, [...(byMemory.get(p.memoryId) ?? []), p]);
  for (const [memoryId, list] of byMemory) {
    const memory = await prisma.taxMemory.findUnique({ where: { id: memoryId } });
    if (!memory) continue;
    const transport = transportFor(memory);
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const res = await transport.inquiryByReferenceNumbers(chunk.map((c) => c.referenceNumber));
      for (const r of res) {
        const hit = chunk.find((c) => c.referenceNumber === r.referenceNumber);
        if (hit) await applyInquiry(hit.taxInvoiceId, r);
      }
    }
  }
}

/** «استعلام وضعیت»: صورتحساب‌های در حال بررسی (یا مشخص‌شده) را از سامانه می‌پرسد؛ بدون شماره پیگیری با uid استعلام می‌شود */
export async function refreshTaxInvoiceStatuses(ids?: number[]): Promise<{ checked: number; updated: number }> {
  const rows = await prisma.taxInvoice.findMany({
    where: ids?.length ? { id: { in: ids } } : { status: "IN_PROGRESS" },
    include: { taxMemory: true },
    take: 500,
  });
  let updated = 0;
  const byMemory = new Map<number, typeof rows>();
  for (const r of rows) byMemory.set(r.taxMemoryId, [...(byMemory.get(r.taxMemoryId) ?? []), r]);
  for (const [, list] of byMemory) {
    const transport = transportFor(list[0].taxMemory);
    const withRef = list.filter((r) => r.referenceNumber);
    const withoutRef = list.filter((r) => !r.referenceNumber);
    for (let i = 0; i < withRef.length; i += 100) {
      const chunk = withRef.slice(i, i + 100);
      for (const r of await transport.inquiryByReferenceNumbers(chunk.map((c) => c.referenceNumber!))) {
        const hit = chunk.find((c) => c.referenceNumber === r.referenceNumber);
        if (hit) {
          await applyInquiry(hit.id, r);
          updated++;
        }
      }
    }
    for (let i = 0; i < withoutRef.length; i += 100) {
      const chunk = withoutRef.slice(i, i + 100);
      for (const r of await transport.inquiryByUids(chunk.map((c) => ({ uid: c.requestTraceId })))) {
        const hit = chunk.find((c) => c.requestTraceId === r.uid);
        if (hit) {
          await applyInquiry(hit.id, r);
          updated++;
        }
      }
    }
  }
  return { checked: rows.length, updated };
}

/** فاکتوری که صورتحساب مالیاتیِ «در حال بررسی/ثبت‌شده» دارد قفل است (ویرایش/حذف/ابطال محلی ممنوع؛ تغییر فقط با صورتحساب ابطالی/اصلاحی/برگشت از فروش — فاز بعد) */
export async function assertNotSentToTax(salesInvoiceId: number): Promise<void> {
  const n = await prisma.taxInvoice.count({ where: { salesInvoiceId, status: { in: ["IN_PROGRESS", "SUCCESS"] } } });
  if (n > 0) throw new Error("این فاکتور به سامانه مودیان ارسال شده است و قابل ویرایش/حذف/ابطال نیست؛ تغییر آن فقط با صورتحساب ابطالی/اصلاحی/برگشت از فروش ممکن است");
}
