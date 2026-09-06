import { prisma } from "../lib/prisma";

// «انتخابگر تفصیل پایه» — طبق تصمیم صریح کاربر: منبع واحد برای «کدام موجودیت‌ها برای این فیلد مجازند»،
// به‌جای اینکه هر فرم جدا (و گاهی فقط در فرانت‌اند، بدون بازبینی در بک‌اند) همین شرط را دوباره بنویسد.
// دو مصرف‌کننده از هر شرط استفاده می‌کنند:
//   ۱) getDetailSelectorOptions — فهرست پیکر فرانت‌اند را پر می‌کند (اندپوینت GET /detail-selector-options)
//   ۲) assertDetailSelectorValid — همان شرط را در لحظه‌ی ذخیره روی بک‌اند دوباره چک می‌کند
// چون هر دو از همان resolveAllowedPartyIds عبور می‌کنند، فیلتر فرانت و اعتبارسنجی بک‌اند هرگز نمی‌توانند
// از هم واگرا شوند — برخلاف وضعیت قبلی که مثلاً «رسید انبار خرید» فرانت را از /suppliers (درست) پر
// می‌کرد ولی بک‌اند اصلاً چک نمی‌کرد طرف مقابل واقعاً تامین‌کننده است یا نه، و «برگشت به تامین‌کننده» حتی
// فرانتش هم از /parties خام (بدون فیلتر) پر می‌شد.
//
// هر شرط جدید فقط وقتی اضافه می‌شود که یک فرم واقعی به آن نیاز داشته باشد (مثلاً مرکز هزینه/پروژه/مشتری
// در دسته‌های بعدی) — فعلاً فقط SUPPLIER_PARTY پیاده شده است.
export type DetailSelectorCondition = { kind: "SUPPLIER_PARTY" };

export interface DetailSelectorOption {
  code: string;
  title: string;
}

async function resolveAllowedPartyIds(condition: DetailSelectorCondition): Promise<Set<number>> {
  switch (condition.kind) {
    case "SUPPLIER_PARTY": {
      // هم‌الگوی دقیق WarehouseReceipts.tsx فعلی: بر اساس Supplier.isActive (نه Party.isActive) فیلتر
      // می‌شود — طرف مقابل باید یک رکورد «تامین‌کننده»ی فعال مرتبط داشته باشد.
      const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, select: { partyId: true } });
      return new Set(suppliers.map((s) => s.partyId));
    }
  }
}

function partyTitle(p: { category: string; firstName: string | null; lastName: string | null; name: string | null }): string {
  return p.category === "INDIVIDUAL" ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() : p.name || "—";
}

/** فهرست گزینه‌های مجاز برای پیکر فرانت‌اند — فقط کد تفصیل و عنوان (طبق تصمیم صریح کاربر) */
export async function getDetailSelectorOptions(condition: DetailSelectorCondition): Promise<DetailSelectorOption[]> {
  const allowedIds = await resolveAllowedPartyIds(condition);
  if (allowedIds.size === 0) return [];
  const parties = await prisma.party.findMany({ where: { id: { in: Array.from(allowedIds) } }, orderBy: { id: "asc" } });
  return parties.map((p) => ({ code: p.detailCode, title: partyTitle(p) }));
}

/** اعتبارسنجی سمت بک‌اند در لحظه‌ی ذخیره — دقیقاً همان شرطی که فهرست فرانت‌اند از آن پر شده دوباره چک
 * می‌شود؛ خروجی id عددی طرف مقابل برای استفاده‌ی داخلی مسیر (مثلاً یافتن Supplier.id مرتبط) است. */
export async function assertDetailSelectorValid(code: string, condition: DetailSelectorCondition): Promise<{ id: number }> {
  const party = await prisma.party.findUnique({ where: { detailCode: code } });
  if (!party) throw new Error("کد تفصیل انتخاب‌شده یافت نشد");
  const allowedIds = await resolveAllowedPartyIds(condition);
  if (!allowedIds.has(party.id)) {
    throw new Error("طرف مقابل انتخاب‌شده با شرایط مجاز این فیلد مطابقت ندارد (باید تامین‌کننده‌ی فعال باشد)");
  }
  return { id: party.id };
}
