import type { JobDefinition } from "./types";
import taxInvoiceReadiness from "./taxInvoiceReadiness";
import paymentJournalEntries from "./paymentJournalEntries";
import taxInvoiceSend from "./taxInvoiceSend";

// فهرست کارهای زمان‌بندی‌شده. کار جدید = یک فایل در همین پوشه با defineJob({...}) و یک خط در آرایه‌ی زیر
// (راهنما: jobs/README.md). کلید هر کار (key) یکتا و ثابت است.
export const JOBS: JobDefinition[] = [taxInvoiceReadiness, paymentJournalEntries, taxInvoiceSend];

const byKey = new Map(JOBS.map((j) => [j.key, j]));
if (byKey.size !== JOBS.length) throw new Error("کلید کارهای زمان‌بندی‌شده تکراری است");

export function getJobDefinition(key: string): JobDefinition | undefined {
  return byKey.get(key);
}
