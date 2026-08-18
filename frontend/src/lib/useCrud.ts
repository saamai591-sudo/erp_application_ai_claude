import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { usePersistedState, hasPersistedState } from "./usePersistedState";

export function useCrud<T extends { id: number }>(basePath: string) {
  const [items, setItems] = usePersistedState<T[]>(basePath, []);
  const [loading, setLoading] = useState(!hasPersistedState(basePath));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(basePath);
      setItems(data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  // فقط در اولین mount واقعی (وقتی هنوز چیزی کش نشده) واکشی خودکار انجام می‌شود؛
  // با برگشتن به این تب بعد از رفتن به تب دیگر، دیتای قبلی حفظ می‌شود (بدون رفرش خودکار)
  useEffect(() => {
    if (!hasPersistedState(basePath)) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  async function create(body: any): Promise<{ ok: boolean; data?: T; error?: string; warning?: boolean }> {
    try {
      const data = await api.post(basePath, body);
      await reload();
      return { ok: true, data };
    } catch (e: any) {
      const err = e as ApiError;
      return { ok: false, error: err.message, warning: err.warning };
    }
  }

  async function remove(id: number): Promise<{ ok: boolean; error?: string }> {
    try {
      await api.del(`${basePath}/${id}`);
      await reload();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  return { items, loading, error, reload, create, remove, setError };
}
