import { Dispatch, SetStateAction, useState } from "react";

// رفتار پایه‌ی گریدهای ردیفی اسناد — انتخاب یک ردیف + جابه‌جایی بالا/پایین + حذفِ ردیفِ انتخاب‌شده + فیلتر متنی.
// طبق تصمیم صریح کاربر («در base انجام بده، هر فرم فقط پیکربندی/استثنای خودش را بدهد») این منطق فقط یک‌بار
// اینجا پیاده شده؛ هر فرمی که گرید ردیفی دارد همین Hook را با آرایه‌ی ردیف‌های خودش صدا می‌زند، نه پیاده‌سازی
// جداگانه. انتخاب بر اساس اندیس (نه کلید ثابت هر ردیف) است — با جابه‌جایی، همان اندیسِ انتخاب‌شده هم عوض
// می‌شود تا هایلایت، ردیفِ واقعاً جابه‌جاشده را دنبال کند؛ چون هیچ فرمی مجبور به داشتن یک فیلد کلید یکتا
// روی ردیف‌هایش نیست (مثلاً ردیف‌های سند حسابداری چنین فیلدی ندارند).

export interface LineGridBase<T> {
  selectedIndex: number | null;
  select: (idx: number) => void;
  clearSelection: () => void;
  canDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveUp: () => void;
  moveDown: () => void;
  deleteSelected: () => void;
  /** حذف یک ردیف با اندیس مشخص (مثلاً از دکمه‌ی حذفِ خودِ ردیف) — انتخاب را هم در صورت نیاز به‌روز می‌کند */
  removeAt: (idx: number) => void;
  filterText: string;
  setFilterText: (v: string) => void;
  /** ردیف‌های قابل‌نمایش پس از فیلتر، همراه با اندیسِ واقعی‌شان در آرایه‌ی اصلی */
  visibleEntries: { row: T; idx: number }[];
}

export function useLineGridBase<T>(rows: T[], setRows: Dispatch<SetStateAction<T[]>>, searchableText?: (row: T) => string): LineGridBase<T> {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filterText, setFilterText] = useState("");

  function select(idx: number) {
    setSelectedIndex(idx);
  }
  function clearSelection() {
    setSelectedIndex(null);
  }

  function removeAt(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex((sel) => {
      if (sel === null) return sel;
      if (sel === idx) return null;
      return sel > idx ? sel - 1 : sel;
    });
  }
  function deleteSelected() {
    if (selectedIndex === null) return;
    removeAt(selectedIndex);
  }

  function moveUp() {
    if (selectedIndex === null || selectedIndex <= 0) return;
    const target = selectedIndex - 1;
    setRows((prev) => {
      const copy = [...prev];
      [copy[target], copy[selectedIndex]] = [copy[selectedIndex], copy[target]];
      return copy;
    });
    setSelectedIndex(target);
  }
  function moveDown() {
    if (selectedIndex === null || selectedIndex >= rows.length - 1) return;
    const target = selectedIndex + 1;
    setRows((prev) => {
      const copy = [...prev];
      [copy[selectedIndex], copy[target]] = [copy[target], copy[selectedIndex]];
      return copy;
    });
    setSelectedIndex(target);
  }

  function matches(row: T): boolean {
    const q = filterText.trim().toLowerCase();
    if (!q) return true;
    return (searchableText ? searchableText(row) : "").toLowerCase().includes(q);
  }
  const visibleEntries = rows.map((row, idx) => ({ row, idx })).filter(({ row }) => matches(row));

  return {
    selectedIndex,
    select,
    clearSelection,
    canDelete: selectedIndex !== null,
    canMoveUp: selectedIndex !== null && selectedIndex > 0,
    canMoveDown: selectedIndex !== null && selectedIndex < rows.length - 1,
    moveUp,
    moveDown,
    deleteSelected,
    removeAt,
    filterText,
    setFilterText,
    visibleEntries,
  };
}
