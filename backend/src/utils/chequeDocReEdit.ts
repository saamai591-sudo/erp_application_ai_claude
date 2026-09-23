import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertRecordNotStale } from "./concurrency";
import { can } from "../authz/guard";

// =========================================================================
// «ویرایش مجدد» اسناد چک‌محور (واگذاری به بانک، برگشت از واگذاری، نتیجه وصول/برگشتِ دریافتنی/پرداختنی) —
// هم‌الگوی «ویرایش مجدد» اعلامیه پرداخت/سند دریافت (Documents/مستند پیاده‌سازی قابلیت «ویرایش مجدد» اعلامیه پرداخت.md)،
// مسیری کاملاً مستقل از «ویرایش» عادی (که برای سند تاییدشده کاملاً قفل است).
//
// در این اسناد «ردیف» همان چک است. ردیف «دارای گردش» = چکی که بعد از این سند اتفاق دیگری برایش افتاده (step چک با
// chequeStep ردیف برابر نیست) یا سندی در وضعیت «ثبت» به آن ارجاع می‌دهد. GET فقط ردیف‌های فاقد گردش را برمی‌گرداند و
// PUT «Partial Update» است: ردیف‌های دارای گردش هرگز لمس نمی‌شوند. افزودن چک جدید مجاز نیست؛ حذف ردیف فاقد گردش
// (برگشت وضعیت چک) و در اسناد نتیجه‌ی وصول، تغییر «نتیجه» مجاز است.
// =========================================================================

export const NO_EDITABLE_CHEQUES_MESSAGE = "همه آیتم‌ها دارای گردش هستند و امکان ویرایش مجدد وجود ندارد.";

export interface ChequeDocReEditConfig {
  path: string; // مثلاً "cheque-deposits"
  form: string; // پیشوند مجوز (FORM)
  docModel: string; // مثلاً "chequeDeposit"
  lineModel: string; // مثلاً "chequeDepositLine"
  detailInclude: any;
  serialize: (d: any) => any;
  notFoundMessage: string;
  minOneMessage: string;
  hasOutcome: boolean;
  /** وضعیتی که چک با حذف ردیف از سند به آن برمی‌گردد */
  revertStatus: string;
  resolveFiscalPeriod: (date: Date) => Promise<unknown>;
}

// جدول‌های ردیفِ اسنادی که ممکن است به یک چک ارجاع بدهند (پیش‌نویس‌ها، برای شناسایی «گردش» در حال انجام)
const DRAFT_REFERENCE_SOURCES: { model: string; parent: string }[] = [
  { model: "paymentInstrumentLine", parent: "payment" },
  { model: "chequeDepositLine", parent: "chequeDeposit" },
  { model: "chequeDepositReturnLine", parent: "chequeDepositReturn" },
  { model: "chequeClearingReceivableLine", parent: "chequeClearingReceivable" },
  { model: "chequeClearingPayableLine", parent: "chequeClearingPayable" },
];

async function hasDraftReference(chequeItemId: number, ownModel: string, ownLineId: number): Promise<boolean> {
  for (const src of DRAFT_REFERENCE_SOURCES) {
    const where: any = { chequeItemId, [src.parent]: { status: "DRAFT" } };
    if (src.model === ownModel) where.id = { not: ownLineId };
    // eslint-disable-next-line no-await-in-loop
    const n = await (prisma as any)[src.model].count({ where });
    if (n > 0) return true;
  }
  return false;
}

