export type ToastType = "success" | "error";
export interface ToastItem { id: number; message: string; type: ToastType }

type Listener = (items: ToastItem[]) => void;

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<Listener>();
const MIN_DURATION_MS = 2500;

function emit() {
  listeners.forEach((l) => l(items));
}

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  l(items);
  return () => {
    listeners.delete(l);
  };
}

/** پیام کوتاه موفقیت که بیرون از فرم (شناور روی صفحه) نمایش داده می‌شود و چیدمان فرم را جابه‌جا نمی‌کند. */
export function showToast(message: string, type: ToastType = "success") {
  const id = ++seq;
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, Math.max(MIN_DURATION_MS, message.length * 60));
}

/** پیام خطا (قرمز) بیرون از فرم؛ جایگزین alert() و کادر خطای داخل فرم که چیدمان را جابه‌جا می‌کرد. */
export function showError(message?: string | null) {
  showToast(message || "خطا رخ داد", "error");
}
