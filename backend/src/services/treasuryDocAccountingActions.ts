import { Router } from "express";
import { can } from "../authz/guard";

// اکشن‌های مشترکِ «تایید حسابداری» اسناد خزانه (دریافت، پرداخت، اعلامیه بدهکار بستانکار، دریافت تضمین، پرداخت تضمین): تایید، لغو تایید، مشاهده/ذخیره‌ی ردیف‌های حسابداری،
// حذف اطلاعات حسابداری، صدور و حذف سند حسابداری. قواعد (قفل سند حسابداری، ترتیب مراحل، پیام‌ها) فقط همین‌جاست؛ هر سند فقط یک آداپتور می‌دهد
// (چگونه سند را بخواند و سرویسِ حسابداری خودش را صدا بزند). مسیرها همان مسیرهای قبلی‌اند: <basePath>/:id/accounting-approve و ...
//
// لغو تایید، ردیف‌های حسابداری را نگه می‌دارد (تفصیل‌های دستی حفظ می‌شود)؛ حذف آن‌ها فقط با «حذف اطلاعات حسابداری».

export interface TreasuryAccountingAdapter {
  /** نام سند در پیام‌ها، مثلاً «سند دریافت» */
  label: string;
  /** پیام قفل وقتی سند حسابداری صادر شده */
  jeLockMessage: string;
  /** اسناد دریافت/پرداخت باید «اثرگذار» (status = APPROVED) باشند؛ تضمین‌ها وضعیت عملیاتی ندارند */
  requireEffective: boolean;
  load(id: number): Promise<{ status?: string; accountingStatus: string; journalEntryId: number | null } | null>;
  approve(id: number, userId: number | null): Promise<void>;
  /** فقط وضعیت را به «تایید‌نشده» برمی‌گرداند (ردیف‌های حسابداری دست‌نخورده) */
  setUnapproved(id: number): Promise<void>;
  /** req: برای سندهایی که پارامتر درخواست لازم دارند (اعلامیه بدهکار بستانکار: ?side=RECEIPT|PAYMENT) */
  view(id: number, req?: any): Promise<unknown>;
  saveDetails(id: number, rows: any[], req?: any): Promise<void>;
  countLines(id: number): Promise<number>;
  deleteLines(id: number): Promise<void>;
  issue(id: number): Promise<{ id: number; number: number; referenceNumber: number; message?: string }>;
  revert(id: number): Promise<void>;
}

class ActionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function registerTreasuryAccountingRoutes(router: Router, cfg: { basePath: string; form: string; adapter: TreasuryAccountingAdapter }) {
  const { basePath, form, adapter: a } = cfg;
  const p = (suffix: string) => `${basePath}/:id/${suffix}`;

  async function loadOr404(id: number) {
    const d = await a.load(id);
    if (!d) throw new ActionError(404, `${a.label} یافت نشد`);
    return d;
  }
  const fail = (res: any, e: any, fallback: string) => res.status(e instanceof ActionError ? e.status : 400).json({ error: e?.message || fallback });

  router.post(p("accounting-approve"), can(`${form}.accountingApprove`), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const d = await loadOr404(id);
      if (d.journalEntryId) throw new ActionError(400, a.jeLockMessage);
      if (a.requireEffective && d.status !== "APPROVED") throw new ActionError(400, "سند هنوز اثرگذار نشده است؛ ابتدا آن را ذخیره کنید");
      if (d.accountingStatus === "APPROVED") throw new ActionError(400, "این سند قبلاً تایید حسابداری شده است");
      await a.approve(id, req.user?.id ?? null);
      res.json({ id, accountingStatus: "APPROVED" });
    } catch (e: any) {
      fail(res, e, "خطا در تایید حسابداری");
    }
  });

  router.post(p("accounting-unapprove"), can(`${form}.accountingUnapprove`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const d = await loadOr404(id);
      if (d.journalEntryId) throw new ActionError(400, a.jeLockMessage);
      if (d.accountingStatus !== "APPROVED") throw new ActionError(400, "این سند تایید حسابداری نشده است");
      await a.setUnapproved(id);
      res.json({ id, accountingStatus: "NONE" });
    } catch (e: any) {
      fail(res, e, "خطا در لغو تایید حسابداری");
    }
  });

  router.get(p("accounting-lines"), can(`${form}.view`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await loadOr404(id);
      res.json(await a.view(id, req));
    } catch (e: any) {
      fail(res, e, "خطا");
    }
  });

  router.put(p("accounting-lines"), can(`${form}.accountingApprove`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const d = await loadOr404(id);
      if (d.journalEntryId) throw new ActionError(400, a.jeLockMessage);
      if (d.accountingStatus !== "APPROVED") throw new ActionError(400, "ابتدا «تایید حسابداری» را انجام دهید");
      await a.saveDetails(id, Array.isArray(req.body?.lines) ? req.body.lines : [], req);
      res.json({ id });
    } catch (e: any) {
      fail(res, e, "خطا در ذخیره");
    }
  });

  // حذف اطلاعات حسابداری: فقط وقتی تایید حسابداری لغو شده، سند حسابداری ندارد و ردیف حسابداری دارد
  router.post(p("delete-accounting-info"), can(`${form}.deleteAccountingInfo`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const d = await loadOr404(id);
      if (d.journalEntryId) throw new ActionError(400, a.jeLockMessage);
      if (d.accountingStatus === "APPROVED") throw new ActionError(400, "ابتدا «لغو تایید حسابداری» را بزنید");
      const count = await a.countLines(id);
      if (count === 0) throw new ActionError(400, "این سند اطلاعات حسابداری ندارد");
      await a.deleteLines(id);
      res.json({ id, deleted: count });
    } catch (e: any) {
      fail(res, e, "خطا در حذف اطلاعات حسابداری");
    }
  });

  router.post(p("issue-journal-entry"), can(`${form}.issueJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await loadOr404(id);
      const entry = await a.issue(id);
      res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
    } catch (e: any) {
      fail(res, e, "خطا در صدور سند حسابداری");
    }
  });

  router.delete(p("journal-entry"), can(`${form}.revertJournalEntry`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      await loadOr404(id);
      await a.revert(id);
      res.status(204).send();
    } catch (e: any) {
      fail(res, e, "خطا در حذف سند حسابداری");
    }
  });
}