export function registerChequeDocReEdit(router: Router, cfg: ChequeDocReEditConfig) {
  const doc = () => (prisma as any)[cfg.docModel];

  async function loadContext(id: number) {
    const existing = await doc().findUnique({ where: { id }, include: cfg.detailInclude });
    if (!existing) throw Object.assign(new Error(cfg.notFoundMessage), { status: 404 });
    if (existing.status !== "APPROVED") throw new Error("ویرایش مجدد فقط برای سند «تایید»شده مجاز است");
    const lines = existing.lines as any[];
    const flags = await Promise.all(
      lines.map(async (l) => l.chequeItem.step !== l.chequeStep || (await hasDraftReference(l.chequeItemId, cfg.lineModel, l.id)))
    );
    const editable = lines.filter((_, i) => !flags[i]);
    const locked = lines.filter((_, i) => flags[i]);
    if (editable.length === 0) throw new Error(NO_EDITABLE_CHEQUES_MESSAGE);
    return { existing, editable, locked };
  }

  router.get(`/${cfg.path}/:id/re-edit`, can(`${cfg.form}.reEdit`), async (req, res) => {
    try {
      const { existing, editable } = await loadContext(Number(req.params.id));
      const ids = new Set(editable.map((l: any) => l.id));
      const full = cfg.serialize(existing);
      res.json({ ...full, lines: full.lines.filter((l: any) => ids.has(l.id)) });
    } catch (e: any) {
      res.status(e.status || 400).json({ error: e.message });
    }
  });

  router.put(`/${cfg.path}/:id/re-edit`, can(`${cfg.form}.reEdit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as { updatedAt?: string; chequeItemIds?: number[]; lines?: { chequeItemId: number; outcome?: string }[] };
    try {
      const { existing, editable, locked } = await loadContext(id);
      assertRecordNotStale(existing.updatedAt, body.updatedAt, "این سند");
      await cfg.resolveFiscalPeriod(existing.date);

      const incoming: { chequeItemId: number; outcome?: string }[] = cfg.hasOutcome
        ? Array.isArray(body.lines) ? body.lines : []
        : (Array.isArray(body.chequeItemIds) ? body.chequeItemIds : []).map((c) => ({ chequeItemId: c }));
      const editableByCheque = new Map<number, any>(editable.map((l: any) => [l.chequeItemId, l]));
      const lockedIds = new Set(locked.map((l: any) => l.chequeItemId));
      const seen = new Set<number>();
      for (const l of incoming) {
        if (seen.has(l.chequeItemId)) throw new Error("یک چک نمی‌تواند دو بار در یک سند تکرار شود");
        seen.add(l.chequeItemId);
        if (lockedIds.has(l.chequeItemId)) throw new Error("چک دارای گردش قابل تغییر نیست");
        if (!editableByCheque.has(l.chequeItemId)) throw new Error("افزودن چک جدید در ویرایش مجدد مجاز نیست");
        if (cfg.hasOutcome && l.outcome !== "CLEARED" && l.outcome !== "BOUNCED") throw new Error("نتیجه نامعتبر است");
      }
      const removed = editable.filter((l: any) => !seen.has(l.chequeItemId));
      if (locked.length + incoming.length === 0) throw new Error(cfg.minOneMessage);

      await prisma.$transaction(async (tx: any) => {
        for (const l of removed) {
          // eslint-disable-next-line no-await-in-loop
          await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: cfg.revertStatus, step: { decrement: 1 } } });
          // eslint-disable-next-line no-await-in-loop
          await tx[cfg.lineModel].delete({ where: { id: l.id } });
        }
        if (cfg.hasOutcome) {
          for (const l of incoming) {
            const ex = editableByCheque.get(l.chequeItemId);
            if (ex.outcome === l.outcome) continue;
            // eslint-disable-next-line no-await-in-loop
            await tx[cfg.lineModel].update({ where: { id: ex.id }, data: { outcome: l.outcome } });
            // eslint-disable-next-line no-await-in-loop
            await tx.chequeItem.update({ where: { id: l.chequeItemId }, data: { status: l.outcome } });
          }
        }
        await tx[cfg.docModel].update({ where: { id }, data: { updatedAt: new Date() } });
      });

      res.json({ id });
    } catch (e: any) {
      res.status(e.status || 400).json({ error: e.message || "خطا در ذخیره" });
    }
  });
}
