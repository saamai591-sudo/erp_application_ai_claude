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
  // پیامی که خودِ صفحه نشان می‌دهد همیشه بر پیام خودکار پایه (scheduleAutoToast) برتری دارد
  cancelAutoToast();
  pushToast(message, type);
}

function pushToast(message: string, type: ToastType) {
  const id = ++seq;
  items = [...items, { id, message, type }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, Math.max(MIN_DURATION_MS, message.length * 60));
}

/** بستن دستی یک toast پیش از ناپدیدشدن خودکارش (دکمه‌ی × روی خود پیام) */
export function dismissToast(id: number) {
  if (!items.some((t) => t.id === id)) return;
  items = items.filter((t) => t.id !== id);
  emit();
}

/** پیام خطا (قرمز) بیرون از فرم؛ جایگزین alert() و کادر خطای داخل فرم که چیدمان را جابه‌جا می‌کرد. */
export function showError(message?: string | null) {
  showToast(message || "خطا رخ داد", "error");
}

/**
 * پیام موفقیتِ خودکارِ پایه برای هر عملیات (ثبت/ویرایش/حذف/تایید/…): lib/api.ts بعد از هر درخواست موفقِ POST/PUT/DELETE آن را
 * زمان‌بندی می‌کند، تا هیچ عملیاتی بدون اطلاع‌رسانی به کاربر نماند — حتی عملیات جدیدی که بعداً اضافه می‌شود.
 * اگر صفحه در همین فاصله پیام خودش را نشان دهد (showToast/showError/flash)، پیام خودکار لغو می‌شود (پیام تکراری ندارد)؛
 * و اگر چند درخواست پشت سر هم بیایند (مثلاً ذخیره + تایید) فقط آخرین پیام نشان داده می‌شود.
 */
const AUTO_TOAST_DELAY_MS = 700;
let pendingAuto: ReturnType<typeof setTimeout> | null = null;

function cancelAutoToast() {
  if (pendingAuto) clearTimeout(pendingAuto);
  pendingAuto = null;
}

export function scheduleAutoToast(message: string) {
  cancelAutoToast();
  pendingAuto = setTimeout(() => {
    pendingAuto = null;
    pushToast(message, "success");
  }, AUTO_TOAST_DELAY_MS);
}
