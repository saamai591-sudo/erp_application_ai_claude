import { ActionDef } from "./types";
import { salesQuoteAction } from "./actions/salesQuote";
import { stockAction, customerInvoicesAction } from "./actions/queries";
import { createCustomerAction } from "./actions/customer";
import { approveQuoteAction } from "./actions/approveQuote";
import { salesDeliveryAction } from "./actions/salesDelivery";
import { salesInvoiceAction } from "./actions/salesInvoice";
import { receiptAction } from "./actions/receipt";
import { paymentAction } from "./actions/payment";

// فهرست کارهای دستیار. کار جدید = یک ActionDef (اسلات‌ها، دسترسی، run) + یک الگوی استخراج در ruleInterpreter.ts (برای تفسیرگر قاعده‌محور)؛
// مدل هوش مصنوعیِ آینده فقط به toolSchemas() نیاز دارد و بدون الگو هم همین کارها را صدا می‌زند.
export const ACTIONS: ActionDef[] = [salesQuoteAction, approveQuoteAction, salesDeliveryAction, salesInvoiceAction, receiptAction, paymentAction, createCustomerAction, stockAction, customerInvoicesAction];

export const actionByKey = (key: string | null | undefined) => ACTIONS.find((a) => a.key === key) ?? null;
