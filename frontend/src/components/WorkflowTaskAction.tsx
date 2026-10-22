import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { stageFormPrefill } from "../lib/formPrefill";
import { showError } from "../lib/toast";
import { useTabs } from "../lib/TabsContext";
import { usePermissions } from "../lib/usePermissions";
import { DELIVERY_DOWNSTREAM_ACTIONS, QUOTE_DOWNSTREAM_ACTIONS } from "./DownstreamDialogs";

// دکمه‌ی «اقدام» کارتابل: از روی کارِ مرحله‌ی خودکار، فرمِ ثبتِ سندِ همان مرحله باز می‌شود (همان سازوکار «صدور سند بعدی»: lib/formPrefill.ts + دیالوگ‌های
// DownstreamDialogs). اقدام از «رویداد بسته‌شدنِ» مرحله مشخص می‌شود؛ طراح فرایند چیزی تنظیم نمی‌کند. کار با زدن دکمه خودکار برای همین کاربر «برداشته» می‌شود.
// کار خودش با ذخیره‌ی سند (رویداد) بسته می‌شود، نه با این دکمه. دکمه فقط وقتی دیده می‌شود که کاربر مجوز «ایجاد» فرم مقصد را دارد (حساب سبک ندارد).

export interface ReceiptFromTaskPrefill {
  partyId: number;
  partyDisplay: string;
  description: string;
}

export interface ActionTask {
  id: number;
  status: string;
  isMine: boolean;
  canClaim: boolean;
  completionEvent: string | null;
  quoteId: number | null;
  deliveryId: number | null;
  actionContext: { quoteNumber: number; partyId: number; partyTitle: string } | null;
}

type DialogKey = "delivery" | "invoice";

export function WorkflowTaskAction({ task, onClaimed }: { task: ActionTask; onClaimed: () => void }) {
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const [dialog, setDialog] = useState<DialogKey | null>(null);
  const [busy, setBusy] = useState(false);

  const active = task.status === "OPEN" || task.status === "CLAIMED";
  if (!active || !task.completionEvent) return null;

  let label = "";
  let permission = "";
  let go: () => DialogKey | null = () => null;
  switch (task.completionEvent) {
    case "RECEIPT_APPROVED":
      if (!task.actionContext) return null;
      label = "ثبت دریافت";
      permission = "treasury.receipt-ops.receipts.create";
      go = () => {
        const prefill: ReceiptFromTaskPrefill = { partyId: task.actionContext!.partyId, partyDisplay: task.actionContext!.partyTitle, description: `بابت پیش‌فاکتور شماره ${task.actionContext!.quoteNumber}` };
        stageFormPrefill("/receipts/new", prefill);
        openTab("/receipts/new");
        return null;
      };
      break;
    case "SALES_DELIVERY_REGISTERED":
      if (!task.quoteId) return null;
      label = "صدور حواله فروش";
      permission = "sales.operations.sales-deliveries.create";
      go = () => "delivery";
      break;
    case "SALES_INVOICE_CREATED":
      label = "صدور فاکتور فروش";
      permission = "sales.operations.sales-invoices.create";
      go = () => {
        if (task.deliveryId) return "invoice";
        openTab("/sales-invoices/new");
        return null;
      };
      break;
    case "TAX_INVOICE_SENT":
      label = "ارسال به سامانه مودیان";
      permission = "tax-affairs.operations.tax-invoice-submission.view";
      go = () => {
        openTab("/tax-invoice-submission");
        return null;
      };
      break;
    default:
      return null;
  }
  if (!hasPermission(permission)) return null;
  // کاری که کاربر دیگری برداشته است برای این کاربر اقدام ندارد
  const takenByOther = task.status === "CLAIMED" && !task.isMine;

  async function start() {
    setBusy(true);
    try {
      // برداشتن خودکار: تا دو نفر هم‌زمان روی یک کار سند ثبت نکنند
      if (task.status === "OPEN") {
        await api.post(`/workflow/tasks/${task.id}/claim`, {}, { silent: true } as any);
        onClaimed();
      }
      const d = go();
      if (d) setDialog(d);
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const Delivery = QUOTE_DOWNSTREAM_ACTIONS[0].Dialog;
  const Invoice = DELIVERY_DOWNSTREAM_ACTIONS[0].Dialog;
  return (
    <>
      <button type="button" className="btn" disabled={busy || takenByOther} title={takenByOther ? "این کار را کاربر دیگری برداشته است" : "فرم ثبت سند را باز می‌کند؛ کار برای شما برداشته می‌شود و با ذخیره‌ی سند خودکار بسته می‌شود"} onClick={start}>
        {label}
      </button>
      {dialog === "delivery" && task.quoteId && <Delivery sourceId={task.quoteId} onClose={() => setDialog(null)} />}
      {dialog === "invoice" && task.deliveryId && <Invoice sourceId={task.deliveryId} onClose={() => setDialog(null)} />}
    </>
  );
}
