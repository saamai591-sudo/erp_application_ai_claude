import { getCurrentFiscalPeriod } from "../../lib/prisma";
import { EntityRef } from "../types";

// ابزار مشترکِ کارهای «حواله فروش» و «فاکتور فروش»: انتخاب مبنا (سند مبدأ) با دکمه. یک گزینه‌ی مبنا یک عدد است؛ نوع سند در بخش بالایی عدد کد می‌شود
// تا حالت گفتگو (که فقط {id,label} دارد) تغییر نکند. مبنا در run دوباره با دیتابیس سنجیده می‌شود.

export type BasisKind = "DELIVERY" | "ORDER" | "QUOTE";
const KINDS: BasisKind[] = ["DELIVERY", "ORDER", "QUOTE"];
const STEP = 1_000_000_000;

export const KIND_FA: Record<BasisKind, string> = { DELIVERY: "حواله فروش", ORDER: "سفارش فروش", QUOTE: "پیش‌فاکتور" };

const encodeBasis = (kind: BasisKind, id: number) => KINDS.indexOf(kind) * STEP + id;

export function decodeBasis(code: number): { kind: BasisKind; id: number } | null {
  const i = Math.floor(code / STEP);
  return KINDS[i] ? { kind: KINDS[i], id: code - i * STEP } : null;
}

export const basisRef = (kind: BasisKind, id: number, label: string): EntityRef => ({ id: encodeBasis(kind, id), label });

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** تاریخ پیشنهادی سند: امروز، در بازه‌ی دوره‌ی مالی جاری، و نه قبل از تاریخ سند مبنا (همان قاعده‌ی دیالوگ‌های «صدور سند بعدی») */
export async function suggestedDate(baseDate: Date): Promise<string> {
  const today = new Date();
  let d = today;
  const fp = await getCurrentFiscalPeriod();
  if (fp) {
    if (d < fp.fromDate) d = fp.fromDate;
    if (d > fp.toDate) d = fp.toDate;
  }
  return iso(d >= baseDate ? d : baseDate);
}
