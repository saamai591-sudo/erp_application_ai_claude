export interface ToastItem { id: number; message: string }

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
export function showToast(message: string) {
  const id = ++seq;
  items = [...items, { id, message }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, Math.max(MIN_DURATION_MS, message.length * 60));
}
