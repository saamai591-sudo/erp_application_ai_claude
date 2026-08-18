import { useState } from "react";

export type SelectId = string | number;

interface ChainState {
  selections: Record<number, Set<SelectId>>;
  order: number[];
}

/**
 * مدیریت انتخاب چندگانه در چند تب، با مبنای «ترتیب زمانی انتخاب کاربر»:
 * - انتخاب/لغوانتخاب یک مورد در تبِ X، آن تب را به انتهای ترتیب زمانی (جدیدترین) منتقل می‌کند
 * - هر تبی که قبلاً (زودتر) در ترتیب زمانی لمس شده باشد، «بالادست» تب X محسوب می‌شود و روی آن اثر می‌گذارد
 * - اگر تب X پیش‌تر هم لمس شده بود، همه‌ی تب‌هایی که بعد از آن لمس شده بودند باطل و پاک می‌شوند
 * - اگر انتخاب یک تب کاملاً خالی شود، از ترتیب زمانی حذف می‌شود
 */
export function useChainedMultiSelect(initial?: ChainState) {
  const [state, setState] = useState<ChainState>(initial || { selections: {}, order: [] });

  function toggle(tabIndex: number, id: SelectId) {
    setState((prev) => {
      const newSet = new Set(prev.selections[tabIndex] || []);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);

      const existingIdx = prev.order.indexOf(tabIndex);
      let staleTabs: number[] = [];
      let baseOrder = prev.order;
      if (existingIdx !== -1) {
        staleTabs = prev.order.slice(existingIdx + 1);
        baseOrder = prev.order.slice(0, existingIdx);
      }

      const nextSelections: Record<number, Set<SelectId>> = { ...prev.selections };
      staleTabs.forEach((t) => delete nextSelections[t]);
      if (newSet.size > 0) nextSelections[tabIndex] = newSet;
      else delete nextSelections[tabIndex];

      const nextOrder = newSet.size > 0 ? [...baseOrder, tabIndex] : baseOrder;

      return { selections: nextSelections, order: nextOrder };
    });
  }

  function get(tabIndex: number): Set<SelectId> {
    return state.selections[tabIndex] || new Set();
  }

  /** فهرست تب‌هایی که پیش از tabIndex در ترتیب زمانی لمس شده‌اند (بالادست)؛ اگر خودِ tabIndex هنوز لمس نشده، کل ترتیب فعلی برگردانده می‌شود */
  function tabsBefore(tabIndex: number): number[] {
    const idx = state.order.indexOf(tabIndex);
    return idx === -1 ? state.order : state.order.slice(0, idx);
  }

  function reset() {
    setState({ selections: {}, order: [] });
  }

  return { selections: state.selections, order: state.order, toggle, get, tabsBefore, reset };
}
