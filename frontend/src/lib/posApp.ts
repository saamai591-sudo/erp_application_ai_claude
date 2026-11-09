import { api } from "./api";

// پل صفحه با «برنامه‌ی صندوق» (Electron، pos-app): فقط وقتی صفحه داخل آن برنامه باز شده باشد window.posApp وجود دارد.
// چاپ مستقیم روی چاپگر ویندوزِ همان کامپیوتر انجام می‌شود (سرور به چاپگر دسترسی ندارد)؛ نتیجه‌ی هر کار به سرور گزارش می‌شود تا سابقه‌ی چاپ نگه‌داری شود.

export interface PosPrinter { name: string; isDefault?: boolean }
interface PosAppBridge {
  isApp: true;
  listPrinters(): Promise<PosPrinter[]>;
  print(job: { html: string; printer: string; widthMm?: number; paper?: string }): Promise<{ ok: true }>;
  cardPay(job: { requestUid: string; driver: string; amount: number; terminalNumber: string; ip?: string; port?: number }): Promise<CardRunResult>;
  cardDiscover(): Promise<PosCardDevice[]>;
  cardResult(requestUid: string): Promise<CardRunResult | { status: "RUNNING" } | null>;
}

/** دستگاه سداد پیداشده روی شبکه */
export interface PosCardDevice { ip: string; port: number; terminalId: string; merchantId: string; model: string; name: string }

/** نتیجه‌ی نهایی اجرای تراکنش روی کارتخوان (شماره‌ی کارت فقط پوشانده) */
export interface CardRunResult { status: "SUCCESS" | "FAILED" | "UNKNOWN"; referenceNumber?: string; maskedCard?: string; errorCode?: string; errorMessage?: string }
declare global {
  interface Window { posApp?: PosAppBridge }
}

export const inPosApp = () => typeof window !== "undefined" && !!window.posApp?.isApp;

export async function listLocalPrinters(): Promise<PosPrinter[]> {
  if (!window.posApp) return [];
  try {
    return await window.posApp.listPrinters();
  } catch {
    return [];
  }
}

/** کار چاپِ تحویل‌گرفته از سرور (POST /store-sales/:id/print) */
export interface PrintJobPayload { id: number; printer: string; printerName: string; html: string; widthMm?: number; paper?: string }

/** هر کار را روی چاپگرش می‌فرستد و نتیجه را به سرور می‌دهد؛ خروجی = وضعیت هر چاپگر */
export async function runPrintJobs(jobs: PrintJobPayload[]): Promise<{ id: number; printer: string; ok: boolean; error: string }[]> {
  const out: { id: number; printer: string; ok: boolean; error: string }[] = [];
  for (const j of jobs) {
    let ok = true;
    let error = "";
    try {
      if (!window.posApp) throw new Error("برای چاپ مستقیم، سامانه را در «برنامه‌ی صندوق» باز کنید");
      // eslint-disable-next-line no-await-in-loop
      await window.posApp.print({ html: j.html, printer: j.printer, widthMm: j.widthMm, paper: j.paper });
    } catch (e) {
      ok = false;
      error = String((e as Error)?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "").slice(0, 300);
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await api.post(`/print-jobs/${j.id}/result`, { ok, error }, { silent: true });
    } catch {
      /* نتیجه به سرور نرسید؛ کار پس از مهلت «نامعلوم» می‌شود */
    }
    out.push({ id: j.id, printer: j.printerName, ok, error });
  }
  return out;
}

// ─── کارتخوان: مثل چاپ، سرور فقط تراکنش را آماده می‌کند و خودِ برنامه‌ی صندوق با دستگاه حرف می‌زند ───
export interface CardRunTx { id: number; requestUid: string; driver: string; amount: number; terminalNumber: string; deviceIp?: string; devicePort?: number | null }

/** جستجوی دستگاه‌های سداد در شبکه‌ی همین کامپیوتر (فقط داخل برنامه‌ی صندوق) */
export async function discoverCardDevices(): Promise<PosCardDevice[]> {
  if (!window.posApp?.cardDiscover) throw new Error("جستجوی کارتخوان فقط داخل «برنامه‌ی صندوق» ممکن است");
  return window.posApp.cardDiscover();
}

async function reportCardResult(txId: number, r: CardRunResult): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await api.post(`/card-transactions/${txId}/client-result`, r, { silent: true });
      return true;
    } catch (e) {
      // خطای قطعی سرور (مثلاً کاربر دیگر) تکرار نمی‌شود؛ خطای شبکه تا سه بار
      const status = (e as { status?: number }).status;
      if (status && status >= 400 && status < 500) return false;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  return false;
}

/** تراکنش را روی دستگاه اجرا می‌کند (تا کارت‌زدن مشتری منتظر می‌ماند) و نتیجه را به سرور می‌دهد. true = نتیجه به سرور رسید. */
export async function runCardTransaction(tx: CardRunTx): Promise<boolean> {
  if (!window.posApp?.cardPay) throw new Error("کارتخوان فقط از «برنامه‌ی صندوق» کار می‌کند");
  let r: CardRunResult;
  try {
    r = await window.posApp.cardPay({ requestUid: tx.requestUid, driver: tx.driver, amount: tx.amount, terminalNumber: tx.terminalNumber, ip: tx.deviceIp || undefined, port: tx.devicePort || undefined });
  } catch (e) {
    const msg = String((e as Error)?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "").slice(0, 300);
    r = { status: "UNKNOWN", errorCode: "APP_ERROR", errorMessage: msg };
  }
  return reportCardResult(tx.id, r);
}

/** اگر نتیجه‌ی این تراکنش در برنامه آماده است (مثلاً بعد از بارگذاری مجدد صفحه) آن را به سرور می‌دهد. true = گزارش شد. */
export async function reportCardResultIfReady(tx: CardRunTx): Promise<boolean> {
  if (!window.posApp?.cardResult) return false;
  try {
    const r = await window.posApp.cardResult(tx.requestUid);
    if (!r || r.status === "RUNNING") return false;
    return reportCardResult(tx.id, r as CardRunResult);
  } catch {
    return false;
  }
}
