import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "./api";
import { clearPermissionsCache } from "./usePermissions";
import { setAuthToken } from "./authToken";
import { resetPreferencesCache } from "./preferences";

interface AuthUser {
  id: number;
  mobile: string;
  firstName: string;
  lastName: string;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (mobile: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // عمداً هیچ تلاشی برای بازیابی نشست قبلی از localStorage/sessionStorage انجام نمی‌شود — طبق نیاز
  // صریح، هر تب باید یک نشست کاملاً مستقل داشته باشد و رفرش صفحه باید نشست را بی‌اعتبار کند؛ توکن فقط
  // در حافظه‌ی همین تب (authToken.ts) نگه داشته می‌شود، نه در چیزی که بین تب‌ها مشترک باشد یا از رفرش
  // جان سالم به در ببرد. پس loading همیشه false است و user همیشه با null شروع می‌شود.
  const [user, setUser] = useState<AuthUser | null>(null);
  const loading = false;

  async function login(mobile: string, password: string) {
    const data = await api.post("/auth/login", { mobile, password });
    setAuthToken(data.token);
    clearPermissionsCache();
    resetPreferencesCache();
    setUser(data.user);
  }

  function logout() {
    setAuthToken(null);
    clearPermissionsCache();
    resetPreferencesCache();
    setUser(null);
  }

  return <Ctx.Provider value={{ user, login, logout, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
