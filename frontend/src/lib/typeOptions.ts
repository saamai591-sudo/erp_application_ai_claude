// «نوع دریافت / نوع پرداخت» غیرفعال: برای سند جدید قابل انتخاب نیست، ولی سندِ موجودی که قبلاً از آن استفاده کرده باید همان نوع را نمایش دهد
// (تا سند معتبر و تاریخچه حفظ شود). گزینه‌های هر انتخابگر = فقط نوع‌های فعال + (فقط برای همان ردیف/سند) نوعِ غیرفعالِ فعلیِ انتخاب‌شده.
// نوع غیرفعال با ردیف دیگر یا سند جدید در دسترس نیست و با تغییر انتخاب هم از فهرست همان ردیف حذف می‌شود.
export function selectableTypes<T extends { id: number; isActive?: boolean }>(all: T[], currentId?: string | number | null): T[] {
  return all.filter((t) => t.isActive !== false || (currentId !== undefined && currentId !== null && currentId !== "" && String(t.id) === String(currentId)));
}

export function typeLabel(t: { title: string; isActive?: boolean }): string {
  return t.isActive === false ? `${t.title} (غیرفعال)` : t.title;
}
