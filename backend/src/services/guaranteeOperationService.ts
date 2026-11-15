import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { roundToCurrencyDecimals } from "../utils/currencyConversion";

// وضعیت فعلیِ ابزار ضمانت‌نامه = ابزار اصلی + رویدادها: تمدید (سررسید جدید) و عملیات (تقلیل / افزایش / ابطال).
// چیزی ذخیره نمی‌شود؛ رویدادها به ترتیب (تاریخ سند، زمان ثبت، شناسه) روی هم اعمال می‌شوند.

export interface InstrumentState {
  id: number;
  originalAmount: number;
  originalDueDate: Date | null;
  /// مبلغ فعلی (بعد از ابطال صفر)
  amount: number;
  dueDate: Date | null;
  cancelled: boolean;
  /// تاریخ آخرین رویداد (تمدید یا عملیات) روی ابزار، برای کنترل ترتیب تاریخ
  lastEventDate: Date | null;
}

/** یک سند تمدید یا عملیات؛ برای کنار گذاشتن همان سند هنگام ویرایش */
export interface EventRef {
  source: "EXT" | "OP";
  id: number;
}

export async function instrumentStates(ids: number[], exclude?: EventRef): Promise<Map<number, InstrumentState>> {
  return withoutFiscalPeriodScope(async () => {
    const out = new Map<number, InstrumentState>();
    if (ids.length === 0) return out;
    const instruments = await prisma.guaranteeInstrument.findMany({ where: { id: { in: ids } }, select: { id: true, amount: true, dueDate: true } });
    for (const i of instruments) {
      out.set(i.id, { id: i.id, originalAmount: Number(i.amount), originalDueDate: i.dueDate, amount: Number(i.amount), dueDate: i.dueDate, cancelled: false, lastEventDate: null });
    }
    const [ext, ops] = await Promise.all([
      prisma.guaranteeExtensionLine.findMany({
        where: { instrumentId: { in: ids }, ...(exclude?.source === "EXT" ? { extensionId: { not: exclude.id } } : {}) },
        include: { extension: { select: { id: true, date: true, createdAt: true } } },
      }),
      prisma.guaranteeOperationLine.findMany({
        where: { instrumentId: { in: ids }, ...(exclude?.source === "OP" ? { operationId: { not: exclude.id } } : {}) },
        include: { operation: { select: { id: true, date: true, createdAt: true, kind: true } } },
      }),
    ]);
    type Ev = { instrumentId: number; date: Date; createdAt: Date; id: number; apply: (s: InstrumentState) => void };
    const events: Ev[] = [
      ...ext.map((l) => ({
        instrumentId: l.instrumentId,
        date: l.extension.date,
        createdAt: l.extension.createdAt,
        id: l.id,
        apply: (s: InstrumentState) => { s.dueDate = l.newDueDate; },
      })),
      ...ops.map((l) => ({
        instrumentId: l.instrumentId,
        date: l.operation.date,
        createdAt: l.operation.createdAt,
        id: l.id,
        apply: (s: InstrumentState) => {
          const c = Number(l.changeAmount ?? 0);
          if (l.operation.kind === "REDUCE") s.amount = roundToCurrencyDecimals(s.amount - c, 2);
          else if (l.operation.kind === "INCREASE") s.amount = roundToCurrencyDecimals(s.amount + c, 2);
          else if (l.operation.kind === "CANCEL") { s.amount = 0; s.cancelled = true; }
        },
      })),
    ];
    events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
    for (const e of events) {
      const s = out.get(e.instrumentId);
      if (!s) continue;
      e.apply(s);
      s.lastEventDate = e.date;
    }
    return out;
  });
}

/** اسناد تمدید/عملیاتی که بعد از این سند (تاریخ، سپس زمان ثبت) روی همین ابزارها ثبت شده‌اند؛ ویرایش/حذف فقط برای آخرین رویداد هر ابزار مجاز است */
export async function laterEvents(self: EventRef, instrumentIds: number[]): Promise<string[]> {
  return withoutFiscalPeriodScope(async () => {
    const head =
      self.source === "EXT"
        ? await prisma.guaranteeExtension.findUnique({ where: { id: self.id }, select: { date: true, createdAt: true } })
        : await prisma.guaranteeOperation.findUnique({ where: { id: self.id }, select: { date: true, createdAt: true } });
    if (!head) return [];
    const after = { OR: [{ date: { gt: head.date } }, { date: head.date, createdAt: { gt: head.createdAt } }] };
    const [ext, ops] = await Promise.all([
      prisma.guaranteeExtensionLine.findMany({
        where: { instrumentId: { in: instrumentIds }, extension: after, ...(self.source === "EXT" ? { extensionId: { not: self.id } } : {}) },
        select: { extension: { select: { number: true, direction: true } } },
      }),
      prisma.guaranteeOperationLine.findMany({
        where: { instrumentId: { in: instrumentIds }, operation: after, ...(self.source === "OP" ? { operationId: { not: self.id } } : {}) },
        select: { operation: { select: { number: true, kind: true } } },
      }),
    ]);
    const KIND_FA: Record<string, string> = { REDUCE: "تقلیل", INCREASE: "افزایش", CANCEL: "ابطال" };
    return [
      ...new Set([...ext.map((e) => `تمدید شماره ${e.extension.number}`), ...ops.map((o) => `${KIND_FA[o.operation.kind] ?? "عملیات"} شماره ${o.operation.number}`)]),
    ];
  });
}

/** آیا روی ابزارهای این سند اصلی تمدید یا عملیاتی ثبت شده؟ */
export async function documentHasEvents(documentId: number): Promise<boolean> {
  return withoutFiscalPeriodScope(async () => {
    const [a, b] = await Promise.all([
      prisma.guaranteeExtensionLine.count({ where: { instrument: { documentId } } }),
      prisma.guaranteeOperationLine.count({ where: { instrument: { documentId } } }),
    ]);
    return a + b > 0;
  });
}
