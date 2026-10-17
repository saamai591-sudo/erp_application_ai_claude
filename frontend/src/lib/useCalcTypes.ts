import { useEffect, useState } from "react";
import { api } from "./api";

// «انواع محاسبه» حقوق (حقوق ماهانه = نوع پایه، عیدی، ذخیره سنوات، …) برای انتخابگرهای فرم‌های حقوق و دستمزد.
export interface CalcType {
  id: number;
  title: string;
  description: string | null;
  isBase: boolean;
  isActive: boolean;
  componentCount: number;
  slipCount: number;
}

/** فهرست انواع محاسبه؛ onlyActive فقط فعال‌ها (برای انتخاب در فرم‌ها). هر بار که فرم باز می‌شود تازه خوانده می‌شود */
export function useCalcTypes(onlyActive = true): { types: CalcType[]; base: CalcType | null; loaded: boolean } {
  const [all, setAll] = useState<CalcType[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api
      .get("/payroll-calc-types")
      .then((r: CalcType[]) => setAll(r))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  const types = onlyActive ? all.filter((t) => t.isActive) : all;
  return { types, base: all.find((t) => t.isBase) ?? null, loaded };
}
