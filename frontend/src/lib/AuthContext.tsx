import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api, setUnauthorizedHandler } from "./api";
import { clearPermissionsCache } from "./usePermissions";
import { getAuthToken, setAuthToken } from "./authToken";
import { resetPreferencesCache } from "./preferences";

interface AuthUser {
  id: number;
  mobile: string;
  firstName: string;
  lastName: string;
  /** کاربر سبک: فقط کارتابل (موبایل) */
  isLight?: boolean;
}

interface AuthCtx {
  user: AuthUser | null;
  login: (mobile: string, password: string) => Promise<void>;
  logout: (message?: string) => void;
  loading: boolean;
  /** پیام خروج خودکار (عدم فعالیت/انقضا) برای نمایش در صفحه‌ی ورود؛ بعد از ورود موفق پاک می‌شود */
  notice: string | null;
}

// نشست با «عدم فعالیت» تمام می‌شود (زمان از سرور می‌آید، پیش‌فرض ۲۰ دقیقه). فعالیت = ورودی واقعی کاربر (ماوس، کیبورد، لمس، اسکرول)؛
// درخواست‌های پس‌زمینه فعالیت حساب نمی‌شوند. تا وقتی کاربر فعال است توکن هر چند دقیقه یک‌بار بی‌صدا تمدید می‌شود.
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
const DEFAULT_IDLE_MINUTES = 20;

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // عمداً هیچ تلاشی برای بازیابی نشست قبلی از localStorage/sessionStorage انجام نمی‌شود — طبق نیاز
  // صریح، هر تب باید یک نشست کاملاً مستقل داشته باشد و رفرش صفحه باید نشست را بی‌اعتبار کند؛ توکن فقط
  // در حافظه‌ی همین تب (authToken.ts) نگه داشته می‌شود، نه در چیزی که بین تب‌ها مشترک باشد یا از رفرش
  // جان سالم به در ببرد. پس loading همیشه false است و user همیشه با null شروع می‌شود.
  const [user, setUser] = useState<AuthUser | null>(null);
  const loading = false;
  const [notice, setNotice] = useState<string | null>(null);
  const idleMsRef = useRef(DEFAULT_IDLE_MINUTES * 60_000);
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(Date.now());

  async function login(mobile: string, password: string) {
    const data = await api.post("/auth/login", { mobile, password });
    setAuthToken(data.token);
    idleMsRef.current = Math.max(1, Number(data.idleMinutes) || DEFAULT_IDLE_MINUTES) * 60_000;
    lastActivityRef.current = Date.now();
    lastRefreshRef.current = Date.now();
    clearPermissionsCache();
    resetPreferencesCache();
    setNotice(null);
    setUser(data.user);
  }

  function logout(message?: string) {
    setAuthToken(null);
    clearPermissionsCache();
    resetPreferencesCache();
    setNotice(message ?? null);
    setUser(null);
  }

  // ۴۰۱ هر درخواستی ⇒ خروج با پیام (توکن منقضی شده)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (getAuthToken()) logout("نشست شما پایان یافت؛ لطفاً دوباره وارد شوید.");
    });
    return () => setUnauthorizedHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تایمر عدم فعالیت + تمدید نشست (فقط وقتی کاربر وارد است)
  useEffect(() => {
    if (!user) return;
    let busy = false;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true, capture: true });

    async function tick() {
      if (busy || !getAuthToken()) return;
      const now = Date.now();
      const idle = now - lastActivityRef.current;
      if (idle >= idleMsRef.current) {
        const minutes = Math.round(idleMsRef.current / 60_000);
        logout(`به‌دلیل عدم فعالیت بیش از ${minutes} دقیقه از سیستم خارج شدید؛ لطفاً دوباره وارد شوید.`);
        return;
      }
      // کاربر بعد از آخرین تمدید فعال بوده و نیمی از عمر توکن گذشته ⇒ تمدید بی‌صدا
      if (now - lastRefreshRef.current >= idleMsRef.current * 0.5 && lastActivityRef.current > lastRefreshRef.current) {
        busy = true;
        try {
          const r = await api.post("/auth/refresh", {});
          if (r?.token && getAuthToken()) {
            setAuthToken(r.token);
            lastRefreshRef.current = Date.now();
            if (r.idleMinutes) idleMsRef.current = Number(r.idleMinutes) * 60_000;
          }
        } catch {
          // قطع موقت شبکه: دور بعدی دوباره تلاش می‌شود؛ ۴۰۱ را api.ts به خروج تبدیل می‌کند
        } finally {
          busy = false;
        }
      }
    }
    const timer = window.setInterval(tick, 15_000);
    // موبایل: تایمر در پس‌زمینه متوقف می‌شود؛ هنگام برگشت به صفحه فوراً بررسی کن
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <Ctx.Provider value={{ user, login, logout, loading, notice }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
