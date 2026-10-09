// گزینه‌های انتخابگر تفصیل: GET /detail-types/:id/options موجودیت‌های غیرفعال (فعلاً حساب بانکیِ غیرفعال) را هم برمی‌گرداند ولی با inactive=true علامت می‌زند،
// چون عنوان مقدار فعلیِ ردیف‌های قدیمی از همین فهرست خوانده می‌شود. انتخابگرها باید فهرست را با این تابع فیلتر کنند: گزینه‌ی غیرفعال فقط
// وقتی نمایش داده می‌شود که مقدار فعلیِ همان ردیف باشد؛ برای انتخاب تازه دیده نمی‌شود. (انتخابگر مشترک حساب بانکی هم همین قاعده را دارد.)
export interface DetailOptionLike {
  code: string;
  title: string;
  inactive?: boolean;
}

export function selectableDetailOptions<T extends DetailOptionLike>(options: T[] | undefined, currentCode?: string | null): T[] {
  return (options ?? []).filter((o) => !o.inactive || o.code === currentCode);
}
