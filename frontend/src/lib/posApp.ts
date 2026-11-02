import { api } from "./api";

// پل صفحه با «برنامه‌ی صندوق» (Electron، pos-app): فقط وقتی صفحه داخل آن برنامه باز شده باشد window.posApp وجود دارد.
// چاپ مستقیم روی چاپگر ویندوزِ همان کامپیوتر انجام می‌شود (سرور به چاپگر دسترسی ندارد)؛ نتیجه‌ی هر کار به سرور گزارش می‌شود تا سابقه‌ی چاپ نگه‌داری شود.

export interface PosPrinter { name: string; isDefault?: boolean }
interface PosAppBridge {
  isApp: true;
  listPrinters(): Promise<PosPrinter[]>;
  print(job: { html: string; printer: string; widthMm?: number; paper?: string }): Promise<{ ok: true }>;
}
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
